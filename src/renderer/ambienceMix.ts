// What the land sounds like now (no audio here, so the tests can reach it): from the hour, the season, the weather,
// the biome and what's in view, how loud each bed of sound is (wind, rain, water) and how often each living thing
// calls (birds, crickets, frogs, owls, wolves), each 0 to 1. ambience.ts plays it.

import { biomeById } from '../shared/data/biomes';

export interface AmbientState {
  /** 0 at night to 1 at noon. */
  daylight: number;
  season: string;
  weather: string;
  biome: string;
  /** Shares of the view that are water and wood (0 to 1), and whether the water is the sea. */
  water: number;
  forest: number;
  sea: boolean;
  /** The liches' and vampires' blighted land: no birdsong, more wolves and owls. */
  blighted: boolean;
  /** A raid under way in town, and the camp's fire in view. */
  raid: boolean;
  fire: boolean;
}

export interface AmbientMix {
  wind: number;
  rain: number;
  water: number;
  fire: number;
  /** Calls a second, more or less. */
  birds: number;
  crickets: number;
  frogs: number;
  owls: number;
  wolves: number;
}

const WIND: Record<string, number> = { clear: 0.25, cloudy: 0.4, rain: 0.55, storm: 1, snow: 0.5, fog: 0.12 };
const RAIN: Record<string, number> = { rain: 0.7, storm: 1 };

export function ambientMix(a: AmbientState): AmbientMix {
  const day = Math.max(0, Math.min(1, (a.daylight - 0.25) / 0.5));
  const night = 1 - day;
  const wet = a.weather === 'rain' || a.weather === 'storm';
  const land = biomeById(a.biome);
  const warm = (a.season === 'spring' || a.season === 'summer') && !land.cold;
  const cold = a.season === 'winter' || a.biome === 'tundra';
  const quietForBattle = a.raid ? 0.25 : 1;
  const wind = Math.min(1, (WIND[a.weather] ?? 0.3) * (land.cold || land.dry ? 1.3 : 1));
  return {
    wind,
    rain: RAIN[a.weather] ?? 0,
    water: Math.min(1, a.water * (a.sea ? 2.2 : 1.6)),
    fire: a.fire ? 0.4 + 0.4 * night : 0,
    birds: a.blighted || wet || cold && a.season === 'winter' ? 0 : day * (0.25 + a.forest * 0.9) * (land.dry && land.hot ? 0.4 : land.wet ? 1.3 : 1) * quietForBattle,
    crickets: warm && !wet && !(land.dry && land.hot) ? night * 0.9 * quietForBattle : 0,
    frogs: warm && !cold ? night * Math.min(1, a.water * 3 + (land.wet ? 0.4 : 0)) * (wet ? 1.4 : 1) * quietForBattle : 0,
    owls: night * (0.04 + a.forest * 0.12) * (a.blighted ? 2 : 1) * (wet ? 0.3 : 1),
    wolves: night * (a.blighted ? 0.06 : cold ? 0.04 : 0.015) * (wet ? 0.5 : 1),
  };
}
