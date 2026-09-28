// Animal husbandry: the pens in the fields behind the town, and what lives in them. A farmer tends each pen
// (collects the eggs, milks, shears, feeds); the herd grows by itself in spring and summer while there's room, eats
// grain through the winter (and starves without it), and when the pen is full, or food runs short, one is
// slaughtered for meat. Numbers are starting points for tuning.

import type { Stock } from './materials';

export interface HerdDef {
  /** One animal, and more than one ("hen", "hens"). */
  animal: string;
  plural: string;
  /** Head the pen holds, and how many come with it when it's built. */
  room: number;
  start: number;
  /** What each head gives at a tending (the total is rounded, at least 1 of each). */
  yields: Stock;
  /** Game hours between tendings. */
  everyHours: number;
  /** Base seconds of a tending. */
  tendSeconds: number;
  /** Game hours for a new head to be born (spring and summer; none in winter), with two or more and room. */
  breedHours: number;
  /** One slaughtered gives this. */
  cull: Stock;
  /** Kept only for meat: one is slaughtered at every tending, down to a breeding pair. */
  forMeat?: boolean;
  /** Grain each head eats a game day in winter (the pasture feeds them the rest of the year). */
  fodder: number;
  /** How it's drawn (renderer/town/animalsView.ts). */
  look: 'hen' | 'goat' | 'sheep' | 'pig' | 'cow';
}

export const HERDS: Readonly<Record<string, HerdDef>> = {
  chicken_coop: {
    animal: 'hen', plural: 'hens', room: 8, start: 3, yields: { eggs: 0.5 }, everyHours: 8, tendSeconds: 15, breedHours: 20,
    cull: { meat: 1, bone: 1 }, fodder: 0.1, look: 'hen',
  },
  goat_pen: {
    animal: 'goat', plural: 'goats', room: 6, start: 2, yields: { milk: 0.7 }, everyHours: 12, tendSeconds: 20, breedHours: 40,
    cull: { meat: 3, hide: 1, bone: 1 }, fodder: 0.3, look: 'goat',
  },
  pig_sty: {
    animal: 'pig', plural: 'pigs', room: 6, start: 2, yields: {}, everyHours: 24, tendSeconds: 20, breedHours: 26,
    cull: { meat: 6, hide: 1, bone: 1 }, forMeat: true, fodder: 0.4, look: 'pig',
  },
  sheep_fold: {
    animal: 'sheep', plural: 'sheep', room: 8, start: 3, yields: { wool: 1 }, everyHours: 24, tendSeconds: 25, breedHours: 44,
    cull: { meat: 3, hide: 1, bone: 1 }, fodder: 0.3, look: 'sheep',
  },
  cattle_pasture: {
    animal: 'cow', plural: 'cattle', room: 6, start: 2, yields: { milk: 1.2 }, everyHours: 12, tendSeconds: 25, breedHours: 70,
    cull: { meat: 8, hide: 2, bone: 2 }, fodder: 0.6, look: 'cow',
  },
};

/** Growth by season (none in winter). */
export const BREED_SEASON = { spring: 1.3, summer: 1, autumn: 0.5, winter: 0 } as const;
/** Game hours a pen can go hungry in winter before one of its animals dies. */
export const STARVE_HOURS = 24;
/** When raiders get away, the chance they drive off some livestock (and the most they take). */
export const RUSTLE_CHANCE = 0.4;
export const RUSTLE_MAX = 3;
