// The founder's treasury (PLAN.md step 2b): tax at dawn on what people earned the day before, at the rate the player
// sets on the Plan tab (data/economy.ts TAX), and the guards it pays: a standing calling, hired by the hour from the
// best fighters free, paid a wage at dawn, on patrol between raids (people.ts `onShift`) and first on the raid map
// (battle.ts `autoPlace`). Heavy tax kept up drives people off.

import { GUARD_PER_PEOPLE, GUARD_UNPAID_DAYS, GUARD_WAGE, TAX, TAX_LEAVE_CHANCE, TAX_LEAVE_DAYS, type TaxRate } from '../data/economy';
import { PURSE_SCALE } from '../data/shop';
import { OPERATORS } from '../data/operators';
import { Rng } from '../rng';
import { hashSeed, mixSeed } from '../rng';
import { giveCoins, incomeOf, moneyTown } from './economy';
import { ambitionOf } from './ambition';
import { directionOf } from './planner';
import { earn, notify, remember, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export const taxRate = (s: GameState): TaxRate => s.tax ?? 'fair';
export const guardWage = (s: GameState) => Math.max(1, Math.round(GUARD_WAGE * PURSE_SCALE[s.era]));
const grownAtHome = (s: GameState) => s.people.filter((p) => p.bornTick == null && p.away === null && !p.downed);

/** Once an hour: guards hired or stood down; at dawn, tax and the guards' wages. */
export function treasuryHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !moneyTown(s)) return;
  if (calendar(s.tick).hour === 6) {
    collectTax(s, rng);
    payGuards(s);
  }
  assignGuards(s);
}

/** Tax at dawn: a share of yesterday's income from every grown-up (what they can pay of it). */
export function collectTax(s: GameState, rng: Rng): void {
  const rate = TAX[taxRate(s)];
  let took = 0;
  for (const p of s.people) {
    if (p.bornTick != null) continue;
    const due = Math.round(incomeOf(s, p).yesterday * rate.share);
    const n = Math.min(due, p.coins ?? 0);
    if (n <= 0) continue;
    p.coins = (p.coins ?? 0) - n;
    took += n;
    p.taxPaid = (p.taxPaid ?? 0) + n;
  }
  if (took) {
    s.coins = (s.coins ?? 0) + took;
    earn(s, 'tax', took);
  }
  // heavy tax, kept up: people start to leave (never the founder)
  if (taxRate(s) === 'heavy') {
    s.taxHeavySince ??= s.tick;
    if (s.tick - s.taxHeavySince >= TAX_LEAVE_DAYS * TICKS_PER_DAY)
      for (const p of grownAtHome(s)) {
        if (p.id === s.mainId || !rng.chance(TAX_LEAVE_CHANCE)) continue;
        s.people = s.people.filter((q) => q !== p);
        for (const b of s.buildings) if (b.operator === p.id) b.operator = null;
        notify(s, `${p.name} has left the town, sick of the tax.`, true);
        break; // (one a day at most)
      }
  } else delete s.taxHeavySince;
}

/** How many guards the town wants: one for every GUARD_PER_PEOPLE grown-ups, one more on Defence or when raided. */
export function guardsWanted(s: GameState): number {
  const grown = s.people.filter((p) => p.bornTick == null).length;
  const raided = s.journal.some((j) => j.text.startsWith('Raid by') && s.tick - j.tick < 3 * TICKS_PER_DAY);
  return Math.floor(grown / GUARD_PER_PEOPLE) + (directionOf(s) === 'defense' ? 1 : 0) + (raided ? 1 : 0);
}
export const guardsOf = (s: GameState): Person[] => s.people.filter((p) => p.guard);

/** Hire the best fighters free (not keepers or holders of a post) up to what's wanted and what the treasury can pay
 *  for a day; stand one down when there are more than wanted. */
export function assignGuards(s: GameState): void {
  const guards = guardsOf(s);
  const want = Math.min(guardsWanted(s), Math.floor(Math.max(0, (s.coins ?? 0)) / guardWage(s)) + guards.length);
  if (guards.length > guardsWanted(s)) {
    const g = guards.sort((a, b) => fight(a) - fight(b))[0];
    delete g.guard;
    notify(s, `${g.name} is no longer needed as a guard.`);
    return;
  }
  if (guards.length >= want) return;
  const busy = new Set(s.buildings.filter((b) => b.operator != null && OPERATORS[b.def]).map((b) => b.operator!));
  const pick = grownAtHome(s)
    .filter((p) => !p.guard && p.id !== s.mainId && !busy.has(p.id))
    .sort((a, b) => fight(b) - fight(a))[0];
  if (!pick) return;
  pick.guard = true;
  pick.priorities.defend = 1;
  pick.autoPriorities = false;
  remember(s, pick, `Hired as a guard (${guardWage(s)} coins a day)`);
  notify(s, `${pick.name} was hired as a guard: ${guardWage(s)} coins a day from the treasury.`, true);
}
const fight = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level) * 2 + p.hp / 20 + (ambitionOf(p) === 'guard' ? 10 : 0);

/** The guards' wages at dawn; a guard the treasury can't pay two days running stands down. */
export function payGuards(s: GameState): void {
  for (const g of guardsOf(s)) {
    // (a guard's wage comes before the treasury's keep: it's what the tax is for)
    const wage = guardWage(s);
    const paid = Math.min(wage, Math.max(0, s.coins ?? 0));
    if (paid > 0) {
      s.coins = (s.coins ?? 0) - paid;
      earn(s, 'guards', -paid);
      giveCoins(s, g, paid, `A guard's wage (${paid} coins)`);
    }
    if (paid >= wage) {
      g.guardUnpaid = 0;
      continue;
    }
    g.guardUnpaid = (g.guardUnpaid ?? 0) + 1;
    if (g.guardUnpaid >= GUARD_UNPAID_DAYS) {
      delete g.guard;
      g.autoPriorities = true;
      notify(s, `${g.name} stood down as a guard: the treasury couldn't pay.`, true);
    }
  }
}

/** A seeded roll for the day (for tests that call the dawn's work directly). */
export const dawnRng = (s: GameState) => new Rng(mixSeed(hashSeed(s.seed), s.tick, 7));
