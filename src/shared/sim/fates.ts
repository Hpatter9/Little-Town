// Fateful choices, remembered (the owner's ask: a fateful choice is remembered forever). When a fateful event
// (data/fatefulEvents.ts) is answered, `recordFate` writes down the day, the event, the answer taken and what came of
// it at once; when a delayed consequence of it lands (an effect met under `later`, sim/events.ts), `fateLanded` adds
// that as its consequence line. The Chronicle's "Fateful choices" section shows them (panel/heroesPanel.ts). Nothing
// here draws a number: it only keeps what the event already resolved, so no town plays out differently for it.
import type { GameState } from './state';
import { TICKS_PER_DAY } from './time';

export interface Fate {
  /** The tick it was answered (also what a delayed effect finds it by). */
  tick: number;
  day: number;
  event: string;
  /** The event's title, as the player saw it ("The night you let the stranger in"). */
  title: string;
  /** The answer taken. */
  choice: string;
  /** What came of it at once. */
  result: string;
  /** What came of it later, once it landed. */
  later?: string;
  /** A consequence is still to come (an effect waiting under `later`). */
  pending?: boolean;
}

/** The most fates kept (the oldest are let go). */
export const FATES_KEPT = 40;

/** Whether an effect of the fate answered at `tick` is still waiting its hour. */
const waiting = (s: GameState, tick: number) => !!s.eventLater?.some((l) => l.fate === tick);
const upper = (x: string) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const stop = (x: string) => (/[.!?)]$/.test(x) ? x : `${x}.`);

/** Write down a fateful answer. */
export function recordFate(s: GameState, event: string, title: string, choice: string, lines: string[]): number {
  const fate: Fate = { tick: s.tick, day: Math.floor(s.tick / TICKS_PER_DAY) + 1, event, title, choice, result: lines.map(upper).map(stop).join(' ') };
  if (waiting(s, fate.tick)) fate.pending = true;
  s.fates = [...(s.fates ?? []), fate].slice(-FATES_KEPT);
  return fate.tick;
}

/** A delayed consequence of the fate answered at `tick` has landed: add what came of it. */
export function fateLanded(s: GameState, tick: number, lines: string[]): void {
  const fate = s.fates?.find((f) => f.tick === tick);
  if (!fate) return;
  if (!waiting(s, tick)) delete fate.pending;
  if (!lines.length) return;
  const text = lines.map(upper).map(stop).join(' ');
  fate.later = fate.later ? `${fate.later} ${text}` : text;
}

/** The Chronicle's view: newest first. */
export function fatesView(s: GameState): Fate[] {
  return [...(s.fates ?? [])].reverse();
}
