// Raids wait for the player (CLAUDE.md, "More to watch"). While the town is caught up after time away, raiders who
// reach the gate hold there: the town pauses, a "Raiders at the gate" question asks the player to watch the fight, and
// the raid begins when they answer (or when the town is unpaused). If the player stays away more than RAID_WAIT_MS
// after the raiders arrived, it plays out without them. The phone page books an alert for when they'll arrive
// (renderer/mobile/alerts.ts, from `raidDueTick`).

import { RAID_KIND_BY_ID } from '../data/raids';
import type { GameState } from './state';

/** The longest raiders wait at the gate for the player (real ms). */
export const RAID_WAIT_MS = 12 * 3600_000;

/** Raiders are about to come through (their warning is up with the next tick), and haven't been held or left alone. */
export const raidAtGate = (s: GameState) => !!s.raid && s.raid.phase === 'warning' && s.tick + 1 >= s.raid.arrivesTick && s.raid.waiting === undefined && !s.raid.alone;

/** Hold the raid at the gate: the town pauses and asks. `waited` is how long (real ms) it has waited already. */
export function holdAtGate(s: GameState, waited: number): void {
  const r = s.raid!;
  const kind = RAID_KIND_BY_ID[r.kind];
  r.waiting = waited;
  s.paused = true;
  s.prompts.push({
    id: s.nextId++,
    kind: 'gate',
    expedition: null,
    title: `${kind.name} at the gate!`,
    text: `${r.raiders.length} ${r.raiders.length === 1 ? 'raider has' : 'raiders have'} reached the town, and the town waits for you. The fight starts when you're watching.`,
    options: ['Watch the fight'],
    defaultOption: 0,
    // (the town is paused while this waits, so it never runs out in play: RAID_WAIT_MS decides, in offline.ts)
    expiresTick: Number.MAX_SAFE_INTEGER,
  });
}

/** Let a held raid in (the player is watching, or it waited long enough). */
export function openGate(s: GameState): void {
  s.prompts = s.prompts.filter((p) => p.kind !== 'gate');
  if (s.raid?.waiting === undefined) return;
  delete s.raid.waiting;
  s.raid.alone = false;
  s.raid.arrivesTick = Math.min(s.raid.arrivesTick, s.tick + 1);
  s.paused = false;
}

/** The tick raiders will next reach the town, if it's known: a raid on its way, else the next one due (plus its
 *  warning, roughly). */
export function raidDueTick(s: GameState): number | null {
  if (s.raid) return s.raid.phase === 'warning' ? s.raid.arrivesTick : null;
  return s.nextRaidTick ?? null;
}
