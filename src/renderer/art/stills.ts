// Single-image enemies (tiny-rpg-town "Battle Sprites" by ansimuz, see CREDITS.md): the Robotic-era machines
// and two of its bosses. They have no animation of their own, so they're drawn still (and bob if they hover).

import { loadImage } from './loadImage';
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
// Golems and elementals (batareya): the rival origins' big troops
import elem_treant from './stills/elem_treant.png';
import elem_stone_golem from './stills/elem_stone_golem.png';
import elem_water_elemental from './stills/elem_water_elemental.png';
import elem_homunculus from './stills/elem_homunculus.png';
import elem_iron_sentry from './stills/elem_iron_sentry.png';
import elem_wraith from './stills/elem_wraith.png';
import elem_crystal_fiend from './stills/elem_crystal_fiend.png';
import elem_fire_elemental from './stills/elem_fire_elemental.png';

export type StillId = 'observer' | 'steel_eagle' | 'drone' | 'sentinel' | 'ogre' | 'mummy' | 'wizard' | 'slime' | 'metal_slug' | 'grave' | 'arch' | ElementalStill;
import type { ElementalStill } from '../../shared/data/enemies';
const URLS: Record<StillId, string> = { observer, steel_eagle: steelEagle, drone, sentinel, ogre, mummy, wizard, slime, metal_slug: metalSlug, grave, arch, elem_treant, elem_stone_golem, elem_water_elemental, elem_homunculus, elem_iron_sentry, elem_wraith, elem_crystal_fiend, elem_fire_elemental };
const textures = new Map<StillId, Texture>();
const images = new Map<StillId, HTMLImageElement>();

export async function loadStills(): Promise<void> {
  await Promise.all(
    (Object.keys(URLS) as StillId[]).map(async (id) => {
      const im = await loadImage(URLS[id]);
      textures.set(id, Texture.from(im));
      images.set(id, im);
    }),
  );
}

export const stillTexture = (id: StillId): Texture => textures.get(id) ?? Texture.EMPTY;

/** The loaded image (for drawing into building art). */
export const stillImage = (id: StillId): HTMLImageElement | undefined => images.get(id);
