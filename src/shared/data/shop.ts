// The shop and travellers (Phase 2 of the ant-farm redesign). The town builds a Trading Post (later a General Store,
// then an Emporium), makes furnishings for it, and its shopkeeper sets them out. Travellers pass through, buy what
// the town has spare for coins, and sell it what it lacks. A better-furnished shop draws more of them, and they
// spend more. Numbers are starting points for tuning.

import { BUILDING_BY_ID } from './buildings';
import type { Era } from './eras';
import { ITEMS, type ItemDef, type WareTier } from './items';
import type { Material } from './materials';
import { caravanGoods } from './trade';

/** Every kind of shop, smallest first (each upgrades into the next). */
export const SHOPS: readonly string[] = ['trading_post', 'general_store', 'emporium'];
export const isShop = (def: string) => !!BUILDING_BY_ID[def]?.shop;

/** Everything a shopkeeper can set out, and every ware the town can make to sell. */
export const FURNISHINGS: readonly ItemDef[] = ITEMS.filter((i) => i.furnish);
export const WARES: readonly ItemDef[] = ITEMS.filter((i) => i.ware);

/* ------------------------------------------------------------ customers */

/** Who a shop draws, by how attractive it is (its appeal plus its renown). Each tier comes once the shop is that
 *  attractive, with a bigger purse, and wants wares of its own tier: a merchant who finds none leaves disappointed,
 *  and the shop's renown suffers. */
export interface CustomerTier {
  tier: WareTier;
  name: string;
  plural: string;
  /** Attractiveness the shop needs before they come. */
  from: number;
  /** How often they come, against the other tiers the shop draws. */
  weight: number;
  /** Their purse, times an ordinary traveller's. */
  purse: number;
  /** What they're called (one is picked for each). */
  kinds: string[];
  /** What they wear (their tunics, in town and in the shop). */
  outfit: string;
}
export const CUSTOMER_TIERS: readonly CustomerTier[] = [
  { tier: 1, name: 'Traveller', plural: 'Travellers', from: 0, weight: 4, purse: 1, kinds: ['pedlar', 'herder', 'pilgrim', 'tinker', 'trapper', 'wanderer', 'salt trader', 'potter'], outfit: '' },
  { tier: 2, name: 'Merchant', plural: 'Merchants', from: 18, weight: 3, purse: 3, kinds: ['merchant', 'spice trader', 'guild factor', 'cloth buyer'], outfit: '#2a5a9a' },
  { tier: 3, name: 'Noble', plural: 'Nobles', from: 45, weight: 2, purse: 8, kinds: ['baroness', 'knight', 'abbess', 'lord'], outfit: '#6a2a8a' },
  { tier: 4, name: 'Magnate', plural: 'Magnates', from: 90, weight: 1.5, purse: 20, kinds: ['magnate', 'collector', 'heiress', 'tycoon'], outfit: '#1e1e24' },
];
export const tierOf = (t: number): CustomerTier => CUSTOMER_TIERS[Math.max(0, Math.min(CUSTOMER_TIERS.length, t) - 1)];
/** The customer tiers a shop this attractive draws. */
export const tiersDrawn = (attract: number) => CUSTOMER_TIERS.filter((c) => attract >= c.from);

/** Renown: won by a customer who finds a ware of their tier (this much a tier), lost by one who doesn't; it fades by
 *  this share each game day, and never goes past the cap. */
export const RENOWN_WIN = 2;
export const RENOWN_LOSS = 1.5;
export const RENOWN_FADE = 0.05;
export const RENOWN_MAX = 60;
/** Wares the town keeps in stock of each kind it makes for the customers it draws. */
export const WARE_STOCK = 3;

/* ------------------------------------------------------------ spending coins on the shop */

/** Extensions bought with coins: each widens the floor by two cells and deepens it by one, up to this many. */
export const MAX_EXTENSIONS = 3;
export const extensionCost = (n: number) => 60 * 2 ** n;
/** Pieces improved with coins, up to this level: each level adds half the piece's appeal again, for its appeal
 *  times this many coins times the level it goes to. */
export const MAX_PIECE_LEVEL = 3;
export const PIECE_LEVEL_COST = 8;

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
/** Each point of attractiveness adds this share to what a traveller spends; each Social level of the shopkeeper this. */
export const APPEAL_SPEND = 0.02;
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

