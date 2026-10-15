// The trade empire (the owner's ask: growing rich is a way to survive, beside arms). Under the Trade direction a town with
// a trade house founds trading posts at far markets on the world map, runs its own caravans and ships between them,
// takes the merchant guilds' deals, and spends its coin on safety: tribute to turn a raid back, mercenaries for a
// season, a power's protection. The rules are in sim/tradeEmpire.ts. Numbers are starting points for tuning.

import type { Era } from './eras';
import type { Material } from './materials';

/** A townsperson away on the trade roads or at a post (like the Order's liege call, a sentinel in `Person.away`). */
export const EMPIRE_AWAY = -4_000_201;

/** The hour of the day the empire takes stock, and the hour its caravans set out. */
export const EMPIRE_HOUR = 11;
export const CARAVAN_HOUR = 12;

/* ------------------------------------------------------------ the posts */

export interface PostSite {
  id: string;
  name: string;
  x: number;
  y: number;
  /** The world map region that must be mapped before the town knows the way (none: a power's own market). */
  region?: string;
  era: Era;
  /** Reached by water: needs a shore town or a boat, and the caravan is a ship. */
  sea?: boolean;
  makes: Material[];
  wants: Material[];
  /** Coins a season it earns the town at the first level, before the cut of the caravans' trade. */
  base: number;
  /** How bandit-ridden the road and the market are (1 = ordinary). */
  danger: number;
}

/** Far markets in the regions of the world map (data/regions.ts). The powers' own strongholds are markets too
 *  (sim/tradeEmpire.ts `sitesOf`), and a post there lives at the power's pleasure. */
export const REGION_SITES: readonly PostSite[] = [
  { id: 'westwood', name: 'Westwood Fair', x: 110, y: 380, region: 'westwood', era: 'neolithic', makes: ['wood', 'herbs', 'fiber'], wants: ['stone', 'clay', 'grain'], base: 18, danger: 1.4 },
  { id: 'northern_crags', name: 'Crag Pass Market', x: 290, y: 110, region: 'northern_crags', era: 'neolithic', makes: ['stone', 'flint', 'bone'], wants: ['wood', 'grain', 'fiber'], base: 20, danger: 1.2 },
  { id: 'eastwood', name: 'Eastwood Hollow', x: 540, y: 330, region: 'eastwood', era: 'neolithic', makes: ['wood', 'berries', 'herbs'], wants: ['stone', 'flint', 'clay'], base: 16, danger: 0.8 },
  { id: 'southern_ridges', name: 'Ridgeway Market', x: 170, y: 570, region: 'southern_ridges', era: 'neolithic', makes: ['stone', 'clay', 'flint'], wants: ['wood', 'herbs', 'fiber'], base: 18, danger: 1.5 },
  { id: 'southern_isle', name: 'Isle Harbour', x: 550, y: 620, region: 'southern_isle', era: 'medieval', sea: true, makes: ['wood', 'herbs', 'cloth'], wants: ['iron', 'stone', 'leather'], base: 32, danger: 0.6 },
  { id: 'far_isles', name: 'Far Isles Staithe', x: 670, y: 240, region: 'far_isles', era: 'medieval', sea: true, makes: ['stone', 'glass', 'herbs'], wants: ['cloth', 'iron', 'wood'], base: 38, danger: 0.5 },
];

/** Goods and people a post costs, and how soon after one is founded (or lost) the next may be. */
export const POST_COINS = 70;
export const POST_GOODS: Partial<Record<Material, number>> = { wood: 24, stone: 12 };
export const POST_FOLK = 2;
export const POST_GAP_DAYS = 6;
export const LOST_SITE_DAYS = 18;
/** Adults the town must keep at home, and a post's staff come out of what's over. */
export const HOME_FOLK_LEAST = 7;
/** Posts allowed at once: one, and one more for each trade house tier (a charter allows another). */
export const POSTS_BASE = 1;
export const POSTS_MOST = 6;
/** A post's levels are reached at these totals of takings; each level multiplies its base. */
export const POST_LEVELS = [0, 120, 420] as const;
export const POST_LEVEL_MULT = 0.45;
/** The share of a caravan's sales at a market the post keeps for the town, and the bonus on a season a caravan called. */
export const POST_CUT = 0.12;
export const CALLED_BONUS = 0.5;
/** Chances a day: a post is raided (before danger), a power's decree falls on a post at its market when it dislikes
 *  the town, and a war on takes a post. */
export const POST_RAIDED = 0.008;
export const POST_DECREE = 0.025;
export const POST_WAR = 0.02;
/** A raided post loses this share of the season's takings and is lost outright this often. */
export const RAID_LOOT = 0.7;
export const RAID_LOSES_POST = 0.3;
/** Of the folk at a post that is lost: the share who die (the rest walk home, hurt). */
export const POST_FOLK_DIE = 0.45;

/* ------------------------------------------------------------ the caravans */

/** Caravans out at once: this and one more for each trade house tier. */
export const CARAVANS_BASE = 1;
/** Units a caravan carries (scaled by the era, data/trade.ts OFFER_SCALE), and the drivers it takes. */
export const CARAVAN_LOAD = 60;
export const DRIVERS = 2;
export const DRIVER_PAY = 6;
/** Hours a road of 100 map pixels takes, and the ships' share of it. */
export const ROAD_HOURS_PER_100 = 4;
export const SHIP_SPEED = 0.7;
/** The least a margin must be (the price there over the price here) for the town to send a good. */
export const CARGO_MARGIN = 1.12;
/** Chance a caravan is robbed or lost on a leg of 100 pixels, before the land's danger; and how the odds fall. */
export const ROAD_LOST = 0.05;
export const ROBBED_SHARE = 0.55;
export const LOST_SHARE = 0.35;
export const SAFE_GUARDS = 0.55;
export const WAR_ROADS = 1.4;
export const SEA_STORM = 1.3;
/** Of the drivers of a lost caravan: the share who die. */
export const DRIVER_DIE = 0.5;

/* ------------------------------------------------------------ the guilds and their deals */

export const GUILDS = ['the Mercers\' Company', 'the Salt Road League', 'the Guild of Weighers', 'the Lantern Merchants'] as const;
export type DealKind = 'monopoly' | 'charter' | 'loan';
/** Days between offers, at the soonest; deals held at once. */
export const DEAL_EVERY_DAYS = 5;
export const DEALS_MOST = 2;
/** A monopoly: a good's price rises (a boom), the posts earn more; the town must keep a stock of it. */
export const MONOPOLY_DAYS = 12;
export const MONOPOLY_PRICE = 1.25;
export const MONOPOLY_POSTS = 1.2;
export const MONOPOLY_KEEP = 15;
/** A monopoly is offered on a good the town has at least this much of (never wood, stone or food: they are spent too fast). */
export const MONOPOLY_STOCK = 80;
export const MONOPOLY_BONUS = 45;
export const MONOPOLY_SHORT_DAYS = 3;
export const MONOPOLY_RESENT = 4;
/** A charter: a fee for a season of one more post and safer roads. */
export const CHARTER_DAYS = 20;
export const CHARTER_FEE = 60;
export const CHARTER_SAFER = 0.7;
/** A loan: the guild lends this per trade house tier (and one), and wants it back with interest. */
export const LOAN_PER_TIER = 60;
export const LOAN_INTEREST = 0.2;
export const LOAN_DAYS = 10;
export const LOAN_WANT_BELOW = 110;
/** Standing with the merchant guilds: kept deals raise it, broken ones cost it; below the floor none will deal. */
export const KEPT_STANDING = 6;
export const BROKEN_STANDING = -12;
export const STANDING_FLOOR = -10;

/** A rich town draws merchants to settle: from this many coins (more for each who came), a chance a day. */
export const RICH_COINS = 500;
export const RICH_PER_SETTLER = 250;
export const RICH_CHANCE = 0.12;
export const SETTLERS_MOST = 4;

/* ------------------------------------------------------------ money buys safety */

/** Tribute turns a raid of people back: so much, and so much a raider, dearer by this each time it is paid (it eases a
 *  step each season). The council's pride refuses now and then, and it never pays more than this share of the purse. */
export const TRIBUTE_BASE = 35;
export const TRIBUTE_PER_RAIDER = 7;
export const TRIBUTE_RISE = 0.3;
export const TRIBUTE_SHARE = 0.4;
export const TRIBUTE_PRIDE = 0.3;
/** The purse the town keeps back after paying tribute. */
export const TRIBUTE_KEEP = 40;
/** Mercenaries: hired a season at a time, a fee each and a wage a day, up to this many (more with the trade house). */
export const MERC_FEE = 22;
export const MERC_WAGE = 3;
export const MERC_DAYS = 10;
export const MERC_BASE = 2;
export const MERCS_MOST = 8;
export const MERC_KEEP = 100;
/** A power's protection: a fee for a season, and its effect on roads, tribute and the goodwill of the power. */
export const PROTECT_FEE = 70;
export const PROTECT_DAYS = 10;
export const PROTECT_SAFER = 0.6;
export const PROTECT_TRIBUTE = 0.7;
export const PROTECT_GOODWILL = 3;
export const PROTECT_KEEP = 150;

export const LOG_MOST = 14;
