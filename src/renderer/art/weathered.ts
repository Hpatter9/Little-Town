// Buildings that show their years (the owner's ask: the town looks lived in): moss creeps up from the foot of a
// building's walls and ivy climbs it as it ages, grime runs down under the eaves; a fire put out leaves soot and
// charring for a few days; a wall or gate knocked about by a raid shows cracks until it's mended. Done on a copy of the
// picture (like art/snowCap.ts), cached per picture and look. `ageStage` and `damageStage` are pure.

import { CanvasSource, Texture } from 'pixi.js';
import type { PixelArt } from './pixelArt';

import { wearKey, type Wear } from './wear';

const cache = new WeakMap<PixelArt, Map<string, PixelArt>>();

/** Cheap fixed noise, 0..1. */
function n2(x: number, y: number, s: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

const MOSS = [[74, 104, 44], [96, 128, 52], [58, 86, 40]];
const IVY = [[46, 92, 38], [70, 120, 50], [36, 70, 30]];
const SOOT = [26, 20, 18];

export function weathered(art: PixelArt, w: Wear): PixelArt {
  if (!w.age && !w.scorch && !w.damage) return art;
  const key = `${wearKey(w)}:${w.seed}`;
  let per = cache.get(art);
  const hit = per?.get(key);
  if (hit) return hit;
  const src = art.texture.source;
  const res = src.resource as unknown;
  const k = src.resolution || 1;
  const W = Math.round(art.width * k);
  const H = Math.round(art.height * k);
  if (!(res instanceof HTMLCanvasElement) || res.width !== W || res.height !== H) return art;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  g.drawImage(res, 0, 0);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 60;
  const blend = (x: number, y: number, col: number[], a: number) => {
    const o = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.round(d[o + ch] + (col[ch] - d[o + ch]) * a);
  };
  // each column's lowest solid pixel (the foot of the wall) and highest (the roof's ridge)
  const foot = new Int32Array(W).fill(-1);
  const top = new Int32Array(W).fill(-1);
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++)
      if (solid(x, y)) {
        if (top[x] < 0) top[x] = y;
        foot[x] = y;
      }
  const s = w.seed;
  // moss creeping up from the foot, patchy, higher the older
  if (w.age) {
    const rise = [0, 3, 7, 12][w.age] * k;
    for (let x = 0; x < W; x++) {
      if (foot[x] < 0) continue;
      const here = rise * (0.4 + 0.9 * n2(Math.floor(x / (3 * k)), 0, s));
      for (let i = 0; i < here; i++) {
        const y = foot[x] - i;
        if (!solid(x, y)) break;
        const fade = 1 - i / here;
        if (n2(x, y, s + 1) < 0.35 + fade * 0.5) blend(x, y, MOSS[Math.floor(n2(x, y, s + 2) * 3)], 0.5 + 0.35 * fade);
      }
    }
    // grime streaks running down from under the roof's edge
    const streaks = w.age * 3;
    for (let i = 0; i < streaks; i++) {
      const x = Math.floor(n2(i, 1, s) * W);
      if (top[x] < 0) continue;
      const y0 = top[x] + Math.floor((foot[x] - top[x]) * (0.25 + 0.3 * n2(i, 2, s)));
      const len = (4 + n2(i, 3, s) * 10) * k;
      for (let y = y0; y < y0 + len; y++) if (solid(x, y)) blend(x, y, [40, 36, 30], 0.18 * (1 - (y - y0) / len));
    }
  }
  // ivy climbing the walls from a few roots (from the second stage)
  if (w.age >= 2) {
    const roots = w.age === 2 ? 2 : 4;
    for (let r = 0; r < roots; r++) {
      let x = Math.floor((0.1 + 0.8 * n2(r, 5, s)) * W);
      if (foot[x] < 0) continue;
      const height = (foot[x] - top[x]) * (w.age === 2 ? 0.35 : 0.65) * (0.6 + 0.4 * n2(r, 6, s));
      for (let i = 0; i < height; i++) {
        const y = foot[x] - i;
        if (n2(r, i, s) < 0.18) x += n2(r, i + 50, s) < 0.5 ? -1 : 1;
        for (let dx = -k; dx <= k; dx++) {
          const xx = x + dx;
          if (!solid(xx, y)) continue;
          // (leaves either side of the stem now and then)
          const leaf = Math.abs(dx) < k || n2(xx, y, s + 9) < 0.45;
          if (leaf) blend(xx, y, IVY[Math.floor(n2(xx, y, s + 7) * 3)], 0.85);
        }
      }
    }
  }
  // soot and char from a fire: dark blotches from the foot up, licks of black up the walls
  if (w.scorch) {
    for (let x = 0; x < W; x++) {
      if (foot[x] < 0) continue;
      const tall = (foot[x] - top[x]) * (0.35 + 0.5 * n2(Math.floor(x / (4 * k)), 9, s));
      for (let i = 0; i < tall; i++) {
        const y = foot[x] - i;
        if (!solid(x, y)) continue;
        const a = 0.75 * (1 - i / tall) * (0.6 + 0.4 * n2(x, y, s + 11));
        blend(x, y, SOOT, a);
      }
    }
  }
  // cracks: dark jagged lines across the face, more when badly broken
  if (w.damage) {
    const cracks = w.damage === 1 ? 3 : 7;
    for (let i = 0; i < cracks; i++) {
      let x = Math.floor(n2(i, 20, s) * W);
      if (top[x] < 0) continue;
      let y = top[x] + Math.floor((foot[x] - top[x]) * n2(i, 21, s));
      const len = (6 + n2(i, 22, s) * 10) * k;
      for (let j = 0; j < len; j++) {
        if (solid(x, y)) blend(x, y, [20, 16, 14], 0.85);
        y += 1;
        if (n2(i, j, s + 23) < 0.5) x += n2(i, j, s + 24) < 0.5 ? -1 : 1;
      }
    }
    if (w.damage === 2)
      // (chunks knocked out: holes along the top)
      for (let i = 0; i < 4; i++) {
        const x0 = Math.floor(n2(i, 30, s) * W);
        for (let x = x0; x < Math.min(W, x0 + 3 * k); x++) {
          if (top[x] < 0) continue;
          for (let y = top[x]; y < top[x] + 3 * k; y++) if (solid(x, y)) d[(y * W + x) * 4 + 3] = 0;
        }
      }
  }
  g.putImageData(img, 0, 0);
  const out: PixelArt = { ...art, texture: new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }) };
  if (!per) cache.set(art, (per = new Map()));
  per.set(key, out);
  return out;
}
