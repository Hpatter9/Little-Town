// What the town has seen of the rare things that nothing else keeps (the legends shelf: panel/shelfPanel.ts): a boss
// slain, a deed's top title won, a special newcomer found out. Noted where the thing already happens (sim/bosses.ts,
// sim/deeds.ts, sim/specials.ts); no draws, nothing else changes. Kept free of imports so anything in the sim can note one.
import type { GameState } from './state';

export type SeenKind = 'bosses' | 'deeds' | 'specials';

/** Note that the town has seen something rare (each id once; only in a town run by its autopilot). */
export function noteSeen(s: GameState, kind: SeenKind, id: string): void {
  if (s.autopilot === false) return;
  const list = ((s.seen ??= {})[kind] ??= []);
  if (!list.includes(id)) list.push(id);
}
