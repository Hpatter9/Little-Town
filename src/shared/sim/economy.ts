// Paying the townsfolk (data/economy.ts): every coin that goes into a person's purse comes through here, so each
// person's income is kept (today and yesterday, for the Townsfolk tab) and the treasury's ledger stays true.

import { PURSE_SCALE } from '../data/shop';
import { BUILDING_BY_ID } from '../data/buildings';
import { WORTH } from '../data/trade';
import type { Material, Stock } from '../data/materials';
import { GATHER_SHARE, TREASURY_KEEP } from '../data/economy';
import { earn, remember, type GameState, type LedgerLine, type Person } from './state';
import { TICKS_PER_DAY } from './time';

/** Whether the town runs on money yet: it has a shop or tavern (so there are coins to earn), or ever had coins. */
export const moneyTown = (s: GameState) => s.coins !== undefined || s.buildings.some((b) => b.status === 'done' && !!BUILDING_BY_ID[b.def]?.floor);

/** Book coins into a person's purse (their income for the day), from nowhere in particular (loot, a bounty). */
export function giveCoins(s: GameState, p: Person, n: number, why?: string): void {
  if (n <= 0) return;
  p.coins = (p.coins ?? 0) + n;
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const pay = (p.pay ??= { day, today: 0, yesterday: 0 });
  if (pay.day !== day) {
    pay.yesterday = pay.day === day - 1 ? pay.today : 0;
    pay.today = 0;
    pay.day = day;
  }
  pay.today += n;
  if (why) remember(s, p, why);
}

/** The treasury pays a person for work, as far as it can above what it keeps back. Returns what was paid. */
export function payFromTreasury(s: GameState, p: Person, want: number, line: LedgerLine, why?: string): number {
  const spare = Math.max(0, (s.coins ?? 0) - TREASURY_KEEP);
  const n = Math.min(Math.round(want), spare);
  if (n <= 0) return 0;
  s.coins = (s.coins ?? 0) - n;
  earn(s, line, -n);
  giveCoins(s, p, n, why);
  return n;
}

/** Work paid by the hour accrues tick by tick and is paid out in whole coins (`Person.owed` holds the fraction). */
export function accruePay(s: GameState, p: Person, perHour: number, line: LedgerLine, why: string, ticksPerHour: number): void {
  if (!moneyTown(s)) return;
  p.owed = (p.owed ?? 0) + (perHour * PURSE_SCALE[s.era]) / ticksPerHour;
  if (p.owed < 1) return;
  const whole = Math.floor(p.owed);
  const paid = payFromTreasury(s, p, whole, line, undefined);
  p.owed -= whole;
  if (paid) p.paidFor = { line: why, n: (p.paidFor?.line === why ? p.paidFor.n : 0) + paid };
}

/** Work by the hour paid by another person (an owner hiring builders): what they can't pay goes unpaid, and the
 *  worker moves on (sim/property.ts `canWork`). */
export function accruePayFrom(s: GameState, payer: Person, p: Person, perHour: number, why: string, ticksPerHour: number): void {
  p.owed = (p.owed ?? 0) + (perHour * PURSE_SCALE[s.era]) / ticksPerHour;
  if (p.owed < 1) return;
  const whole = Math.floor(p.owed);
  const n = Math.min(whole, payer.coins ?? 0);
  p.owed -= whole;
  if (n <= 0) return;
  payer.coins = (payer.coins ?? 0) - n;
  giveCoins(s, p, n);
  p.paidFor = { line: why, n: (p.paidFor?.line === why ? p.paidFor.n : 0) + n };
}

/** What a load brought into the stores is worth to whoever brings it (GATHER_SHARE of its worth). */
export function loadPrice(s: GameState, load: Stock): number {
  let n = 0;
  for (const [m, k] of Object.entries(load) as [Material, number][]) n += (WORTH[m] ?? 0) * k;
  return Math.round(n * GATHER_SHARE * Math.sqrt(PURSE_SCALE[s.era]));
}

/** Split a sum among a party, evenly (the odd coins to the first named). */
export function payParty(s: GameState, members: Person[], total: number, why: string): void {
  if (total <= 0 || !members.length) return;
  const each = Math.floor(total / members.length);
  let left = total - each * members.length;
  for (const p of members) {
    const n = each + (left > 0 ? 1 : 0);
    if (left > 0) left--;
    giveCoins(s, p, n, `${why} (${n} coins)`);
  }
}

/** A person's income today and yesterday. */
export function incomeOf(s: GameState, p: Person): { today: number; yesterday: number } {
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const pay = p.pay;
  if (!pay) return { today: 0, yesterday: 0 };
  if (pay.day === day) return { today: pay.today, yesterday: pay.yesterday };
  return { today: 0, yesterday: pay.day === day - 1 ? pay.today : 0 };
}
