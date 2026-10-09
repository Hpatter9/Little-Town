// A castle town (the Blood Court: `castle` in data/origins.ts): one castle in the middle of the land, not a town of
// separate buildings. Its buildings (`roomKind`) are rooms of the castle: each new one is built on to it, sharing a
// wall with the hall at the camp (`coreRect`) or with a room already standing, so the castle grows outward room by
// room and is walled all round (the renderer: map/castleArt.ts). Fields, pens, mines, the graveyard, the shop and the
// tavern stay outside, a cell clear of its walls. Inside, people walk through the rooms (sim/walk.ts lets them), a
// room's door is its own middle, and roads run to the gate in the hall's south wall, never inside.

import type { BuildingDef } from '../data/buildings';
import { rulesOf } from '../data/origins';
import { carvable, groundAt, idx, inMap, MOUNTAIN_FOOT, setGround, type LandMap, type Pt, type Rect } from './land';
import { footprint } from './buildings';
import { campCell, type GameState } from './state';

/** The hall at the camp: the castle's first cells, which the rooms are built on to. */
export const CORE_W = 6;
export const CORE_H = 4;
/** The widest a room may be. */
export const ROOM_MAX_W = 12;
/** Built outside, never as rooms (the venues keep their own halls too: `floor` on the def). */
const OUTSIDE = new Set(['boatyard', 'graveyard', 'mine', 'coal_mine', 'deep_mine', 'oil_derrick', 'launch_site']);

type CastleState = Pick<GameState, 'land' | 'nomad' | 'buildings' | 'origin'>;

/** What kind of hold the town is: a castle standing on the land (the vampires), a hold carved into the mountain (the
 *  dwarves), or none. */
export type Hold = 'castle' | 'mountain';
export const holdOf = (s: Pick<GameState, 'origin'>): Hold | null => (rulesOf(s).castle ? 'castle' : rulesOf(s).hold === 'mountain' ? 'mountain' : null);
export const castleOn = (s: Pick<GameState, 'origin'>) => holdOf(s) !== null;

/** Whether a kind of building goes into the castle, as a room. */
export const roomKind = (s: Pick<GameState, 'origin'>, def: BuildingDef) => castleOn(s) && def.layer === 'mid' && !OUTSIDE.has(def.id) && !def.floor && def.width <= ROOM_MAX_W;

/** The castle's rooms (built or being built). */
export const rooms = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.room);

/** The hall's ground, in cells: over the camp for a castle; cut into the mountain's foot above the camp for a mountain
 *  hold, its gate opening onto the terrain. */
export function coreRect(s: Pick<GameState, 'land' | 'nomad' | 'origin'>): Rect {
  const c = campCell(s);
  if (holdOf(s) === 'mountain') return { x: c.x - Math.floor(CORE_W / 2), y: c.y - MOUNTAIN_FOOT - CORE_H + 1, w: CORE_W, h: CORE_H };
  return { x: c.x - Math.floor(CORE_W / 2), y: c.y - Math.floor(CORE_H / 2), w: CORE_W, h: CORE_H };
}

/** Cut a room's ground out of the mountain (a mountain hold: its cells become hall, walked through). */
export function carve(s: Pick<GameState, 'land'>, r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(s.land, x, y) && groundAt(s.land, x, y) === 'mountain') setGround(s.land, x, y, 'hall');
}

/** Whether every cell of a footprint is the mountain's (or already cut), where a mountain hold's rooms go. */
export function inMountain(m: LandMap, r: Rect): boolean {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!inMap(m, x, y) || !carvable(groundAt(m, x, y))) return false;
  return true;
}

/** Every cell of the castle: the hall's and its rooms', as land indices; in a mountain hold every cell cut out of the
 *  rock besides (the galleries dug for ore), since a new hall may be carved off a gallery. */
export function castleCells(s: CastleState): Set<number> {
  const m = s.land;
  const out = new Set<number>();
  const add = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(m, x, y)) out.add(idx(m, x, y));
  };
  add(coreRect(s));
  for (const b of rooms(s)) add(footprint(b));
  if (holdOf(s) === 'mountain') for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === 'H') out.add(i);
  return out;
}

/** The cell in front of the gate: outside the hall's south wall, in the middle (where the roads run to). */
export function castleGate(s: Pick<GameState, 'land' | 'nomad' | 'origin'>): Pt {
  const c = coreRect(s);
  return { x: c.x + Math.floor(c.w / 2), y: c.y + c.h };
}

/** The smallest rectangle round the whole castle. */
export function castleBounds(s: CastleState): Rect {
  let r = coreRect(s);
  for (const b of rooms(s)) {
    const f = footprint(b);
    const x = Math.min(r.x, f.x);
    const y = Math.min(r.y, f.y);
    r = { x, y, w: Math.max(r.x + r.w, f.x + f.w) - x, h: Math.max(r.y + r.h, f.y + f.h) - y };
  }
  return r;
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The castle's cells that nothing may be built over: the hall's and its rooms' (a mountain hold's galleries may be
 *  carved into a room). */
export function solidCells(s: CastleState): Set<number> {
  const m = s.land;
  const out = new Set<number>();
  const add = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(m, x, y)) out.add(idx(m, x, y));
  };
  add(coreRect(s));
  for (const b of rooms(s)) add(footprint(b));
  return out;
}

/** How many of a footprint's cell edges lie against the castle (its snugness), or -1 if it overlaps what may not be
 *  built over (`solid`: the castle's cells themselves, unless given). */
export function sharedEdges(cells: Set<number>, m: LandMap, r: Rect, solid: Set<number> = cells): number {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (inMap(m, x, y) && solid.has(idx(m, x, y))) return -1;
      for (const [dx, dy] of SIDES) if (inMap(m, x + dx, y + dy) && cells.has(idx(m, x + dx, y + dy))) n++;
    }
  return n;
}

/** Whether a footprint can be built on to the castle: clear of its cells, sharing at least one wall with it. */
export const joinsCastle = (cells: Set<number>, m: LandMap, r: Rect, solid?: Set<number>) => sharedEdges(cells, m, r, solid) > 0;

/** Whether a footprint comes within `gap` cells of the castle (where nothing but a room may stand). */
export function nearCastle(cells: Set<number>, m: LandMap, r: Rect, gap = 1): boolean {
  for (let y = r.y - gap; y < r.y + r.h + gap; y++) for (let x = r.x - gap; x < r.x + r.w + gap; x++) if (inMap(m, x, y) && cells.has(idx(m, x, y))) return true;
  return false;
}

/** Whether a cell is the castle's (its hall or a room). */
export const inCastle = (s: CastleState, x: number, y: number) => castleOn(s) && inMap(s.land, x, y) && castleCells(s).has(idx(s.land, x, y));

/** How many cells the castle's rooms stand on. */
export function roomCells(s: Pick<GameState, 'buildings'>): number {
  return rooms(s).reduce((n, b) => {
    const f = footprint(b);
    return n + f.w * f.h;
  }, 0);
}

/* ------------------------------------------------------------ walls, doorways and the gate (walking) */

/** Which region each castle cell is in (the hall -1, each room its building's id, each separate run of a hold's dug
 *  galleries -2, -3, ...), the doorways cut between regions (`doorsOf`: keys `x,y|h` for the edge between a cell and
 *  the one above it, `x,y|v` for the one to its left), and the gate: the cell before it and the hall's cell inside it. */
export interface CastleLayout {
  region: Map<number, number>;
  doors: Set<string>;
  gateOut: number;
  gateIn: number;
  /** Every way in or out: the gate before the hall, then the side gates a growing castle opens (`sideGates`). */
  gates: CastleGate[];
}

/** A gate: the castle cell inside it, the cell outside it, and which wall it's in. */
export interface CastleGate {
  inside: Pt;
  outside: Pt;
  side: 'n' | 's' | 'w' | 'e';
}

/** A castle on the land opens another gate for every `ROOMS_PER_GATE` rooms, up to `GATES_MOST` in all, so the
 *  townsfolk aren't all squeezed through one (the owner's ask; a mountain hold keeps its one carved gate). */
export const ROOMS_PER_GATE = 4;
export const GATES_MOST = 4;

const SIDE_STEP: Record<CastleGate['side'], [number, number]> = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

/** The side gates: each on the outer wall, on firm open ground outside, as far as can be from the gates already there. */
function sideGates(s: CastleState, region: Map<number, number>, main: CastleGate): CastleGate[] {
  if (holdOf(s) !== 'castle') return [];
  const want = Math.min(GATES_MOST, 1 + Math.floor(rooms(s).length / ROOMS_PER_GATE)) - 1;
  if (want <= 0) return [];
  const m = s.land;
  const built = new Set<number>();
  for (const b of s.buildings) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (inMap(m, x, y)) built.add(idx(m, x, y));
  }
  const cands: CastleGate[] = [];
  for (const [i, id] of region) {
    if (id <= -2) continue; // (not a hold's galleries)
    const x = i % m.w;
    const y = (i - x) / m.w;
    for (const side of ['s', 'e', 'w', 'n'] as const) {
      const [dx, dy] = SIDE_STEP[side];
      const ox = x + dx;
      const oy = y + dy;
      if (!inMap(m, ox, oy)) continue;
      const o = idx(m, ox, oy);
      if (region.has(o) || built.has(o)) continue;
      const g = groundAt(m, ox, oy);
      if (g === 'water' || g === 'mountain' || g === 'shallows') continue;
      cands.push({ inside: { x, y }, outside: { x: ox, y: oy }, side });
    }
  }
  const gates = [main];
  const out: CastleGate[] = [];
  for (let k = 0; k < want && cands.length; k++) {
    let best = -1;
    let bestD = -1;
    for (let c = 0; c < cands.length; c++) {
      const d = Math.min(...gates.map((q) => Math.abs(q.inside.x - cands[c].inside.x) + Math.abs(q.inside.y - cands[c].inside.y)));
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best < 0 || bestD < 3) break;
    const g = cands.splice(best, 1)[0];
    gates.push(g);
    out.push(g);
  }
  return out;
}

/** The doorway between each pair of regions: one in the middle of the longest straight run of wall they share. The map
 *  draws the same ones (map/castleArt.ts), so the doorways people walk through are the ones they see. */
export function doorsOf(region: Map<number, number>, w: number): Set<string> {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w ? undefined : region.get(y * w + x));
  const shared = new Map<string, { h: boolean; cells: { x: number; y: number }[] }>();
  for (const [i, id] of region) {
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [n, h] of [
      [at(x, y - 1), true],
      [at(x - 1, y), false],
    ] as const) {
      if (n === undefined || n === id) continue;
      const key = `${Math.min(id, n)}|${Math.max(id, n)}|${h ? 'h' : 'v'}`;
      let s = shared.get(key);
      if (!s) shared.set(key, (s = { h, cells: [] }));
      s.cells.push({ x, y });
    }
  }
  const doors = new Set<string>();
  for (const s of shared.values()) {
    const sorted = s.cells.sort((a, b) => (s.h ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
    const runs: { x: number; y: number }[][] = [];
    for (const c of sorted) {
      const last = runs[runs.length - 1];
      const prev = last?.[last.length - 1];
      if (prev && (s.h ? prev.y === c.y && prev.x === c.x - 1 : prev.x === c.x && prev.y === c.y - 1)) last.push(c);
      else runs.push([c]);
    }
    // (the longest run; of runs as long, the first in reading order, so the choice never depends on the map's order)
    runs.sort((a, b) => b.length - a.length || a[0].y - b[0].y || a[0].x - b[0].x);
    const run = runs[0];
    const mid = run[Math.floor((run.length - 1) / 2)];
    doors.add(`${mid.x},${mid.y}|${s.h ? 'h' : 'v'}`);
  }
  return doors;
}

/** A hold's galleries (cells dug out of the rock that are neither the hall nor a room). */
export function galleryCells(s: CastleState): number[] {
  if (holdOf(s) !== 'mountain') return [];
  const solid = solidCells(s);
  const out: number[] = [];
  for (let i = 0; i < s.land.cells.length; i++) if (s.land.cells[i] === 'H' && !solid.has(i)) out.push(i);
  return out;
}

const layouts = new WeakMap<object, { key: string; tick: number; layout: CastleLayout }>();

/** The castle's regions, doorways and gate (cached until a room or the rock changes). Null without a castle. */
export function castleLayout(s: CastleState): CastleLayout | null {
  if (!castleOn(s)) return null;
  // (looked at once a tick at most: a path search a tick would otherwise rebuild the key each time)
  const tick = (s as { tick?: number }).tick ?? -1;
  const hit = layouts.get(s);
  if (hit && hit.tick === tick && tick >= 0) return hit.layout;
  const rs = rooms(s);
  const key = `${s.land.version}|${s.nomad ? 1 : 0}|${rs.map((b) => `${b.id}:${b.tile},${b.row},${b.def},${b.turned ? 1 : 0}`).join(';')}`;
  if (hit && hit.key === key) {
    hit.tick = tick;
    return hit.layout;
  }
  const m = s.land;
  const region = new Map<number, number>();
  const add = (r: Rect, id: number) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(m, x, y)) region.set(idx(m, x, y), id);
  };
  add(coreRect(s), -1);
  for (const b of rs) add(footprint(b), b.id);
  // each run of galleries (joined side to side) is a region of its own, so each gets its own doorway
  let next = -2;
  const gal = new Set(galleryCells(s));
  for (const start of gal) {
    if (region.has(start)) continue;
    const id = next--;
    const stack = [start];
    region.set(start, id);
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % m.w;
      const y = (c - x) / m.w;
      for (const [dx, dy] of SIDES) {
        if (!inMap(m, x + dx, y + dy)) continue;
        const n = idx(m, x + dx, y + dy);
        if (gal.has(n) && !region.has(n)) {
          region.set(n, id);
          stack.push(n);
        }
      }
    }
  }
  const g = castleGate(s);
  const main: CastleGate = { inside: { x: g.x, y: g.y - 1 }, outside: g, side: 's' };
  const layout: CastleLayout = { region, doors: doorsOf(region, m.w), gateOut: idx(m, g.x, g.y), gateIn: idx(m, g.x, g.y - 1), gates: [main, ...sideGates(s, region, main)] };
  layouts.set(s, { key, tick, layout });
  return layout;
}

/** Whether a step from one cell to a side neighbour keeps to the castle's walls: within a region, or outside, freely;
 *  between two regions only through their doorway; in or out only through the gate. A step onto raw rock (a face being
 *  dug) is left to the rock's own rules. */
export function castleStep(s: CastleState, layout: CastleLayout): (ax: number, ay: number, bx: number, by: number) => boolean {
  const m = s.land;
  return (ax, ay, bx, by) => {
    const a = ay * m.w + ax;
    const b = by * m.w + bx;
    const ra = layout.region.get(a);
    const rb = layout.region.get(b);
    if (ra === rb) return true;
    if (ra === undefined || rb === undefined) {
      const out = ra === undefined ? a : b;
      if (groundAt(m, out % m.w, Math.floor(out / m.w)) === 'mountain') return true;
      return layout.gates.some((q) => {
        const qi = q.inside.y * m.w + q.inside.x;
        const qo = q.outside.y * m.w + q.outside.x;
        return (a === qo && b === qi) || (b === qo && a === qi);
      });
    }
    // (the edge between the two cells, named by the lower or the right one)
    const key = ay === by ? `${Math.max(ax, bx)},${ay}|v` : `${ax},${Math.max(ay, by)}|h`;
    return layout.doors.has(key);
  };
}
