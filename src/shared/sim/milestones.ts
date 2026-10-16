// The firsts a town sees (data/tiers.ts MILESTONES): first wall closed, first child, first death, first harvest and so on.
// Each is recorded once, in `s.milestones` (id and day), where the event already fires (`markMilestone`) or, for those
// the state already shows, in the hourly look (`milestonesHourly`). Nothing here draws a number. The renderer reads them
// from the snapshot and tells each as a card; an older save records from the day it first ran this (`milestonesFrom`),
// not the days before. Off with the autopilot, like every new system.

import { MILESTONE_BY_ID, HUNDRED_DAYS, type MilestoneId } from '../data/tiers';
import { calendar } from './time';
import { addJournal, type GameState } from './state';

/** A news line and journal entry that does not take the town's next id (`nextId`): the ids of everyone born and
 *  everything built after must not move because a rank was reckoned. It sits between the last id given out and the
 *  next, as a fraction (`s.tellAt` counts the lines at that place), so it keeps its order and stays unique. */
export function tell(s: GameState, text: string, key = false): void {
  const base = s.nextId - 1;
  const at = s.tellAt?.base === base ? s.tellAt : (s.tellAt = { base, n: 0 });
  at.n = Math.min(at.n + 1, 999);
  const n = { id: base + at.n / 1000, tick: s.tick, text };
  s.notices.push(n);
  if (s.notices.length > 20) s.notices.splice(0, s.notices.length - 20);
  addJournal(s, key ? { ...n, key } : { ...n });
}

export const hasMilestone = (s: GameState, id: MilestoneId): boolean => !!s.milestones?.some((m) => m.id === id);

/** Record a first, once. Returns whether it was new. */
export function markMilestone(s: GameState, id: MilestoneId): boolean {
  if (s.autopilot === false || hasMilestone(s, id)) return false;
  const day = calendar(s.tick).day;
  (s.milestones ??= []).push({ id, day });
  s.milestonesFrom ??= day;
  tell(s, `${MILESTONE_BY_ID[id].title}. ${MILESTONE_BY_ID[id].line}`, true);
  return true;
}

/** The firsts the state shows by itself, looked for once an hour. */
export function milestonesHourly(s: GameState, founders: readonly number[]): void {
  if (s.autopilot === false) return;
  s.milestonesFrom ??= calendar(s.tick).day;
  const has = (id: MilestoneId) => hasMilestone(s, id);
  if (!has('wall') && s.ring?.done) markMilestone(s, 'wall');
  if (!has('child') && s.people.some((p) => (p.parents?.length ?? 0) > 0)) markMilestone(s, 'child');
  if (!has('death') && (s.fallen?.length ?? 0) > 0) markMilestone(s, 'death');
  if (!has('wedding') && s.people.some((p) => p.married)) markMilestone(s, 'wedding');
  if (!has('caravan') && s.caravan) markMilestone(s, 'caravan');
  if (!has('mythic') && (s.mythics?.length ?? 0) > 0) markMilestone(s, 'mythic');
  if (!has('unique') && (s.uniques?.length ?? 0) > 0) markMilestone(s, 'unique');
  if (!has('day100') && calendar(s.tick).day >= HUNDRED_DAYS) markMilestone(s, 'day100');
  if (!has('village') && (s.villages?.length ?? 0) > 0) markMilestone(s, 'village');
  if (!has('generation') && founders.length && !founders.some((id) => s.people.some((p) => p.id === id))) markMilestone(s, 'generation');
}
