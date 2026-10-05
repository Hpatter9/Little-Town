// The townsfolk's own money (the owner's direction, PLAN.md). The coins are theirs, not the town's: each person earns
// by their work and keeps a purse; the town's purse is the founder's **treasury**. What each kind of work pays, so
// some get rich and some don't:
//
// - **Gathering, farming, mining, fishing**: whoever brings a load into the stores sells it to the town there and then,
//   at GATHER_SHARE of its worth (the shop sells it on to travellers at the full price: the treasury's margin).
// - **Building**: a day rate from the treasury, by the hour worked.
// - **Study**: a stipend from the treasury, by the hour.
// - **Crafting**: a piece rate for what's made to sell (data/shop.ts PIECE_RATE; a furnishing bought outright).
// - **Keeping a shop or the tavern**: a cut of every sale.
// - **Adventuring**: every coin a party finds, and every bounty it earns, is split among the party. The richest road,
//   and the deadliest.
//
// The treasury pays for work only from what it holds above TREASURY_KEEP (it must still buy what the town can't
// gather); a poor treasury pays less, and the work still gets done (people's goodwill, for now: rent and tax come
// next, PLAN.md step 2).

/** What the stores pay for a unit brought in, as a share of its worth (data/trade.ts WORTH). */
export const GATHER_SHARE = 0.5;
/** A builder's pay for an hour's work, and a scholar's stipend (both times the era's PURSE_SCALE). */
export const BUILD_PER_HOUR = 2;
export const STUDY_PER_HOUR = 1.5;
/** A keeper's cut of each sale made in their shop or tavern. */
export const KEEPER_CUT = 0.15;
/** Coins the treasury keeps back before it pays for work. */
export const TREASURY_KEEP = 20;

/* ------------------------------------------------------------ building, land and rent (PLAN.md step 2) */

/** Building takes this much longer than it did (the owner's call: long enough that hiring builders matters). */
export const BUILD_PACE = 2;
/** The Construction level a building needs of whoever works on it, by the era of what's built (`buildSkill` adds
 *  a little for a big footprint). Below it they can't work the site at all. */
export const BUILD_SKILL_BY_ERA = { neolithic: 1, medieval: 8, industrial: 20, modern: 35, space: 50 } as const;
export const BUILD_SKILL_PER_CELL = 0.25;
export const BUILD_SKILL_FREE_CELLS = 8;
/** How fast a builder works by Construction level: a steep curve (level 1 about 0.8×, 20 about 2.7×, 50 about 5.7×,
 *  100 about 10.7×), so skill makes a huge difference. */
export const buildPower = (level: number) => 0.7 + level / 10;
/** What a cell of land costs to buy from the town, and a day's rent for a bed in one of the town's homes (both
 *  times the era's PURSE_SCALE). */
export const LAND_PRICE_PER_CELL = 4;
export const RENT_PER_BED = 1;
/** A renter who can't pay: the morale mark, and the arrears kept on them. */
export const RENT_MORALE = -3;
/** Whoever owns a site pays the builders working on it this an hour (times PURSE_SCALE); the owner works for nothing. */
export const HIRE_PER_HOUR = 2;

/* ------------------------------------------------------------ tax, guards and thrift (PLAN.md step 2b) */

export type TaxRate = 'low' | 'fair' | 'heavy';
export const TAX_RATES: readonly TaxRate[] = ['low', 'fair', 'heavy'];
/** The tax lever (the Plan tab): the share of yesterday's income each grown-up pays the treasury at dawn, and how it
 *  sits with them. Heavy tax kept up TAX_LEAVE_DAYS and people start to leave (TAX_LEAVE_CHANCE a day each). */
export const TAX: Record<TaxRate, { name: string; share: number; morale: number; text: string }> = {
  low: { name: 'Low', share: 0.05, morale: 2, text: 'A twentieth of what people earn. The treasury runs thin; people are glad of it.' },
  fair: { name: 'Fair', share: 0.15, morale: -2, text: 'A seventh of what people earn. Enough for the guards, grudged a little.' },
  heavy: { name: 'Heavy', share: 0.3, morale: -8, text: 'Nearly a third of what people earn. The treasury fills; kept up, people leave.' },
};
export const TAX_LEAVE_DAYS = 5;
export const TAX_LEAVE_CHANCE = 0.06;
/** Guards: one for every GUARD_PER_PEOPLE grown-ups (one more on Defence, one more when raided), each paid GUARD_WAGE a
 *  day by the treasury (times PURSE_SCALE); unpaid GUARD_UNPAID_DAYS running, a guard stands down. */
export const GUARD_PER_PEOPLE = 6;
export const GUARD_WAGE = 3;
export const GUARD_UNPAID_DAYS = 2;
/** What people keep back before spending on gear or an evening out (so they can save for land). */
export const SAVINGS_KEEP = 8;
