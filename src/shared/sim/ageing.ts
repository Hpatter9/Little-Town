// Townsfolk age (data/pace.ts): a grown-up has `grownAt`, the tick they came of age (children when they grow up;
// founders and wanderers are given one some days into their prime, decided by who they are, so the first generation
// doesn't all go grey together). Elders work slower; past old age each night may be their last. The deathless never age.
import { ELDER_DAYS, ELDER_WORK, OLD_AGE_DAILY, OLD_AGE_DAILY_PER_DAY, OLD_AGE_DAYS, PRIME_SPREAD } from '../data/pace';
import type { Rng } from '../rng';
import { killPerson } from './health';
import { isChild } from './social';
import { tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** Whether someone ages at all: the living, grown. */
export const ages = (s: Pick<GameState, 'lich' | 'mainId'>, p: Person) => !isChild(p) && !tireless(p) && p.monster !== 'vampire' && !(s.lich && p.id === s.mainId);

/** When they came of age (given to a grown-up without one: some days into their prime, by who they are). */
export function grownAt(s: Pick<GameState, 'tick'>, p: Person): number {
  if (p.grownAt === undefined) p.grownAt = s.tick - ((p.id * 7919) % (PRIME_SPREAD + 1)) * TICKS_PER_DAY;
  return p.grownAt;
}

/** Days as a grown-up. */
export const ageDays = (s: Pick<GameState, 'tick'>, p: Person) => (isChild(p) ? 0 : (s.tick - grownAt(s, p)) / TICKS_PER_DAY);
export const isElder = (s: Pick<GameState, 'tick' | 'lich' | 'mainId'>, p: Person) => ages(s, p) && ageDays(s, p) >= ELDER_DAYS;
/** Elders work slower. */
export const ageWork = (s: Pick<GameState, 'tick' | 'lich' | 'mainId'>, p: Person) => (isElder(s, p) ? ELDER_WORK : 1);

/** Once a day, in the small hours: the old may die in their sleep. */
export function ageingHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || calendar(s.tick).hour !== 3) return;
  for (const p of [...s.people]) {
    if (!ages(s, p)) continue;
    const over = ageDays(s, p) - OLD_AGE_DAYS;
    if (over < 0) continue;
    if (!rng.chance(OLD_AGE_DAILY + over * OLD_AGE_DAILY_PER_DAY)) continue;
    killPerson(s, p, 'of old age, full of days');
  }
}
