// A townsperson's attributes (data/attributes.ts): the base, their first level's spread in their class's proportions,
// the stat points they've spent (two a level: by the player, or by the town in the class's proportions), their work
// skills' part, their traits' and a founder's edge.
import { ATTR_AT_START, ATTR_BASE, ATTR_KEYS, ATTR_PER_SKILL, AUTO_SPEND_HOURS, classAttrs, pointsEarned, type Attrs } from '../data/attributes';
import { roadAttrs } from '../data/pathAttrs';
import { FOUNDER_EDGE } from '../data/founderClasses';
import { levelOf } from '../data/levels';
import type { GameState, Person } from './state';
import { TICKS_PER_HOUR } from './time';

type Leveled = Pick<Person, 'cls' | 'level' | 'fcls' | 'skills' | 'traits' | 'monster'> & { attrPts?: Partial<Attrs>; road?: string | null };

export function attributesOf(p: Leveled): Attrs {
  const w = classAttrs(p.cls);
  const edge = p.fcls ? FOUNDER_EDGE : 1;
  const sk = (k: keyof Person['skills']) => (p.skills[k]?.level ?? 1) * ATTR_PER_SKILL;
  // (no record yet, as before the points: every point earned so far spent the class's way; the record begins at
  // their next level, sim/classes.ts gainLevelXp)
  const spent = p.attrPts ?? virtualSpend(p);
  const a: Attrs = {
    str: ATTR_BASE + ATTR_AT_START * w.str * edge + (spent.str ?? 0) + sk('melee') + sk('construction') * 0.5,
    dex: ATTR_BASE + ATTR_AT_START * w.dex * edge + (spent.dex ?? 0) + sk('ranged') + sk('crafting') * 0.5,
    vit: ATTR_BASE + ATTR_AT_START * w.vit * edge + (spent.vit ?? 0) + sk('gathering') * 0.5 + sk('farming') * 0.5,
    int: ATTR_BASE + ATTR_AT_START * w.int * edge + (spent.int ?? 0) + sk('research'),
    wis: ATTR_BASE + ATTR_AT_START * w.wis * edge + (spent.wis ?? 0) + sk('medicine') + sk('social') * 0.5,
    cha: ATTR_BASE + ATTR_AT_START * w.cha * edge + (spent.cha ?? 0) + sk('social'),
  };
  if (p.traits.includes('tough')) a.vit += 3;
  if (p.traits.includes('quick_learner')) a.int += 2;
  // (a werewolf's curse: the beast's strength and quickness)
  if (p.monster === 'werewolf') (a.str += 4), (a.dex += 3);
  for (const k of ATTR_KEYS) a[k] = Math.round(a[k] * 10) / 10;
  return a;
}

/* ------------------------------------------------------------ stat points */

/** The points their level has earned, spent in the class's proportions (an old save's townsperson, or anyone whose
 *  record hasn't begun). */
export function virtualSpend(p: Pick<Person, 'cls' | 'level'> & { road?: string | null }): Partial<Attrs> {
  const w = roadAttrs(p.cls, p.road);
  const n = pointsEarned(levelOf(p));
  const out: Partial<Attrs> = {};
  for (const k of ATTR_KEYS) out[k] = Math.round(n * w[k] * 10) / 10;
  return out;
}
/** Begin someone's record of spent points: what they've had so far, whole points by the class's shares. */
export function beginRecord(p: Person): void {
  if (p.attrPts) return;
  const n = pointsEarned(levelOf(p));
  const rec: Partial<Attrs> = {};
  for (const k of ATTR_KEYS) rec[k] = 0;
  p.attrPts = rec;
  for (let i = 0; i < n; i++) rec[nextByClass(p)] = (rec[nextByClass(p)] ?? 0) + 1;
}

export const pointsSpent = (p: Pick<Person, 'attrPts'>) => ATTR_KEYS.reduce((n, k) => n + (p.attrPts?.[k] ?? 0), 0);
/** Points earned by their level and not yet spent. */
export const freePoints = (p: Pick<Person, 'attrPts' | 'level'>) => (p.attrPts ? Math.max(0, pointsEarned(levelOf(p)) - pointsSpent(p)) : 0);

/** Spend one point on an attribute (nothing if none are free). */
export function spendPoint(p: Person, k: keyof Attrs): boolean {
  if (freePoints(p) <= 0) return false;
  (p.attrPts ??= {})[k] = (p.attrPts[k] ?? 0) + 1;
  if (freePoints(p) <= 0) delete p.ptsSince;
  return true;
}

/** The attribute the class would raise next: the one furthest behind its share of all the points spent. */
export function nextByClass(p: Pick<Person, 'cls' | 'attrPts'> & { road?: string | null }): keyof Attrs {
  const w = roadAttrs(p.cls, p.road);
  const total = pointsSpent(p) + 1;
  let best: keyof Attrs = 'vit';
  let gap = -Infinity;
  for (const k of ATTR_KEYS) {
    const g = w[k] * total - (p.attrPts?.[k] ?? 0);
    if (g > gap) (gap = g), (best = k);
  }
  return best;
}

/** Spend every free point the class's way. */
export function spendByClass(p: Person): number {
  let n = 0;
  while (freePoints(p) > 0 && spendPoint(p, nextByClass(p))) n++;
  return n;
}

/** Each hour: points are spent the class's way unless the player is asked (then only once they've waited
 *  AUTO_SPEND_HOURS unspent, so a town left to itself still grows). */
export function statsHourly(s: GameState): void {
  const ask = s.statsAsk !== false && s.autopilot !== false;
  for (const p of s.people) {
    if (freePoints(p) <= 0) {
      delete p.ptsSince;
      continue;
    }
    if (!ask) {
      spendByClass(p);
      continue;
    }
    p.ptsSince ??= s.tick;
    if (s.tick - p.ptsSince >= AUTO_SPEND_HOURS * TICKS_PER_HOUR) spendByClass(p);
  }
}
