// The airships, from the packs: Craftpix's steampunk cityscape draws a great airship over its fourth city (a gasbag
// ribbed with spars, a gondola slung beneath with a paddle wheel and a long fin), and the enemy spaceship pack has a
// ship that needs no gasbag at all. Each kind is that picture recoloured by a ramp of its own (`RAMPS`: the pack's
// one-colour sepia mapped from dark to light onto the kind's colours) at a size of its own, facing left as the packs
// drew them (`flip` turns her right). The sky pirates' ship is the same airship in black and plum. Loaded once
// (`loadAirshipArt`); until then `airshipTexture` is null and nothing is drawn.

import { Texture } from 'pixi.js';
import type { AirshipKind } from '../../shared/data/skies';
import { loadImage } from './loadImage';
import airshipUrl from './skies/airship.png';
import frigateUrl from './skies/skyfrigate.png';

export type ShipLook = AirshipKind | 'pirates';

/** Each look's picture, its colours from dark to light (null keeps the pack's own), and its size for the map. */
const LOOKS: Record<ShipLook, { src: 'airship' | 'frigate'; ramp: [number, number, number][] | null; scale: number }> = {
  dirigible: { src: 'airship', ramp: [[58, 40, 30], [138, 98, 66], [236, 220, 186]], scale: 0.36 },
  zeppelin: { src: 'airship', ramp: [[40, 42, 52], [118, 124, 134], [214, 218, 224]], scale: 0.46 },
  sky_cruiser: { src: 'airship', ramp: [[28, 38, 32], [84, 102, 84], [176, 188, 152]], scale: 0.58 },
  sky_frigate: { src: 'frigate', ramp: null, scale: 1.3 },
  pirates: { src: 'airship', ramp: [[12, 8, 16], [58, 34, 62], [138, 72, 96]], scale: 0.52 },
};
/** Where her deck is, as a share of the picture's height from the top (the party stands there on a watched voyage),
 *  and where her mooring line is made fast (the nose's tip, a share of the width and height). */
export const DECK: Record<ShipLook, number> = { dirigible: 0.86, zeppelin: 0.86, sky_cruiser: 0.86, sky_frigate: 0.55, pirates: 0.86 };
export const NOSE: Record<ShipLook, [number, number]> = { dirigible: [0.02, 0.62], zeppelin: [0.02, 0.62], sky_cruiser: [0.02, 0.62], sky_frigate: [0.0, 0.5], pirates: [0.02, 0.62] };

let images: { airship: HTMLImageElement; frigate: HTMLImageElement } | null = null;
let loading: Promise<void> | null = null;
const listeners: (() => void)[] = [];
/** Called once the pictures have loaded (the map and the fight screen draw again). */
export const onAirshipArt = (fn: () => void) => listeners.push(fn);

export function loadAirshipArt(): Promise<void> {
  loading ??= Promise.all([loadImage(airshipUrl), loadImage(frigateUrl)])
    .then(([airship, frigate]) => {
      images = { airship, frigate };
      for (const fn of listeners) fn();
    })
    .catch(() => {});
  return loading;
}

const cache = new Map<string, Texture>();

/** Her picture at `size` times the look's own scale, facing left (or right when `flip`); a shadow is all black at
 *  the alpha given. Null until the pictures load. */
export function airshipTexture(look: ShipLook, size = 1, flip = false, shadow = 0): Texture | null {
  if (!images) return null;
  const key = `${look}|${size}|${flip}|${shadow}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = LOOKS[look];
  const im = images[def.src];
  const w = Math.max(4, Math.round(im.naturalWidth * def.scale * size));
  const h = Math.max(2, Math.round(im.naturalHeight * def.scale * size));
  // (recoloured at the picture's own size, then scaled with nearest-neighbour so the pixels stay sharp)
  const base = document.createElement('canvas');
  base.width = im.naturalWidth;
  base.height = im.naturalHeight;
  const g = base.getContext('2d')!;
  g.drawImage(im, 0, 0);
  if (def.ramp || shadow) {
    const data = g.getImageData(0, 0, base.width, base.height);
    const d = data.data;
    // (the pack's tones run over a narrow band: stretched to the whole ramp)
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = lum(d, i);
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      if (shadow) {
        d[i] = d[i + 1] = d[i + 2] = 0;
        d[i + 3] = Math.round(d[i + 3] * shadow);
        continue;
      }
      const [r, gg, b] = ramp(def.ramp!, (lum(d, i) - lo) / Math.max(0.01, hi - lo));
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = b;
    }
    g.putImageData(data, 0, 0);
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  if (flip) {
    o.translate(w, 0);
    o.scale(-1, 1);
  }
  o.drawImage(base, 0, 0, w, h);
  const tex = Texture.from(out);
  tex.source.scaleMode = 'nearest';
  cache.set(key, tex);
  return tex;
}

const lum = (d: Uint8ClampedArray, i: number) => (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;

function ramp(stops: [number, number, number][], t: number): [number, number, number] {
  const f = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}
