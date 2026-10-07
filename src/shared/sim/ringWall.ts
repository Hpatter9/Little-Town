// The ring wall (the owner's ask: a wall that encloses the town and grows with it). The planner walls an open town
// all round: a ring of one-cell wall pieces `RING_PAD` cells outside its outermost buildings, snapped to steps of
// `RING_STEP` a side, with a gate wherever a road crosses it and one on the camp's row on each side (where raids come
// in: sim/battle.ts `gateCell`). When the town outgrows the ring a wider one is raised outside it, and the old ring is
// taken down (half its materials refunded: `demolish`) once the new one stands all round. Pieces are ordinary wall
// and gate buildings (data/buildings.ts), tagged with the ring's generation (`Building.ring`), so raids break them,
// shooters stand on them (battle.ts wall spots) and the better walls of later ages replace them in place (UPGRADES).
// Townsfolk walk out through the gates (walk.ts `blockedBy` lets gates through; a sealed town walks straight through).
// Castles and the hold have walls of their own, and a wandering tribe its wagons: no ring for them.
import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { blueprintCount, buildSlots, builtOn, canPlace, demolish, isUnlocked, placeBlueprint, unlockInfo } from './buildings';
import { holdOf } from './castle';
import { groundAt, idx, inMap, isRoad, WILD, type Pt, type Rect } from './land';
import { nomadic } from './nomads';
import { campCell, type Building, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';

/** Cells between the outermost building and the wall; the ring grows in steps of this many cells a side. */
export const RING_PAD = 3;
export const RING_STEP = 4;
/** A ring reaches at least this far from the camp each way (before the pad), so a young town has room to grow in it. */
export const RING_MIN = 6;
/** Grown-ups before a town walls itself (sooner when raided or set on defence). */
export const RING_PEOPLE = 6;
/** Ring pieces on the build queue at a time (a slot is always left for the rest). */
export const RING_AT_ONCE = 2;
/** A piece is placed only while the town holds this many times its cost (the wall never takes the last wood). */
export const RING_SPARE = 3;
/** Hours after a ring stands all round before a wider one is begun (a town that has grown past it waits; a raid
 *  brings the new ring on at once). */
export const RING_REGROW_HOURS = 72;
/** Wild cells cleared ahead of the ring at a time. */
export const RING_CLEAR = 4;

/** The walls, weakest first, and each one's gate. */
export const WALL_KINDS = ['palisade_wall', 'stone_wall', 'brick_wall', 'concrete_wall', 'force_wall'] as const;
export const GATE_OF: Record<string, string> = { palisade_wall: 'palisade_gate', stone_wall: 'stone_gate', brick_wall: 'brick_gate', concrete_wall: 'concrete_gate', force_wall: 'force_gate' };
const GATES = new Set(Object.values(GATE_OF));
export const isGate = (id: string) => GATES.has(id);
export const isRingPiece = (id: string) => (WALL_KINDS as readonly string[]).includes(id) || GATES.has(id);

export interface Ring {
  /** Which ring this is (the pieces carry it: `Building.ring`). */
  gen: number;
  rect: Rect;
  /** The wall it is built of, and its gate. */
  wall: string;
  gate: string;
  /** The ring cells the gates stand on. */
  gates: Pt[];
  /** Standing all round (the older rings are down), and since when. */
  done?: boolean;
  doneAt?: number;
}

/** Whether a town walls itself with a ring: not a castle or a hold (walls of their own), not a tribe on the move. */
export const ringTown = (s: GameState) => !holdOf(s) && !nomadic(s);

/** The best wall the town can build now. */
export function bestWall(s: GameState): string | null {
  const u = unlockInfo(s);
  let best: string | null = null;
  for (const id of WALL_KINDS) if (BUILDING_BY_ID[id] && BUILDING_BY_ID[GATE_OF[id]] && isUnlocked(u, BUILDING_BY_ID[id])) best = id;
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

/** The cells of a ring, clockwise from its top-left corner. */
export function ringCells(r: Rect): Pt[] {
  const out: Pt[] = [];
  for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y: r.y });
  for (let y = r.y + 1; y < r.y + r.h; y++) out.push({ x: r.x + r.w - 1, y });
  for (let x = r.x + r.w - 2; x >= r.x; x--) out.push({ x, y: r.y + r.h - 1 });
  for (let y = r.y + r.h - 2; y > r.y; y--) out.push({ x: r.x, y });
  return out;
}

/** Which side of its ring a cell is on. */
export const sideOf = (r: Rect, p: Pt): 'n' | 's' | 'w' | 'e' => (p.y === r.y ? 'n' : p.y === r.y + r.h - 1 ? 's' : p.x === r.x ? 'w' : 'e');

/** Where a gate standing on a ring cell is placed (its top-left): a gate is two cells long, laid along the wall:
 *  across on the north and south sides, and turned (`Building.turned`) to stand down the column on the west and east. */
export function gateAt(r: Rect, p: Pt): Pt {
  const side = sideOf(r, p);
  if (side === 'n' || side === 's') return { x: Math.min(p.x, r.x + r.w - 2), y: p.y };
  return { x: p.x, y: Math.min(p.y, r.y + r.h - 2) };
}
/** Whether a gate on a ring cell stands turned (down a column: the west and east sides). */
export const gateTurned = (r: Rect, p: Pt) => sideOf(r, p) === 'w' || sideOf(r, p) === 'e';
/** The two ring cells a gate covers. */
const gateCovers = (r: Rect, g: Pt): Pt[] => {
  const at = gateAt(r, g);
  return gateTurned(r, g) ? [at, { x: at.x, y: at.y + 1 }] : [at, { x: at.x + 1, y: at.y }];
};

/** The ring cells that get gates: the camp's row on the west and east (raids come in there), and wherever a road
 *  crosses the ring (at most one gate every few cells of a side). */
export function gateCells(s: GameState, r: Rect): Pt[] {
  const c = campCell(s);
  const out: Pt[] = [];
  const row = Math.max(r.y + 1, Math.min(r.y + r.h - 2, c.y));
  out.push({ x: r.x, y: row }, { x: r.x + r.w - 1, y: row });
  const near = (p: Pt) => out.some((g) => sideOf(r, g) === sideOf(r, p) && Math.abs(g.x - p.x) + Math.abs(g.y - p.y) < 4);
  for (const p of ringCells(r)) {
    if (near(p) || !isRoad(s.land, p.x, p.y)) continue;
    const corner = (p.x === r.x || p.x === r.x + r.w - 1) && (p.y === r.y || p.y === r.y + r.h - 1);
    if (corner) continue;
    out.push(p);
  }
  return out;
}

/** The ring piece standing on a cell (of this ring or an older one). */
const pieceAt = (s: GameState, p: Pt): Building | undefined => {
  const b = builtOn(s, p.x, p.y);
  return b && isRingPiece(b.def) ? b : undefined;
};

/** What the ring still needs: the gates first, then the walls; each with its cell to build on, or a wild cell to
 *  clear first. Cells with water, mountain or another building are left as they are (the river or a field is the
 *  wall there). */
export function missingPieces(s: GameState, ring: Ring): { def: string; at: Pt; clear: boolean; turned?: boolean }[] {
  const out: { def: string; at: Pt; clear: boolean; turned?: boolean }[] = [];
  const m = s.land;
  const covered = new Set<number>();
  const want = (def: string, at: Pt, cells: Pt[], turned = false) => {
    for (const c of cells) covered.add(idx(m, c.x, c.y));
    const there = cells.map((c) => pieceAt(s, c));
    if (there.some((b) => b && b.ring === ring.gen)) return;
    if (there.some((b) => b && b.ring !== ring.gen)) return; // (an older ring's piece stands there: it goes when this ring is up)
    if (cells.some((c) => !inMap(m, c.x, c.y) || !!builtOn(s, c.x, c.y))) return;
    const wild = cells.find((c) => WILD.includes(groundAt(m, c.x, c.y)));
    if (wild) {
      out.push({ def, at: wild, clear: true });
      return;
    }
    if (!canPlace(s, BUILDING_BY_ID[def], at.x, at.y, undefined, turned).ok) return;
    out.push({ def, at, clear: false, ...(turned ? { turned } : {}) });
  };
  for (const g of ring.gates) want(ring.gate, gateAt(ring.rect, g), gateCovers(ring.rect, g), gateTurned(ring.rect, g));
  for (const p of ringCells(ring.rect)) if (!covered.has(idx(m, p.x, p.y))) want(ring.wall, p, [p]);
  return out;
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
    s.ring = { gen: 1, rect: want, wall, gate: GATE_OF[wall], gates: gateCells(s, want) };
  } else if (!contains(cur.rect, want) && mayRegrow) {
    // (the town has grown past its wall: a wider ring outside it; the gates where the roads cross now)
    s.ring = { gen: cur.gen + 1, rect: want, wall, gate: GATE_OF[wall], gates: gateCells(s, want) };
  } else if (cur.wall !== wall) {
    // (a better wall learned: new pieces are of it; the old ones are rebuilt in place by the upgrade loop)
    cur.wall = wall;
    cur.gate = GATE_OF[wall];
  }
  const ring = s.ring!;
  // (the town knows the land its wall stands on: the ring's corners lie further out than its buildings)
  const c = campCell(s);
  const r = ring.rect;
  const reach = Math.ceil(Math.max(Math.hypot(r.x - c.x, r.y - c.y), Math.hypot(r.x + r.w - 1 - c.x, r.y - c.y), Math.hypot(r.x - c.x, r.y + r.h - 1 - c.y), Math.hypot(r.x + r.w - 1 - c.x, r.y + r.h - 1 - c.y)));
  if (s.land.open < reach + 1) s.land.open = reach + 1;
  const missing = missingPieces(s, ring);
  if (!missing.length && !ring.done && !s.buildings.some((b) => b.ring === ring.gen && b.status !== 'done')) {
    // (standing all round: the older rings, and the old end walls, come down)
    for (const b of s.buildings.filter((q) => isRingPiece(q.def) && q.ring !== ring.gen)) demolish(s, b.id);
    ring.done = true;
    ring.doneAt = s.tick;
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
    if (placeBlueprint(s, piece.def, piece.at.x, piece.at.y, !!piece.turned).ok) {
      const b = s.buildings[s.buildings.length - 1];
      b.ring = ring.gen;
      b.planned = true;
    }
  }
  // (a better wall learned since: the pieces still only planned become it)
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || !b.planned) continue;
    if (isGate(b.def) && b.def !== ring.gate) b.def = ring.gate;
    else if (!isGate(b.def) && b.def !== ring.wall) b.def = ring.wall;
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
  const g = ring.gates.find((p) => (side < 0 ? p.x === ring.rect.x : p.x === ring.rect.x + ring.rect.w - 1));
  return g ?? null;
}
