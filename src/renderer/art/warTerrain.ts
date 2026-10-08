// The ground of the War tab's canvases (panel/warMap.ts, panel/warBoard.ts), painted as the town's map paints its land
// (map/groundArt.ts): a plain colour a land, two tones mottled by noise, the borders between lands wandering off the
// cells' edges (so nothing reads as squares), the sea shaded by its depth with foam at the shore, the mountains in
// relief with snow on the crests; then the pack's lighter patches, the Fields pack's tufts, flowers and pebbles, and
// the lands' own trees, bushes and rocks from the props atlases. No Pixi: it draws into a canvas's pixels.

import type { WorldCell } from '../../shared/data/conquest';
import { drawPatch, drawTuft, groundDetailReady, loadGroundDetail, type Patch } from './groundDetail';
import { drawProp, notifyWarArt, propAspect, propsOfKind, warImage, type WarPropSet } from './warSprites';

/* ------------------------------------------------------------ noise */

const frac = (n: number) => n - Math.floor(n);
/** A hash of three integers to 0..1. */
export function hashAt(seed: number, x: number, y: number): number {
  let h = (seed * 374761393 + x * 668265263 + y * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise (0..1) over px at `scale` px a cell. */
export function noise(seed: number, x: number, y: number, scale: number): number {
  const gx = x / scale;
  const gy = y / scale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hashAt(seed, ix, iy);
  const b = hashAt(seed, ix + 1, iy);
  const c = hashAt(seed, ix, iy + 1);
  const d = hashAt(seed, ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
void frac;

/* ------------------------------------------------------------ the lands' looks */

export interface LandLook {
  /** The plain ground's two tones. */
  tones: [string, string];
  /** The pack's lighter patch on it, and how many cells wear one. */
  patch?: Patch;
  patchShare: number;
  /** The props atlases its wild things come from, by kind, with each kind's weight; whether its trees are evergreen. */
  props: { set: WarPropSet; kind: string; weight: number; evergreen?: boolean }[];
  /** How many cells hold a prop. */
  density: number;
  /** The small things on the grass. */
  tufts?: boolean;
  flowers?: boolean;
  pebbles?: boolean;
}
export const LAND_LOOK: Record<WorldCell, LandLook> = {
  water: { tones: ['#3f7eb4', '#4382b8'], patchShare: 0, props: [], density: 0 },
  mountain: { tones: ['#5a5664', '#8a8694'], patchShare: 0, props: [{ set: 'cave', kind: 'rock', weight: 1 }], density: 0.12 },
  forest: { tones: ['#55923c', '#447a33'], patch: 'leaf', patchShare: 0.3, props: [{ set: 'wild', kind: 'tree', weight: 0.72 }, { set: 'wild', kind: 'bush', weight: 0.18 }, { set: 'wild', kind: 'rock', weight: 0.1 }], density: 0.5, tufts: true, flowers: true },
  desert: { tones: ['#d9c58c', '#cbb67c'], patch: 'sand', patchShare: 0.25, props: [{ set: 'desert', kind: 'rock', weight: 0.5 }, { set: 'desert', kind: 'plant', weight: 0.35 }, { set: 'desert', kind: 'bones', weight: 0.15 }], density: 0.14, pebbles: true },
  tundra: { tones: ['#dfe6ec', '#cdd8df'], patch: 'chalk', patchShare: 0.14, props: [{ set: 'winter', kind: 'tree', weight: 0.55 }, { set: 'winter', kind: 'rock', weight: 0.45 }], density: 0.26 },
  coast: { tones: ['#8fbf7a', '#7aad66'], patch: 'meadow', patchShare: 0.3, props: [{ set: 'coast', kind: 'tree', weight: 0.5 }, { set: 'coast', kind: 'bush', weight: 0.3 }, { set: 'coast', kind: 'plant', weight: 0.2 }], density: 0.26, tufts: true, flowers: true },
  swamp: { tones: ['#4e6f44', '#44633c'], patch: 'teal', patchShare: 0.42, props: [{ set: 'wild', kind: 'bush', weight: 0.4 }, { set: 'wild', kind: 'plant', weight: 0.35 }, { set: 'wild', kind: 'tree', weight: 0.25 }], density: 0.4, tufts: true },
  jungle: { tones: ['#2f6b2f', '#3b7d3a'], patch: 'leaf', patchShare: 0.42, props: [{ set: 'wild', kind: 'tree', weight: 0.72 }, { set: 'wild', kind: 'bush', weight: 0.16 }, { set: 'grove', kind: 'plant', weight: 0.12 }], density: 0.66, tufts: true, flowers: true },
  highlands: { tones: ['#8a8c6a', '#7e7f7c'], patch: 'olive', patchShare: 0.26, props: [{ set: 'cave', kind: 'rock', weight: 0.55 }, { set: 'wild', kind: 'tree', weight: 0.35, evergreen: true }, { set: 'wild', kind: 'bush', weight: 0.1 }], density: 0.3, pebbles: true, tufts: true },
  ashlands: { tones: ['#5e4e4c', '#78736f'], patch: 'peat', patchShare: 0.3, props: [{ set: 'undead', kind: 'tree', weight: 0.4 }, { set: 'undead', kind: 'rock', weight: 0.4 }, { set: 'desert', kind: 'bones', weight: 0.2 }], density: 0.26, pebbles: true },
  steppe: { tones: ['#b8b06a', '#a3a35a'], patch: 'grass', patchShare: 0.28, props: [{ set: 'wild', kind: 'bush', weight: 0.55 }, { set: 'desert', kind: 'rock', weight: 0.2 }, { set: 'wild', kind: 'plant', weight: 0.25 }], density: 0.13, tufts: true },
  taiga: { tones: ['#3c6a4c', '#4f7a55'], patch: 'peat', patchShare: 0.3, props: [{ set: 'wild', kind: 'tree', weight: 0.8, evergreen: true }, { set: 'wild', kind: 'rock', weight: 0.1 }, { set: 'wild', kind: 'bush', weight: 0.1 }], density: 0.5, tufts: true },
};
/** The sea by its depth in cells from the shore: the shallows, the sea, the deep. */
const SEA = ['#6cb6cf', '#4e92c0', '#3f7eb4', '#366ea4', '#2e5f92', '#2a5584'];
const FOAM = '#e4f3f5';
const SNOW = '#eef1f4';

const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const RGB = new Map<string, [number, number, number]>();
const rgb = (hex: string) => {
  let c = RGB.get(hex);
  if (!c) RGB.set(hex, (c = rgbOf(hex)));
  return c;
};

/* ------------------------------------------------------------ the plain ground */

export interface GroundOpts {
  /** The canvas's size in px, and a cell's. */
  w: number;
  h: number;
  cell: number;
  /** The land of a cell (null outside the world: left clear). */
  landAt: (cx: number, cy: number) => WorldCell | null;
  /** A water cell's depth in cells from the shore (1 beside it). */
  depthAt?: (cx: number, cy: number) => number;
  seed: number;
  /** Px a block (the fill's grain): 2 on a big canvas, 1 on a small one. */
  block?: number;
  /** A light cast over everything (the board's evening, say). */
  tint?: [number, number, number, number];
}

/** Paint the plain ground into the canvas (the whole of it), the lands' borders wandering by noise. */
export function paintGround(g: CanvasRenderingContext2D, o: GroundOpts): void {
  const { w, h, cell, landAt, seed } = o;
  const block = o.block ?? (w * h > 400000 ? 2 : 1);
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  // the land under each block, after the warp
  const warp = cell * 0.42;
  const warpScale = Math.max(6, cell * 1.4);
  const lands = new Array<WorldCell | null>(bw * bh);
  const heights = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const px = bx * block + block / 2;
      const py = by * block + block / 2;
      const wx = px + (noise(seed + 11, px, py, warpScale) - 0.5) * 2 * warp;
      const wy = py + (noise(seed + 23, px, py, warpScale) - 0.5) * 2 * warp;
      const cx = Math.floor(wx / cell);
      const cy = Math.floor(wy / cell);
      const i = by * bw + bx;
      // (the warp never reaches outside the world: the edge is the sea's)
      const land = landAt(Math.max(0, Math.min(Math.floor((w - 1) / cell), cx)), Math.max(0, Math.min(Math.floor((h - 1) / cell), cy)));
      lands[i] = land;
      heights[i] = land === 'mountain' ? noise(seed + 41, px, py, cell * 1.6) * 0.62 + noise(seed + 43, px, py, cell * 0.55) * 0.38 : 0;
    }
  const img = g.createImageData(w, h);
  const d = img.data;
  const set = (x: number, y: number, c: [number, number, number], a = 255) => {
    const o4 = (y * w + x) * 4;
    d[o4] = c[0];
    d[o4 + 1] = c[1];
    d[o4 + 2] = c[2];
    d[o4 + 3] = a;
  };
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const tint = o.tint;
  for (let by = 0; by < bh; by++)
    for (let bx = 0; bx < bw; bx++) {
      const i = by * bw + bx;
      const land = lands[i];
      if (land === null) continue;
      const px = bx * block;
      const py = by * block;
      let c: [number, number, number];
      if (land === 'water') {
        const cx = Math.floor((px + block / 2) / cell);
        const cy = Math.floor((py + block / 2) / cell);
        const depth = o.depthAt ? o.depthAt(cx, cy) : 2;
        // foam where the warped water meets land, a little broken up
        const nb = (dx: number, dy: number) => {
          const j = (by + dy) * bw + (bx + dx);
          return by + dy >= 0 && by + dy < bh && bx + dx >= 0 && bx + dx < bw ? lands[j] : null;
        };
        const shore = [nb(1, 0), nb(-1, 0), nb(0, 1), nb(0, -1)].some((l) => l !== null && l !== 'water');
        if (shore && noise(seed + 5, px, py, 5) > 0.3) c = rgb(FOAM);
        else {
          const deep = Math.max(0, Math.min(SEA.length - 1, depth - 1 + (noise(seed + 7, px, py, cell * 2.2) - 0.5) * 1.2));
          const lo = Math.floor(deep);
          c = mix(rgb(SEA[lo]), rgb(SEA[Math.min(SEA.length - 1, lo + 1)]), deep - lo);
          // the waves: faint light lines
          const wave = noise(seed + 9, px * 0.6, py * 2.4, cell * 1.1);
          if (wave > 0.78) c = mix(c, rgb('#9fd3e6'), (wave - 0.78) * 2.5);
        }
      } else if (land === 'mountain') {
        const hgt = heights[i];
        const at = (dx: number, dy: number) => {
          const j = (by + dy) * bw + (bx + dx);
          return by + dy >= 0 && by + dy < bh && bx + dx >= 0 && bx + dx < bw && lands[j] === 'mountain' ? heights[j] : hgt * 0.5;
        };
        const slope = at(-2, -2) - at(2, 2); // (lit from the north-west)
        const look = LAND_LOOK.mountain;
        c = mix(rgb(look.tones[0]), rgb(look.tones[1]), Math.max(0, Math.min(1, 0.5 + slope * 2.6)));
        if (hgt > 0.66) c = mix(c, rgb(SNOW), Math.min(1, (hgt - 0.66) * 4));
        // a crack now and then
        if (noise(seed + 51, px, py, cell * 0.7) > 0.86) c = mix(c, rgb('#34303c'), 0.6);
      } else {
        const look = LAND_LOOK[land];
        const t = noise(seed + 3, px, py, cell * 1.3) * 0.7 + noise(seed + 4, px, py, cell * 0.45) * 0.3;
        c = mix(rgb(look.tones[0]), rgb(look.tones[1]), t);
      }
      if (tint) c = mix(c, [tint[0], tint[1], tint[2]], tint[3]);
      const r: [number, number, number] = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
      for (let yy = py; yy < Math.min(h, py + block); yy++) for (let xx = px; xx < Math.min(w, px + block); xx++) set(xx, yy, r);
    }
  g.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------ the detail on it */

let detailAsked = false;
/** Ask for the pack's patches and tufts (painted again when they come). */
export function askGroundDetail(): boolean {
  if (!detailAsked) {
    detailAsked = true;
    loadGroundDetail().then(() => notifyWarArt());
  }
  return groundDetailReady();
}

/** The patches and small things over a stretch of cells. `at(cx, cy)` gives the land (or null to leave a cell alone). */
export function paintDetail(g: CanvasRenderingContext2D, o: { cols: number; rows: number; cell: number; seed: number; landAt: (cx: number, cy: number) => WorldCell | null; x0?: number; y0?: number }): void {
  if (!askGroundDetail()) return;
  const { cols, rows, cell, seed } = o;
  const x0 = o.x0 ?? 0;
  const y0 = o.y0 ?? 0;
  const k = cell / 43; // (a patch about a cell across)
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const land = o.landAt(cx, cy);
      if (!land || land === 'water' || land === 'mountain') continue;
      const look = LAND_LOOK[land];
      const r = hashAt(seed + 101, cx, cy);
      if (look.patch && r < look.patchShare) {
        const n = Math.floor(hashAt(seed + 102, cx, cy) * 8);
        const px = x0 + cx * cell + (hashAt(seed + 103, cx, cy) - 0.5) * cell * 0.5;
        const py = y0 + cy * cell + (hashAt(seed + 104, cx, cy) - 0.5) * cell * 0.5;
        drawPatch(g, look.patch, n, Math.round(px), Math.round(py), k * (0.45 + hashAt(seed + 105, cx, cy) * 0.4));
      }
      // tufts, flowers and pebbles, small against a cell
      const small = hashAt(seed + 106, cx, cy);
      const kind = small < 0.18 && look.tufts ? 'tuft' : small < 0.26 && look.flowers ? 'flower' : small < 0.34 && look.pebbles ? 'pebble' : null;
      if (kind) {
        const sx = x0 + cx * cell + hashAt(seed + 107, cx, cy) * cell;
        const sy = y0 + cy * cell + hashAt(seed + 108, cx, cy) * cell;
        const sk = Math.max(0.35, Math.min(2.2, cell / 28));
        g.save();
        g.translate(sx, sy);
        g.scale(sk, sk);
        drawTuft(g, kind, Math.floor(hashAt(seed + 109, cx, cy) * 12), 0, 0);
        g.restore();
      }
    }
}

export interface PlacedProp {
  set: WarPropSet;
  frame: number;
  x: number;
  feetY: number;
  h: number;
}
/** Choose the props standing on a stretch of cells: by each land's density and kinds, seeded so they never move;
 *  `keep(cx, cy)` says where none may stand (a settlement, a road). */
export function placeProps(o: { cols: number; rows: number; cell: number; seed: number; landAt: (cx: number, cy: number) => WorldCell | null; keep?: (cx: number, cy: number) => boolean; x0?: number; y0?: number; scale?: number; densityMult?: number }): PlacedProp[] {
  const { cols, rows, cell, seed } = o;
  const x0 = o.x0 ?? 0;
  const y0 = o.y0 ?? 0;
  const scale = o.scale ?? 1;
  const out: PlacedProp[] = [];
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const land = o.landAt(cx, cy);
      if (!land || land === 'water') continue;
      if (o.keep && o.keep(cx, cy)) continue;
      const look = LAND_LOOK[land];
      if (hashAt(seed + 201, cx, cy) >= look.density * (o.densityMult ?? 1)) continue;
      // which kind, by weight
      let pick = hashAt(seed + 202, cx, cy);
      let choice = look.props[0];
      for (const p of look.props) {
        if (pick < p.weight) {
          choice = p;
          break;
        }
        pick -= p.weight;
      }
      if (!choice) continue;
      const frames = propsOfKind(choice.set, choice.kind, !!choice.evergreen);
      if (!frames.length) continue;
      const frame = frames[Math.floor(hashAt(seed + 203, cx, cy) * frames.length)];
      const tall = choice.kind === 'tree' ? 1.55 : choice.kind === 'bush' ? 0.8 : choice.kind === 'plant' ? 0.7 : choice.kind === 'bones' ? 0.6 : 0.75;
      const h = cell * tall * (0.85 + hashAt(seed + 204, cx, cy) * 0.3) * scale;
      out.push({ set: choice.set, frame, x: x0 + (cx + 0.2 + hashAt(seed + 205, cx, cy) * 0.6) * cell, feetY: y0 + (cy + 0.55 + hashAt(seed + 206, cx, cy) * 0.45) * cell, h });
    }
  out.sort((a, b) => a.feetY - b.feetY);
  return out;
}
/** Draw placed props (back to front), with a soft shadow under each. */
export function drawProps(g: CanvasRenderingContext2D, props: PlacedProp[], alpha = 1): void {
  for (const p of props) {
    const w = p.h * propAspect(p.set, p.frame);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(p.x, p.feetY - 1, Math.max(2, w * 0.3), Math.max(1.2, p.h * 0.08), 0, 0, Math.PI * 2);
    g.fill();
    drawProp(g, p.set, p.frame, p.x, p.feetY, p.h, alpha);
  }
}
/** Whether every atlas a list of props needs has loaded (so a cached painting can be kept). */
export const propsReady = (sets: Iterable<WarPropSet>) => [...sets].every((s) => !!warImage(`props/${s}.png`));
