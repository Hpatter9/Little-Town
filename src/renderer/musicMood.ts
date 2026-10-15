// The music's mood from what the town is doing (music.ts plays to it). Pure.

import type { Mood } from './musicScore';

export interface MoodInput {
  raid: boolean;
  boss: boolean;
  /** Another fight on screen: a watched party's, a tactics battle. */
  fight: boolean;
  victory?: boolean;
  daylight: number;
  season: string;
  theme: string;
  gathering: string | null;
  biome: string;
  /** The town's alignment, -100..100 (sim/alignment.ts). */
  align?: number;
}

export function moodOf(m: MoodInput): Mood {
  if (m.boss) return 'boss';
  if (m.raid || m.fight) return 'battle';
  if (m.victory) return 'victory';
  if (m.gathering === 'festival') return 'festival';
  if (m.gathering === 'feast' || m.gathering === 'wedding') return 'feast';
  if (m.theme === 'lich' || m.theme === 'vampire' || (m.align ?? 0) <= -45) return 'dark';
  if (m.daylight < 0.2) return 'night';
  if (m.season === 'winter' || m.biome === 'tundra' || m.biome === 'taiga') return 'winter';
  if (m.theme === 'merfolk') return 'sea';
  if (m.theme === 'knights' || (m.align ?? 0) >= 60) return 'heroic';
  return 'day';
}
