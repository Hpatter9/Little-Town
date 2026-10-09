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
/** The camp's fire lights so far (cells), and the open fires (the bloomery, the kiln...) so far. */
export const CAMPFIRE_RADIUS = 4.5;
export const FIRE_RADIUS = 2.5;
/** Under the mountain the sconces burn from waking to bed (they're put out while the hold sleeps). */
export const CAVE_WAKE = 6;
export const CAVE_SLEEP = 22;
