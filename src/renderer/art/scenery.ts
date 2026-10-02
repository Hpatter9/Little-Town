// The town's trees, bushes and rocks (and the sky's clouds) from Craftpix's side-on packs (tools/compose-scenery.cjs: one atlas,
// scenery/scenery.png, beside the page; frames by set in scenery.json), drawn at half size so each of their pixels is one
// pixel of the fine grid (pixelArt.ts FINE). They stand in for the painted ones once loaded (`packScenery`): which set
// by the land and the season (snowy trees and rocks in winter and on the tundra, dry trees and desert rocks in the
// desert, the leaves turned in autumn), and each recoloured through the layer's tone (the far land's haze).

import { CanvasSource, Texture } from 'pixi.js';
import { loadImage } from './loadImage';
import { FINE, type PixelArt, type Tone } from './pixelArt';
import manifest from './scenery.json';

import { scenerySets, type ScenerySet } from './scenerySets';
import type { SpriteSet } from './sprites';
export type { ScenerySet } from './scenerySets';
const FRAMES = manifest as Record<ScenerySet, [number, number, number, number][]>;

let atlas: HTMLImageElement | null = null;
let loading: Promise<HTMLImageElement | null> | null = null;
/** Load the atlas once (null if it can't be had: the painted scenery stays). */
export function loadScenery(): Promise<HTMLImageElement | null> {
  loading ??= loadImage('scenery/scenery.png').then(
    (im) => (atlas = im),
    () => null,
  );
  return loading;
}
export const sceneryReady = () => atlas !== null;

/** Leaves turned for autumn: greens pushed to gold, orange and rust, the rest left alone. */
function autumn(r: number, g: number, b: number, i: number): [number, number, number] {
  // (green and teal leaves alike: the packs shade their leaves toward blue-green; bark, stone and snow stay)
  if (!(g > r * 1.08 && g > 40)) return [r, g, b];
  const l = (r + g + b) / 3;
  const pick = i % 3;
  const [tr, tg, tb] = pick === 0 ? [214, 150, 48] : pick === 1 ? [196, 98, 40] : [150, 62, 36];
  const k = l / 110;
  return [Math.min(255, tr * k), Math.min(255, tg * k), Math.min(255, tb * k)];
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const made = new Map<string, PixelArt[]>();
/** A set's pictures through a tone (and turned for autumn), made once each. Empty until the atlas has loaded. */
export function sceneryArts(set: ScenerySet, tone: Tone, toneKey: string, turned = false): PixelArt[] {
  if (!atlas) return [];
  const key = `${set}|${toneKey}|${turned}`;
  const hit = made.get(key);
  if (hit) return hit;
  const cache = new Map<number, [number, number, number]>();
  const arts = (FRAMES[set] ?? []).map(([fx, fy, fw, fh], n) => {
    // (padded to whole art pixels, the picture standing on the bottom edge)
    const w = Math.ceil(fw / FINE) * FINE;
    const h = Math.ceil(fh / FINE) * FINE;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.drawImage(atlas!, fx, fy, fw, fh, Math.floor((w - fw) / 2), h - fh, fw, fh);
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const width = w / FINE;
    const height = h / FINE;
    const tops = new Int16Array(width).fill(height);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (d[o + 3] < 8) continue;
        const ax = Math.floor(x / FINE);
        if (tops[ax] === height) tops[ax] = Math.floor(y / FINE);
        const c = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
        // (each colour through the tone once: pixel art has few)
        const ck = turned ? c * 3 + ((x + y * 7 + n) % 3) : c;
        let rgb = cache.get(ck);
        if (!rgb) {
          let [r, gg, b] = [d[o], d[o + 1], d[o + 2]];
          if (turned) [r, gg, b] = autumn(r, gg, b, (x + y * 7 + n) % 3);
          const t = tone(hex(r, gg, b));
          const v = parseInt(t.slice(1, 7), 16);
          rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
          cache.set(ck, rgb);
        }
        [d[o], d[o + 1], d[o + 2]] = rgb;
      }
    g.putImageData(img, 0, 0);
    const art: PixelArt = { texture: new Texture({ source: new CanvasSource({ resource: canvas, resolution: FINE }) }), width, height, tops };
    return art;
  });
  made.set(key, arts);
  return arts;
}

export { scenerySets } from './scenerySets';

/** A painted scenery set with its trees, bushes and boulders swapped for the packs' (when loaded), for a land and a
 *  season, through a tone (keyed, for the cache). */
export function withPackScenery(set: SpriteSet, tone: Tone, toneKey: string, biome: string, season: string): SpriteSet {
  if (!atlas) return set;
  const k = scenerySets(biome, season);
  // (in autumn the broadleaf trees and bushes turn; the evergreens and the grass on the rocks keep their green)
  const pick = (s: ScenerySet, fallback: PixelArt[], turns: boolean) => {
    const arts = sceneryArts(s, tone, toneKey, turns && k.turned);
    return arts.length ? arts : fallback;
  };
  return { ...set, broadleaf: pick(k.broadleaf, set.broadleaf, true), pine: pick(k.pine, set.pine, false), bush: pick(k.bush, set.bush, true), boulder: pick(k.boulder, set.boulder, false) };
}
