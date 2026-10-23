// The town plan (the owner: "Is there any way to have more thought go into the town layout? It seems so random").
// Early on the planner lays down a plan from the seat and the land (`makeLayout`, kept on `GameState.layout`): a square
// in front of the seat, with the fire on it; a high street through the square west and east to the ring's
// gates, and a road south from it to the south gate; and side streets every `BLOCK` rows, crossed by lanes every
// `CROSS` columns, so the town is laid out in blocks. Every kind of building has its quarter (`zoneOf`): the shop, the
// tavern, the temple and the well on the square; the storehouses at its edge on the craft side; the workshops, kilns
// and smithies in a craft quarter downwind (one side, `TownLayout.craft`); homes in rows along the side streets on
// the other side and to the north and south; the library and the tower beside the seat; the barracks by the south
// gate; the graveyard and memorials at the edge; fields and pens in a belt outside the homes. `layoutSpot` (asked by
// planner.ts `findSpot`) picks the best free spot of the building's quarter: its door on a street, its walls clear of
// the streets to come, beside its own kind, never a cell's sliver from a neighbour. The plan lays no street itself
// (the owner's ask: the founder draws every path, sim/pathPlans.ts): its lines are kept clear for the paths to come.
// Each people lays its town its own way (`STYLE_OF`): most in blocks; the machines on a tighter grid; the pack, the
// orcs and the nomads once settled in rings round the fire; the druids and the fae in a glade with no straight lines.
// An older town gets a plan fitted round what stands (`fitted`): only what is built after follows it.

import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { CROPS } from '../data/crops';
import { HERDS } from '../data/livestock';
import { RESEARCH_STATIONS } from '../data/research';
import { MAGIC_BUILDINGS } from '../data/magic';
import { isSeat } from '../data/seats';
import { depthOf, doorCell, footprint } from './buildings';
import { castleCells, castleGate, castleOn } from './castle';
import { rectExplored } from './fog';
import { buildable, doorOf, groundAt, idx, inMap, isOpen, isPlannedRoad, isRoad, wet, wildToClear, touchesWater, type Pt, type Rect } from './land';
import { nomadic } from './nomads';
import { isRingPiece, ringShapeOf, ringWallCells, shapeTest } from './ringWall';
import { seaBuild } from './sea';
import { campCell, type GameState } from './state';
import { hashSeed } from '../rng';
import { TICKS_PER_HOUR } from './time';
import { hillShare } from './hills';
import { SLOPE_CROPS } from '../data/hills';

/** Side streets run west to east every this many rows (three rows of buildings between, their doors on the street
 *  below them). */
export const BLOCK = 4;
/** Lanes run north to south every this many columns (the machines' grid is tighter: `CROSS_TIGHT`). */
export const CROSS = 11;
export const CROSS_TIGHT = 8;
/** The square: this many cells wide (an odd number, the seat's door in its middle) and deep. */
export const SQUARE_W = 11;
export const SQUARE_H = 5;
/** The town's core is never reckoned smaller than this (cells from the square's middle). */
export const CORE_MIN = 6;
/** How far past the core a building of the town looks for a spot (fields further: `FARM_REACH`). */
export const SPOT_REACH = 14;
export const FARM_REACH = 20;

/** How a people lays out its town: in blocks (`grid`), or in rings round the fire with no grid (`ring`), or loosely, as
 *  a glade (`glade`, no straight lines). */
export type LayoutStyle = 'grid' | 'ring' | 'glade';
export const STYLE_OF: Record<string, LayoutStyle> = {
  settlers: 'grid',
  knights: 'grid',
  alchemists: 'grid',
  robot: 'grid',
  lich: 'grid',
  vampire: 'grid',
  dwarves: 'grid',
  merfolk: 'grid',
  nomads: 'ring',
  werewolf: 'ring',
  orcs: 'ring',
  druid: 'glade',
  fae: 'glade',
};
/** What the plan is called, for the Town tab (one line). */
export const STYLE_NAMES: Record<string, string> = {
  settlers: 'a market town in blocks round its square',
  knights: 'a keep and its bailey, the town in blocks below',
  alchemists: 'a town laid out by the book, in blocks',
  robot: 'a grid, every street square to the next',
  lich: 'a necropolis: the crypt and the graves at its heart',
  vampire: 'the castle, and its town in blocks before the gate',
  dwarves: "the hold's halls, and the yards before its gate",
  merfolk: 'a town along the shore',
  nomads: 'a wagon ring round the fire',
  werewolf: 'dens in a ring round the fire',
  orcs: 'a stockade of huts round the fire',
  druid: 'a glade, its homes among the trees',
  fae: 'a glade, with no straight line in it',
};

/** The quarter of the town a kind of building belongs in. */
export type Zone = 'square' | 'civic' | 'home' | 'craft' | 'store' | 'learned' | 'guard' | 'farm' | 'edge' | 'shore' | 'defense';

export interface TownLayout {
  /** The square (cells): the seat's door on its top edge, the high street along its bottom edge. */
  sq: Rect;
  /** The high street's row and the south road's column (the square's middle). */
  row: number;
  col: number;
  /** The side the craft quarter lies on (downwind): -1 west, 1 east. */
  craft: -1 | 1;
  style: LayoutStyle;
  /** Fitted round a town that stood before the plan (only what is built after follows it). */
  fitted?: boolean;
}

/** The town's plan, if it has one. */
export const layoutOf = (s: Pick<GameState, 'layout'>): TownLayout | null => s.layout ?? null;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const cross = (s: Pick<GameState, 'origin'>) => (s.origin === 'robot' ? CROSS_TIGHT : CROSS);

/** Whether a cell lies on one of the plan's lines: a side street's row, a lane's column, or the square. */
export function onPlanLine(s: Pick<GameState, 'layout' | 'origin'>, x: number, y: number): boolean {
  const L = s.layout;
  if (!L) return false;
  if (inSquare(L, x, y)) return true;
  if (L.style !== 'grid') return y === L.row || (x === L.col && y > L.sq.y);
  return mod(y - L.row, BLOCK) === 0 || mod(x - L.col, cross(s)) === 0;
}
const inSquare = (L: TownLayout, x: number, y: number) => x >= L.sq.x && x < L.sq.x + L.sq.w && y >= L.sq.y && y < L.sq.y + L.sq.h;

/** The quarter a building belongs in. */
export function zoneOf(def: BuildingDef, s?: Pick<GameState, 'origin'>): Zone {
  const id = def.id;
  if (id === 'well' || id === 'statue' || id === 'god_idol' || id === 'victory_monument') return 'square';
  if (isSeat(id) || def.floor) return 'civic';
  if (CROPS[id] || HERDS[id] || id === 'windmill' || id === 'stable' || id === 'beast_ranch' || id === 'creature_pen' || id === 'kennels') return 'farm';
  if (def.shore || def.onWater) return 'shore';
  if (def.defense) return 'defense';
  if (def.housing) return 'home';
  if (def.storage) return 'store';
  // (the dead: at the edge of town, but at the heart of a necropolis)
  if (id === 'graveyard') return s?.origin === 'lich' ? 'civic' : 'edge';
  if (id === 'resurrection_shrine' || id === 'cult_altar' || id === 'ward_stone' || id === 'launch_site' || id === 'airship_mast' || id === 'deep_shaft' || id === 'portal_arch' || id === 'portal_rift' || id === 'arena') return 'edge';
  if (RESEARCH_STATIONS[id] || MAGIC_BUILDINGS.some((m) => m.id === id) || id === 'school' || id === 'arcane_academy') return 'learned';
  if (id === 'barracks' || id === 'drill_yard' || id === 'archery_range' || id === 'siege_workshop' || id === 'watchtower' || id === 'lookout' || id === 'trophy_hall' || id === 'armourer' || id === 'monster_guild' || id === 'sparring_yard' || def.cells) return 'guard';
  if (def.morale || def.healing || id === 'elder_lodge' || id === 'town_hall') return 'civic';
  return 'craft';
}

/** The plan's anchor: the cell before the seat's door (a castle's or a hold's gate; the camp's, without a seat). */
function anchorOf(s: GameState): Pt {
  if (castleOn(s)) return castleGate(s);
  const seat = s.buildings.find((b) => isSeat(b.def) && !b.room);
  if (seat) return doorCell(seat);
  const c = campCell(s);
  return { x: c.x, y: c.y - 2 };
}

/** Lay down the town's plan (once: the autopilot's first pass, or an older town's first pass since). */
export function ensureLayout(s: GameState): TownLayout | null {
  if (s.layout) return s.layout;
  if (s.autopilot === false || nomadic(s)) return null;
  const L = makeLayout(s);
  s.layout = L;
  return L;
}

export function makeLayout(s: GameState): TownLayout {
  const a = anchorOf(s);
  const style = STYLE_OF[s.origin ?? 'settlers'] ?? 'grid';
  const sq = { x: a.x - Math.floor(SQUARE_W / 2), y: a.y, w: SQUARE_W, h: SQUARE_H };
  // (downwind: the craft quarter's side, the town's own draw: a side stream, so no town's own draws change)
  const craft = (hashSeed(`${s.seed}:layout`) & 1 ? 1 : -1) as -1 | 1;
  return { sq, row: sq.y + sq.h - 1, col: a.x, craft, style, ...(s.tick >= TICKS_PER_HOUR ? { fitted: true } : {}) };
}

/** The quarters people live and trade in (the fields' belt lies beyond them). */
const HOMELY: readonly Zone[] = ['home', 'civic', 'store', 'square'];

/** The town's core: how far its furthest building (but its fields, defences, walls, guard and outliers; or only those
 *  of the quarters given) stands from the square's middle (chessboard cells). */
export function coreRadius(s: GameState, L: TownLayout, only?: readonly Zone[]): number {
  let r = CORE_MIN;
  for (const b of s.buildings) {
    const def = BUILDING_BY_ID[b.def];
    // (a castle's or a hold's rooms are the castle's: the town outside lays out round its gate)
    if (!def || b.room || isRingPiece(b.def) || (def.hp && def.width <= 2 && !def.housing)) continue;
    const z = zoneOf(def, s);
    if (only ? !only.includes(z) : z === 'farm' || z === 'defense' || z === 'edge' || z === 'shore' || z === 'guard') continue;
    const f = footprint(b);
    r = Math.max(r, Math.abs(f.x - L.col), Math.abs(f.x + f.w - 1 - L.col), Math.abs(f.y - L.row), Math.abs(f.y + f.h - 1 - L.row));
  }
  return r;
}

/* ------------------------------------------------------------ spots */

/** Each wild cell a spot would clear counts this much against it (as planner.ts `WILD_SPOT_COST`); a spot across
 *  the water from the square, this much (the town keeps to its own bank of a river). */
const WILD_COST = 1.5;
export const ACROSS_COST = 20;

/** The best spot of a building's quarter (its top-left cell), or null to fall back on the old way (planner.ts
 *  `findSpot`). The candidates are every top-left within reach of the square; each must fit (over the wild too),
 *  keep its door free, stand clear of the square, the main streets and (in blocks) every street to come with its
 *  door on one; the best is the lowest score: how far from where its quarter wants it, plus a sliver left beside a
 *  neighbour, less standing shoulder to shoulder with its own kind. */
export function layoutSpot(s: GameState, def: BuildingDef): (Pt & { wild?: true }) | null {
  const L = s.layout;
  if (!L || s.autopilot === false || nomadic(s) || seaBuild(s, def)) return null;
  const m = s.land;
  const zone = zoneOf(def, s);
  const w = def.width, h = depthOf(def);
  const grid = L.style === 'grid';
  const cx = cross(s);
  const R = coreRadius(s, L);
  // (the box round the homes, the square and the stores: the fields lie just outside it, close for the farmers' walk)
  const homely = { x0: L.sq.x, y0: L.sq.y - 3, x1: L.sq.x + L.sq.w - 1, y1: L.sq.y + L.sq.h - 1 };
  for (const b of s.buildings) {
    const bd = BUILDING_BY_ID[b.def];
    if (!bd || b.room || !HOMELY.includes(zoneOf(bd, s))) continue;
    const f = footprint(b);
    homely.x0 = Math.min(homely.x0, f.x);
    homely.y0 = Math.min(homely.y0, f.y);
    homely.x1 = Math.max(homely.x1, f.x + f.w - 1);
    homely.y1 = Math.max(homely.y1, f.y + f.h - 1);
  }
  const reach = zone === 'farm' || zone === 'edge' ? R + FARM_REACH : R + SPOT_REACH;
  const castle = castleOn(s) ? castleCells(s) : null;
  const wall = s.ring ? ringWallCells(s) : null;
  // (inside the ring wall's shape)
  const inRing = s.ring ? shapeTest(ringShapeOf(s), s.ring.rect) : null;
  // (who stands where, indexed once: 1 + the building's place in the list)
  const occ = new Int32Array(m.w * m.h);
  s.buildings.forEach((b, k) => {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (inMap(m, x, y)) occ[y * m.w + x] = k + 1;
  });
  const zoneAt = new Map<number, Zone>();
  const zoneOfAt = (k: number) => {
    let z = zoneAt.get(k);
    if (z === undefined) zoneAt.set(k, (z = zoneOf(BUILDING_BY_ID[s.buildings[k - 1].def] ?? def, s)));
    return z;
  };
  const taken = (x: number, y: number) => inMap(m, x, y) && occ[y * m.w + x] > 0;
  const street = (x: number, y: number) => isRoad(m, x, y) || isPlannedRoad(m, x, y);
  // where each quarter wants to be (u: toward the craft side, v: south of the high street)
  // (the homes' reach: the guard, the defences and the graveyard keep to it, so the town stays compact in its wall)
  const Rh = coreRadius(s, L, HOMELY);
  const anchor = guardAnchor(s, L, Rh);
  let fertileOf = (_r: Rect) => 0;
  const score = (r: Rect): number => {
    const mx = r.x + r.w / 2 - 0.5, my = r.y + r.h / 2 - 0.5;
    const u = (mx - L.col) * L.craft, v = my - L.row;
    const d = Math.max(Math.abs(mx - L.col), Math.abs(my - L.row));
    const gap = rectGap(r, L.sq);
    let z = 0;
    switch (zone) {
      case 'square':
      case 'civic':
        z = gap * 4 + d * 0.2;
        break;
      case 'store':
        z = Math.abs(gap - 1) * 2 + Math.max(0, 2 - u) * 1.5 + d * 0.3;
        break;
      case 'learned':
        z = Math.hypot(u + 5, my - (L.sq.y - 2)) * 1.5;
        break;
      case 'home': {
        // (off the craft side; south and north of the square too, once past its flanks)
        const off = Math.abs(v) >= BLOCK ? Math.max(0, u - 2) : Math.max(0, u + 3);
        z = off * 3 + d * (L.style === 'ring' ? 0.5 : 1) + (L.style === 'ring' ? Math.max(0, 5 - d) * 3 : 0);
        break;
      }
      case 'craft':
        z = Math.max(0, 6 - u) * 3 + Math.abs(v) * 0.5 + d * 0.4;
        break;
      case 'guard':
        z = Math.hypot(mx - anchor.x, my - anchor.y) * 1.5;
        break;
      case 'edge':
        // (behind the seat, on the homes' side: a churchyard at the back of the town)
        z = Math.hypot(u + 4, my - (L.sq.y - 6)) * 1.2;
        break;
      case 'farm': {
        const fertile = fertileOf(r);
        const amid = r.x <= homely.x1 + 1 && r.x + r.w - 1 >= homely.x0 - 1 && r.y <= homely.y1 + 1 && r.y + r.h - 1 >= homely.y0 - 1;
        z = (amid ? 8 : 0) + d * 0.8 + Math.max(0, u) * 0.3 - (fertile / (r.w * r.h)) * 3;
        // (on a land with hills, sim/hills.ts: orchards, vineyards, herds and the windmill up on them, the rest below)
        if (m.relief) z += hillShare(m, r) * (SLOPE_CROPS.has(def.id) || HERDS[def.id] || def.id === 'windmill' ? -3 : 2);
        break;
      }
      case 'defense':
        z = Math.abs(d - Rh) * 1.5 + Math.min(Math.abs(my - L.row), Math.abs(mx - L.col)) * 0.6;
        if (m.relief) z -= hillShare(m, r, true) * 3; // (a tower on the high ground sees further)
        break;
      case 'shore':
        z = d * 0.5;
        break;
    }
    // (on the square's own bank: across a river is a long walk round, or a bridge)
    if (zone !== 'shore' && !bank[Math.round(my) * m.w + Math.round(mx)]) z += ACROSS_COST;
    // (inside the ring wall, but the fields and the edge's outliers)
    if (inRing && zone !== 'farm' && zone !== 'edge' && !(inRing(r.x, r.y) && inRing(r.x + r.w - 1, r.y) && inRing(r.x, r.y + r.h - 1) && inRing(r.x + r.w - 1, r.y + r.h - 1))) z += 8;
    // (no sliver of a cell between it and a neighbour, beside it or behind it)
    const sliverX = (x: number) => {
      for (let y = r.y; y < r.y + r.h; y++) if (!taken(x, y) && !street(x, y) && taken(x + (x < r.x ? -1 : 1), y)) return true;
      return false;
    };
    if (sliverX(r.x - 1) || sliverX(r.x + r.w)) z += 6;
    for (let x = r.x; x < r.x + r.w; x++)
      if (!taken(x, r.y - 1) && !street(x, r.y - 1) && taken(x, r.y - 2) && !(grid && mod(r.y - 1 - L.row, BLOCK) === 0)) {
        z += 4;
        break;
      }
    // (shoulder to shoulder with its own kind: homes in a row, the workshops together)
    for (const x of [r.x - 1, r.x + r.w])
      for (let y = r.y; y < r.y + r.h; y++)
        if (taken(x, y) && zoneOfAt(occ[y * m.w + x]) === zone) {
          z -= 3;
          break;
        }
    // (a door on a street already there, or planned)
    const door = doorOf(r);
    if (street(door.x, door.y)) z -= 1;
    return z;
  };
  // (the land on the square's own side of the water: flooded out from it over dry ground)
  const bank = new Uint8Array(m.w * m.h);
  {
    const q = [idx(m, L.col, L.row)];
    bank[q[0]] = 1;
    for (let k = 0; k < q.length; k++) {
      const x = q[k] % m.w, y = Math.floor(q[k] / m.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(m, nx, ny) || Math.abs(nx - L.col) > reach + 8 || Math.abs(ny - L.row) > reach + 8) continue;
        const i = ny * m.w + nx;
        if (bank[i] || wet(groundAt(m, nx, ny)) || groundAt(m, nx, ny) === 'mountain') continue;
        bank[i] = 1;
        q.push(i);
      }
    }
  }
  // (what each cell of the search's box allows, summed over areas so a footprint is checked at a glance: what may not
  // be built on at all; a lane's column and a side street's row (in blocks); the wild to clear; good soil; the castle)
  const o = { x: L.col, y: L.row };
  const bx = o.x - reach - 2, by = o.y - reach - 2;
  const BW = 2 * reach + w + 5, BH = 2 * reach + h + 5;
  const lines = grid && zone !== 'farm';
  const sat = (f: (x: number, y: number) => boolean) => {
    const a = new Int32Array((BW + 1) * (BH + 1));
    for (let j = 0; j < BH; j++)
      for (let i = 0, row = 0; i < BW; i++) {
        row += f(bx + i, by + j) ? 1 : 0;
        a[(j + 1) * (BW + 1) + i + 1] = a[j * (BW + 1) + i + 1] + row;
      }
    return (x: number, y: number, ww: number, hh: number) => {
      const i0 = x - bx, j0 = y - by;
      return a[(j0 + hh) * (BW + 1) + i0 + ww] - a[j0 * (BW + 1) + i0 + ww] - a[(j0 + hh) * (BW + 1) + i0] + a[j0 * (BW + 1) + i0];
    };
  };
  const bad = sat((x, y) => {
    if (!isOpen(m, x, y) || taken(x, y) || street(x, y) || inSquare(L, x, y)) return true;
    if (!rectExplored(s, x, y, 1, 1)) return true; // (the fog: sim/fog.ts)
    if (!buildable(groundAt(m, x, y)) && !wildToClear(m, x, y)) return true;
    if (wall && wall.has(y * m.w + x)) return true;
    // (the main streets' lines are kept clear everywhere: the high street, the road south)
    return y === L.row || (x === L.col && y > L.row);
  });
  const lane = sat((x) => lines && mod(x - L.col, cx) === 0);
  const sideRow = sat((_x, y) => lines && mod(y - L.row, BLOCK) === 0);
  const wildSum = sat((x, y) => !buildable(groundAt(m, x, y)));
  const fertileSum = sat((x, y) => groundAt(m, x, y) === 'fertile');
  const castleSum = castle ? sat((x, y) => inMap(m, x, y) && castle.has(y * m.w + x)) : null;
  fertileOf = (r) => fertileSum(r.x, r.y, r.w, r.h);
  let best: Rect | null = null;
  let bestScore = Infinity;
  let bestWild = 0;
  for (let y = o.y - reach; y <= o.y + reach; y++)
    for (let x = o.x - reach; x <= o.x + reach; x++) {
      if (bad(x, y, w, h) || lane(x, y, w, h)) continue;
      // (a side street's row: only the top row of a building four deep may stand over one not yet planned)
      if (h >= BLOCK ? sideRow(x, y + 1, w, h - 1) : sideRow(x, y, w, h)) continue;
      const door = { x: x + Math.floor(w / 2), y: y + h };
      // (a door on a side street: the row below it is one of the plan's)
      if (grid && zone !== 'farm' && zone !== 'defense' && zone !== 'square' && zone !== 'shore' && mod(door.y - L.row, BLOCK) !== 0 && !(zone === 'civic' && inSquare(L, door.x, door.y))) continue;
      if (!isOpen(m, door.x, door.y) || taken(door.x, door.y) || wet(groundAt(m, door.x, door.y)) || !rectExplored(s, door.x, door.y, 1, 1)) continue;
      if (castleSum && castleSum(x - 1, y - 1, w + 2, h + 2)) continue;
      const r = { x, y, w, h };
      if (def.shore && !touchesWater(m, r)) continue;
      const wild = wildSum(x, y, w, h);
      const sc = score(r) + wild * WILD_COST;
      if (sc < bestScore) {
        bestScore = sc;
        best = r;
        bestWild = wild;
      }
    }
  if (!best) return null;
  return { x: best.x, y: best.y, ...(bestWild ? { wild: true as const } : {}) };
}

/** The gap in cells between two boxes (0 touching or overlapping). */
const rectGap = (a: Rect, b: Rect) => Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));

/** Where the guard's quarter goes: by the ring's south gate (its nearest to the road south), or where it will stand. */
function guardAnchor(s: GameState, L: TownLayout, R: number): Pt {
  const want = { x: L.col + 3, y: L.row + R };
  const gates = s.ring?.gates ?? [];
  if (!gates.length) return want;
  const g = gates.reduce((a, b) => (Math.hypot(b.x - want.x, b.y - want.y) < Math.hypot(a.x - want.x, a.y - want.y) ? b : a));
  // (a few cells in from the gate, toward the square)
  const dx = Math.sign(L.col - g.x), dy = Math.sign(L.row - g.y);
  return { x: g.x + dx * 4, y: g.y + dy * 4 };
}
