// The raid battle map's scenery: Craftpix's top-down objects (trees, bushes, rocks, mushrooms, crystals, corals, idols),
// packed by tools/compose-props.cjs into one atlas per set (props/<set>.png, files beside the page, not inlined) at
// twice the map's scale. `propTextures` loads a set once and cuts its frames.

import { Rectangle, Texture } from 'pixi.js';
import { loadImage } from './loadImage';
import manifest from './props.json';

export type PropSet = 'wild' | 'winter' | 'desert' | 'coast' | 'cave' | 'sea' | 'grove' | 'places' | 'undead';
/** Each object's frame in its atlas: x, y, w, h (atlas px: twice art px). */
const FRAMES = manifest as Record<PropSet, [number, number, number, number][]>;
/** Atlas px per art px. */
export const PROP_FINE = 2;

const loaded = new Map<PropSet, Promise<Texture[]>>();
/** A set's objects (loaded once). */
export function propTextures(set: PropSet): Promise<Texture[]> {
  let p = loaded.get(set);
  if (!p) {
    p = loadImage(`props/${set}.png`).then((im) => {
      const source = Texture.from(im).source;
      return FRAMES[set].map(([x, y, w, h]) => new Texture({ source, frame: new Rectangle(x, y, w, h) }));
    });
    loaded.set(set, p);
  }
  return p;
}
