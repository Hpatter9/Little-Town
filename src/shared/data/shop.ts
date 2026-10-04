// The shop and travellers (Phase 2 of the ant-farm redesign). The town builds a Trading Post (later a General Store,
// then an Emporium), makes furnishings for it, and its shopkeeper sets them out. Travellers pass through, buy what
// the town has spare for coins, and sell it what it lacks. A better-furnished shop draws more of them, and they
// spend more. Numbers are starting points for tuning.

import { BUILDING_BY_ID, type Venue } from './buildings';
import type { Era } from './eras';
import { ITEM_BY_ID, ITEMS, type ItemDef, type WareTier } from './items';
import { plusOf, qualityMult } from './quality';
import { WORTH } from './trade';
import type { Material } from './materials';
import { caravanGoods } from './trade';
import { SHOP_LINES, type ShopLine } from './stores';

/** Every kind of shop, smallest first (each upgrades into the next). */
export const SHOPS: readonly string[] = ['trading_post', 'general_store', 'emporium'];
/** The general store's chain (a specialty shop is a venue of the shop kind too, but not one of these). */
export const isShop = (def: string) => BUILDING_BY_ID[def]?.floor?.venue === 'shop' && !BUILDING_BY_ID[def]?.floor?.line;
/** What a specialty shop sells (undefined for the general store and the tavern). */
export const lineOfDef = (def: string): ShopLine | undefined => BUILDING_BY_ID[def]?.floor?.line;
/** The medicines (apothecary's line besides its wares). */
const MEDICINES = new Set(['bandage', 'poultice', 'antibiotics', 'medkit']);
const MEDICINE_STATIONS = new Set(['apothecary', 'pharmacy', 'herb_press', 'alembic']);
const ARMOUR_SLOTS = new Set(['body', 'head', 'offhand']);
/** Which line an item belongs to, if any: furnishings, weapons, armour (and shields), medicine. */
export function lineOfItem(i: ItemDef): ShopLine | undefined {
  if (i.relic || i.unique) return undefined;
  if (i.furnish) return 'furniture';
  if (i.slot === 'weapon') return 'weapons';
  if (i.slot && ARMOUR_SLOTS.has(i.slot)) return 'armour';
  if (MEDICINES.has(i.id) || (i.ware && MEDICINE_STATIONS.has(i.station))) return 'medicine';
  return undefined;
}
/** Every item of a line. */
export const LINE_ITEMS: Readonly<Record<ShopLine, readonly ItemDef[]>> = Object.fromEntries(
  SHOP_LINES.map((l) => [l, ITEMS.filter((i) => lineOfItem(i) === l)]),
) as unknown as Record<ShopLine, readonly ItemDef[]>;
export const isTavern = (def: string) => BUILDING_BY_ID[def]?.floor?.venue === 'tavern';
export const venueOfDef = (def: string): Venue | undefined => BUILDING_BY_ID[def]?.floor?.venue;
/** Every kind of tavern, smallest first. */
export const TAVERNS: readonly string[] = ['fireside_inn', 'tavern'];
/** A venue's buildings, smallest first. */
export const VENUE_CHAIN: Record<Venue, readonly string[]> = { shop: SHOPS, tavern: TAVERNS };

/** Everything a shopkeeper can set out, and every ware the town can make to sell. */
export const FURNISHINGS: readonly ItemDef[] = ITEMS.filter((i) => i.furnish);
/** Whether a furnishing belongs in a venue. */
export const furnishes = (i: ItemDef, venue: Venue) => !!i.furnish && (i.furnish.venue === 'both' || (venue === 'tavern') === (i.furnish.venue === 'tavern'));
export const FARE: readonly ItemDef[] = ITEMS.filter((i) => i.fare);
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
export const MAX_EXTENSIONS = 5;
/** The keeper fills no more than this share of the floor: past it the venue is crowded, and the town saves up to
 *  extend it rather than cram more in. */
export const FILL_MAX = 0.5;
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
/** Attractiveness past this adds nothing more to a purse or to how often travellers come (a town selling gold once had
 *  both climb without end: the coins went on the shop, the shop drew more and bigger purses, and so on). */
export const APPEAL_CAP = 100;
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
const EVERYDAY: readonly Material[] = ['fiber', 'wood', 'stone', 'hide', 'clay', 'flint', 'herbs', 'berries', 'bone', 'copper_ore', 'tin_ore'];
export function travellerGoods(era: Era): Material[] {
  return [...new Set([...EVERYDAY, ...(era === 'neolithic' ? [] : caravanGoods(era))])];
}


/* ------------------------------------------------------------ who they are */

/** Customers are strangers passing through: a first name, and a byname or where they're from. */
export const FIRST_NAMES = [
  'Aldo', 'Berit', 'Bram', 'Cessa', 'Corwin', 'Dagny', 'Edric', 'Elsa', 'Fenna', 'Gisli', 'Halla', 'Ivo', 'Jorunn', 'Kasimir', 'Linnet', 'Magnus',
  'Nell', 'Osric', 'Petra', 'Quill', 'Ragna', 'Silas', 'Thora', 'Ulla', 'Vidar', 'Wynn', 'Yrsa', 'Zeno', 'Agnes', 'Birger', 'Clem', 'Dunstan',
  'Eira', 'Folke', 'Gerda', 'Hamish', 'Isolde', 'Jory', 'Katla', 'Leif', 'Mabel', 'Noor', 'Oddny', 'Perrin', 'Rolf', 'Sigrun', 'Tam', 'Vesna',
];
export const BYNAMES = [
  'Tallow', 'Ashdown', 'Crook', 'Marsh', 'Redhand', 'Stonefoot', 'Quickly', 'Barrow', 'Fairweather', 'Hollis', 'Pike', 'Thatcher', 'Wren',
  'the Elder', 'the Younger', 'One-Eye', 'Longstride', 'Greycloak', 'Silvertongue', 'Butterfield', 'Oakes', 'Salt', 'Brightwater',
];
export const ORIGINS = ['the Salt Road', 'the Fens', 'Hollowmere', 'the High Pass', 'Ember Vale', 'the Coast', 'Three Wells', 'Farhollow', 'the Old Quarry', 'Deepford'];

/** How a customer takes things: how much they spend, how easily they're talked into more (added to the keeper's
 *  chance), whether they'll settle for something else, how long they stay, and how often they come (weight). */
export interface Temper {
  name: string;
  purse: number;
  upsell: number;
  picky?: boolean;
  stay: number;
  weight: number;
}
export const TEMPERS: Record<string, Temper> = {
  plain: { name: '', purse: 1, upsell: 0, stay: 1, weight: 5 },
  haggler: { name: 'a haggler', purse: 0.85, upsell: -0.15, stay: 1.2, weight: 1 },
  spender: { name: 'a big spender', purse: 1.6, upsell: 0.05, stay: 1, weight: 1 },
  picky: { name: 'picky', purse: 1.1, upsell: -0.05, picky: true, stay: 1, weight: 1 },
  chatty: { name: 'chatty', purse: 1, upsell: 0.15, stay: 1.5, weight: 1 },
  hurried: { name: 'in a hurry', purse: 1, upsell: -0.05, stay: 0.5, weight: 1 },
};
export const temperOf = (id: string | undefined): Temper => TEMPERS[id ?? 'plain'] ?? TEMPERS.plain;

/* ------------------------------------------------------------ what they come for */

/** What a shop's customer comes looking for, by their tier: gear of a kind (a tool, a weapon, armour), one piece of
 *  gear in particular, the fine wares of their standing, or a load of some material. */
export type ShopWantKind = 'tool' | 'weapon' | 'armor' | 'item' | 'ware' | 'material';
export const SHOP_WANTS: Record<number, [ShopWantKind, number][]> = {
  1: [['material', 4], ['tool', 2], ['weapon', 2], ['item', 1], ['ware', 2]],
  2: [['ware', 4], ['armor', 2], ['weapon', 1], ['material', 2], ['item', 1]],
  3: [['ware', 4], ['armor', 2], ['weapon', 2], ['item', 1]],
  4: [['ware', 5], ['armor', 1], ['weapon', 1], ['item', 1]],
};
export const WANT_SLOTS = { tool: ['tool'], weapon: ['weapon'], armor: ['body', 'head', 'offhand'] } as const;
/** Gear (and furnishings) sell for what went into them, times this. */
export const GEAR_MARKUP = 1.6;

/** What a made thing is worth, at a quality: a ware's price, or what went into it, marked up. This is what strangers
 *  pay for gear and wares, and what the town pays its crafters for a furnishing. */
export function saleValue(i: ItemDef, q: number | undefined): number {
  const made =
    (Object.entries(i.cost) as [Material, number][]).reduce((n, [m, k]) => n + WORTH[m] * k, 0) +
    Object.entries(i.items ?? {}).reduce((n, [id, k]) => n + saleValue(ITEM_BY_ID[id], undefined) * k, 0);
  const base = i.ware ? i.ware.price : i.fare ? i.fare.price : made * GEAR_MARKUP;
  // (a +N piece is worth more again: each + about a fifth)
  return Math.max(2, Math.round(base * qualityMult(q) * 1.2 ** plusOf(q)));
}

/** A crafter is paid this share of what a piece they make to sell is worth (all of it, for a furnishing: the town
 *  buys those outright). */
export const PIECE_RATE = 0.3;

/** A keeper's chance to talk a customer into more (a better piece, something extra, a better price) or, when the
 *  shop hasn't what they came for, into something else: this much per Social level over 2, up to a cap. */
export const UPSELL_PER_LEVEL = 0.07;
export const UPSELL_MAX = 0.75;
/** A price talked up goes up this much. */
export const PREMIUM = 1.2;
/** Social XP for the keeper: a sale, and a customer talked round. */
export const SALE_XP = 6;
export const UPSELL_XP = 30;
/** How long an unmet want is remembered (the share kept each game day): the town makes what's asked for. */
export const ASKED_KEEP = 0.6;

/* ------------------------------------------------------------ the tavern */

/** Guests: their purse, and the comfort they need, rolled up to this share over the tavern's comfort plus a few (so
 *  there's always someone who finds it too rough). Better-off guests need more, and spend more. */
export const GUEST_PURSE: [number, number] = [4, 10];
export const COMFORT_REACH = 1.15;
export const COMFORT_BASE = 4;
/** What they're called, by the comfort they're used to (at least this much). */
export const GUEST_KINDS: [number, number, string[]][] = [
  [0, 1, ['drover', 'carter', 'herder', 'trapper', 'woodcutter']],
  [10, 2, ['minstrel', 'pilgrim', 'soldier', 'huntress', 'tinker']],
  [25, 3, ['cloth merchant', 'guild factor', 'scholar', 'physician']],
  [45, 4, ['knight', 'lady', 'magistrate', 'bishop']],
];
/** Tastes, by how often they're wanted; a guest wants one dish in particular this often. */
export const TASTES: [import('./items').FareKind, number][] = [['hearty', 3], ['drink', 3], ['sweet', 2]];
export const DISH_CHANCE = 0.35;
/** Fare kept in stock of each kind the town can make. */
export const FARE_STOCK = 3;
/** Guests linger over their food (times a shopper's stay). */
export const GUEST_STAY = 1.5;

/** Lodging: a guest who comes in the evening may stay the night in one of the tavern's beds (its `bed` furnishings),
 *  paying this much (times the era's purse scale, the bed's comfort and quality) and leaving in the morning. Wanting a
 *  bed and finding none counts against the tavern, and the town makes one. */
export const LODGING = { price: 4, perComfort: 0.5, evening: 17, night: 21, morning: 7, chance: 0.75 } as const;
