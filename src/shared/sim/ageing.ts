// Townsfolk age (data/pace.ts, data/lifespans.ts): a grown-up has `grownAt`, the tick they came of age (children
// when they grow up; founders and wanderers are given one some days into their prime, decided by who they are, so
// the first generation doesn't all go grey together). Each people has its own span (dwarves and the fae live long,
// a werewolf's curse burns short): elders work slower, and past old age each night may be their last. The deathless
// (the undead, machines, vampires, a lich) never age.
import { CURSED_LIFESPAN, HUMAN_OLD_DAYS, LIFESPANS, type Lifespan } from '../data/lifespans';
import { CHILD_DAYS, ELDER_WORK, OLD_AGE_DAILY, OLD_AGE_DAILY_PER_DAY } from '../data/pace';
import type { Rng } from '../rng';
import { killPerson } from './health';
import { isChild } from './social';
import { tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

type AgeState = Pick<GameState, 'tick' | 'lich' | 'mainId' | 'origin'>;

/** Whether someone ages at all: the living, grown. */
export const ages = (s: Pick<GameState, 'lich' | 'mainId'>, p: Person) => !isChild(p) && !tireless(p) && p.monster !== 'vampire' && !(s.lich && p.id === s.mainId);

/** The span someone lives by: their town's people's, or the curse's. */
export const lifespanOf = (s: Pick<GameState, 'origin'>, p: Pick<Person, 'monster'>): Lifespan => (p.monster === 'werewolf' ? CURSED_LIFESPAN : LIFESPANS[s.origin ?? 'settlers']);

/** Founders and wanderers arrive up to this many days into their prime. */
export const primeSpread = (life: Lifespan) => Math.round(life.elderDays * 0.4);

/** When they came of age (given to a grown-up without one: some days into their prime, by who they are). */
export function grownAt(s: AgeState, p: Person): number {
  if (p.grownAt === undefined) p.grownAt = s.tick - ((p.id * 7919) % (primeSpread(lifespanOf(s, p)) + 1)) * TICKS_PER_DAY;
  return p.grownAt;
}

/** Days as a grown-up. */
export const ageDays = (s: AgeState, p: Person) => (isChild(p) ? 0 : (s.tick - grownAt(s, p)) / TICKS_PER_DAY);
export const isElder = (s: AgeState, p: Person) => ages(s, p) && ageDays(s, p) >= lifespanOf(s, p).elderDays;
/** Elders work slower. */
export const ageWork = (s: AgeState, p: Person) => (isElder(s, p) ? ELDER_WORK : 1);

/** How old they are in years (their people's reckoning): a child's years climb to `grown` as they grow up; the
 *  deathless keep the years they had (as if they came of age at the founding, so a lich looks their part). */
export function ageYears(s: AgeState, p: Person): number {
  const life = lifespanOf(s, p);
  if (isChild(p)) return Math.max(0, Math.min(life.grown, ((s.tick - (p.bornTick ?? s.tick)) / TICKS_PER_DAY / CHILD_DAYS) * life.grown));
  return life.grown + (ageDays(s, p) * (life.old - life.grown)) / life.oldDays;
}

export type LifeStage = 'child' | 'young' | 'prime' | 'elder' | 'old' | 'deathless';

export function lifeStage(s: AgeState, p: Person): LifeStage {
  if (isChild(p)) return 'child';
  if (!ages(s, p)) return 'deathless';
  const d = ageDays(s, p);
  const life = lifespanOf(s, p);
  if (d >= life.oldDays) return 'old';
  if (d >= life.elderDays) return 'elder';
  if (d < life.elderDays * 0.25) return 'young';
  return 'prime';
}

const STAGE_TEXT: Record<LifeStage, string> = {
  child: 'still a child',
  young: 'young',
  prime: 'in their prime',
  elder: 'an elder, slower than they were',
  old: 'very old: any night may be their last',
  deathless: 'deathless: the years no longer touch them',
};

/** A line for the inspect page: "A dwarf of 112 years, in their prime. Dwarves grow old at about 250." */
export function ageLine(s: AgeState, p: Person): string {
  const life = lifespanOf(s, p);
  const years = Math.floor(ageYears(s, p));
  const who = life.one[0].toUpperCase() + life.one.slice(1);
  const stage = lifeStage(s, p);
  const span = stage === 'deathless' ? '' : ` ${life.many[0].toUpperCase() + life.many.slice(1)} grow old at about ${life.old}.`;
  return `${who} of ${years} years, ${STAGE_TEXT[stage]}.${span}`;
}

/** Once a day, in the small hours: the old may die in their sleep. */
export function ageingHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || calendar(s.tick).hour !== 3) return;
  for (const p of [...s.people]) {
    if (!ages(s, p)) continue;
    const life = lifespanOf(s, p);
    const over = ageDays(s, p) - life.oldDays;
    if (over < 0) continue;
    if (!rng.chance(OLD_AGE_DAILY + over * OLD_AGE_DAILY_PER_DAY * (HUMAN_OLD_DAYS / life.oldDays))) continue;
    killPerson(s, p, 'of old age, full of days');
  }
}
