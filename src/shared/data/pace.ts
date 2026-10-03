// The game's length (the owner's call): a town should take generations to reach the stars, about three months of
// real time played on a phone. Research takes PACE times longer in every era, and the dangers that grow with the day
// (raids' strength and kinds, flanking, the lords' health, the Behemoth) count a paced day instead (sim/time.ts
// `paceDay`), so a long Stone Age stays a Stone Age fight. Townsfolk age meanwhile (data/ageing below, sim/ageing.ts):
// grown-ups are in their prime, then elders, and death comes for them in old age (each people's span is in
// data/lifespans.ts: dwarves and the fae live long, a werewolf's curse burns short), so the founders' grandchildren are the ones who leave for the stars.
import type { Era } from './eras';

/** How much longer research takes, by the topic's era (the later eras already stretch far: RESEARCH_MULTIPLIER). */
export const RESEARCH_PACE: Record<Era, number> = { neolithic: 10, medieval: 5, industrial: 4, modern: 3, space: 2 };
/** The day-driven dangers count the day divided by this. */
export const DANGER_PACE = 2.5;

/* ------------------------------------------------------------ ageing */

/** Each people's span (days grown before an elder, before old age) is in data/lifespans.ts. From old age each day
 *  may be their last: OLD_AGE_DAILY, and more each day past it (scaled to the people's span). The deathless (the
 *  undead, machines, vampires, a lich) never age. */
export const OLD_AGE_DAILY = 0.05;
export const OLD_AGE_DAILY_PER_DAY = 0.012;
/** Elders work this much slower. */
export const ELDER_WORK = 0.8;
/** Children grow up after this many days. */
export const CHILD_DAYS = 18;
/** Wanderers come less as a town fills, and none past this many people: a long game would swell a town past what a
 *  phone can draw, and generations should turn over, not pile up. */
export const POP_SOFT_CAP = 60;
