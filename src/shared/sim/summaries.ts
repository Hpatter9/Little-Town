// One summary card for each trip and each raid (the owner's ask: the cards that piled up after a trip or a raid are
// merged). A commanded party's homecoming (sim/muster.ts `debrief`) and a raid's recap (sim/raidRecap.ts) are the
// summaries: the founder's story chapter for the trip or the raid is still written (the Story tab) but not put as a
// card of its own, only named on the summary; the firsts it earned are told on it as lines, not their own cards
// (`folded`: the page's milestone cards pass them by); and the "While you were gone" news joins the trip's card.
// Choices (a creature's pick, a naming) still come as their own steps. Everything still goes to the news and annals.

import { MILESTONE_BY_ID, type MilestoneId } from '../data/tiers';
import { markMilestone } from './milestones';
import type { FirstLine, GameState } from './state';

/** How many firsts the town has recorded: pass it to `foldFirsts` after the summary's moment to fold what came since. */
export const firstsSoFar = (s: GameState): number => s.milestones?.length ?? 0;

/** The firsts recorded since `since` (`firstsSoFar`), marked as told on a summary card, as lines for it. */
export function foldFirsts(s: GameState, since: number): FirstLine[] {
  const out: FirstLine[] = [];
  for (const m of (s.milestones ?? []).slice(since)) {
    const d = MILESTONE_BY_ID[m.id as MilestoneId];
    if (!d) continue;
    m.folded = true;
    out.push({ title: d.title, line: d.line, icon: d.icon });
  }
  return out;
}

/** The firsts a deadly moment earns at once rather than at the next hourly look, so the summary can tell them: the
 *  first death. (Deterministic: no numbers drawn, and markMilestone does nothing with the autopilot off.) */
export function marksNow(s: GameState, died: boolean): void {
  if (died && (s.fallen?.length ?? 0) > 0) markMilestone(s, 'death');
  if ((s.uniques?.length ?? 0) > 0) markMilestone(s, 'unique');
}

/** The founder's trip card still waiting to be read, for the steward's news to join. */
export function founderTripCard(s: GameState) {
  return s.prompts.find((p) => p.kind === 'debrief' && p.debrief?.trip !== undefined && p.debrief.chapter !== undefined && !p.debrief.home);
}
