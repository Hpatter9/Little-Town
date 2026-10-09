// Skip a raid to its recap (the owner's ask): the player taps "Skip to the end" on a raid's battle (or sets every raid
// to skip, the Town menu's Raid battles row): the town takes over the fight (auto on the trail and the board alike) and
// the game loop runs the sim flat out until the raid ends (`GameLoop.pump`), when the recap shows as it always does.
// Nothing about the fight changes but its speed: the same ticks run, so a skipped raid ends as a watched one would.

import { setAutoBattle } from './battle';
import type { GameState } from './state';

/** A raid under way that can be skipped (or is being skipped). */
export const raidOn = (s: GameState) => !!s.raid && s.raid.phase !== 'warning';

/** Skip the raid under way to its end. */
export function skipRaid(s: GameState): boolean {
  if (!s.raid || s.raidSkip) return false;
  s.raidSkip = { auto: s.autoBattle };
  setAutoBattle(s, true);
  return true;
}

/** Every tick: a town set to skip its raids skips each as it turns active. */
export function skipRaidsTick(s: GameState): void {
  if (s.skipRaids && raidOn(s) && !s.raidSkip) skipRaid(s);
}

/** The raid is over: the player's own auto setting back as it was (from raids.ts endRaid). */
export function raidSkipOver(s: GameState): void {
  if (!s.raidSkip) return;
  s.autoBattle = s.raidSkip.auto;
  s.raidSkip = undefined;
}
