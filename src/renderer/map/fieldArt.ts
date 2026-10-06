// Fields and pens seen from above: a tilled plot the size of the footprint, its furrows running across, the crop
// standing in rows by its stage (sprouts, tall, ripe), a fence round a pen. Painted once per kind, stage and size.

import { CROPS, sectionsOf } from '../../shared/data/crops';
import { HERDS } from '../../shared/data/livestock';
import { CELL } from '../../shared/sim/land';
import { CanvasSource, Texture } from 'pixi.js';
import { FINE, paint, type PixelArt, type Tone } from '../art/pixelArt';
import { drawFence, drawSoil, fieldTilesReady } from '../art/fieldTiles';
import { paintFarm } from '../art/farmland';
import type { CropLook } from '../art/buildings';

const FENCE = '#9a7a4a';
const FENCE_DARK = '#6a522f';

/** The crop's colours by material: leaf, and the ripe head. */
const CROP: Record<string, [string, string]> = {
  grain: ['#7fae46', '#e2c054'],
  herbs: ['#5f9a58', '#8fd08a'],
  fiber: ['#86b85a', '#a8c8e8'],
  vegetables: ['#5c9a3e', '#d86a3a'],
  fruit: ['#4f8a3a', '#e05050'],
};

const cache = new Map<string, PixelArt>();

/** A hex colour lightened (or darkened, below zero) by a share. */
function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${[ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Whether a building is drawn as a plot from above. */
export const isPlot = (defId: string) => !!CROPS[defId] || !!HERDS[defId];

export function fieldArt(defId: string, w: number, h: number, stage: CropLook | undefined, tone: Tone, toneKey: string, done = 0): PixelArt {
  const packed = fieldTilesReady();
  const key = `${defId}|${w}|${h}|${stage ?? ''}|${toneKey}|${packed ? 'pack' : ''}|${done}`;
  let art = cache.get(key);
  if (art) return art;
  const W = w * CELL;
  const H = h * CELL;
  const crop = CROPS[defId];
  const herd = HERDS[defId];
  // (a field is painted: no pack has tilled farmland, art/farmland.ts)
  if (crop) {
    art = farmPlot(defId, w, h, stage, done);
    cache.set(key, art);
    return art;
  }
  if (packed) {
    art = packedPlot(defId, w, h, stage, crop ? 'crop' : 'pen');
    cache.set(key, art);
    return art;
  }
  art = paint(
    W,
    H,
    tone,
    (p) => {
      if (herd) {
        // a pen: trodden ground, a water trough, a fence round it with a gap for the gate
        p.rect(W - 12, 6, 8, 4, '#6a8aa8');
        for (let x = 0; x < W; x += 6) {
          p.rect(x, 0, 2, 5, x % 12 ? FENCE : FENCE_DARK);
          if (x < W / 2 - 8 || x > W / 2 + 6) p.rect(x, H - 5, 2, 5, x % 12 ? FENCE : FENCE_DARK);
        }
        p.rect(0, 1, W, 1, FENCE);
        p.rect(0, 3, W, 1, FENCE_DARK);
        for (let y = 0; y < H; y += 6) {
          p.rect(0, y, 2, 5, FENCE);
          p.rect(W - 2, y, 2, 5, FENCE);
        }
      }
    },
    0.6,
    { stuff: false },
  );
  cache.set(key, art);
  return art;
}

/** A plot on the Fields tileset's soil (art/fieldTiles.ts): the crop in rows over it by its stage, or a rail fence
 *  round a pen. Drawn on the fine grid. */
function packedPlot(defId: string, w: number, h: number, stage: CropLook | undefined, kind: 'crop' | 'pen'): PixelArt {
  const k = FINE;
  const W = w * CELL;
  const H = h * CELL;
  const c = document.createElement('canvas');
  c.width = W * k;
  c.height = H * k;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const seed = defId.length * 31 + w * 7 + h;
  // (a field on soil; a pen is only its fence, over the land as it lies)
  if (kind === 'crop') drawSoil(g, w, h, seed, k);
  const rect = (x: number, y: number, rw: number, rh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x * k, y * k, rw * k, rh * k);
  };
  const crop = CROPS[defId];
  if (kind === 'crop' && crop) {
    // furrows across the plot, the crop standing in rows by its stage
    for (let y = 6; y < H - 3; y += 8) rect(3, y, W - 6, 1, 'rgba(60, 30, 10, 0.35)');
    const [leaf, head] = CROP[crop.material] ?? CROP.grain;
    // (the crop in rows, taller and fuller at each stage, its colour turning as it ripens; the orchard's trees fill out)
    const pale = lighten(leaf, 0.35);
    const dark = lighten(leaf, -0.25);
    const turning = lighten(head, -0.2);
    if (stage && stage !== 'fallow')
      for (let y = 8; y < H - 2; y += 7)
        for (let x = 4; x < W - 3; x += 5) {
          const kk = ((x * 7 + y * 13) % 5) - 2;
          if (crop.establishHours) {
            // an orchard: saplings, then round trees, in fruit when ripe
            if (stage === 'sprout') rect(x, y - 3, 1, 3, dark);
            else if (stage === 'young') {
              rect(x, y - 4, 1, 4, dark);
              rect(x - 1, y - 5, 3, 2, leaf);
            } else {
              rect(x, y - 2, 1, 2, dark);
              rect(x - 2, y - 6, 5, 4, leaf);
              rect(x - 1, y - 7, 3, 1, pale);
              if (stage === 'ripe') {
                rect(x - 1, y - 5, 1, 1, head);
                rect(x + 1 + (kk > 0 ? 0 : -1), y - 4, 1, 1, head);
              }
            }
          } else if (stage === 'sprout') rect(x, y - 1, 2, 1, pale);
          else if (stage === 'young') {
            rect(x, y - 3, 2, 3, leaf);
            rect(x + 1, y - 4, 1, 1, pale);
          } else if (stage === 'tall') {
            rect(x, y - 5, 2, 5, leaf);
            rect(x + 2, y - 4 + (kk > 0 ? 1 : 0), 1, 2, pale);
            rect(x - 1, y - 3, 1, 2, dark);
          } else if (stage === 'heading') {
            rect(x, y - 6, 2, 6, leaf);
            rect(x + 2, y - 5, 1, 3, pale);
            rect(x - 1, y - 7, 3, 2, turning);
          } else {
            rect(x, y - 6, 2, 6, dark);
            rect(x + 2, y - 5, 1, 3, leaf);
            rect(x - 1 + (kk > 0 ? 1 : 0), y - 8, 3, 2, head);
            rect(x, y - 9, 2, 1, head);
          }
        }
  } else {
    // a pen: a water trough in the corner, and the fence round it
    rect(W - 15, 9, 10, 5, '#5a3a24');
    rect(W - 14, 10, 8, 3, '#6a8aa8');
    rect(W - 13, 10, 3, 1, '#9cc0d8');
    drawFence(g, w, h, seed, k);
  }
  const tops = new Int16Array(W);
  return { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }), width: W, height: H, tops };
}

/** A field: dark loam in ridges, the crop along them by kind and stage (art/farmland.ts). */
function farmPlot(defId: string, w: number, h: number, stage: CropLook | undefined, done = 0): PixelArt {
  const k = FINE;
  const W = w * CELL;
  const H = h * CELL;
  const c = document.createElement('canvas');
  c.width = W * k;
  c.height = H * k;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const crop = CROPS[defId];
  paintFarm(g, k, W, H, crop.material, !!crop.establishHours, stage, defId.length * 31 + w * 7 + h, false, done / sectionsOf(w));
  const tops = new Int16Array(W);
  return { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }), width: W, height: H, tops };
}
