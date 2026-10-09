// The music's mood from what the town is doing (music.ts plays to it). Pure.

import type { Mood } from './musicScore';

export interface MoodInput {
  raid: boolean;
  boss: boolean;
  /** Another fight on screen: a watched party's, a tactics battle. */
  fight: boolean;
  daylight: number;
  season: string;
  theme: string;
  gathering: string | null;
  biome: string;
}

export function moodOf(m: MoodInput): Mood {
  if (m.boss) return 'boss';
  if (m.raid || m.fight) return 'battle';
  if (m.gathering === 'feast' || m.gathering === 'wedding') return 'feast';
  if (m.theme === 'lich' || m.theme === 'vampire') return 'dark';
  if (m.daylight < 0.2) return 'night';
  if (m.season === 'winter' || m.biome === 'tundra' || m.biome === 'taiga') return 'winter';
  if (m.theme === 'merfolk') return 'sea';
  if (m.theme === 'knights') return 'heroic';
  return 'day';
}
