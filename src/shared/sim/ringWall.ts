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
import { RING_SHAPE_OF, type RingShape } from '../data/ringShapes';
import { builtOn, builtOnIndex, canPlace, demolish, isUnlocked, overgrownCells, placeBlueprint, refreshOvergrown, unlockInfo } from './buildings';
import { holdOf } from './castle';
import { CELL, groundAt, idx, inMap, isPlannedRoad, isRoad, planRoad, unsetRoad, wet, WILD, wildToClear, type LandMap, type Pt, type Rect } from './land';
import { nomadic } from './nomads';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { campCell, type Building, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';

/** Cells between the outermost building and the wall; the ring grows in steps of this many cells a side. */
export const RING_PAD = 4;
export const RING_STEP = 5;
/** A ring reaches at least this far from the camp each way (before the pad), so a young town has room to grow in it. */
export const RING_MIN = 8;
/** When the town outgrows its wall, the wider ring is pushed out this many cells more each side than the town needs
 *  yet (the owner's ask: it was only just past the buildings, and soon outgrown again). The first ring is as before. */
export const RING_WIDEN = 10;
/** Grown-ups before a town walls itself (sooner when raided or set on defence). */
export const RING_PEOPLE = 6;
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
  /** The wall as one construction (the owner's ask): the work done on it all, in build-seconds summed over its pieces
   *  (`ringTotals`), and the materials brought for it all; every piece's own progress and delivered are made from these
   *  (`syncRing`). Left out of an older save: taken from its pieces' own the first time (`ringTotals`). */
  sec?: number;
  pool?: Stock;
  /** Pieces of the line not yet in the construction (still laid as plans or waiting on their ground), as planRing
   *  last counted them: the wall is not finished while any are. */
  unlaid?: number;
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

/** The town's wanted ring pushed `RING_WIDEN` cells further each side, and at least `RING_STEP` past the old ring
 *  (so the new wall stands clear of the old one), kept on the land. */
export function widened(s: GameState, want: Rect, old: Rect): Rect {
  const m = s.land;
  const x0 = Math.max(0, Math.min(want.x - RING_WIDEN, old.x - RING_STEP));
  const y0 = Math.max(0, Math.min(want.y - RING_WIDEN, old.y - RING_STEP));
  const x1 = Math.min(m.w - 1, Math.max(want.x + want.w - 1 + RING_WIDEN, old.x + old.w - 1 + RING_STEP));
  const y1 = Math.min(m.h - 1, Math.max(want.y + want.h - 1 + RING_WIDEN, old.y + old.h - 1 + RING_STEP));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
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
export function shapeRing(s: Pick<GameState, 'land'> & Partial<Pick<GameState, 'origin' | 'buildings'>>, r: Rect, shape: RingShape = ringShapeOf(s)): LineCell[] {
  const m = s.land;
  const M = PUSH_MOST + 2;
  const bx = r.x - M, by = r.y - M, bw = r.w + 2 * M, bh = r.h + 2 * M;
  const inBox = (x: number, y: number) => x >= bx && y >= by && x < bx + bw && y < by + bh;
  const key = (x: number, y: number) => (y - by) * bw + (x - bx);
  const R = new Uint8Array(bw * bh);
  if (shape === 'box') for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) R[key(x, y)] = 1;
  else {
    // (the people's own shape over the box, data/ringShapes.ts; whatever it cuts off that the town stands on is taken
    // back in, `TOWN_KEEP` round each building)
    const inside = shapeTest(shape, r);
    for (let y = by + 1; y < by + bh - 1; y++) for (let x = bx + 1; x < bx + bw - 1; x++) if (inMap(m, x, y) && inside(x, y)) R[key(x, y)] = 1;
    for (const b of s.buildings ?? []) {
      const def = BUILDING_BY_ID[b.def];
      if (!def || def.layer === 'back' || isRingPiece(b.def) || (def.hp && def.width === 1)) continue;
      const w = def.width + (b.wide ?? 0), d = depth(def);
      for (let y = b.row - TOWN_KEEP; y < b.row + d + TOWN_KEEP; y++)
        for (let x = b.tile - TOWN_KEEP; x < b.tile + w + TOWN_KEEP; x++) if (inBox(x, y) && x > bx && y > by && x < bx + bw - 1 && y < by + bh - 1) R[key(x, y)] = 1;
    }
  }
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

/** How far round each building the shaped ring keeps the town inside it. */
const TOWN_KEEP = 2;

/** The ring's shape for this town's people (data/ringShapes.ts). */
export function ringShapeOf(s: Partial<Pick<GameState, 'origin'>>): RingShape {
  return RING_SHAPE_OF[s.origin ?? 'settlers'] ?? 'box';
}

/** Whether a cell lies inside a shape laid over the ring's box `r`: the box's inside is about -1..1 each way (u, v),
 *  and a shape is drawn about as big, bulging past it here and cutting in there. Every shape keeps a straight run
 *  of wall at the middle of each side, for the gates. */
export function shapeTest(shape: RingShape, r: Rect): (x: number, y: number) => boolean {
  const base = shapeBase(shape, r);
  if (shape === 'box') return base;
  // (a straight run, `GATE_FLAT` cells either side of each side's middle, at the shape's reach there: the gates' room)
  const cx = Math.round(r.x + (r.w - 1) / 2), cy = Math.round(r.y + (r.h - 1) / 2);
  const reach = (dx: number, dy: number) => {
    let n = 0;
    while (n < r.w + r.h && base(cx + dx * (n + 1), cy + dy * (n + 1))) n++;
    return n;
  };
  const w = reach(-1, 0), e = reach(1, 0), n = reach(0, -1), s = reach(0, 1);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    if (Math.abs(dy) <= GATE_FLAT && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? -dx <= w : dx <= e;
    if (Math.abs(dx) <= GATE_FLAT && Math.abs(dy) > Math.abs(dx)) return dy < 0 ? -dy <= n : dy <= s;
    return base(x, y);
  };
}
const GATE_FLAT = 2;
function shapeBase(shape: RingShape, r: Rect): (x: number, y: number) => boolean {
  const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
  const A = Math.max(2, (r.w - 2) / 2), B = Math.max(2, (r.h - 2) / 2);
  const cells = Math.min(A, B);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = dx / A, v = dy / B, au = Math.abs(u), av = Math.abs(v);
    const rho = Math.hypot(u, v), th = Math.atan2(v, u);
    switch (shape) {
      case 'box':
        return au <= 1 && av <= 1;
      case 'star': {
        // (a bastion, an arrowhead, at each corner, `cells` a third of the half-width out)
        if (au <= 1 && av <= 1) return true;
        const k = Math.max(3, Math.round(cells * 0.32));
        return Math.abs(Math.abs(dx) - A) + Math.abs(Math.abs(dy) - B) <= k && au >= 0.6 && av >= 0.6;
      }
      case 'round':
        return rho <= 1.12;
      case 'octagon':
        return au <= 1.04 && av <= 1.04 && au + av <= 1.5;
      case 'hexagon':
        // (flat west and east walls, pointed north and south)
        return au <= 1.08 && av + 0.55 * au <= 1.22;
      case 'coffin': {
        // (widest a third of the way down, narrower at the head and narrower still at the foot)
        const w = v < -0.35 ? 1.05 - ((-0.35 - v) / 0.7) * 0.4 : 1.05 - ((v + 0.35) / 1.4) * 0.5;
        return av <= 1.06 && au <= w;
      }
      case 'grove':
        return rho <= 1.08 + 0.08 * Math.sin(3 * th + 0.7) + 0.06 * Math.sin(5 * th + 2.1) + 0.04 * Math.sin(7 * th + 4.0) - 0.03;
      case 'scalloped':
        return rho <= 1.06 + 0.07 * Math.cos(12 * th);
      case 'flower':
        // (eight petals, one at each side's middle)
        return rho <= 1.0 + 0.14 * Math.cos(8 * th);
      case 'jagged': {
        // (teeth along every side, `TOOTH` cells apart, `TOOTH_DEEP` deep, the middle of each side left straight)
        const tooth = (t: number) => (Math.abs(t) < 3 ? 0 : TOOTH_DEEP * (1 - Math.abs((((Math.abs(t) / TOOTH) % 1) * 2) - 1)));
        if (au >= av) return Math.abs(dx) <= A + tooth(dy) && av <= 1;
        return Math.abs(dy) <= B + tooth(dx) && au <= 1;
      }
      case 'terraced': {
        // (the corners stepped down like terraces on a hillside, `TERRACE` cells a step)
        if (au > 1 || av > 1) return false;
        const fx = Math.floor((A - Math.abs(dx)) / TERRACE), fy = Math.floor((B - Math.abs(dy)) / TERRACE);
        return fx + fy >= Math.floor(cells / TERRACE / 2);
      }
    }
  };
}
const TOOTH = 6;
const TOOTH_DEEP = 2;
const TERRACE = 2;

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
  // (a town with a plan has its gates where its main streets meet the wall: the high street's row, the south road's
  // column, sim/layout.ts)
  const c = s.layout ? { x: s.layout.col, y: s.layout.row } : campCell(s);
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

/** What the ring still needs: the gates first, then the walls and the grates; each with its cell to build on, or a
 *  wild cell to clear first. A wet cell gets a grate where the ring crosses a river or a stream, or runs down one
 *  (`riverCell`); the sea, a lake, the mountain and another building are left as they are (they are the wall
 *  there). */
export function missingPieces(s: GameState, ring: Ring): { def: string; at: Pt; clear: boolean; turned?: boolean; wild?: boolean }[] {
  const out: { def: string; at: Pt; clear: boolean; turned?: boolean; wild?: boolean }[] = [];
  const m = s.land;
  const covered = new Set<number>();
  // (the cells built on, indexed once: nothing is built while the pieces are reckoned, and every cell of the ring asks)
  const on = builtOnIndex(s);
  // (whether the cells are accounted for: a piece stands or is wanted there, or something else stands in its place)
  const want = (def: string, at: Pt, cells: Pt[], turned = false): boolean => {
    const there = cells.map((c) => {
      const b = on(c.x, c.y);
      return b && isRingPiece(b.def) ? b : undefined;
    });
    if (there.some((b) => b && b.ring === ring.gen)) return true;
    if (there.some((b) => b && b.ring !== ring.gen)) return true; // (an older ring's piece stands there: it goes when this ring is up)
    if (cells.some((c) => !inMap(m, c.x, c.y) || !!on(c.x, c.y))) return true;
    const wild = cells.find((c) => WILD.includes(groundAt(m, c.x, c.y)));
    // (trees or rocks on its cells: the piece is laid over them all the same, so the whole wall shows in the plan,
    // gates and all (the owner's ask), and they're cleared before it's built)
    if (wild && cells.every((c) => !WILD.includes(groundAt(m, c.x, c.y)) || wildToClear(m, c.x, c.y)) && canPlace(s, BUILDING_BY_ID[def], at.x, at.y, undefined, turned, true).ok) {
      out.push({ def, at, clear: false, wild: true, ...(turned ? { turned } : {}) });
      return true;
    }
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
/** The ring stands all round: none of its pieces unbuilt (the quick test, first) and none missing. The walk round the
 *  wall is kept until the buildings or the land change (the roaming bands ask every tick). */
let completeOf: { key: string; s: GameState; done: boolean } | null = null;
export function ringComplete(s: GameState, ring: Ring): boolean {
  if (s.buildings.some((b) => b.ring === ring.gen && b.status !== 'done')) return false;
  let done = 0;
  for (const b of s.buildings) if (b.status === 'done') done++;
  const key = `${ring.gen}|${s.buildings.length}|${done}|${s.land.version}|${s.buildings.at(-1)?.id ?? 0}`;
  if (completeOf && completeOf.s === s && completeOf.key === key) return completeOf.done;
  const v = !missingPieces(s, ring).length;
  completeOf = { key, s, done: v };
  return v;
}

/** The planner's turn (from planBuilding, each pass): start or widen one ring project, lay all of its cell pieces and
 *  put every cleared one into work at once (one construction, the owner's ask), then take the old ring down only once
 *  the new one stands. Returns the wild cells to clear for it. */
export function planRing(s: GameState, wanted: boolean, raided = false): number[] {
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
    // (the town has grown past its wall: a wider ring well outside it, `RING_WIDEN` more each side, and never inside
    // the old one; the gates where the roads cross now)
    const rect = widened(s, want, cur.rect);
    const line = shapeRing(s, rect);
    s.ring = { gen: cur.gen + 1, rect, line, wall, gate: GATE_OF[wall], gates: gateCells(s, line) };
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
  // The whole ring is laid out and worked as one project. Its cell pieces stay separate for pathing, damage and art,
  // but all cleared sections can be built in parallel; none waits behind a five-piece queue.
  for (const piece of missing) {
    if (piece.clear) {
      if (clear.length < RING_CLEAR) clear.push(idx(s.land, piece.at.x, piece.at.y));
      continue;
    }
    // (planned: it takes no slot, so a cell cleared or freed later still gets its piece while the queue is full)
    if (placeBlueprint(s, piece.def, piece.at.x, piece.at.y, !!piece.turned, true, !!piece.wild).ok) {
      const b = s.buildings[s.buildings.length - 1];
      b.ring = ring.gen;
      b.planned = true;
    }
  }
  // (the trees and rocks under the pieces laid over the wild, in the ring's order)
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || !b.overgrown) continue;
    // (ground cleared some other way, a wildfire through the wood say, leaves the piece clear: it was once stuck
    // overgrown for good, and the wall never finished)
    refreshOvergrown(s, b);
    if (!b.overgrown) continue;
    for (const i of overgrownCells(s, b)) if (clear.length < RING_CLEAR && !clear.includes(i)) clear.push(i);
  }
  ring.clearing = clear.slice();
  // (the pieces still to be laid, their ground uncleared: the wall is not finished while any wait; `ringCap`)
  ring.unlaid = missing.filter((m) => m.clear).length;
  ringTotalsStale();
  // (a better wall learned since: the pieces still only planned become it)
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || !b.planned) continue;
    if (isGate(b.def) && b.def !== ring.gate) b.def = ring.gate;
    else if (isGrate(b.def) && b.def !== GRATE_OF[ring.wall]) b.def = GRATE_OF[ring.wall];
    else if (!isGate(b.def) && !isGrate(b.def) && b.def !== ring.wall) b.def = ring.wall;
  }
  // (the whole ring goes into work at once, one construction: every section cleared of its trees and rocks is a site
  //  the haulers and builders may take; the town's other sites are served first (people.ts `haulOrder`), so the wall
  //  never takes the wood another site is waiting on)
  for (const b of s.buildings) if (b.ring === ring.gen && b.planned && !b.overgrown) delete b.planned;
  ringTotalsStale();
  return clear;
}

/** Materials wanted by the ring's sections still waiting on their ground to be cleared (the rest are in work, and their
 *  needs counted with every other site's): the town gathers for its whole wall. Nothing once it stands. */
export function ringWants(s: GameState): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  const ring = s.ring;
  if (!ring || ring.done) return out;
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || b.status !== 'blueprint' || !b.planned) continue;
    for (const [m, k] of Object.entries(BUILDING_BY_ID[b.def]?.cost ?? {})) out[m] = (out[m] ?? 0) + (k ?? 0);
  }
  return out;
}

/** How far the ring under way has come, as one job: its sections standing of all, and the share of the whole wall's
 *  work done (each section weighed by its build time). Null with no ring. */
export function ringProgress(s: Pick<GameState, 'ring' | 'buildings'>): { done: number; of: number; share: number } | null {
  const ring = s.ring;
  if (!ring) return null;
  let done = 0, of = 0, work = 0, all = 0;
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || !isRingPiece(b.def)) continue;
    const w = BUILDING_BY_ID[b.def]?.buildSeconds ?? 1;
    of++;
    all += w;
    if (b.status === 'done') {
      done++;
      work += w;
    } else work += w * b.progress;
  }
  return { done, of, share: all ? work / all : 0 };
}

/** The ring's gate cell on a side (for raids: the trail ends there), if the town has a ring. */
export function ringGate(s: GameState, side: -1 | 1): Pt | null {
  const ring = s.ring;
  if (!ring) return null;
  const g = ring.gates.find((p) => sideOn(ring, p) === (side < 0 ? 'w' : 'e'));
  return g ?? null;
}

/** The ring's cells where only the wall may stand: every cell of its line but the gates' (the owner's ask: a road
 *  laid over a cell whose piece was destroyed or never built kept the wall from being raised there again, so roads
 *  cross the ring only at its gates). Kept by the ring, its line and its gates. */
let wallCellsOf: { ring: Ring; key: string; cells: Set<number> } | null = null;
export function ringWallCells(s: GameState): Set<number> {
  const ring = s.ring;
  if (!ring) return new Set();
  const m = s.land;
  const line = lineOf(ring);
  const key = `${ring.gen}|${line.length}|${ring.gates.map((g) => `${g.x},${g.y}`).join(';')}|${m.w}`;
  if (wallCellsOf && wallCellsOf.ring === ring && wallCellsOf.key === key) return wallCellsOf.cells;
  const gates = new Set<number>();
  for (const g of ring.gates) for (const c of gateCovers(ring, g)) gates.add(idx(m, c.x, c.y));
  const cells = new Set<number>();
  for (const p of line) if (inMap(m, p.x, p.y) && !gates.has(idx(m, p.x, p.y))) cells.add(idx(m, p.x, p.y));
  wallCellsOf = { ring, key, cells };
  return cells;
}

/** Whether a road may not run over a cell: a cell of the ring's line with no gate on it (one standing there, or the
 *  ring's own gate cells, may be crossed). */
export function wallOnly(s: GameState, x: number, y: number): boolean {
  if (!s.ring || !inMap(s.land, x, y) || !ringWallCells(s).has(idx(s.land, x, y))) return false;
  return !isGate(builtOn(s, x, y)?.def ?? '');
}

/** Roads and planned streets lying over the ring's wall cells are lifted, so the wall can be raised there (older towns
 *  laid them over broken or missing pieces). Returns how many cells were cleared. */
export function liftRoadsOffWall(s: GameState): number {
  if (!s.ring) return 0;
  const m = s.land;
  let n = 0;
  for (const i of ringWallCells(s)) {
    const x = i % m.w, y = Math.floor(i / m.w);
    const road = isRoad(m, x, y), planned = isPlannedRoad(m, x, y);
    if ((!road && !planned) || !wallOnly(s, x, y)) continue;
    if (road) unsetRoad(m, x, y);
    if (planned) planRoad(m, x, y, false);
    n++;
  }
  return n;
}

// ---- The wall as one construction (the owner's ask: "one large building they work on from anywhere, and the whole thing
// goes up together as one") ----
// While a ring is going up, its pieces (the blueprints of this generation) are one site: one pool of materials
// (`Ring.pool`), one count of work done (`Ring.sec`), one progress that every piece shows. Builders take the nearest
// open spot along the line, spread out (`ringBuilderPick`), haulers carry to the nearest part of it (`ringHaulTarget`),
// and the whole wall, gates and grates with it, turns from blueprint to built in the same tick (`finishRing`). Once it
// stands, a breach is mended piece by piece as before (a hole is a hole).

/** Most of the wall that may be done while pieces of it are still waiting on ground to clear (or not yet laid). */
export const RING_OPEN_CAP = 0.97;
/** Builders along the wall keep this many cells (of crowding) from one another: each builder within `RING_CROWD_CELLS`
 *  of a piece counts as `RING_CROWD_PULL` cells further off, so the crew spreads along the line. */
export const RING_CROWD_CELLS = 3;
export const RING_CROWD_PULL = 5;

/** The ring when `b` is a piece of it still being raised (a blueprint of the ring under way, not mere plans): its
 *  work and materials are the whole wall's. Null for anything else: other sites, and the pieces of a ring that stands
 *  (a mended breach, an upgrade), which are built one at a time. */
export function ringSite(s: Pick<GameState, 'ring'>, b: Pick<Building, 'ring' | 'status' | 'planned'>): Ring | null {
  const ring = s.ring;
  return ring && !ring.done && b.ring === ring.gen && b.status === 'blueprint' && !b.planned ? ring : null;
}

export interface RingTotals {
  /** The blueprints of the ring under way (in work first, then those still only plans). */
  live: Building[];
  planned: number;
  /** The makings of the pieces in work, the build-seconds of those, and of all (plans included). */
  cost: Stock;
  liveSec: number;
  allSec: number;
}
let totalsMade: { s: GameState; ring: Ring; tick: number; n: number; totals: RingTotals } | null = null;
/** What the construction holds now (kept for the tick; `planRing` and a finished wall make it afresh). */
export function ringTotals(s: GameState, ring: Ring): RingTotals {
  if (totalsMade && totalsMade.s === s && totalsMade.ring === ring && totalsMade.tick === s.tick && totalsMade.n === s.buildings.length) return totalsMade.totals;
  const live: Building[] = [];
  const cost: Stock = {};
  let planned = 0, liveSec = 0, allSec = 0;
  const first = ring.sec === undefined;
  const fromPieces: Stock = {};
  let secFrom = 0;
  for (const b of s.buildings) {
    if (b.ring !== ring.gen || b.status !== 'blueprint' || !isRingPiece(b.def)) continue;
    const def = BUILDING_BY_ID[b.def];
    const w = def?.buildSeconds ?? 1;
    allSec += w;
    if (b.planned) {
      planned++;
      continue;
    }
    live.push(b);
    liveSec += w;
    for (const m of MATERIALS) if (def?.cost[m]) cost[m] = (cost[m] ?? 0) + def.cost[m]!;
    if (first) {
      secFrom += w * b.progress;
      for (const m of MATERIALS) if (b.delivered[m]) fromPieces[m] = (fromPieces[m] ?? 0) + b.delivered[m]!;
    }
  }
  // (an older save: each piece had its own progress and makings; they are pooled once)
  if (first) {
    ring.sec = secFrom;
    ring.pool = fromPieces;
  }
  const totals = { live, planned, cost, liveSec, allSec };
  totalsMade = { s, ring, tick: s.tick, n: s.buildings.length, totals };
  return totals;
}
/** Forget the kept totals (pieces were laid, taken or finished). */
export const ringTotalsStale = () => {
  totalsMade = null;
};

/** The makings the whole wall still lacks. */
export function ringStillNeeded(s: GameState, ring: Ring): Stock {
  const t = ringTotals(s, ring);
  const out: Stock = {};
  for (const m of MATERIALS) {
    const need = (t.cost[m] ?? 0) - (ring.pool?.[m] ?? 0);
    if (need > 0) out[m] = need;
  }
  return out;
}

/** The share of the makings on site (as `deliveredShare` is for one building). */
export function ringDeliveredShare(s: GameState, ring: Ring): number {
  const t = ringTotals(s, ring);
  let total = 0, got = 0;
  for (const m of MATERIALS) {
    const n = t.cost[m] ?? 0;
    total += n;
    got += Math.min(n, ring.pool?.[m] ?? 0);
  }
  return total > 0 ? got / total : 1;
}

/** The share of the whole wall's work done. */
export function ringWorkShare(s: GameState, ring: Ring): number {
  const t = ringTotals(s, ring);
  return t.allSec > 0 ? Math.min(1, (ring.sec ?? 0) / t.allSec) : 0;
}

/** How far the work may go now: no further than the makings brought, and while pieces wait on their ground or are
 *  yet to be laid, no further than the pieces in work (and `RING_OPEN_CAP`): the wall is finished all at once. */
export function ringCap(s: GameState, ring: Ring): number {
  const t = ringTotals(s, ring);
  const open = t.planned > 0 || (ring.unlaid ?? 0) > 0;
  const room = open ? Math.min(RING_OPEN_CAP, t.allSec > 0 ? t.liveSec / t.allSec : 0) : 1;
  return Math.min(ringDeliveredShare(s, ring), room);
}

/** Whether the wall has work for a builder now (as `buildableNow` is for one building). */
export function ringBuildable(s: GameState, ring: Ring): boolean {
  const t = ringTotals(s, ring);
  if (!t.live.length) return false;
  const cap = ringCap(s, ring);
  return cap >= 1 || cap - ringWorkShare(s, ring) >= 0.02;
}

/** Add work to the wall (`sec` build-seconds' worth), no further than `ringCap`. Returns whether it is all done and
 *  may be finished. */
export function ringWork(s: GameState, ring: Ring, sec: number): boolean {
  const t = ringTotals(s, ring);
  if (t.allSec <= 0) return false;
  const cap = ringCap(s, ring);
  ring.sec = Math.min(cap * t.allSec, (ring.sec ?? 0) + sec);
  return cap >= 1 && ring.sec >= t.allSec - 1e-9;
}

/** Bring materials to the wall: what it still lacks, taken from `carrying`. */
export function ringDeliver(s: GameState, ring: Ring, carrying: Stock): void {
  const need = ringStillNeeded(s, ring);
  const pool = (ring.pool ??= {});
  for (const m of MATERIALS) {
    const n = Math.min(carrying[m] ?? 0, need[m] ?? 0);
    if (n > 0) {
      pool[m] = (pool[m] ?? 0) + n;
      carrying[m] = (carrying[m] ?? 0) - n;
    }
  }
}

/** Every piece shows the wall's one progress and its share of the makings (the renderer, the planner and the queue read
 *  the pieces): called once a tick while a wall is going up. */
let syncedKey: { ring: Ring; key: string } | null = null;
export function syncRing(s: GameState): void {
  const ring = s.ring;
  if (!ring || ring.done) return;
  const t = ringTotals(s, ring);
  if (!t.live.length) return;
  // (only when something changed: the work, the makings, or the pieces)
  const key = `${ring.sec}|${MATERIALS.map((m) => ring.pool?.[m] ?? 0).join(',')}|${t.live.length}|${t.planned}|${s.buildings.length}`;
  if (syncedKey && syncedKey.ring === ring && syncedKey.key === key) return;
  syncedKey = { ring, key };
  const p = Math.min(0.999, ringWorkShare(s, ring));
  const frac: Partial<Record<Material, number>> = {};
  for (const m of MATERIALS) if (t.cost[m]) frac[m] = Math.min(1, (ring.pool?.[m] ?? 0) / t.cost[m]!);
  for (const b of t.live) {
    b.progress = p;
    const cost = BUILDING_BY_ID[b.def]?.cost ?? {};
    const d: Stock = {};
    for (const m of MATERIALS) if (cost[m]) d[m] = cost[m]! * (frac[m] ?? 0);
    b.delivered = d;
  }
}

/** The whole wall is raised: every piece in work turns built in this tick, gates and grates with the walls. Returns the
 *  number of pieces. */
export function finishRing(s: GameState, ring: Ring): number {
  const t = ringTotals(s, ring);
  for (const b of t.live) {
    const def = BUILDING_BY_ID[b.def];
    b.progress = 1;
    b.status = 'done';
    b.builtAt = s.tick;
    b.delivered = {};
    if (def?.hp) b.hp = def.hp;
  }
  ring.sec = 0;
  ring.pool = {};
  syncedKey = null;
  ringTotalsStale();
  return t.live.length;
}

const distTo = (b: Building, p: Pt) => Math.hypot((b.tile + 0.5) * CELL - p.x, (b.row + 0.5) * CELL - p.y);

/** The pieces for a builder to choose among, nearest to `at` first, each counted further off by the builders already
 *  nearby (`taken`: where builders stand, px), so the crew spreads along the wall. */
export function ringBuilderOrder(s: GameState, ring: Ring, at: Pt, taken: Pt[]): Building[] {
  const crowd = RING_CROWD_CELLS * CELL;
  const cost = new Map<Building, number>();
  for (const b of ringTotals(s, ring).live) {
    const c = { x: (b.tile + 0.5) * CELL, y: (b.row + 0.5) * CELL };
    let n = 0;
    for (const q of taken) if (Math.abs(q.x - c.x) <= crowd && Math.abs(q.y - c.y) <= crowd) n++;
    cost.set(b, distTo(b, at) + n * RING_CROWD_PULL * CELL);
  }
  return [...cost.keys()].sort((a, c) => cost.get(a)! - cost.get(c)! || a.id - c.id);
}

/** The piece a hauler carries to: the nearest to where they stand. */
export function ringHaulTarget(s: GameState, ring: Ring, at: Pt): Building | null {
  let best: Building | null = null, bd = Infinity;
  for (const b of ringTotals(s, ring).live) {
    const d = distTo(b, at);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
