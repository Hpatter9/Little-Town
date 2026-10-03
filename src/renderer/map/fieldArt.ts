// Fields and pens seen from above: a tilled plot the size of the footprint, its furrows running across, the crop
// standing in rows by its stage (sprouts, tall, ripe), a fence round a pen. Painted once per kind, stage and size.

import { CROPS } from '../../shared/data/crops';
import { HERDS } from '../../shared/data/livestock';
import { CELL } from '../../shared/sim/land';
import { CanvasSource, Texture } from 'pixi.js';
import { FINE, paint, type PixelArt, type Tone } from '../art/pixelArt';
import { drawFence, drawSoil, fieldTilesReady } from '../art/fieldTiles';
import type { CropLook } from '../art/buildings';

const SOIL = '#6e4e30';
const SOIL_DARK = '#5b3f26';
const SOIL_LIGHT = '#8a6640';
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

/** Whether a building is drawn as a plot from above. */
export const isPlot = (defId: string) => !!CROPS[defId] || !!HERDS[defId];

export function fieldArt(defId: string, w: number, h: number, stage: CropLook | undefined, tone: Tone, toneKey: string): PixelArt {
  const packed = fieldTilesReady();
  const key = `${defId}|${w}|${h}|${stage ?? ''}|${toneKey}|${packed ? 'pack' : ''}`;
  let art = cache.get(key);
  if (art) return art;
  const W = w * CELL;
  const H = h * CELL;
  const crop = CROPS[defId];
  const herd = HERDS[defId];
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
      if (crop) {
        p.rect(0, 0, W, H, SOIL);
        // furrows across the plot
        for (let y = 3; y < H - 1; y += 6) {
          p.rect(1, y, W - 2, 2, SOIL_DARK);
          p.rect(1, y + 3, W - 2, 1, SOIL_LIGHT);
        }
        const [leaf, head] = CROP[crop.material] ?? CROP.grain;
        if (stage && stage !== 'fallow')
          for (let y = 4; y < H - 2; y += 6)
            for (let x = 3; x < W - 2; x += 5) {
              const k = ((x * 7 + y * 13) % 5) - 2;
              if (stage === 'sprout') p.rect(x, y - 1, 2, 2, leaf);
              else if (crop.establishHours) {
                // an orchard: little round trees
                p.rect(x - 1, y - 3, 4, 3, leaf);
                p.rect(x, y - 4, 2, 1, leaf);
                if (stage === 'ripe') p.px(x + (k > 0 ? 1 : 0), y - 2, head);
              } else {
                p.rect(x, y - 3, 2, 4, leaf);
                p.px(x + 1, y - 4 + (k > 0 ? 1 : 0), leaf);
                if (stage === 'ripe') p.rect(x, y - 5, 2, 2, head);
              }
            }
      } else if (herd) {
        // a pen: trodden ground, a water trough, a fence round it with a gap for the gate
        p.rect(0, 0, W, H, '#8c7a4e');
        for (let i = 0; i < (W * H) / 40; i++) p.px((i * 37) % W, (i * 53) % H, '#7a6a42');
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
  drawSoil(g, w, h, seed, k);
  const rect = (x: number, y: number, rw: number, rh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x * k, y * k, rw * k, rh * k);
  };
  const crop = CROPS[defId];
  if (kind === 'crop' && crop) {
    // furrows across the plot, the crop standing in rows by its stage
    for (let y = 6; y < H - 3; y += 8) rect(3, y, W - 6, 1, 'rgba(60, 30, 10, 0.35)');
    const [leaf, head] = CROP[crop.material] ?? CROP.grain;
    if (stage && stage !== 'fallow')
      for (let y = 8; y < H - 3; y += 8)
        for (let x = 5; x < W - 4; x += 6) {
          const kk = ((x * 7 + y * 13) % 5) - 2;
          if (stage === 'sprout') rect(x, y - 1, 2, 2, leaf);
          else if (crop.establishHours) {
            rect(x - 1, y - 3, 4, 3, leaf);
            rect(x, y - 4, 2, 1, leaf);
            if (stage === 'ripe') rect(x + (kk > 0 ? 1 : 0), y - 2, 1, 1, head);
          } else {
            rect(x, y - 3, 2, 4, leaf);
            rect(x + 1, y - 4 + (kk > 0 ? 1 : 0), 1, 1, leaf);
            if (stage === 'ripe') rect(x, y - 5, 2, 2, head);
          }
        }
  } else {
    // a pen: a water trough, and the fence round it
    rect(W - 12, 6, 8, 4, '#6a8aa8');
    drawFence(g, w, h, seed, k);
  }
  const tops = new Int16Array(W);
  return { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }), width: W, height: H, tops };
}
