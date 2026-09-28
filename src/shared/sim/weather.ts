// The weather: just for looks (it doesn't touch crops or people). A spell of weather lasts a few game hours,
// picked from the town's seed and the time, so it's the same on every screen and after a reload; the season sets
// the odds, and a disaster overrides it (snow in the Deep Freeze, clear skies in a drought, haze in an ash winter
// or smog).

import type { DoomKind } from '../data/doom';
import { hashSeed, mixSeed } from '../rng';
import { calendar, TICKS_PER_HOUR, type Season } from './time';

export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

/** A spell of weather lasts this long (game hours). */
export const SPELL_HOURS = 6;

const ODDS: Record<Season, [Weather, number][]> = {
  spring: [['clear', 4], ['cloudy', 3], ['rain', 3], ['fog', 1]],
  summer: [['clear', 6], ['cloudy', 2], ['rain', 1], ['storm', 1.5]],
  autumn: [['clear', 2], ['cloudy', 3], ['rain', 3], ['fog', 2], ['storm', 0.5]],
  winter: [['clear', 2], ['cloudy', 3], ['snow', 4], ['fog', 1]],
};

/** The weather in a given spell (index = which SPELL_HOURS block since the game began). */
export function spellWeather(seed: string, spell: number, season: Season): Weather {
  const odds = ODDS[season];
  const total = odds.reduce((n, [, w]) => n + w, 0);
  let roll = ((mixSeed(hashSeed(seed), 0x7ea7, spell) >>> 0) % 10_000) / 10_000 * total;
  for (const [w, n] of odds) if ((roll -= n) < 0) return w;
  return 'clear';
}

export interface WeatherNow {
  kind: Weather;
  /** 0..1 through the spell (the renderer eases between spells). */
  through: number;
  /** The spell before this one (for a rainbow after rain, and easing). */
  before: Weather;
}

export function weatherAt(seed: string, tick: number, doom: DoomKind | null): WeatherNow {
  const spellTicks = SPELL_HOURS * TICKS_PER_HOUR;
  const spell = Math.floor(tick / spellTicks);
  const through = (tick % spellTicks) / spellTicks;
  const at = (i: number) => override(doom) ?? spellWeather(seed, i, calendar(i * spellTicks).season);
  return { kind: at(spell), through, before: at(spell - 1) };
}

function override(doom: DoomKind | null): Weather | null {
  switch (doom) {
    case 'deep_freeze':
      return 'snow';
    case 'drought':
      return 'clear';
    case 'ash_winter':
    case 'smog':
      return 'fog';
    default:
      return null;
  }
}
