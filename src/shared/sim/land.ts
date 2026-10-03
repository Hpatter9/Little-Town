// The land, seen from above: the town's map is a grid of cells (CELL px square), each a kind of ground. The camp is
// cleared in the middle; woods, rocks, hills and marsh lie about in clumps by the biome; a river winds across with
// fertile banks; on the coast one edge is the sea. Wild cells hold what can be gathered from them (their `pools`).
// Only the open area round the camp is known and usable at first (`open`, in cells); it widens as the town grows.
// Roads are cells marked on top of the ground; people walk the map by `findPath` (A*, eight ways, quicker on roads,
// round water and buildings). Pure data and seeded: the same seed makes the same land.

import { BIOME_DEFS, type Biome } from '../data/biomes';
import type { Material } from '../data/materials';
import { TERRAIN } from '../data/terrain';
import { hashSeed, Rng } from '../rng';

/** One cell's side, in world px (a building's width in cells is its width in the old tiles). */
export const CELL = 32;
/** The map's size in cells, and the open area at founding (cells from the camp's centre). */
export const LAND_W = 96;
export const LAND_H = 96;
export const OPEN_START = 11;
/** The camp's cleared ground, in cells from its centre. */
export const CAMP_CLEAR = 5;
/** At least this many cells of each wild kind lie within the open land at the start (wood, stone, clay and fiber). */
export const MIN_KIND_NEAR = 10;
/** Footpaths: the most a cell wears, how worn it is before a path shows (and shows fully), what one walker stepping
 *  into a cell adds, and what an hour's rest takes off. */
export const WEAR_MAX = 60;
export const WEAR_SHOW = 6;
export const WEAR_FULL = 24;
export const WEAR_STEP = 2;
export const WEAR_DECAY = 1;

/** Beyond the open land, this many cells are seen dimly (the renderer's fog); past them, nothing. */
export const FOG_BAND = 6;

export type Ground = 'grass' | 'forest' | 'rock' | 'marsh' | 'hill' | 'water' | 'fertile' | 'sand' | 'mountain' | 'hall';
const CODE: Record<Ground, string> = { grass: '.', forest: 'f', rock: 'r', marsh: 'm', hill: 'h', water: 'w', fertile: 'F', sand: 's', mountain: 'M', hall: 'H' };
const GROUND: Record<string, Ground> = Object.fromEntries(Object.entries(CODE).map(([g, c]) => [c, g as Ground]));
/** The wild kinds, which must be cleared (gathered out) before building. */
export const WILD: readonly Ground[] = ['forest', 'rock', 'marsh', 'hill'];

export interface LandMap {
  w: number;
  h: number;
  /** One character per cell, row by row (see CODE). */
  cells: string;
  /** What each wild cell still holds, by cell index. */
  pools: Record<number, Partial<Record<Material, number>>>;
  /** Road cells, one character per cell ('#' road, '.' none). */
  roads: string;
  /** Cells marked for gathering (clearing), by index. */
  marked: number[];
  /** The camp's centre cell, and how far from it the land is open (cells). */
  camp: { x: number; y: number };
  open: number;
  /** Bumped whenever the ground, the roads or what stands on them change (pathfinding caches by it). */
  version: number;
  /** Foot traffic, one character per cell: '0' plus how worn (up to `WEAR_MAX`). A worn footpath shows from
   *  `WEAR_SHOW`, fully at `WEAR_FULL`; every hour each cell grasses over by `WEAR_DECAY`. Absent until someone walks. */
  wear?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}
export const idx = (m: Pick<LandMap, 'w'>, x: number, y: number) => y * m.w + x;
/** A cell index's cell. */
export const cellAt = (m: Pick<LandMap, 'w'>, i: number): Pt => ({ x: i % m.w, y: Math.floor(i / m.w) });
/** The cell a world point (px) is in, and a cell index's centre in px. */
export const cellOf = (p: Pt): Pt => ({ x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) });
export const cellCentre = (m: Pick<LandMap, 'w'>, i: number): Pt => centreOf(i % m.w, Math.floor(i / m.w));
/** Chessboard distance between cells. */
export const cheb = (a: Pt, b: Pt) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const inMap = (m: Pick<LandMap, 'w' | 'h'>, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export const groundAt = (m: LandMap, x: number, y: number): Ground => (inMap(m, x, y) ? GROUND[m.cells[idx(m, x, y)]] : 'water');
export const isRoad = (m: LandMap, x: number, y: number) => inMap(m, x, y) && m.roads[idx(m, x, y)] === '#';
/** Within the open (known, usable) land. */
export const isOpen = (m: LandMap, x: number, y: number) => inMap(m, x, y) && Math.hypot(x - m.camp.x, y - m.camp.y) <= m.open;
/** Ground that can be built on as it is. */
export const buildable = (g: Ground) => g === 'grass' || g === 'fertile' || g === 'sand';
/** The mountain's rock, which a hold's rooms are carved into (`mountain`: solid, nothing crosses it), and the halls and
 *  galleries already cut (`hall`: walked through). */
export const carvable = (g: Ground) => g === 'mountain' || g === 'hall';
/** How the land is shaped besides its biome: `mountain`, half of it solid rock north of the camp (the dwarves). */
export type LandShape = 'mountain';
/** The mountain's foot runs this many rows above the camp (level by the camp, ragged further off). */
export const MOUNTAIN_FOOT = 3;

/** Mark a cell for gathering, or unmark it. */
export function setMarked(m: LandMap, i: number, on: boolean): void {
  const at = m.marked.indexOf(i);
  if (on && at < 0) m.marked.push(i);
  else if (!on && at >= 0) m.marked.splice(at, 1);
  m.version++;
}
export const isMarked = (m: LandMap, i: number) => m.marked.includes(i);

/** Set one cell's ground (clearing a wild cell, say). */
export function setGround(m: LandMap, x: number, y: number, g: Ground): void {
  const i = idx(m, x, y);
  m.cells = m.cells.slice(0, i) + CODE[g] + m.cells.slice(i + 1);
  if (!WILD.includes(g)) {
    delete m.pools[i];
    setMarked(m, i, false);
  }
  m.version++;
}

/** Lay (or lift) a road on a cell. */
export function setRoad(m: LandMap, x: number, y: number, on = true): void {
  const i = idx(m, x, y);
  m.roads = m.roads.slice(0, i) + (on ? '#' : '.') + m.roads.slice(i + 1);
  m.version++;
}
/** Take a road up again (a castle's room built over it: the floor covers where it ran). */
export function unsetRoad(m: LandMap, x: number, y: number): void {
  if (!inMap(m, x, y)) return;
  const i = idx(m, x, y);
  if (m.roads[i] !== '#') return;
  m.roads = m.roads.slice(0, i) + '.' + m.roads.slice(i + 1);
  m.version++;
}

/* ------------------------------------------------------------ making the land */

/** Smooth value noise in 0..1 (a few octaves), seeded. */
function noise(seed: number, scale: number) {
  const at = (ix: number, iy: number) => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) & 0xffff) / 0xffff;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const one = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x: number, y: number) => (one(x / scale, y / scale) * 0.6 + one(x / (scale / 2), y / (scale / 2)) * 0.3 + one(x / (scale / 4), y / (scale / 4)) * 0.1);
}

export function makeLand(seed: string, biome: Biome = 'forest', shape?: LandShape): LandMap {
  const seedHash = hashSeed(seed);
  const w = LAND_W;
  const h = LAND_H;
  const camp = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
  const grid: Ground[] = new Array(w * h).fill('grass');
  const def = BIOME_DEFS[biome];
  // how wild the land is (more so further out), and which wild kind, from two noise fields
  const wild = noise(seedHash ^ 0x11, 9);
  const kind = noise(seedHash ^ 0x23, 6);
  const weights = Object.entries(def.mid) as [Exclude<Ground, 'grass' | 'water' | 'fertile' | 'sand'>, number][];
  const total = weights.reduce((n, [, v]) => n + v, 0);
  const pickKind = (v: number) => {
    let acc = 0;
    for (const [k, wt] of weights) {
      acc += wt / total;
      if (v * 0.999 < acc) return k;
    }
    return weights[weights.length - 1][0];
  };
  const wildShare = biome === 'desert' ? 0.4 : 0.5; // (how much of the land is wild)
  // (the noise bunches round its middle, so the threshold is taken from its spread: exactly that share is wild)
  const wildness = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - camp.x, y - camp.y);
      const lift = Math.min(0.08, Math.max(0, (d - CAMP_CLEAR - 2) * 0.006)); // (wilder further out)
      wildness[y * w + x] = wild(x, y) + lift;
    }
  const sorted = Array.from(wildness).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * (1 - wildShare))];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // (the kind field spread over 0..1: noise bunches round the middle)
      const k = Math.max(0, Math.min(1, (kind(x, y) - 0.5) * 2.4 + 0.5));
      if (wildness[y * w + x] >= threshold) grid[y * w + x] = pickKind(k);
      else if (biome === 'desert') grid[y * w + x] = 'sand';
    }

  // a river winding across, from one edge to the other, wide of the camp
  const rng = Rng.from(seedHash, 7);
  const across = rng.chance(0.5);
  const side = rng.chance(0.5) ? 1 : -1;
  let pos = (across ? camp.y : camp.x) + side * rng.int(CAMP_CLEAR + 5, CAMP_CLEAR + 12);
  const river: number[] = [];
  for (let t = 0; t < (across ? w : h); t++) {
    pos += rng.int(-1, 1) * (rng.chance(0.55) ? 1 : 0);
    const near = (across ? camp.y : camp.x) + side * (CAMP_CLEAR + 4);
    if (side > 0 ? pos < near : pos > near) pos = near;
    const width = biome === 'desert' ? 1 : rng.chance(0.3) ? 3 : 2;
    for (let k = 0; k < width; k++) {
      const [x, y] = across ? [t, pos + k] : [pos + k, t];
      if (x >= 0 && y >= 0 && x < w && y < h) river.push(y * w + x);
    }
  }
  for (const i of river) grid[i] = 'water';
  // its banks: fertile soil, here and there marsh (none in the desert's dry beds)
  for (const i of river) {
    const x0 = i % w;
    const y0 = Math.floor(i / w);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (grid[j] === 'water') continue;
        // (the banks are rich soil: the river clears them; further off, only open ground turns)
        const near = Math.max(Math.abs(dx), Math.abs(dy)) <= 2;
        if (near || grid[j] === 'grass' || grid[j] === 'sand') grid[j] = biome !== 'desert' && rng.chance(0.12) ? 'marsh' : 'fertile';
      }
  }
  // the coast: the sea along one edge, a strip of sand inland of it
  if (biome === 'coast') {
    const edge = rng.int(0, 3);
    const shore = noise(seedHash ^ 0x5e, 7);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = edge === 0 ? x : edge === 1 ? w - 1 - x : edge === 2 ? y : h - 1 - y;
        const depth = 10 + shore(x, y) * 8;
        if (d < depth) grid[y * w + x] = 'water';
        else if (d < depth + 2.5) grid[y * w + x] = 'sand';
      }
  }
  // the camp's clearing (and a little fertile ground just beside it, for the first fields)
  for (let y = camp.y - CAMP_CLEAR; y <= camp.y + CAMP_CLEAR; y++)
    for (let x = camp.x - CAMP_CLEAR; x <= camp.x + CAMP_CLEAR; x++) if (Math.hypot(x - camp.x, y - camp.y) <= CAMP_CLEAR + 0.5) grid[y * w + x] = biome === 'desert' ? 'sand' : 'grass';

  // the mountain: solid rock over the whole north half, its foot MOUNTAIN_FOOT rows above the camp, level there and
  // ragged further off (the river and the shore are swallowed where they ran into it)
  if (shape === 'mountain') {
    const foot = noise(seedHash ^ 0x7a, 8);
    for (let x = 0; x < w; x++) {
      const off = Math.min(1, Math.max(0, (Math.abs(x - camp.x) - 7) / 12)); // (level by the gate, then ragged)
      const line = camp.y - MOUNTAIN_FOOT - Math.round((foot(x, 0) - 0.5) * 8 * off);
      for (let y = 0; y <= line && y < h; y++) grid[y * w + x] = 'mountain';
    }
  }

  // every kind of wild land within reach of the camp: a town must find wood, stone, clay and fiber close by. A kind
  // the open land is short of takes over a patch of the commonest kind, nearest the camp first.
  const openWild = () => {
    const out: number[] = [];
    for (let y = camp.y - OPEN_START; y <= camp.y + OPEN_START; y++)
      for (let x = camp.x - OPEN_START; x <= camp.x + OPEN_START; x++)
        if (x >= 0 && y >= 0 && x < w && y < h && Math.hypot(x - camp.x, y - camp.y) <= OPEN_START && WILD.includes(grid[y * w + x])) out.push(y * w + x);
    return out.sort((a, b) => Math.hypot((a % w) - camp.x, Math.floor(a / w) - camp.y) - Math.hypot((b % w) - camp.x, Math.floor(b / w) - camp.y) || a - b);
  };
  for (const [k] of weights) {
    const cells = openWild();
    const count = (g: Ground) => cells.filter((i) => grid[i] === g).length;
    if (count(k) >= MIN_KIND_NEAR) continue;
    const commonest = weights.map(([g]) => g).sort((a, b) => count(b) - count(a))[0];
    if (commonest === k) continue;
    // (a patch: the nearest cell of the commonest kind and its wild neighbours, until there's enough)
    let need = MIN_KIND_NEAR - count(k);
    for (const i of cells) {
      if (need <= 0) break;
      if (grid[i] !== commonest) continue;
      const x0 = i % w;
      const y0 = Math.floor(i / w);
      for (let dy = -1; dy <= 1 && need > 0; dy++)
        for (let dx = -1; dx <= 1 && need > 0; dx++) {
          const j = (y0 + dy) * w + x0 + dx;
          if (x0 + dx < 0 || x0 + dx >= w || y0 + dy < 0 || y0 + dy >= h || grid[j] !== commonest) continue;
          grid[j] = k;
          need--;
        }
    }
  }

  // what the wild cells hold
  const pools: LandMap['pools'] = {};
  const poolRng = Rng.from(seedHash, 9);
  grid.forEach((g, i) => {
    if (!WILD.includes(g)) return;
    const pool: Partial<Record<Material, number>> = {};
    for (const [mat, [lo, hi]] of Object.entries(TERRAIN[g as keyof typeof TERRAIN].pool) as [Material, [number, number]][]) {
      const n = poolRng.int(lo, hi);
      if (n > 0) pool[mat] = n;
    }
    pools[i] = pool;
  });

  return { w, h, cells: grid.map((g) => CODE[g]).join(''), pools, roads: '.'.repeat(w * h), marked: [], camp, open: OPEN_START, version: 0 };
}

/* ------------------------------------------------------------ building on it */

/** Whether a footprint can go here: inside the open land, on buildable ground, clear of roads and of `taken`. */
export function fits(m: LandMap, r: Rect, taken: readonly Rect[] = [], opts: { roads?: boolean; carve?: boolean } = {}): boolean {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!isOpen(m, x, y) || !(opts.carve ? carvable : buildable)(groundAt(m, x, y))) return false;
      if (!opts.roads && isRoad(m, x, y)) return false;
    }
  return !taken.some((t) => overlaps(t, r));
}
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The cell in front of a footprint's door: the middle of its front (bottom) edge, one cell out. */
export const doorOf = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + r.h });
/** A cell's centre in world px. */
export const centreOf = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });

/** The cells at chessboard distance r round a cell (r 0: the cell itself). */
export function ringCells(cx: number, cy: number, r: number): Pt[] {
  if (r === 0) return [{ x: cx, y: cy }];
  const out: Pt[] = [];
  for (let x = cx - r; x <= cx + r; x++) out.push({ x, y: cy - r }, { x, y: cy + r });
  for (let y = cy - r + 1; y <= cy + r - 1; y++) out.push({ x: cx - r, y }, { x: cx + r, y });
  return out;
}

/** Whether a footprint's door cell is free to stand on (open, buildable or road, under nothing). */
export function doorFree(m: LandMap, r: Rect, taken: readonly Rect[]): boolean {
  const d = doorOf(r);
  return isOpen(m, d.x, d.y) && (buildable(groundAt(m, d.x, d.y)) || isRoad(m, d.x, d.y)) && !taken.some((t) => inRect(t, d.x, d.y));
}

/** The nearest place out from `from` for a w by h footprint: rings outward, each ring's spots sorted by `prefer`
 *  (lower first; nearer a road, say). `inside`: it must lie within this rectangle; `avoid`: and clear of this one;
 *  `ok`: and pass this test; `door: false`: its door cell needn't be free (a castle's room). Null if there's none
 *  within `maxR` rings. */
export function spiralSpot(m: LandMap, w: number, h: number, taken: readonly Rect[], from: Pt, opts: { maxR?: number; inside?: Rect; avoid?: Rect; prefer?: (r: Rect) => number; roads?: boolean; ok?: (r: Rect) => boolean; door?: boolean; carve?: boolean } = {}): Rect | null {
  const maxR = opts.maxR ?? m.open + 2;
  for (let r = 0; r <= maxR; r++) {
    let best: Rect | null = null;
    let bestScore = Infinity;
    for (const c of ringCells(from.x, from.y, r)) {
      const rect = { x: c.x - Math.floor(w / 2), y: c.y - Math.floor(h / 2), w, h };
      if (opts.inside && !(rect.x >= opts.inside.x && rect.y >= opts.inside.y && rect.x + w <= opts.inside.x + opts.inside.w && rect.y + h <= opts.inside.y + opts.inside.h)) continue;
      if (opts.avoid && overlaps(opts.avoid, rect)) continue;
      if (!fits(m, rect, taken, { roads: opts.roads, carve: opts.carve }) || (opts.door !== false && !doorFree(m, rect, taken))) continue;
      if (opts.ok && !opts.ok(rect)) continue;
      const score = opts.prefer ? opts.prefer(rect) : 0;
      if (score < bestScore) {
        bestScore = score;
        best = rect;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Chessboard distance from a cell to the nearest road (up to `max`), for laying buildings along the roads. */
export function roadDistance(m: LandMap, p: Pt, max = 6): number {
  for (let r = 0; r <= max; r++) for (const c of ringCells(p.x, p.y, r)) if (isRoad(m, c.x, c.y)) return r;
  return max + 1;
}

/* ------------------------------------------------------------ getting about */

/** What a step onto a cell costs (Infinity: can't), on its own ground and road. */
export function stepCost(m: LandMap, x: number, y: number, blocked?: (x: number, y: number) => boolean): number {
  if (!inMap(m, x, y)) return Infinity;
  if (isRoad(m, x, y)) return 0.55; // (a road bridges water too)
  if (blocked?.(x, y)) return Infinity;
  switch (groundAt(m, x, y)) {
    case 'water':
      return Infinity;
    case 'forest':
      return 1.7;
    case 'marsh':
      return 2.2;
    case 'hill':
      return 1.8;
    case 'rock':
      return 2.4;
    case 'mountain':
      return Infinity;
    default:
      return 1;
  }
}

/** Limits on a path search: how many cells to look at, and what wading through water costs (none: it can't be). */
export interface PathOpts {
  maxNodes?: number;
  ford?: number;
}

/** The cheapest way from one cell to another (cells, the start left out), or null if there's none. Eight ways, no
 *  corner-cutting past what can't be crossed; `blocked` marks cells stood on (buildings), the goal always allowed. */
export function findPath(m: LandMap, from: { x: number; y: number }, to: { x: number; y: number }, blocked?: (x: number, y: number) => boolean, limits: number | PathOpts = 12000): { x: number; y: number }[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const opts: PathOpts = typeof limits === 'number' ? { maxNodes: limits } : limits;
  const maxNodes = opts.maxNodes ?? 12000;
  const W = m.w;
  const goal = to.y * W + to.x;
  const raw = (x: number, y: number, b?: typeof blocked) => {
    const c = stepCost(m, x, y, b);
    // (a raiding party wades a river where it must: water costs `ford`, not everything)
    return c === Infinity && opts.ford !== undefined && inMap(m, x, y) && groundAt(m, x, y) === 'water' && !b?.(x, y) ? opts.ford : c;
  };
  const cost = (x: number, y: number) => (x === to.x && y === to.y ? Math.min(raw(x, y), 1) : raw(x, y, blocked));
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const start = from.y * W + from.x;
  g.set(start, 0);
  // a binary heap of [f, cell]
  const heap: [number, number][] = [];
  const push = (f: number, c: number) => {
    heap.push([f, c]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };
  const hfn = (x: number, y: number) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return 0.55 * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)); // (admissible: roads are the cheapest steps)
  };
  push(hfn(from.x, from.y), start);
  let seen = 0;
  while (heap.length) {
    const [, c] = pop();
    if (c === goal) break;
    if (++seen > maxNodes) return null;
    const cx = c % W;
    const cy = (c - cx) / W;
    const gc = g.get(c)!;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        const step = cost(nx, ny);
        if (step === Infinity) continue;
        // (no cutting a corner past something that can't be crossed)
        if (dx && dy && (cost(cx + dx, cy) === Infinity || cost(cx, cy + dy) === Infinity)) continue;
        const n = ny * W + nx;
        const ng = gc + step * (dx && dy ? 1.414 : 1);
        if (ng < (g.get(n) ?? Infinity)) {
          g.set(n, ng);
          came.set(n, c);
          push(ng + hfn(nx, ny), n);
        }
      }
  }
  if (!came.has(goal)) return null;
  const out: { x: number; y: number }[] = [];
  for (let c = goal; c !== start; c = came.get(c)!) out.push({ x: c % W, y: Math.floor(c / W) });
  return out.reverse();
}

/* ------------------------------------------------------------ footpaths */

/** How worn a cell is by walking (0..WEAR_MAX). */
export const wearAt = (m: Pick<LandMap, 'wear'>, i: number): number => (m.wear ? m.wear.charCodeAt(i) - 48 : 0);

/** Someone stepped into a cell: it wears a little more (never a road, which is already made). */
export function addWear(m: LandMap, i: number, n = WEAR_STEP): void {
  if (i < 0 || i >= m.w * m.h || m.roads[i] === '#') return;
  if (!m.wear) m.wear = '0'.repeat(m.w * m.h);
  const v = Math.min(WEAR_MAX, wearAt(m, i) + n);
  m.wear = m.wear.slice(0, i) + String.fromCharCode(48 + v) + m.wear.slice(i + 1);
}

/** An hour passes: every worn cell grasses over a little; with nothing worn the field is dropped. */
export function decayWear(m: LandMap): void {
  if (!m.wear) return;
  let out = '';
  let any = false;
  for (let i = 0; i < m.wear.length; i++) {
    const v = Math.max(0, m.wear.charCodeAt(i) - 48 - WEAR_DECAY);
    if (v > 0) any = true;
    out += String.fromCharCode(48 + v);
  }
  if (any) m.wear = out;
  else delete m.wear;
}
