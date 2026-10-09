// When and where the small creatures come out, and what the weather leaves on the ground (map/mapCritters.ts and
// map/groundFrost.ts draw them). Pure, so it is tested.

import type { Era } from '../../shared/data/eras';

interface Sky {
  season: string;
  weather: string;
  daylight: number;
  hour: number;
  /** The cold lands (biomeById(...).cold): frost most mornings, no bees. */
  cold?: boolean;
}

const FAIR = new Set(['clear', 'cloudy']);
const WET = new Set(['rain', 'storm', 'snow']);

/** The buildings bees work round, each with a hive by it: the herb garden and the orchard. */
export const BEE_PLOTS = new Set(['herb_garden', 'orchard']);
/** Bees about each hive, and over the flowers in view. */
export const BEES_PER_HIVE = 4;
export const BEES_WILD = 3;

/** Bees by day in spring and summer in fair weather, never in the cold lands. */
export function beesOut(o: Sky): boolean {
  return !o.cold && (o.season === 'spring' || o.season === 'summer') && FAIR.has(o.weather) && o.daylight > 0.5;
}

/** A hive of the age: a straw skep, then a wooden box hive from the Industrial age. */
export function hiveKind(era: Era): 'skep' | 'box' {
  return era === 'neolithic' || era === 'medieval' ? 'skep' : 'box';
}

/** Dragonflies over the water by day, from late spring through summer, in fair weather. */
export function dragonfliesOut(o: Sky & { dayOfSeason: number }): boolean {
  const warm = o.season === 'summer' || (o.season === 'spring' && o.dayOfSeason >= 2);
  return warm && FAIR.has(o.weather) && o.daylight > 0.6;
}
export const DRAGONFLIES_MOST = 5;

/** How many of the bats are out (0..1): they pour out at dusk, thin out through the night and are home before dawn;
 *  none in winter (they sleep) or the wet. */
export function batsOut(o: Sky): number {
  if (o.season === 'winter' || WET.has(o.weather) || (o.cold && o.season !== 'summer')) return 0;
  if (o.daylight > 0.6) return 0;
  if (o.hour >= 17 && o.hour <= 22) return o.daylight > 0.05 ? 1 : 0.7;
  if (o.hour >= 23 || o.hour <= 3) return 0.35;
  return 0;
}
export const BATS_MOST = 7;

/** Moths round the lamps on warm-season nights, not in the wet. */
export function mothsOut(o: Sky): boolean {
  return o.daylight < 0.3 && o.season !== 'winter' && !WET.has(o.weather) && !(o.cold && o.season !== 'summer');
}
export const MOTHS_PER_LIGHT = 3;
export const MOTHS_MOST = 18;

/** The crop fields that have a scarecrow (by the field's id: about three in five; never the orchard or the herbs). */
export function hasScarecrow(id: number, def: string): boolean {
  if (def === 'orchard' || def === 'herb_garden') return false;
  return ((Math.imul(id + 7, 2654435761) >>> 0) % 10) < 6;
}
/** A field tempts the crows when it's ripe or near it. */
export function tempting(crop: { stage: string; growth: number } | undefined): boolean {
  return !!crop && (crop.stage === 'ripe' || (crop.stage === 'growing' && crop.growth >= 0.7));
}
/** Crows down on a tempting field; a scarecrow keeps all but one off. */
export const CROWS_PER_FIELD = 3;
export function crowsFor(tempts: boolean, scarecrow: boolean): number {
  return !tempts ? 0 : scarecrow ? 1 : CROWS_PER_FIELD;
}
/** How often (s) a scarecrow, in a gust, puts up a crow that has come down anyway. */
export const SCARE_EVERY = 9;

/** Rats about the stores: none while they're under half full, more as they fill, two more with a full granary, a swarm
 *  in the rats' plague. */
export const RATS_MOST = 9;
export function ratCount(used: number, capacity: number, granary: boolean, plague: boolean): number {
  const full = capacity > 0 ? used / capacity : 0;
  let n = full < 0.5 ? 0 : Math.round((full - 0.5) * 6);
  if (granary && full >= 0.8) n += 2;
  if (plague) n += 6;
  return Math.max(0, Math.min(RATS_MOST, n));
}
/** The rats' plague (the fateful event f_rats, data/fatefulEvents.ts): its question waiting, or its outcome lately told. */
export function ratPlague(promptTitles: string[], outcomeTitle: string | null | undefined): boolean {
  return promptTitles.some((t) => /\bRats\b/.test(t)) || (!!outcomeTitle && /\bRats\b/.test(outcomeTitle));
}

/** Frost on the grass (0..1) on a cold morning: autumn's last days, winter, spring's first day, and most of the year in
 *  the cold lands; under a clear sky or fog (clouds keep the ground warm), from the small hours till the sun is up and
 *  thawing it by ten. */
export function frostOn(o: Sky & { dayOfSeason: number }): number {
  const coldSeason = o.season === 'winter' || (o.season === 'autumn' && o.dayOfSeason >= 3) || (o.season === 'spring' && o.dayOfSeason === 1) || (!!o.cold && o.season !== 'summer');
  if (!coldSeason || !(o.weather === 'clear' || o.weather === 'fog' || o.weather === 'cloudy')) return 0;
  const sky = o.weather === 'cloudy' ? 0.5 : 1;
  if (o.hour >= 2 && o.hour < 8) return sky;
  if (o.hour >= 8 && o.hour < 10) return sky * (1 - (o.hour - 8) / 2);
  return 0;
}

/** Dew glinting on the grass at dawn (0..1), where there's no frost, in fair weather or fog. */
export function dewOn(o: Sky & { dayOfSeason: number }): number {
  if (frostOn(o) > 0 || o.season === 'winter' || !(FAIR.has(o.weather) || o.weather === 'fog')) return 0;
  if (o.hour === 5 || o.hour === 6) return o.daylight > 0.05 ? 1 : 0.5;
  if (o.hour === 7) return 0.6;
  if (o.hour === 8) return 0.25;
  return 0;
}

/** Hail: a third of the storms of the cold seasons (and of the cold lands), and now and then a cold spring rain; by the
 *  game's hour, so a spell hails or doesn't. */
export function hailing(weather: string, season: string, cold: boolean, day: number, hour: number): boolean {
  const spell = (Math.imul(day * 24 + Math.floor(hour / 3) * 3 + 11, 2246822519) >>> 0) % 3;
  if (weather === 'storm') return (season !== 'summer' || cold) && spell === 0;
  if (weather === 'rain') return season === 'spring' && cold && spell === 0;
  return false;
}
export const HAIL_MOST = 70;

/** How deep the snow drifts against the walls (0..1): it heaps up through winter and while it snows, and lies most of
 *  the year in the cold lands. */
export function driftDepth(season: string, dayOfSeason: number, weather: string, cold: boolean): number {
  if (season === 'winter') return Math.min(1, 0.45 + dayOfSeason * 0.18 + (weather === 'snow' ? 0.2 : 0));
  if (cold && season !== 'summer') return weather === 'snow' ? 0.8 : 0.55;
  if (weather === 'snow') return 0.4;
  return 0;
}
