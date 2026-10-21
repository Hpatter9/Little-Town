// The Surface / Underground switch on the phone's map: which ways down the town has, and which one it is in now.
// Pure, so the tests can reach it. The views themselves are drawn elsewhere (deep/, underdark/, fight/mineView.ts).
import type { Command } from './commands';

/** What the switch reads from the snapshot. */
export interface UndergroundInput {
  deep: { levels: unknown[] } | null;
  underdark: unknown | null;
  places: { id: number; name: string; mine: unknown | null }[];
  deepView: unknown | null;
  underView: unknown | null;
  mine: { id: number } | null;
}

export interface UndergroundWay {
  /** A stable key, kept as the "last picked" level. */
  key: string;
  label: string;
  go: Command;
}

/** The ways down the town has now, the Deep first. */
export function undergroundWays(s: UndergroundInput): UndergroundWay[] {
  const ways: UndergroundWay[] = [];
  if (s.deep && s.deep.levels.length > 0) ways.push({ key: 'deep', label: 'The Deep', go: { type: 'watchDeep', depth: s.deep.levels.length } });
  if (s.underdark) ways.push({ key: 'under', label: 'The Underdark', go: { type: 'watchUnder', on: true } });
  let n = 0;
  for (const p of s.places) {
    if (!p.mine) continue;
    n++;
    ways.push({ key: `mine:${p.id}`, label: `Mine ${n}`, go: { type: 'watchMine', place: p.id } });
  }
  return ways;
}

/** The way the town is looking at now, or null on the surface. */
export function undergroundNow(s: UndergroundInput): string | null {
  if (s.mine) return `mine:${s.mine.id}`;
  if (s.deepView) return 'deep';
  if (s.underView) return 'under';
  return null;
}

/** The commands that bring the camera back up to the surface. */
export function surfaceCommands(s: UndergroundInput): Command[] {
  const out: Command[] = [];
  if (s.mine) out.push({ type: 'watchMine', place: null });
  if (s.deepView) out.push({ type: 'watchDeep', depth: null });
  if (s.underView) out.push({ type: 'watchUnder', on: false });
  return out;
}

/** The one-line reason for a greyed-out switch. */
export const NO_WAY_DOWN = 'Dig a mine shaft to reach the Deep';
