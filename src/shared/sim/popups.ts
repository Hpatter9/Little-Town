// Pop-ups hold the town (the owner's ask: "the game needs to pause on any popups like events or fights"). This is the
// one place that says when: `holdOf` reads the state and answers 'fight' (a raid's battle or a watched fight is on
// screen: only the fight plays, `Sim.step('fight')`), 'popup' (a question for the player is up: nothing but the
// player's answer is applied, `Sim.step('popup')`), or null (the town runs). The host (shared/gameLoop.ts) asks it every
// frame, so a hold clears the moment its pop-up goes: answered, skipped, timed out or removed. The pop-ups only the
// page knows of (a reveal card, the event box's outcome, a recap) hold through the page: renderer/mobile/popupHold.ts.
// Headless runs (tests, time away) never ask, so they play as before.

import { fightOnScreen, holdForFight } from './raidWait';
import type { GameState, Prompt } from './state';
import { TICKS_PER_HOUR } from './time';

export type Hold = 'fight' | 'popup' | null;

/** The questions that open the event box on the phone (mobile/eventSheet.ts); the strip's small card stands aside for them. */
export const EVENT_BOX_KINDS: ReadonlySet<string> = new Set<string>([
  'event', 'secret', 'saga', 'road', 'debrief', 'envoy', 'watch', 'dragon', 'evolve', 'refugees', 'village', 'council', 'trial', 'revolt', 'ways', 'enemy', 'dispute', 'duel', 'name', 'deal',
]);

/** A question held the town this long (ticks, ten real minutes) and still no answer: the town goes on, and the question's
 *  own clock with it, so it times out as ever. A page left open on a question can't hold the game for ever. */
export const POPUP_MOST_TICKS = 6000;

/** A question for the player that stops the town: any but the raid's own (its clock runs with the fight) and the gate's
 *  (the town is paused for it already). */
export const blocksTown = (p: Prompt): boolean => p.kind !== 'raid' && p.kind !== 'gate' && (!!p.waits || (!p.parked && (p.stood ?? 0) < POPUP_MOST_TICKS));

/** A question closed unanswered settles itself after this long in game time (six hours), on its default answer, unless
 *  its own clock runs out sooner. */
export const PARK_WAIT_TICKS = 6 * TICKS_PER_HOUR;

/** A question the player can close without answering: not the raid's own, the gate's, or a debrief (closing that is
 *  reading it). */
export const canPark = (p: Prompt): boolean => p.kind !== 'raid' && p.kind !== 'gate' && p.kind !== 'debrief';

/** Close a question unanswered: it waits behind the choices button and the town goes on (unless it `waits` for the founder: then the
 *  town stays held until it is answered). Its clock is cut to `PARK_WAIT_TICKS` if it was longer, and `expirePrompts`
 *  answers it with its default when that runs out. */
export function parkPrompt(s: GameState, id: number): void {
  const p = s.prompts.find((q) => q.id === id);
  if (!p || !canPark(p) || p.parked) return;
  p.parked = true;
  if (!p.waits) p.expiresTick = Math.min(p.expiresTick, s.tick + PARK_WAIT_TICKS);
}

/** Open a waiting question again (the oldest first is the page's choice). It holds the town as before while it is up. */
export function openPrompt(s: GameState, id: number): void {
  const p = s.prompts.find((q) => q.id === id);
  if (p) p.parked = false;
}

/** (A question the founder's trip waits on, `waits`, holds the town even closed: `blocksTown`; `waitingOnFounder` in the step still drops the stale ones.) */
export function holdOf(s: GameState): Hold {
  if (s.gameOver || s.paused) return null;
  if (fightOnScreen(s)) return 'fight';
  return s.prompts.some(blocksTown) ? 'popup' : null;
}

/** One tick held for a question: it counts toward `POPUP_MOST_TICKS`. */
export function stoodTick(s: GameState): void {
  for (const p of s.prompts) if (blocksTown(p)) p.stood = (p.stood ?? 0) + 1;
}

/** One tick of a fight on screen while the town holds: the fight's own timers move (the calendar does not), and the questions' clocks stand still. */
export function fightClock(s: GameState): void {
  s.tick++;
  s.fightTicks = (s.fightTicks ?? 0) + 1; // (the day's clock stands still: time.ts `clockTick`)
  holdForFight(s);
}
