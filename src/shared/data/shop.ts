// The shop and travellers (Phase 2 of the ant-farm redesign). The town builds a Trading Post (later a General Store,
// then an Emporium), makes furnishings for it, and its shopkeeper sets them out. Travellers pass through, buy what
// the town has spare for coins, and sell it what it lacks. A better-furnished shop draws more of them, and they
// spend more. Numbers are starting points for tuning.

import { BUILDING_BY_ID } from './buildings';
import type { Era } from './eras';
import { ITEMS, type ItemDef } from './items';
import type { Material } from './materials';
import { caravanGoods } from './trade';

/** Every kind of shop, smallest first (each upgrades into the next). */
export const SHOPS: readonly string[] = ['trading_post', 'general_store', 'emporium'];
export const isShop = (def: string) => !!BUILDING_BY_ID[def]?.shop;

/** Everything a shopkeeper can set out. */
export const FURNISHINGS: readonly ItemDef[] = ITEMS.filter((i) => i.furnish);

/** Game hours between travellers for a bare shop (a well-furnished one draws them more often; see travellerGap). */
export const TRAVELLER_EVERY: [number, number] = [4, 7];
/** Appeal that halves the wait between travellers. */
export const APPEAL_HALVES_WAIT = 25;
/** Most travellers in town at once. */
export const MAX_TRAVELLERS = 3;
/** How long a traveller browses (game hours), and how fast they walk (px per second). */
export const SHOPPING_HOURS = 1;
export const TRAVELLER_SPEED = 40;

/** A traveller's purse (coins), before the era's scale, the shop's appeal and the shopkeeper's skill. */
export const PURSE: [number, number] = [6, 14];
export const PURSE_SCALE: Record<Era, number> = { neolithic: 1, medieval: 2, industrial: 4, modern: 6, space: 8 };
/** Each point of appeal adds this share to what a traveller spends; each Social level of the shopkeeper this. */
export const APPEAL_SPEND = 0.04;
export const KEEPER_SPEND = 0.03;
/** Most of one good a traveller buys, and most kinds of goods. */
export const MAX_BUY_EACH = 12;
export const MAX_KINDS = 3;

/** What the town pays for a traveller's goods, over their worth (coins per unit of worth). */
export const BUY_MARKUP = 1.25;
/** Most of one good the town buys from a traveller. */
export const MAX_SELL_EACH = 20;
/** Coins the town keeps back (times the era's purse scale) unless it's buying something it can't get any other way. */
export const COIN_RESERVE = 15;
/** Lines kept in the shop's log. */
export const SHOP_LOG = 8;

/** What travellers carry to sell: everyday goods, and whatever caravans bring in the town's era. */
const EVERYDAY: readonly Material[] = ['fiber', 'wood', 'stone', 'hide', 'clay', 'flint', 'herbs', 'berries', 'bone'];
export function travellerGoods(era: Era): Material[] {
  return [...new Set([...EVERYDAY, ...(era === 'neolithic' ? [] : caravanGoods(era))])];
}

/** Where they're from (for the log), and what they're called. */
export const TRAVELLER_KINDS = ['pedlar', 'herder', 'pilgrim', 'tinker', 'trapper', 'wanderer', 'salt trader', 'potter'];
