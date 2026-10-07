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
