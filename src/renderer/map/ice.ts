// Deep winter on the land (no DOM, so the tests can reach it): which water freezes, and how long a footprint lasts on
// each kind of ground in each weather. groundArt.ts paints the ice; mapTracks.ts lays the footprints.

import { biomeById } from '../../shared/data/biomes';

/** Whether the water freezes and the snow lies: in winter (the land's palette is snowy then, wherever the town). */
export function freezes(season: string, _biome?: string): boolean {
  return season === 'winter';
}

/** How far water runs from a cell along a row and down a column (the cell itself counted once each way). */
function runs(isWater: (x: number, y: number) => boolean, x: number, y: number, reach: number): [number, number] {
  let h = 1;
  let v = 1;
  for (let k = 1; k <= reach && isWater(x - k, y); k++) h++;
  for (let k = 1; k <= reach && isWater(x + k, y); k++) h++;
  for (let k = 1; k <= reach && isWater(x, y - k); k++) v++;
  for (let k = 1; k <= reach && isWater(x, y + k); k++) v++;
  return [h, v];
}

/** Narrow water is a river, a stream or a pond and freezes over; water wide both ways is the sea or a great lake, and
 *  stays open (the waves and the salt keep it so). */
export const ICE_NARROW = 4;
export function iceAt(isWater: (x: number, y: number) => boolean, x: number, y: number): boolean {
  if (!isWater(x, y)) return false;
  const [h, v] = runs(isWater, x, y, 5);
  return Math.min(h, v) <= ICE_NARROW;
}

/** The ground underfoot, as the footprints see it. */
export type TrackGround = 'snow' | 'sand' | 'mud' | 'none';

/** What a step leaves on this ground in this season and weather: snow in winter or the tundra, sand on the dunes and
 *  the strand, mud on soft ground in the rain; nothing on grass in fair weather, on roads or on rock. */
export function trackGround(ground: string, season: string, biome: string, weather: string, road: boolean): TrackGround {
  if (road || ground === 'water' || ground === 'mountain' || ground === 'hall' || ground === 'rock') return 'none';
  if (freezes(season, biome) || weather === 'snow') return ground === 'shallows' ? 'none' : 'snow';
  if (ground === 'sand') return 'sand';
  if ((weather === 'rain' || weather === 'storm') && (ground === 'grass' || ground === 'fertile' || ground === 'marsh' || ground === 'forest' || ground === 'hill')) return 'mud';
  return 'none';
}

/** Seconds a footprint lasts: long in snow (unless more is falling), brief in sand (the wind), a while in mud. */
export function trackLife(g: TrackGround, weather: string): number {
  if (g === 'snow') return weather === 'snow' ? 25 : 90;
  if (g === 'sand') return weather === 'storm' || weather === 'cloudy' ? 6 : 12;
  if (g === 'mud') return 40;
  return 0;
}

/** Breath shows in the cold: winter, the tundra all year, and the small hours of autumn. */
export function breathShows(season: string, biome: string, daylight: number): boolean {
  return freezes(season) || !!biomeById(biome).cold || (season === 'autumn' && daylight < 0.3);
}
