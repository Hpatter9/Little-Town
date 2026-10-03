// Snow on the buildings in winter: a cap of white along each picture's top edge (the roofs' ridges, the eaves, the tops
// of the walls: the first opaque pixel of each column, `tops`), lying deep where the edge runs level and thin down a
// steep slope, blended onto a copy of the picture on the fine grid. Cached per picture, so a building is capped once a
// winter. The pictures are whole canvases (the painter's and the packs'); anything else is left as it is.

import { CanvasSource, Texture } from 'pixi.js';
import type { PixelArt } from './pixelArt';

const capped = new WeakMap<PixelArt, PixelArt>();
/** How deep the snow lies (art px) on a level edge, a gentle slope and a steep one. */
const DEEP = 5;
const GENTLE = 3;
const THIN = 1.5;
const SNOW = [244, 248, 255];

export function snowCapped(art: PixelArt): PixelArt {
  const hit = capped.get(art);
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
  const tops = art.tops;
  for (let x = 0; x < art.width; x++) {
    const top = tops[x];
    if (top >= art.height) continue;
    const l = x > 0 ? tops[x - 1] : top;
    const r = x < art.width - 1 ? tops[x + 1] : top;
    const slope = Math.min(Math.abs(l - top), Math.abs(r - top));
    const depth = (slope <= 1 ? DEEP : slope <= 3 ? GENTLE : THIN) * k;
    for (let fx = x * k; fx < (x + 1) * k; fx++) {
      let y0 = -1;
      for (let fy = top * k; fy < H && y0 < 0; fy++) if (d[(fy * W + fx) * 4 + 3] > 40) y0 = fy;
      if (y0 < 0) continue;
      for (let i = 0; i < depth; i++) {
        const fy = y0 + i;
        if (fy >= H) break;
        const o = (fy * W + fx) * 4;
        if (d[o + 3] <= 40) break; // (the cap ends at a hole)
        const t = i / depth;
        const a = t < 0.55 ? 0.93 : 0.93 * (1 - (t - 0.55) / 0.45);
        for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.round(d[o + ch] + (SNOW[ch] - d[o + ch]) * a);
      }
    }
  }
  g.putImageData(img, 0, 0);
  const out: PixelArt = { ...art, texture: new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }) };
  capped.set(art, out);
  return out;
}
