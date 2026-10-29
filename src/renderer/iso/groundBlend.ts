// The ground's kinds meeting softly (docs/notes/ground-blend.md). Each cell is still one kind of ground (its kit tile,
// tinted), but where two unlike cells meet, the one that lies over the other (grass over a marsh, a field's edge or a
// path; land over water) reaches a little way into its neighbour with a ragged, dithered pixel edge made from its own
// tile's pixels, and water meets land with a strip of sand and a paler strip of shallow water. No pack has edge tiles
// for the kits' diamonds, so the edges are made here.
//
// Pure (no Pixi, no DOM): the view (iso/isoView.ts) turns the kit tiles into pixel arrays and bakes the ground a chunk
// of cells at a time into one texture with `bakeChunk`.

import type { Biome } from '../../shared/data/biomes';
import type { Ground } from '../../shared/sim/land';
import { groundTile } from './isoKits';
import { cellHash } from './isoTown';
import { ISO_TH, ISO_TW } from './isoMath';

/** What lies over what, lowest first: a kind with a higher rank reaches into its lower neighbour. Water lies under
 *  everything, then the shore's sand, bare rock, a field's soil, a street's stones, bare earth (a yard, a hold's
 *  floor), the marsh, the grass, and the woods' floor on top. */
export const GROUND_RANK: Readonly<Record<Ground, number>> = {
  water: 0,
  shallows: 1,
  sand: 2,
  rock: 3,
  mountain: 3,
  hall: 6,
  marsh: 7,
  grass: 8,
  fertile: 8,
  hill: 8,
  forest: 9,
};
/** The ranks of the per-cell grounds laid by the town (iso/isoView.ts `paintCells` before): a field, a street, a yard. */
export const FIELD_RANK = 4;
export const STREET_RANK = 5;
export const BARE_RANK = 6;
/** How much a fully worn footpath sinks below its own ground's rank (grass creeps back over a path's edge). */
const WEAR_SINK = 2;

/** How a cell's ground is drawn: a kit tile (0 open, 1 bare, 2 path, 3 field) tinted, a tile to every `n` cells,
 *  its rank (`GROUND_RANK`, with a tie-break so two kinds of one rank still meet the same way everywhere), whether it
 *  is water, whether it takes a sandy shore where it meets water, and a footpath's wear (the bare tile over it, a
 *  share 0..1). */
export interface Surface {
  tile: 0 | 1 | 2 | 3;
  tint: number;
  n: number;
  rank: number;
  wet: boolean;
  shore: boolean;
  wear: number;
}

/** What the town lays on a cell (a field, a street, a yard's bare earth), if anything. */
export type Laid = 'field' | 'street' | 'yard' | null;

/** A cell's surface: its ground (tinted for the biome, iso/isoKits.ts `groundTile`), or what the town laid on it (a
 *  field, a street or a yard: a kit tile to each cell, as they were drawn before), and a footpath's wear. Water takes
 *  nothing laid on it. `n`: how many cells one of the kit's ground tiles covers. */
export function cellSurface(g: Ground, laid: Laid, wear: number, biome: Biome, n: number): Surface {
  const wet = g === 'water' || g === 'shallows';
  if (laid && !wet) {
    const tile = laid === 'field' ? 3 : laid === 'street' ? 2 : 1;
    const rank = laid === 'field' ? FIELD_RANK : laid === 'street' ? STREET_RANK : BARE_RANK;
    return { tile, tint: 0xffffff, n: 1, rank: rank + tieBreak(tile, 0xffffff), wet: false, shore: true, wear: 0 };
  }
  const t = groundTile(g, false, false, biome);
  const w = wet ? 0 : Math.round(wear * 20) / 20;
  return { tile: t.tile, tint: t.tint, n, rank: GROUND_RANK[g] - w * WEAR_SINK + tieBreak(t.tile, t.tint), wet, shore: !wet && g !== 'marsh', wear: w };
}

/** A small, fixed nudge to a rank from the tile and its tint, so two different surfaces never tie. */
const tieBreak = (tile: number, tint: number): number => (((tint >>> 0) % 997) + tile * 997) / 1e7;

/** A surface's identity, for sharing one record between cells. */
export const surfaceKey = (s: Surface): string => `${s.tile}:${s.tint}:${s.n}:${s.wear}:${s.rank.toFixed(7)}:${s.wet ? 1 : 0}`;

/** The shore's sand (the bare tile tinted as sand, for the biome). */
export const shoreSurface = (biome: Biome, n: number): Surface => ({ ...cellSurface('sand', null, 0, biome, n), shore: false });

/** A kit tile's top face as pixels (32-bit, the canvas's byte order: red lowest), sized for `n` cells: `n * ISO_TW`
 *  by `n * ISO_TH`, every pixel opaque (the face's edge filled out from inside, so a sample at its rim never shows
 *  through). */
export interface TilePx {
  w: number;
  h: number;
  px: Uint32Array;
}

/** How far (in cells) a cell's middle weighs on the pixels round it; how far ahead a kind that lies over another is
 *  for each step of rank (`GROUND_RANK`); how much water a land pixel has near it before it turns to the shore's sand,
 *  and how much land near a water pixel before it runs paler. */
export const KERNEL = 1.45;
export const RANK_BIAS = 0.008;
export const SHORE = 0.24;
export const FOAM = 0.2;
/** How much of the shore's sand shows over the land's own ground in its strip, and how much paler the shallows run. */
const SAND = 0.6;
const PALE = 0.12;
/** How ragged an edge is (the low wobble's share), and how wide its dithered band (in shares). */
const WOBBLE = 0.2;
const DITHER = 0.1;

/** The window of cells round a pixel's cell, as offsets. */
const WX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
const WY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
/** Scratch for a cell's window: each slot's surface, its lead, whether it's water, its wobble's offset, its share. */
const slotId = new Int32Array(9);
const slotOf = new Int32Array(9);
const slotBias = new Float64Array(9);
const slotWet = new Uint8Array(9);
const slotSalt = new Int32Array(9);
const share = new Float64Array(9);
const unlikeK = new Int32Array(9);
const shoreK = new Int32Array(9);
/** Below these shares a pixel can't change hands (its own kind leads by more than the ranks, the wobble and the
 *  dither can make up), take the shore's sand, or run paler: it is its own cell's pixel, unweighed. */
const SAFE_UNLIKE = (1 - 10 * RANK_BIAS - WOBBLE - DITHER) / 2 - 0.01;
const SAFE_SHORE = SHORE - WOBBLE / 2 - 0.05;
const SAFE_FOAM = FOAM - WOBBLE / 2 - 0.05;

/** The 4x4 ordered dither, as thresholds 0..1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** A smooth wobble (-0.5..0.5) over the screen's px, so edges wander rather than run straight: value noise on a
 *  lattice every `WOB_STEP` px, made once as a table that repeats every `WOB_SIZE` px. */
const WOB_STEP = 16;
const WOB_SIZE = 256;
const WOB = (() => {
  const L = WOB_SIZE / WOB_STEP;
  const t = new Float32Array(WOB_SIZE * WOB_SIZE);
  for (let y = 0; y < WOB_SIZE; y++)
    for (let x = 0; x < WOB_SIZE; x++) {
      const ix = Math.floor(x / WOB_STEP);
      const iy = Math.floor(y / WOB_STEP);
      const tx = (x % WOB_STEP) / WOB_STEP;
      const ty = (y % WOB_STEP) / WOB_STEP;
      const h = (a: number, b: number) => cellHash(a % L, b % L, 41);
      const top = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * tx;
      const bot = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * tx;
      t[y * WOB_SIZE + x] = top + (bot - top) * ty - 0.5;
    }
  return t;
})();
const wobble = (gx: number, gy: number): number => WOB[(gy & (WOB_SIZE - 1)) * WOB_SIZE + (gx & (WOB_SIZE - 1))];
/** The eight neighbours, the four sides first. */
const DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** A pixel times a tint (both the canvas's byte order: red lowest), alpha opaque. */
function tinted(c: number, tint: number): number {
  if (tint === 0xffffff) return c | 0xff000000;
  const r = ((c & 255) * ((tint >> 16) & 255) + 127) / 255;
  const g = (((c >> 8) & 255) * ((tint >> 8) & 255) + 127) / 255;
  const b = (((c >> 16) & 255) * (tint & 255) + 127) / 255;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
/** Two pixels mixed, `t` of the second. */
function mix(a: number, b: number, t: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (0xff000000 | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}
/** A pixel taken part way to white (the shallow water's pale strip). */
const paler = (c: number, t: number): number => mix(c, 0xffffffff, t);

/** What a chunk is baked from: its first cell and size, the land's size, each cell's surface (an index into
 *  `surfaces`, -1 off the land), the shore's sand, and the kit tiles' pixels for a tile at a size (null while one
 *  hasn't loaded). */
export interface ChunkIn {
  x0: number;
  y0: number;
  size: number;
  landW: number;
  landH: number;
  surfAt: (x: number, y: number) => number;
  surfaces: readonly Surface[];
  shore: Surface;
  tileOf: (tile: number, n: number) => TilePx | null;
}

/** A chunk's picture: `size * ISO_TW` by `size * ISO_TH` px, its cells' diamond in the middle (its top corner, cell
 *  (x0, y0)'s, at the top middle), the corners outside it clear. */
export const chunkPx = (size: number): { w: number; h: number } => ({ w: size * ISO_TW, h: size * ISO_TH });

/** A surface ready to sample: its tile's pixels tinted, the tile's cells, and a footpath's dirt (untinted, a tile to
 *  a cell) with its share. */
interface Ready {
  px: Uint32Array;
  n: number;
  wear: number;
  dirt: Uint32Array | null;
}
function ready(s: Surface, tileOf: ChunkIn['tileOf']): Ready | null {
  const t = tileOf(s.tile, s.n);
  if (!t) return null;
  const dirt = s.wear > 0 ? tileOf(1, 1) : null;
  if (s.wear > 0 && !dirt) return null;
  const px = new Uint32Array(t.px.length);
  for (let k = 0; k < px.length; k++) px[k] = tinted(t.px[k], s.tint);
  if (dirt) for (let k = 0; k < px.length; k++) px[k] = px[k] | 0xff000000;
  return { px, n: s.n, wear: s.wear, dirt: dirt ? dirt.px : null };
}

/** A cell's pixels, the same for every cell: the px of its diamond inside the box `ISO_TW` by `ISO_TH` below its top
 *  corner (`at`, as box px), and where each lies in the cell (`fu`, `fv`, 0..1 along x and y). */
const CELL_PX = (() => {
  const at: number[] = [];
  const fu: number[] = [];
  const fv: number[] = [];
  for (let qy = 0; qy < ISO_TH; qy++)
    for (let qx = 0; qx < ISO_TW; qx++) {
      const X = (qx + 0.5 - ISO_TW / 2) / ISO_TW;
      const Y = (qy + 0.5) / ISO_TH;
      const u = Y + X;
      const v = Y - X;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
      at.push(qy * ISO_TW + qx);
      fu.push(u);
      fv.push(v);
    }
  return { at: Int32Array.from(at), fu: Float32Array.from(fu), fv: Float32Array.from(fv) };
})();
/** How much each cell of the 3x3 window round a cell (`WX`, `WY`) weighs on each of the cell's px (`CELL_PX`), by how
 *  near its middle is (within `KERNEL`), the nine summing to one: made once. */
const WEIGHTS = (() => {
  const m = CELL_PX.at.length;
  const t = new Float64Array(m * 9);
  for (let q = 0; q < m; q++) {
    let total = 0;
    for (let k = 0; k < 9; k++) {
      const dx = WX[k] + 0.5 - CELL_PX.fu[q];
      const dy = WY[k] + 0.5 - CELL_PX.fv[q];
      const d = Math.sqrt(dx * dx + dy * dy);
      const w = d >= KERNEL ? 0 : (1 - d / KERNEL) * (1 - d / KERNEL);
      t[q * 9 + k] = w;
      total += w;
    }
    for (let k = 0; k < 9; k++) t[q * 9 + k] /= total;
  }
  return t;
})();

/** For a tile to every `n` cells, a cell at (a, b) in its block, turned about or not: the tile's px under each of the
 *  cell's px (`CELL_PX`), made once. */
const LOOKUPS = new Map<number, Int32Array>();
function lookup(n: number, a: number, b: number, flip: boolean): Int32Array {
  const key = ((n * 16 + a) * 16 + b) * 2 + (flip ? 1 : 0);
  const had = LOOKUPS.get(key);
  if (had) return had;
  const w = n * ISO_TW;
  const h = n * ISO_TH;
  const m = CELL_PX.at.length;
  const out = new Int32Array(m);
  for (let q = 0; q < m; q++) {
    const fu = (a + CELL_PX.fu[q]) / n;
    const fv = (b + CELL_PX.fv[q]) / n;
    let tx = (fu - fv + 1) * 0.5 * w;
    if (flip) tx = w - tx;
    const ty = (fu + fv) * 0.5 * h;
    const ix = Math.min(w - 1, Math.max(0, Math.floor(tx)));
    const iy = Math.min(h - 1, Math.max(0, Math.floor(ty)));
    out[q] = iy * w + ix;
  }
  LOOKUPS.set(key, out);
  return out;
}

/** The eight neighbours as offsets, the four sides first. */
const DX = DIRS.map((d) => d[0]);
const DY = DIRS.map((d) => d[1]);

/** Bakes a chunk of the ground into `out` (`chunkPx(size)`, the canvas's byte order). Whether every tile it needs
 *  had loaded (if not, bake it again later). */
export function bakeChunk(out: Uint32Array, c: ChunkIn): boolean {
  const { x0, y0, size, surfaces, tileOf } = c;
  const { w } = chunkPx(size);
  // (each cell's surface, a ring of neighbours round the chunk too)
  const R = size + 2;
  const S = new Int32Array(R * R);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) S[j * R + i] = c.surfAt(x0 + i - 1, y0 + j - 1);
  const rd: (Ready | null)[] = [];
  for (const si of new Set(S)) {
    if (si < 0) continue;
    const r = ready(surfaces[si], tileOf);
    if (!r) return false;
    rd[si] = r;
  }
  const shore = ready(c.shore, tileOf);
  if (!shore) return false;
  out.fill(0);
  const m = CELL_PX.at.length;
  const offs = offsetsFor(w);
  const half = (size * ISO_TW) / 2;
  // (the screen px of the chunk's picture's top-left, for the dither and the wobble: whole px, the same in every chunk)
  const gx0 = ((x0 - y0) * ISO_TW) / 2 - half;
  const gy0 = ((x0 + y0) * ISO_TH) / 2;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = x0 + i;
      const y = y0 + j;
      const at = (j + 1) * R + i + 1;
      const me = S[at];
      if (me < 0 || x >= c.landW || y >= c.landH) continue;
      const mine = surfaces[me];
      // (the cell's box in the chunk's picture, and its place in its tiles' blocks)
      const bx = half + ((i - j) * ISO_TW) / 2 - ISO_TW / 2;
      const by = ((i + j) * ISO_TH) / 2;
      const base = by * w + bx;
      const N = mine.n;
      const lookN = (n: number) => (n === 1 ? look1 : n === N ? lookMine : lookup(n, x % n, y % n, cellHash(x - (x % n), y - (y % n), 21) >= 0.5));
      const look1 = lookup(1, 0, 0, cellHash(x, y, 22) >= 0.5);
      const lookMine = N === 1 ? look1 : lookup(N, x % N, y % N, cellHash(x - (x % N), y - (y % N), 21) >= 0.5);
      let unlike = false;
      for (let d = 0; d < 8 && !unlike; d++) {
        const o = S[at + DY[d] * R + DX[d]];
        unlike = o >= 0 && o !== me;
      }
      const r = rd[me]!;
      if (!unlike) {
        // (a cell among its own kind: its tile as it is)
        const px = r.px;
        if (r.dirt) for (let q = 0; q < m; q++) out[base + offs[q]] = mix(px[lookMine[q]], r.dirt[look1[q]], r.wear);
        else for (let q = 0; q < m; q++) out[base + offs[q]] = px[lookMine[q]];
        continue;
      }
      const pick = (rr: Ready, q: number) => {
        const p = rr.px[(rr.n === N ? lookMine : lookN(rr.n))[q]];
        return rr.dirt ? mix(p, rr.dirt[look1[q]], rr.wear) : p;
      };
      // (the window's surfaces, each once: the weights below are summed by these slots)
      let slots = 0;
      for (let k = 0; k < 9; k++) {
        const o = S[at + WY[k] * R + WX[k]];
        const id = o < 0 ? me : o;
        let sl = 0;
        while (sl < slots && slotId[sl] !== id) sl++;
        if (sl === slots) {
          slotId[slots] = id;
          const sf = surfaces[id];
          slotBias[slots] = sf.rank * RANK_BIAS;
          slotWet[slots] = sf.wet ? 1 : 0;
          slotSalt[slots] = Math.round(sf.rank) * 29;
          slots++;
        }
        slotOf[k] = sl;
      }
      // (the window's cells unlike this one, and the water or the land among them, for the quick test below)
      const meSlot = slotOf[4];
      let nUnlike = 0;
      let nShore = 0;
      for (let k = 0; k < 9; k++) {
        if (slotOf[k] === meSlot) continue;
        unlikeK[nUnlike++] = k;
        if (slotWet[slotOf[k]] !== (mine.wet ? 1 : 0)) shoreK[nShore++] = k;
      }
      const shoreSafe = mine.wet ? SAFE_FOAM : mine.shore ? SAFE_SHORE : 2;
      for (let q = 0; q < m; q++) {
        const wq = q * 9;
        // (a pixel too little of its unlike neighbours reaches is this cell's own, however the wobble and dither fall)
        let unlike = 0;
        for (let k = 0; k < nUnlike; k++) unlike += WEIGHTS[wq + unlikeK[k]];
        if (unlike < SAFE_UNLIKE) {
          let across = 0;
          for (let k = 0; k < nShore; k++) across += WEIGHTS[wq + shoreK[k]];
          if (across < shoreSafe) {
            out[base + offs[q]] = pick(r, q);
            continue;
          }
        }
        const gx = gx0 + bx + (CELL_PX.at[q] % ISO_TW);
        const gy = gy0 + by + ((CELL_PX.at[q] / ISO_TW) | 0);
        // (each surface's share of the pixel: the cells round it weighed by how near their middles are, `WEIGHTS`)
        for (let sl = 0; sl < slots; sl++) share[sl] = 0;
        for (let k = 0; k < 9; k++) share[slotOf[k]] += WEIGHTS[wq + k];
        // (the most of it wins, a kind that lies over another a little ahead, the edge wandering and dithered)
        let best = 0;
        let second = -1;
        let wet = 0;
        for (let sl = 0; sl < slots; sl++) {
          if (slotWet[sl]) wet += share[sl];
          share[sl] += slotBias[sl] + wobble(gx + slotSalt[sl], gy + slotSalt[sl] * 3) * WOBBLE;
          if (share[sl] > share[best]) {
            second = best;
            best = sl;
          } else if (sl !== best && (second < 0 || share[sl] > share[second])) second = sl;
        }
        const dith = BAYER[(gy & 3) * 4 + (gx & 3)];
        const win = second >= 0 && share[best] - share[second] < DITHER * dith * dith ? second : best;
        const t = surfaces[slotId[win]];
        const wob = wobble(gx + 101, gy + 57) * WOBBLE;
        if (!t.wet) {
          // (land: a strip of sand where water is near)
          const land = pick(rd[slotId[win]]!, q);
          out[base + offs[q]] = t.shore && wet + wob > SHORE + (dith - 0.5) * 0.08 ? mix(land, pick(shore, q), SAND) : land;
        } else {
          // (water: paler where it runs shallow up to the land)
          const col = pick(rd[slotId[win]]!, q);
          out[base + offs[q]] = 1 - wet + wob > FOAM + (dith - 0.5) * 0.08 ? paler(col, PALE) : col;
        }
      }
    }
  return true;
}
/** Each of a cell's px (`CELL_PX`) as an offset from its box's top-left in a picture `w` px wide, made once. */
const OFFSETS = new Map<number, Int32Array>();
function offsetsFor(w: number): Int32Array {
  let o = OFFSETS.get(w);
  if (!o) {
    o = CELL_PX.at.map((a) => ((a / ISO_TW) | 0) * w + (a % ISO_TW));
    OFFSETS.set(w, o);
  }
  return o;
}

/** A chunk's fingerprint (its cells' surfaces and the ring round it): baked again only when it changes. */
export function chunkSig(c: Pick<ChunkIn, 'x0' | 'y0' | 'size' | 'surfAt'>): number {
  let h = 2166136261;
  for (let y = c.y0 - 1; y <= c.y0 + c.size; y++)
    for (let x = c.x0 - 1; x <= c.x0 + c.size; x++) {
      h ^= c.surfAt(x, y) + 7;
      h = Math.imul(h, 16777619);
    }
  return h >>> 0;
}

/** A kit tile's face (RGBA bytes, `w` by `h`) made fully opaque: each see-through pixel at its rim takes the colour
 *  of an opaque one beside it, pass by pass from the inside out. */
export function fillOut(px: Uint32Array, w: number, h: number): void {
  for (let pass = 0; pass < w + h; pass++) {
    const prev = px.slice();
    let left = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (prev[k] >>> 24 >= 128) continue;
        const near = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1].find((q) => q >= 0 && prev[q] >>> 24 >= 128);
        if (near === undefined) {
          left++;
          continue;
        }
        px[k] = prev[near];
      }
    if (!left) break;
  }
  for (let k = 0; k < px.length; k++) px[k] = (px[k] | 0xff000000) >>> 0;
}
