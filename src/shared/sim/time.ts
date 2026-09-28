// Fixed tick rate and the in-game calendar. Every timing constant here is a starting value to tune.

export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

/** Real seconds per in-game hour (60 = one real minute per game hour, so a day lasts 24 real minutes). */
export const SECONDS_PER_GAME_HOUR = 60;
export const TICKS_PER_HOUR = SECONDS_PER_GAME_HOUR * TICK_HZ;
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24;

export const DAYS_PER_SEASON = 3;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** A new game starts on day 1 of spring at this hour. */
export const START_HOUR = 7;

// Light level: full daylight between sunrise end and sunset start, dark at night, eased in between.
const SUNRISE = [5, 7] as const;
const SUNSET = [19, 21] as const;

export interface Calendar {
  /** 1-based day count since the game began. */
  day: number;
  /** 1-based year. */
  year: number;
  season: Season;
  /** 1-based day within the season. */
  dayOfSeason: number;
  hour: number;
  minute: number;
  /** 0 (night) .. 1 (full day). */
  daylight: number;
}

export function calendar(tick: number): Calendar {
  const t = tick + START_HOUR * TICKS_PER_HOUR;
  const dayIndex = Math.floor(t / TICKS_PER_DAY);
  const hoursIntoDay = (t % TICKS_PER_DAY) / TICKS_PER_HOUR;
  const seasonIndex = Math.floor(dayIndex / DAYS_PER_SEASON);
  return {
    day: dayIndex + 1,
    year: Math.floor(seasonIndex / SEASONS.length) + 1,
    season: SEASONS[seasonIndex % SEASONS.length],
    dayOfSeason: (dayIndex % DAYS_PER_SEASON) + 1,
    hour: Math.floor(hoursIntoDay),
    minute: Math.floor((hoursIntoDay % 1) * 60),
    daylight: daylight(hoursIntoDay),
  };
}

function daylight(h: number): number {
  if (h < SUNRISE[0] || h >= SUNSET[1]) return 0;
  if (h < SUNRISE[1]) return smooth((h - SUNRISE[0]) / (SUNRISE[1] - SUNRISE[0]));
  if (h < SUNSET[0]) return 1;
  return 1 - smooth((h - SUNSET[0]) / (SUNSET[1] - SUNSET[0]));
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
