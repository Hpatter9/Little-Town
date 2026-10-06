// Ground under the party's feet for the painted backdrops that have none at foot height (a city's skyline, a moon's
// craters seen from afar, open water over a lake, the sea with no bed): a strip of side-on tiles laid along the scene's
// foot, scrolling with the march. Earth from Craftpix's free platformer tileset, brick and metal from the loose tiles
// pack (`1 Tiles`); each tile is a 32 px column, its top piece over the fill. A backdrop not listed has its own ground.

import { ColorMatrixFilter, Texture } from 'pixi.js';
import type { BackdropId } from '../../shared/data/backdrops';
import brickUrl from './fightGround/brick.png';
import earthUrl from './fightGround/earth.png';
import metalUrl from './fightGround/metal.png';
import { loadImage } from './loadImage';

export type GroundKind = 'earth' | 'brick' | 'metal';
/** How a strip is recoloured to sit in its scene: `grey` takes out that share of the colour, `tone` multiplies. */
export interface GroundLook {
  kind: GroundKind;
  grey?: number;
  bright?: number;
  tone?: number;
}

const CITY: GroundLook = { kind: 'brick', grey: 0.85, bright: 0.85 };
const RUINS: GroundLook = { kind: 'brick', grey: 0.9, bright: 0.7, tone: 0xd8c8b0 };
const STEAM: GroundLook = { kind: 'brick', grey: 0.9, bright: 0.8, tone: 0xe0b890 };
const FUTURE: GroundLook = { kind: 'metal' };
const WORKS: GroundLook = { kind: 'metal', grey: 0.3, bright: 0.85, tone: 0xe8d8c8 };
const MOON: GroundLook = { kind: 'earth', grey: 1, bright: 0.85 };
const SEABED: GroundLook = { kind: 'earth', grey: 0.6, bright: 0.75, tone: 0x9cc8d8 };

export const GROUND_OF: Partial<Record<BackdropId, GroundLook>> = {
  city_1: CITY, city_2: CITY, city_3: CITY, city_4: CITY, city_5: CITY,
  ruins_1: RUINS, ruins_2: RUINS, ruins_3: RUINS, ruins_4: RUINS,
  steampunk_1: STEAM, steampunk_2: STEAM, steampunk_3: STEAM, steampunk_4: STEAM,
  future_1: FUTURE, future_2: FUTURE, future_3: FUTURE, future_4: FUTURE,
  industrial_day: WORKS, industrial_night: { ...WORKS, bright: 0.6 },
  moon_1: MOON, moon_2: MOON, moon_3: MOON, moon_4: MOON,
  mountains_5: { kind: 'earth' },
  underwater_2: SEABED, underwater_3: SEABED, underwater_4: SEABED,
};

const URL_OF: Record<GroundKind, string> = { earth: earthUrl, brick: brickUrl, metal: metalUrl };
const loaded = new Map<GroundKind, Promise<Texture>>();

export function loadGround(kind: GroundKind): Promise<Texture> {
  let p = loaded.get(kind);
  if (!p) {
    p = loadImage(URL_OF[kind]).then((im) => {
      const t = Texture.from(im);
      t.source.scaleMode = 'nearest';
      return t;
    });
    loaded.set(kind, p);
  }
  return p;
}

/** The filter that greys and brightens a strip for its scene (none when it needs none). */
export function groundFilter(look: GroundLook): ColorMatrixFilter | null {
  if (!look.grey && look.bright === undefined && look.tone === undefined) return null;
  const f = new ColorMatrixFilter();
  const g = look.grey ?? 0;
  // (each channel mixes its own value with the grey, by the share)
  f.matrix = [
    1 - g + g * 0.3, g * 0.59, g * 0.11, 0, 0,
    g * 0.3, 1 - g + g * 0.59, g * 0.11, 0, 0,
    g * 0.3, g * 0.59, 1 - g + g * 0.11, 0, 0,
    0, 0, 0, 1, 0,
  ];
  if (look.bright !== undefined) f.brightness(look.bright, true);
  if (look.tone !== undefined) f.tint(look.tone, true);
  return f;
}
