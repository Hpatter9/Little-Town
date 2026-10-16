// Close calls (the owner's aim: stakes you feel). When someone nearly dies and does not (their bleeding stopped by a
// townsperson, a medkit on the spot, a raid that left them with barely a breath, a cave-in or a flood below survived,
// a sickness that turned), a line is told: "Bram nearly bled out; Osric stopped the bleeding." It is kept on the
// person (`Person.closeCalls`, the last few, for their diary and the "Shaken" label on their card for a while after,
// `SHAKEN_HOURS`) and on the town (`GameState.closeCalls`, which the Journal's view weaves in among its lines and the
// raid's recap tells). Detected where those things already happen; no draws, no ids taken (the line sits in the
// Journal after the entry before it: `after`), and nothing here changes how the town plays.

import { maxHp, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

/** The "Shaken" label on someone's card lasts this long (game hours) after a close call. */
export const SHAKEN_HOURS = 12;
/** Close calls kept on a person (for their diary) and on the town (for the Journal). */
export const CLOSE_CALLS_KEPT = 3;
export const TOWN_CLOSE_CALLS = 40;
/** A raid left someone standing with this share of their health or less: a close call. */
export const SLIVER = 0.2;

export interface CloseCall {
  tick: number;
  /** Who it happened to. */
  id: number;
  text: string;
  /** The last id taken when it happened (`s.nextId - 1`): the Journal shows it just after that entry. */
  after: number;
}

/** Someone nearly died: tell it and remember it. */
export function closeCall(s: GameState, p: Person, text: string): void {
  p.closeCalls = [...(p.closeCalls ?? []), { tick: s.tick, text }].slice(-CLOSE_CALLS_KEPT);
  const town = (s.closeCalls ??= []);
  town.push({ tick: s.tick, id: p.id, text, after: s.nextId - 1 });
  if (town.length > TOWN_CLOSE_CALLS) town.splice(0, town.length - TOWN_CLOSE_CALLS);
}

/** Still shaken by a close call (a label on their card only). */
export const isShaken = (s: GameState, p: Person): boolean => {
  const last = p.closeCalls?.at(-1);
  return !!last && s.tick - last.tick < SHAKEN_HOURS * TICKS_PER_HOUR;
};

/** The raid's close calls, for its recap: those who came through with a sliver of health (called as it ends, with
 *  the townsfolk who fought and what they took), and the lines told since it began. */
export function raidCloseCalls(s: GameState, since: number, fought: { id: number; died: boolean; fell: boolean }[]): string[] {
  for (const row of fought) {
    if (row.died || row.fell) continue;
    const p = s.people.find((q) => q.id === row.id);
    if (!p || p.hp <= 0 || p.hp > maxHp(p) * SLIVER) continue;
    if (p.closeCalls?.some((c) => c.tick >= since)) continue; // (told already: their bleeding stopped)
    closeCall(s, p, `${p.name} nearly fell to the raiders, and came through with barely a breath left.`);
  }
  return (s.closeCalls ?? []).filter((c) => c.tick >= since && fought.some((r) => r.id === c.id)).map((c) => c.text);
}

