// Single-image enemies (tiny-rpg-town "Battle Sprites" by ansimuz, see CREDITS.md): the Robotic-era machines
// and two of its bosses. They have no animation of their own, so they're drawn still (and bob if they hover).

import { Texture } from 'pixi.js';
import drone from './stills/drone.png';
import observer from './stills/observer.png';
import sentinel from './stills/sentinel.png';
import steelEagle from './stills/steel_eagle.png';
import ogre from './stills/ogre.png';
import mummy from './stills/mummy.png';
import wizard from './stills/wizard.png';
import slime from './stills/slime.png';
import metalSlug from './stills/metal_slug.png';
import grave from './stills/grave.png';
import arch from './stills/arch.png';

export type StillId = 'observer' | 'steel_eagle' | 'drone' | 'sentinel' | 'ogre' | 'mummy' | 'wizard' | 'slime' | 'metal_slug' | 'grave' | 'arch';
const URLS: Record<StillId, string> = { observer, steel_eagle: steelEagle, drone, sentinel, ogre, mummy, wizard, slime, metal_slug: metalSlug, grave, arch };
const textures = new Map<StillId, Texture>();
const images = new Map<StillId, HTMLImageElement>();

export async function loadStills(): Promise<void> {
  await Promise.all(
    (Object.keys(URLS) as StillId[]).map(async (id) => {
      const im = new Image();
      im.src = URLS[id];
      await im.decode();
      textures.set(id, Texture.from(im));
      images.set(id, im);
    }),
  );
}

export const stillTexture = (id: StillId): Texture => textures.get(id) ?? Texture.EMPTY;

/** The loaded image (for drawing into building art). */
export const stillImage = (id: StillId): HTMLImageElement | undefined => images.get(id);
