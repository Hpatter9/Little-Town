// How wet the ground is, and how much snow lies on it between the seasons (map/groundWeather.ts draws them). Pure, so
// it is tested.

import { TICKS_PER_HOUR } from '../../shared/sim/time';

/** Hours of rain to soak the ground, and of dry weather to dry it out again. */
export const SOAK_HOURS = 2;
export const DRY_HOURS = 8;

/** The ground's wetness after so many ticks of a weather. */
export function wetnessStep(wet: number, weather: string, ticks: number): number {
  const hours = ticks / TICKS_PER_HOUR;
  if (weather === 'rain' || weather === 'storm') return Math.min(1, wet + hours / SOAK_HOURS);
  if (weather === 'snow' || weather === 'fog') return wet;
  return Math.max(0, wet - hours / DRY_HOURS);
}

/** How much of the ground snow covers (0..1) at the turns of winter: settling through the last afternoon and evening of
 *  autumn, melting away through the first day of spring. (Winter's ground is painted white already.) */
export function snowCover(season: string, dayOfSeason: number, hour: number, lastDay = 3): number {
  if (season === 'autumn' && dayOfSeason === lastDay && hour >= 12) return Math.min(0.7, ((hour - 12) / 12) * 0.7);
  if (season === 'spring' && dayOfSeason === 1) return Math.max(0, 1 - hour / 22);
  return 0;
}
