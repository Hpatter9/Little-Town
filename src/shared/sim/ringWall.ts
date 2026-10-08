// The ring wall (the owner's ask: a wall that encloses the town and grows with it). The planner walls an open town
// all round: a ring of one-cell wall pieces `RING_PAD` cells outside its outermost buildings, snapped to steps of
// `RING_STEP` a side, with a gate on each of its four sides (on the camp's row to the west and east, where raids come
// in: sim/battle.ts `gateCell`) and wherever a road crosses it, and a grate where a river crosses it (the wall carried
// over the water). When the town outgrows the ring a wider one is raised outside it, and the old ring is
// taken down (half its materials refunded: `demolish`) once the new one stands all round. Pieces are ordinary wall
// and gate buildings (data/buildings.ts), tagged with the ring's generation (`Building.ring`), so raids break them,
// shooters stand on them (battle.ts wall spots) and the better walls of later ages replace them in place (UPGRADES).
// Townsfolk walk out through the gates (walk.ts `blockedBy` lets gates through; a sealed town walks straight through).
// Castles and the hold have walls of their own, and a wandering tribe its wagons: no ring for them.
import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { blueprintCount, buildSlots, builtOn, canPlace, demolish, isUnlocked, placeBlueprint, unlockInfo } from './buildings';
import { holdOf } from './castle';
import { groundAt, idx, inMap, isRoad, wet, WILD, type LandMap, type Pt, type Rect } from './land';
import { nomadic } from './nomads';
import { campCell, type Building, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';

/** Cells between the outermost building and the wall; the ring grows in steps of this many cells a side. */
export const RING_PAD = 4;
export const RING_STEP = 5;
/** A ring reaches at least this far from the camp each way (before the pad), so a young town has room to grow in it. */
export const RING_MIN = 8;
/** Grown-ups before a town walls itself (sooner when raided or set on defence). */
export const RING_PEOPLE = 6;
/** Ring pieces on the build queue at a time (a slot is always left for the rest). */
export const RING_AT_ONCE = 2;
/** A piece is placed only while the town holds this many times its cost (the wall never takes the last wood). */
export const RING_SPARE = 3;
/** Hours after a ring stands all round before a wider one is begun (a town that has grown past it waits; a raid
 *  brings the new ring on at once). */
export const RING_REGROW_HOURS = 72;
/** Wild cells cleared for the ring at a time: every tree and rock on the line, up to this many at once (the owner's
 *  ask: a wall laid through a wood or a rockfall has them cut and mined out once it is planned; they used to wait on
 *  the planner's marking cap, four at a time, and were often never marked at all). */
export const RING_CLEAR = 24;
/** The ring's cells to clear are taken ahead of other marked cells by whoever gathers, as if this many cells nearer. */
export const RING_CLEAR_PULL = 20;

/** The walls, weakest first, and each one's gate and water grate (the owner's ask: where the ring met a river it was
 *  left open there; now the wall is carried over on a grating the water runs through and nobody does). */
export const WALL_KINDS = ['palisade_wall', 'stone_wall', 'brick_wall', 'concrete_wall', 'force_wall'] as const;
export const GATE_OF: Record<string, string> = { palisade_wall: 'palisade_gate', stone_wall: 'stone_gate', brick_wall: 'brick_gate', concrete_wall: 'concrete_gate', force_wall: 'force_gate' };
export const GRATE_OF: Record<string, string> = { palisade_wall: 'palisade_grate', stone_wall: 'stone_grate', brick_wall: 'brick_grate', concrete_wall: 'concrete_grate', force_wall: 'force_grate' };
const GATES = new Set(Object.values(GATE_OF));
const GRATES = new Set(Object.values(GRATE_OF));
export const isGate = (id: string) => GATES.has(id);
export const isGrate = (id: string) => GRATES.has(id);
export const isRingPiece = (id: string) => (WALL_KINDS as readonly string[]).includes(id) || GATES.has(id) || GRATES.has(id);
/** Water narrower than this along one axis (across a river the ring crosses, or across a stream the ring runs down)
 *  is a river or a stream, and gets grates; water wider both ways is the sea or a lake, left open (a shore town's
 *  whole south side is the sea). */
export const GRATE_WATER_MOST = 7;
/** How far along its side a gate is moved from the camp's row or column to stand on dry ground. */
export const GATE_SEEK = 6;

export interface Ring {
  /** Which ring this is (the pieces carry it: `Building.ring`). */
  gen: number;
  /** The box round the town it started from (a wider ring is begun when the town outgrows it). */
  rect: Rect;
  /** Its line, shaped to the land (`shapeRing`); an older ring without one keeps its box's edge (`lineOf`). */
  line?: LineCell[];
  /** The wall it is built of, and its gate. */
  wall: string;
  gate: string;
  /** The ring cells the gates stand on. */
  gates: Pt[];
  /** Standing all round (the older rings are down), and since when. */
  done?: boolean;
  doneAt?: number;
  /** The wild cells on the line being cleared for it (cell indices; marked for gathering, and taken first). */
  clearing?: number[];
}

/** Whether a town walls itself with a ring: not a castle or a hold (walls of their own), not a tribe on the move. */
export const ringTown = (s: GameState) => !holdOf(s) && !nomadic(s);

/** The best wall the town can build now. */
export function bestWall(s: GameState): string | null {
  const u = unlockInfo(s);
  let best: string | null = null;
  for (const id of WALL_KINDS) if (BUILDING_BY_ID[id] && BUILDING_BY_ID[GATE_OF[id]] && BUILDING_BY_ID[GRATE_OF[id]] && isUnlocked(u, BUILDING_BY_ID[id])) best = id;
  return best;
}

/** The ring the town wants now: round everything but its fields, pens and old walls, `RING_PAD` out, each side
 *  stepped out to a multiple of `RING_STEP` from the camp (so it grows in steps, not every time a shed goes up). */
export function wantRect(s: GameState): Rect {
  const c = campCell(s);
  let x0 = c.x, y0 = c.y, x1 = c.x, y1 = c.y;
  for (const b of s.buildings) {
    const def = BUILDING_BY_ID[b.def];
    if (!def || def.layer === 'back' || isRingPiece(b.def) || (def.hp && def.width === 1)) continue;
    x0 = Math.min(x0, b.tile);
    y0 = Math.min(y0, b.row);
    x1 = Math.max(x1, b.tile + def.width - 1);
    y1 = Math.max(y1, b.row + depth(def) - 1);
  }
  const step = (d: number) => Math.ceil((Math.max(d, RING_MIN) + RING_PAD) / RING_STEP) * RING_STEP;
  const L = step(c.x - x0), R = step(x1 - c.x), T = step(c.y - y0), B = step(y1 - c.y);
  const m = s.land;
  const rx = Math.max(0, c.x - L), ry = Math.max(0, c.y - T);
  return { x: rx, y: ry, w: Math.min(m.w - 1, c.x + R) - rx + 1, h: Math.min(m.h - 1, c.y + B) - ry + 1 };
}
const depth = (def: BuildingDef) => def.depth ?? (def.hp && def.width <= 2 && !def.housing ? 1 : def.width <= 3 ? 2 : def.width <= 5 ? 3 : 4);

const contains = (a: Rect, b: Rect) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

/** The cells of a box's edge, clockwise from its top-left corner (a ring's starting shape, and an older town's ring). */
export function ringCells(r: Rect): Pt[] {
  const out: Pt[] = [];
  for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y: r.y });
  for (let y = r.y + 1; y < r.y + r.h; y++) out.push({ x: r.x + r.w - 1, y });
  for (let x = r.x + r.w - 2; x >= r.x; x--) out.push({ x, y: r.y + r.h - 1 });
  for (let y = r.y + r.h - 2; y > r.y; y--) out.push({ x: r.x, y });
  return out;
}

export type Side = 'n' | 's' | 'w' | 'e';
/** A cell of the ring's line and the side of the town it stands on (which way it faces out). */
export interface LineCell { x: number; y: number; side: Side }

/** The ring is shaped to the land (the owner's ask: "the wall should push past the river and be built on the other
 *  side rather than right down the middle; the walls don't need to be a square, any shape that gets the wall up
 *  faster without obstacles"). It starts as the box's edge; wherever the line runs along a river (a run of at least
 *  `PUSH_ALONG` river cells on it) that stretch is pushed out a cell at a time till it stands past the far bank, at most
 *  `PUSH_MOST` cells beyond the box. A river that only crosses the line keeps its grate. */
export const PUSH_ALONG = 5;
export const PUSH_MOST = 8;
const sideOfBox = (r: Rect, p: Pt): Side => (p.y === r.y ? 'n' : p.y === r.y + r.h - 1 ? 's' : p.x === r.x ? 'w' : 'e');
export function shapeRing(s: Pick<GameState, 'land'>, r: Rect): LineCell[] {
  const m = s.land;
  const M = PUSH_MOST + 2;
  const bx = r.x - M, by = r.y - M, bw = r.w + 2 * M, bh = r.h + 2 * M;
  const inBox = (x: number, y: number) => x >= bx && y >= by && x < bx + bw && y < by + bh;
  const key = (x: number, y: number) => (y - by) * bw + (x - bx);
  const R = new Uint8Array(bw * bh);
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) R[key(x, y)] = 1;
  const inR = (x: number, y: number) => inBox(x, y) && R[key(x, y)] === 1;
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  const boundary = (): Pt[] => {
    const out: Pt[] = [];
    for (let y = by + 1; y < by + bh - 1; y++)
      for (let x = bx + 1; x < bx + bw - 1; x++) if (!inR(x, y) && inMap(m, x, y) && N8.some(([dx, dy]) => inR(x + dx, y + dy))) out.push({ x, y });
    return out;
  };
  const beyond = (p: Pt) => Math.max(r.x - p.x, p.x - (r.x + r.w - 1), r.y - p.y, p.y - (r.y + r.h - 1));
  for (let pass = 0; pass < PUSH_MOST + 2; pass++) {
    const river = new Set(boundary().filter((p) => wet(groundAt(m, p.x, p.y)) && riverCell(m, p) && beyond(p) < PUSH_MOST).map((p) => key(p.x, p.y)));
    let pushed = false;
    const seen = new Set<number>();
    for (const k0 of river) {
      if (seen.has(k0)) continue;
      // (the run of river along the line this cell is in)
      const run: number[] = [k0];
      seen.add(k0);
      for (let i = 0; i < run.length; i++) {
        const x = (run[i] % bw) + bx, y = Math.floor(run[i] / bw) + by;
        for (const [dx, dy] of N8) {
          const k = key(x + dx, y + dy);
          if (inBox(x + dx, y + dy) && river.has(k) && !seen.has(k)) {
            seen.add(k);
            run.push(k);
          }
        }
      }
      if (run.length < PUSH_ALONG) continue;
      for (const k of run) R[k] = 1;
      pushed = true;
    }
    if (!pushed) break;
  }
  // (no holes: whatever the line has closed round is inside it)
  const out = new Uint8Array(bw * bh);
  const q: number[] = [];
  for (let x = bx; x < bx + bw; x++) for (const y of [by, by + bh - 1]) q.push(key(x, y));
  for (let y = by; y < by + bh; y++) for (const x of [bx, bx + bw - 1]) q.push(key(x, y));
  for (const k of q) out[k] = 1;
  for (let i = 0; i < q.length; i++) {
    const x = (q[i] % bw) + bx, y = Math.floor(q[i] / bw) + by;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (!inBox(nx, ny)) continue;
      const k = key(nx, ny);
      if (out[k] || R[k]) continue;
      out[k] = 1;
      q.push(k);
    }
  }
  for (let k = 0; k < R.length; k++) if (!out[k]) R[k] = 1;
  const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
  return boundary()
    .map((p): LineCell => {
      const side: Side = inR(p.x + 1, p.y) ? 'w' : inR(p.x - 1, p.y) ? 'e' : inR(p.x, p.y + 1) ? 'n' : inR(p.x, p.y - 1) ? 's' : inR(p.x + 1, p.y + 1) || inR(p.x - 1, p.y + 1) ? 'n' : 's';
      return { ...p, side };
    })
    .sort((a, c) => ang(a.x - cx, a.y - cy) - ang(c.x - cx, c.y - cy));
}
// (clockwise from the top-left, as the box's edge ran)
const ang = (dx: number, dy: number) => (Math.atan2(dy, dx) + Math.PI * 1.75) % (Math.PI * 2);

/** A ring's line (an older town's ring, laid before the line was shaped, keeps its box). */
export function lineOf(ring: Ring): LineCell[] {
  return ring.line ?? ringCells(ring.rect).map((p) => ({ ...p, side: sideOfBox(ring.rect, p) }));
}
/** The side of the town a cell of the ring's line stands on. */
export function sideOn(ring: Ring, p: Pt): Side {
  return lineOf(ring).find((l) => l.x === p.x && l.y === p.y)?.side ?? sideOfBox(ring.rect, p);
}

/** Where a gate standing on a ring cell is placed (its top-left): a gate is two cells long, laid along the wall:
 *  across on the north and south sides from its cell, and turned (`Building.turned`) down the column on the west and
 *  east. */
export const gateAt = (_ring: Ring, p: Pt): Pt => ({ x: p.x, y: p.y });
/** Whether a gate on a ring cell stands turned (down a column: the west and east sides). */
export const gateTurned = (ring: Ring, p: Pt) => {
  const side = sideOn(ring, p);
  return side === 'w' || side === 'e';
};
/** The two ring cells a gate covers. */
const gateCovers = (ring: Ring, g: Pt): Pt[] => (gateTurned(ring, g) ? [g, { x: g.x, y: g.y + 1 }] : [g, { x: g.x + 1, y: g.y }]);

/** The ring cells that get gates: one on each of the four sides (the owner's ask: travellers wander in from any
 *  way), where the camp's row meets the line to the west and east (where raids come in) and the camp's column meets it
 *  to the north and south, each moved along the line up to `GATE_SEEK` cells (further if it must) to stand on dry
 *  ground with both its cells on the same side's run; and wherever a road crosses the line (a gate every few cells
 *  at most). */
export function gateCells(s: GameState, line: LineCell[]): Pt[] {
  const c = campCell(s);
  const m = s.land;
  const at = new Map(line.map((l) => [idx(m, l.x, l.y), l]));
  const dry = (p: Pt) => inMap(m, p.x, p.y) && !wet(groundAt(m, p.x, p.y)) && groundAt(m, p.x, p.y) !== 'mountain';
  const pair = (l: LineCell): Pt => (l.side === 'w' || l.side === 'e' ? { x: l.x, y: l.y + 1 } : { x: l.x + 1, y: l.y });
  const runs = (l: LineCell) => {
    const p = pair(l);
    return at.get(idx(m, p.x, p.y))?.side === l.side;
  };
  const standable = (l: LineCell) => runs(l) && dry(l) && dry(pair(l));
  const out: LineCell[] = [];
  const sides: [Side, (l: LineCell) => boolean, (l: LineCell) => number][] = [
    ['w', (l) => l.x < c.x, (l) => Math.abs(l.y - c.y) * 4 + Math.abs(l.x - c.x) / 64],
    ['e', (l) => l.x > c.x, (l) => Math.abs(l.y - c.y) * 4 + Math.abs(l.x - c.x) / 64],
    ['n', (l) => l.y < c.y, (l) => Math.abs(l.x - c.x) * 4 + Math.abs(l.y - c.y) / 64],
    ['s', (l) => l.y > c.y, (l) => Math.abs(l.x - c.x) * 4 + Math.abs(l.y - c.y) / 64],
  ];
  for (const [side, onSide, far] of sides) {
    const cands = line.filter((l) => l.side === side && onSide(l));
    if (!cands.length) continue;
    const target = cands.reduce((a, l) => (far(l) < far(a) ? l : a));
    const d = (l: LineCell) => Math.max(Math.abs(l.x - target.x), Math.abs(l.y - target.y));
    // (on dry ground near the camp's row or column; else wherever along that side it can stand; else the cell, and
    // the river or the mountain is the wall there)
    const good = cands.filter(standable).sort((a, b) => d(a) - d(b) || far(a) - far(b));
    out.push(good[0] && d(good[0]) <= GATE_SEEK * 3 ? good[0] : runs(target) ? target : (cands.find(runs) ?? target));
  }
  const near = (p: LineCell) => out.some((g) => g.side === p.side && Math.abs(g.x - p.x) + Math.abs(g.y - p.y) < 4);
  for (const l of line) {
    if (near(l) || !isRoad(m, l.x, l.y) || !runs(l)) continue;
    out.push(l);
  }
  return out.map((l) => ({ x: l.x, y: l.y }));
}

/** The ring piece standing on a cell (of this ring or an older one). */
const pieceAt = (s: GameState, p: Pt): Building | undefined => {
  const b = builtOn(s, p.x, p.y);
  return b && isRingPiece(b.def) ? b : undefined;
};

/** What the ring still needs: the gates first, then the walls and the grates; each with its cell to build on, or a
 *  wild cell to clear first. A wet cell gets a grate where the ring crosses a river or a stream, or runs down one
 *  (`riverCell`); the sea, a lake, the mountain and another building are left as they are (they are the wall
 *  there). */
export function missingPieces(s: GameState, ring: Ring): { def: string; at: Pt; clear: boolean; turned?: boolean }[] {
  const out: { def: string; at: Pt; clear: boolean; turned?: boolean }[] = [];
  const m = s.land;
  const covered = new Set<number>();
  // (whether the cells are accounted for: a piece stands or is wanted there, or something else stands in its place)
  const want = (def: string, at: Pt, cells: Pt[], turned = false): boolean => {
    const there = cells.map((c) => pieceAt(s, c));
    if (there.some((b) => b && b.ring === ring.gen)) return true;
    if (there.some((b) => b && b.ring !== ring.gen)) return true; // (an older ring's piece stands there: it goes when this ring is up)
    if (cells.some((c) => !inMap(m, c.x, c.y) || !!builtOn(s, c.x, c.y))) return true;
    const wild = cells.find((c) => WILD.includes(groundAt(m, c.x, c.y)));
    if (wild) {
      out.push({ def, at: wild, clear: true });
      return true;
    }
    if (!canPlace(s, BUILDING_BY_ID[def], at.x, at.y, undefined, turned).ok) return false;
    out.push({ def, at, clear: false, ...(turned ? { turned } : {}) });
    return true;
  };
  for (const g of ring.gates) {
    const cells = gateCovers(ring, g);
    // (a gate that can't stand where it was meant to (the river runs under it) leaves its cells to the wall)
    if (want(ring.gate, gateAt(ring, g), cells, gateTurned(ring, g))) for (const c of cells) covered.add(idx(m, c.x, c.y));
  }
  for (const p of lineOf(ring)) {
    if (covered.has(idx(m, p.x, p.y))) continue;
    if (wet(groundAt(m, p.x, p.y))) {
      if (riverCell(m, p)) want(GRATE_OF[ring.wall], p, [p]);
      continue;
    }
    want(ring.wall, p, [p]);
  }
  return out;
}

/** Whether a wet cell lies in a river or a stream (the water through it narrower than `GRATE_WATER_MOST` along one
 *  axis or the other) rather than the sea or a lake (wide both ways). */
export function riverCell(m: LandMap, p: Pt): boolean {
  const span = (dx: number, dy: number) => {
    let n = 1;
    for (const d of [-1, 1])
      for (let k = 1; k <= GRATE_WATER_MOST; k++) {
        const x = p.x + dx * d * k, y = p.y + dy * d * k;
        if (!inMap(m, x, y) || !wet(groundAt(m, x, y))) break;
        n++;
      }
    return n;
  };
  return Math.min(span(1, 0), span(0, 1)) <= GRATE_WATER_MOST;
}

/** Whether the ring stands all round: every piece of it finished (cells that can't take one don't count). */
export const ringComplete = (s: GameState, ring: Ring) => !missingPieces(s, ring).length && !s.buildings.some((b) => b.ring === ring.gen && b.status !== 'done');

/** The planner's turn (from planBuilding, each pass): start or widen the ring, place its next pieces (up to
 *  `RING_AT_ONCE` on the queue, a slot left for the rest, only while the stores hold `RING_SPARE` times a piece's cost),
 *  take the old ring down once the new one stands. Returns
 *  the wild cells to clear for it. */
export function planRing(s: GameState, wanted: boolean, stock: Partial<Record<string, number>> = {}, raided = false): number[] {
  const clear: number[] = [];
  if (!ringTown(s)) return clear;
  const wall = bestWall(s);
  if (!wall) return clear;
  const want = wantRect(s);
  const cur = s.ring;
  // (a wider ring only once the last stands and has stood a while: a town growing fast would rebuild its wall every
  // other day; raided, it widens at once)
  const mayRegrow = !cur || (!!cur.done && (raided || s.tick - (cur.doneAt ?? 0) >= RING_REGROW_HOURS * TICKS_PER_HOUR));
  if (!cur) {
    if (!wanted) return clear;
    const line = shapeRing(s, want);
    s.ring = { gen: 1, rect: want, line, wall, gate: GATE_OF[wall], gates: gateCells(s, line) };
  } else if (!contains(cur.rect, want) && mayRegrow) {
    // (the town has grown past its wall: a wider ring outside it; the gates where the roads cross now)
    const line = shapeRing(s, want);
    s.ring = { gen: cur.gen + 1, rect: want, line, wall, gate: GATE_OF[wall], gates: gateCells(s, line) };
  } else if (cur.wall !== wall) {
    // (a better wall learned: new pieces are of it; the old ones are rebuilt in place by the upgrade loop)
    cur.wall = wall;
    cur.gate = GATE_OF[wall];
  }
  const ring = s.ring!;
  // (the town knows the land its wall stands on: the ring's corners lie further out than its buildings)
  const c = campCell(s);
  const reach = Math.ceil(Math.max(...lineOf(ring).map((p) => Math.hypot(p.x - c.x, p.y - c.y))));
  if (s.land.open < reach + 1) s.land.open = reach + 1;
  const missing = missingPieces(s, ring);
  if (!missing.length && !ring.done && !s.buildings.some((b) => b.ring === ring.gen && b.status !== 'done')) {
    // (standing all round: the older rings, and the old end walls, come down)
    for (const b of s.buildings.filter((q) => isRingPiece(q.def) && q.ring !== ring.gen)) demolish(s, b.id);
    ring.done = true;
    ring.doneAt = s.tick;
    delete ring.clearing;
    return clear;
  }
  // The whole ring is laid out at once (the owner's ask: one blueprint for the wall, built a section at a time):
  // every piece that can stand now goes down as a planned blueprint (`Building.planned`: no slot, no hauling, walked
  // through), and the sections are released into work in the ring's order, `RING_AT_ONCE` at a time.
  for (const piece of missing) {
    if (piece.clear) {
      if (clear.length < RING_CLEAR) clear.push(idx(s.land, piece.at.x, piece.at.y));
      continue;
    }
    // (planned: it takes no slot, so a cell cleared or freed later still gets its piece while the queue is full)
    if (placeBlueprint(s, piece.def, piece.at.x, piece.at.y, !!piece.turned, true).ok) {
      const b = s.buildings[s.buildings.length - 1];
      b.ring = ring.gen;
      b.planned = true;
    }
  }
  ring.clearing = clear.slice();
  // (a better wall learned since: the pieces still only planned become it)
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || !b.planned) continue;
    if (isGate(b.def) && b.def !== ring.gate) b.def = ring.gate;
    else if (isGrate(b.def) && b.def !== GRATE_OF[ring.wall]) b.def = GRATE_OF[ring.wall];
    else if (!isGate(b.def) && !isGrate(b.def) && b.def !== ring.wall) b.def = ring.wall;
  }
  const queued = s.buildings.filter((b) => b.ring === ring.gen && b.status === 'blueprint' && !b.planned).length;
  // (what the other sites still wait on is theirs: the wall never takes the shop's last logs)
  const owed: Record<string, number> = {};
  for (const b of s.buildings) {
    if (b.status !== 'blueprint' || isRingPiece(b.def)) continue;
    for (const [m, n] of Object.entries(BUILDING_BY_ID[b.def]?.cost ?? {})) owed[m] = (owed[m] ?? 0) + Math.max(0, (n ?? 0) - (b.delivered[m as keyof typeof b.delivered] ?? 0));
  }
  let room = Math.min(RING_AT_ONCE - queued, buildSlots(s) - 1 - blueprintCount(s));
  // (the next sections, in the order they were laid: the gates first, then round the ring)
  for (const b of s.buildings) {
    if (room <= 0) break;
    if (b.ring !== ring.gen || !b.planned) continue;
    const cost = BUILDING_BY_ID[b.def].cost;
    if (Object.entries(cost).some(([m, n]) => (stock[m] ?? 0) - (owed[m] ?? 0) < (n ?? 0) * RING_SPARE)) continue;
    delete b.planned;
    room--;
  }
  return clear;
}

/** The ring's gate cell on a side (for raids: the trail ends there), if the town has a ring. */
export function ringGate(s: GameState, side: -1 | 1): Pt | null {
  const ring = s.ring;
  if (!ring) return null;
  const g = ring.gates.find((p) => sideOn(ring, p) === (side < 0 ? 'w' : 'e'));
  return g ?? null;
}
