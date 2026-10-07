// The raid battle map's scenery: Craftpix's top-down objects (trees, bushes, rocks, mushrooms, crystals, corals, idols),
// packed by tools/compose-props.cjs into one atlas per set (props/<set>.png, files beside the page, not inlined) at
// twice the map's scale. `propTextures` loads a set once and cuts its frames.

import { Rectangle, Texture } from 'pixi.js';
import { loadImage } from './loadImage';
import manifest from './props.json';
import kindsJson from './propKinds.json';
import evergreenJson from './propEvergreen.json';

export type PropSet = 'wild' | 'winter' | 'desert' | 'coast' | 'cave' | 'sea' | 'grove' | 'places' | 'undead';
/** Each object's frame in its atlas: x, y, w, h (atlas px: twice art px). */
const FRAMES = manifest as Record<PropSet, [number, number, number, number][]>;
/** Atlas px per art px. */
export const PROP_FINE = 2;
/** How much bigger than the old raid map's scale each kind is cut for the land's sets (GROW in
 *  tools/compose-props.cjs; not the places or the sea): the tactics board shrinks them back to its tiles. */
export const PROP_GROW: Record<string, number> = { tree: 2, bush: 1.7, rock: 1.4, plant: 1.5, crystal: 1.3, other: 1.3 };

const loaded = new Map<PropSet, Promise<Texture[]>>();
const images = new Map<PropSet, HTMLImageElement>();

/** A set's atlas image, for painting its objects straight onto a canvas (the ground's shallows): null until it has
 *  loaded (asked for, if it hasn't been). */
export function propImage(set: PropSet): HTMLImageElement | null {
  const im = images.get(set);
  if (!im && !loaded.has(set)) propTextures(set).catch(() => undefined);
  return im ?? null;
}
/** A set's frames (atlas px). */
export const propFrames = (set: PropSet) => FRAMES[set];
/** A set's objects (loaded once). */
export function propTextures(set: PropSet): Promise<Texture[]> {
  let p = loaded.get(set);
  if (!p) {
    p = loadImage(`props/${set}.png`).then((im) => {
      images.set(set, im);
      const source = Texture.from(im).source;
      return FRAMES[set].map(([x, y, w, h]) => new Texture({ source, frame: new Rectangle(x, y, w, h) }));
    });
    loaded.set(set, p);
  }
  return p;
}

const KINDS_OF = kindsJson as Record<string, string[]>;
const EVERGREEN = evergreenJson as Record<string, number[]>;
/** Leaves turned for autumn: each broadleaf tree and bush in one of four turns (gold, orange, rust, and one just turning),
 *  its greens pushed toward it and their light kept; bark, stone, flowers and the evergreens stay as they are. */
const TURNS: [number, number, number][] = [
  [222, 168, 52],
  [208, 112, 40],
  [160, 64, 38],
  [176, 160, 60],
];
const turned = new Map<PropSet, Promise<Texture[]>>();
/** A set's objects with their leaves turned for autumn (made once, from the loaded atlas). */
export function autumnTextures(set: PropSet): Promise<Texture[]> {
  let p = turned.get(set);
  if (!p) {
    p = propTextures(set).then(() => {
      const im = images.get(set)!;
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(im, 0, 0);
      const kinds = KINDS_OF[set] ?? [];
      const keep = new Set(EVERGREEN[set] ?? []);
      FRAMES[set].forEach(([x, y, w, h], n) => {
        if ((kinds[n] !== 'tree' && kinds[n] !== 'bush') || keep.has(n)) return;
        const img = g.getImageData(x, y, w, h);
        const d = img.data;
        const [tr, tg, tb] = TURNS[(n * 7 + 3) % TURNS.length];
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const gg = d[i + 1];
          const b = d[i + 2];
          // (green and teal leaves alike: the packs shade their leaves toward blue-green)
          if (d[i + 3] < 8 || !(gg > r * 1.08 && gg > 40)) continue;
          const k = (r + gg + b) / 3 / 105;
          // (a fleck here and there keeps a little of its green)
          const mix = ((i >> 2) * 2654435761) % 97 < 8 ? 0.5 : 1;
          d[i] = Math.min(255, r + (tr * k - r) * mix);
          d[i + 1] = Math.min(255, gg + (tg * k - gg) * mix);
          d[i + 2] = Math.min(255, b + (tb * k - b) * mix);
        }
        g.putImageData(img, x, y);
      });
      const source = Texture.from(c).source;
      return FRAMES[set].map(([x, y, w, h]) => new Texture({ source, frame: new Rectangle(x, y, w, h) }));
    });
    turned.set(set, p);
  }
  return p;
}
