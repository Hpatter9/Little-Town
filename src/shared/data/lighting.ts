// Light in the dark (the owner's ask: wall torches that must be fed, that light so far and cast shadows, and without
// them the town goes dark at night, and a castle's or a hold's rooms go dark). The numbers; sim/lighting.ts runs it.

import type { Era } from './eras';
import type { Material } from './materials';

/** Each age's light: what it's called, what it burns (null: on the grid, never fed), how far it lights (cells). */
export const LIGHT_KIND: Record<Era, { name: string; fuel: Material | null; radius: number }> = {
  neolithic: { name: 'torch', fuel: 'wood', radius: 3.5 },
  medieval: { name: 'lantern', fuel: 'wood', radius: 4 },
  industrial: { name: 'gas lamp', fuel: 'coal', radius: 5 },
  modern: { name: 'electric lamp', fuel: null, radius: 6 },
  space: { name: 'light panel', fuel: null, radius: 6.5 },
};

/** A street light every so many road cells (by the cell's hash). */
export const LIGHT_EVERY = 5;
/** Street lights the town keeps: a few to begin, more for every grown-up, up to the most. */
export const STREET_LIGHTS_BASE = 3;
export const STREET_LIGHTS_PER_PERSON = 2;
export const STREET_LIGHTS_MOST = 70;
/** Hours of burning a light holds, and how many one unit of fuel gives. */
export const FUEL_MOST = 12;
export const FUEL_PER_UNIT = 12;
/** A light is fed once it's below this share of full. */
export const FEED_BELOW = 0.5;
/** Seconds of work to feed a light. */
export const FEED_SECONDS = 4;
/** From this hour the lamplighters go round (and until dawn); fuel burns while it's dark. */
export const FEED_FROM = 15;
export const FEED_UNTIL = 23;
/** Dark below this daylight. */
export const DARK_BELOW = 0.25;
/** Work in the dark goes at this pace. */
export const DARK_PACE = 0.75;
/** The camp's fire lights so far (cells). */
export const CAMPFIRE_RADIUS = 4.5;
/** The fires that burn at the town's buildings and how far each lights (cells), its colour and strength: the camp's
 *  fire, the open fires and the furnaces. */
export const FIRE_LIGHTS: Record<string, { radius: number; color: number; power: number }> = {
  campfire: { radius: CAMPFIRE_RADIUS, color: 0xffb070, power: 1 },
  storytellers_circle: { radius: 3.5, color: 0xffb070, power: 0.95 },
  bloomery: { radius: 3, color: 0xffa060, power: 0.9 },
  kiln: { radius: 2.5, color: 0xffa060, power: 0.85 },
  smithy: { radius: 2.5, color: 0xff9850, power: 0.8 },
  glassworks: { radius: 2, color: 0xffb060, power: 0.75 },
};
/** Buildings that lie flat on the ground (fields, pens, yards, a heap of stores, the fire itself): light passes over
 *  them. Fields, pens and traps besides are known by what they are (sim/lightField.ts `flat`). */
export const LOW_BUILDINGS = new Set(['campfire', 'stockpile', 'village_green', 'quoits_pitch', 'sparring_yard', 'graveyard', 'fishing_jetty', 'herb_garden', 'pleasure_garden']);
/** A tree's or a rock's shadow is round: how far from its cell's middle it stops light (cells). */
export const ROUND_BLOCK = 0.38;

/** Under the mountain the sconces burn from waking to bed (they're put out while the hold sleeps). */
export const CAVE_WAKE = 6;
export const CAVE_SLEEP = 22;
