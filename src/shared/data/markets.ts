// A real trade economy (the owner's pick of the content updates, the ninth; sim/markets.ts). Prices move with supply,
// distance and war; the town's trade house sends its own wagons down routes to the powers' strongholds on the world
// map; booms, shortages, gluts and crashes come and go; and the house can grow into a merchant power, or borrow too
// much and go bust on a bad season.

import type { Material } from './materials';

/** The hour each day the markets move (and loans fall due), and the hour the wagons set out. */
export const MARKET_HOUR = 7;
export const SEND_HOUR = 8;

/* ------------------------------------------------------------ prices */

/** A good's price is its worth (data/trade.ts WORTH) times an index that drifts this share of the way to its target each
 *  morning, with a little noise, kept between the two bounds. */
export const PRICE_DRIFT = 0.3;
export const PRICE_NOISE = 0.06;
export const PRICE_LEAST = 0.35;
export const PRICE_MOST = 3;
/** Supply: what the town has sold of a good lately (`flow`, halved each morning) lowers its price, what it has bought
 *  raises it: this many coins' worth moves it a full step (to the bounds `FLOW_LEAST`..`FLOW_MOST`). */
export const FLOW_WORTH = 300;
export const FLOW_LEAST = 0.6;
export const FLOW_MOST = 1.5;
/** War: arms and food dearer for every power the town is at war with (a feud between two powers counts half). */
export const WAR_ARMS = 0.25;
export const WAR_FOOD = 0.1;
export const ARMS: readonly Material[] = ['iron', 'steel', 'arrows', 'shot', 'cartridges', 'leather', 'bronze', 'alloys', 'iron_ore', 'sulphur'];
/** The seasons: food dear in winter, cheap at the harvest. */
export const WINTER_FOOD = 1.25;
export const HARVEST_FOOD = 0.85;

/* ------------------------------------------------------------ booms and shortages */

export type SwingKind = 'boom' | 'shortage' | 'glut' | 'crash';
/** A swing begins on this share of mornings (at most `SWINGS_MOST` at once), lasting so many days, moving the price by
 *  so much. */
export const SWING_DAILY = 0.35;
export const SWINGS_MOST = 3;
export const SWING_DAYS: [number, number] = [3, 7];
export const SWING_MULT: Record<SwingKind, [number, number]> = { boom: [1.6, 2.4], shortage: [1.5, 2.2], glut: [0.45, 0.65], crash: [0.4, 0.6] };
/** A bad season: in winter, or with a war on, shortages of food come this many times as often. */
export const BAD_SEASON = 2.5;

export type GoodKind = 'food' | 'metal' | 'build' | 'cloth' | 'rich' | 'arms' | 'other';
export function goodKind(m: Material): GoodKind {
  if (ARMS.includes(m) && !/ore$/.test(m)) return 'arms';
  if (['grain', 'bread', 'flour', 'meat', 'dried_meat', 'berries', 'fish', 'kelp', 'vegetables', 'fruit', 'milk', 'eggs', 'rations'].includes(m)) return 'food';
  if (/ore$/.test(m) || ['coal', 'copper', 'silver', 'sulphur', 'rare_minerals'].includes(m)) return 'metal';
  if (['wood', 'lumber', 'stone', 'bricks', 'clay', 'concrete', 'glass'].includes(m)) return 'build';
  if (['cloth', 'wool', 'hide', 'leather', 'fiber'].includes(m)) return 'cloth';
  if (['gold', 'gems', 'pearls', 'blood'].includes(m)) return 'rich';
  return 'other';
}

/** Why the market swung: `{place}` is filled with a power's name, else "the south". */
export const SWING_WHY: Record<SwingKind, Partial<Record<GoodKind, string[]>> & { any: string[] }> = {
  boom: {
    food: ['the cities of {place} are hungry for it', 'a great feast is being laid in {place}'],
    metal: ['the smiths of {place} cannot get enough', 'a new mint has opened in {place}'],
    build: ['{place} is building a great wall', 'half of {place} is being rebuilt after a fire'],
    cloth: ['a new fashion has caught on in {place}', 'the court of {place} is dressing for a wedding'],
    rich: ['the lords of {place} are spending as if there were no tomorrow', 'a jeweller\'s craze has swept {place}'],
    arms: ['{place} is arming', 'every captain in {place} is buying'],
    any: ['the merchants of {place} are buying it up', 'it is all the talk in {place}'],
  },
  shortage: {
    food: ['the harvest failed in {place}', 'blight has struck the fields of {place}', 'the granaries of {place} are empty'],
    metal: ['the mines of {place} have flooded', 'a pit collapsed in {place}'],
    build: ['the quarries of {place} are closed by floods', 'the roads from {place} are washed out'],
    cloth: ['a murrain took the flocks of {place}', 'the looms of {place} stand idle'],
    rich: ['the diggers of {place} have struck', 'pirates took the ships of {place}'],
    arms: ['the forges of {place} are cold', 'the armouries of {place} were looted'],
    any: ['nobody can get any out of {place}', 'the carts from {place} have stopped'],
  },
  glut: {
    food: ['a bumper harvest in {place}', 'the barns of {place} are bursting'],
    metal: ['a rich new vein was struck in {place}', 'the mines of {place} are working day and night'],
    build: ['{place} has stopped building', 'a new quarry opened in {place}'],
    cloth: ['a glut of fleeces out of {place}', 'the mills of {place} are running flat out'],
    rich: ['treasure has turned up in {place}', 'a hoard was dug up in {place}'],
    arms: ['{place} has made peace and is selling off its stores', 'the armouries of {place} are emptying'],
    any: ['{place} is selling it off cheap', 'every cart out of {place} carries it'],
  },
  crash: {
    any: ['a merchant house in {place} has failed and its stores are being sold off', 'nobody in {place} wants it any more', 'panic in the markets of {place}'],
  },
};

/* ------------------------------------------------------------ the trade house */

export interface HouseTier {
  name: string;
  /** Standing (the house's profit, less its losses) it is reached at. */
  at: number;
  /** Routes it may run at once, a wagon's load (units, times the era's offer scale), its haggling (on the price both
   *  ways), and what the moneylenders will lend it (0: nothing). */
  routes: number;
  load: number;
  haggle: number;
  loan: number;
}
export const HOUSE_TIERS: readonly HouseTier[] = [
  { name: 'Peddlers', at: 0, routes: 1, load: 20, haggle: 0, loan: 0 },
  { name: 'Traders', at: 150, routes: 2, load: 30, haggle: 0.03, loan: 60 },
  { name: 'Merchant House', at: 600, routes: 3, load: 45, haggle: 0.06, loan: 150 },
  { name: 'Trade League', at: 1800, routes: 4, load: 60, haggle: 0.09, loan: 300 },
  { name: 'Merchant Power', at: 4500, routes: 6, load: 80, haggle: 0.12, loan: 600 },
];

/** A power sells its own goods (data/trade.ts FACTION_GOODS) cheap and pays well for what it wants (three goods, by the
 *  seed); the further away it is, the more what the town brings is worth there. */
export const MAKES_PRICE = 0.65;
export const WANTS_PRICE = 1.5;
export const WANTS_COUNT = 3;
export const DISTANCE_PREMIUM = 0.5;
/** A wagon's road: so many game hours per hundred leagues of map each way. */
export const HOURS_PER_100 = 4;
/** A power the town has no treaty with takes this toll on what's sold there. */
export const TOLL = 0.12;
/** The house sends goods only where they fetch at least this much more than at home. */
export const SEND_MARGIN = 1.1;
/** The town keeps back this much of a good before it trades any away (food: `FOOD_KEEP`). */
export const GOODS_KEEP = 30;
export const FOOD_KEEP = 60;
/** The share of the treasury above its keep a wagon carries to buy with, and the most. */
export const STAKE_SHARE = 0.3;
export const STAKE_MOST = 200;
/** What a wagon buys to bring home: goods the town is short of (under `SHORT`) or that are this much cheaper there. */
export const SHORT = 10;
export const BUY_MARGIN = 1.25;
/** Robbed on the road: this often, more the longer the road (a share of the map), half as often with two guards or an
 *  ally; robbers take this share of what's carried. */
export const ROBBED = 0.08;
export const ROBBED_PER_DISTANCE = 0.15;
export const ROBBED_TAKE = 0.6;
/** A loan: borrowed when a wagon has too little to carry, owed back with interest within so many days. */
export const LOAN_INTEREST = 0.25;
export const LOAN_DAYS = 6;
/** A stake worth less than this (coins) isn't worth the road: the house borrows to fill it, or waits. */
export const STAKE_LEAST = 25;
/** Gone bust: the routes closed for so many days, and the town's spirits. */
export const BUST_DAYS = 4;
export const BUST_MORALE = -8;
export const BUST_HOURS = 48;
/** Three losing runs in a row and the moneylenders call in a loan early. */
export const LOSSES_CALL = 3;
/** A merchant power: the town's spirits, and goodwill with its partners each morning. */
export const POWER_MORALE = 8;
export const PARTNER_GOODWILL = 0.5;
/** Lines kept in the house's log. */
export const LOG_MOST = 12;
