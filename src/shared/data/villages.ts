// Daughter villages (the owner's pick of the content updates). Once the town is big, a group of its people leaves to
// found a village of their own out on the land, under a leader of their own. The village runs itself (sim/villages.ts):
// it grows, works its land and sends what it can spare to the town by cart; its folk and the town's marry; it sends
// fighters when the town is raided, and asks for help when it is beset itself. How it feels about the town (its
// loyalty) follows how it's treated: blessed or begrudged at the parting, the tax, gifts, help given or refused. Let it
// fall far enough and the village breaks away, and its rebels come raiding until the town wins it back (a gift, or a
// party sent to bring it to heel).

import type { Material } from './materials';
import type { RaidKind } from './raids';

/** A town founds a village from this day, with this many grown-ups at home (or, at its chosen size, this many), no
 *  oftener than every VILLAGE_GAP_DAYS, at most VILLAGES_MOST of them; at this hour of the morning. */
export const VILLAGE_FROM_DAY = 10;
export const VILLAGE_PEOPLE = 9;
export const VILLAGE_PEOPLE_AT_SIZE = 7;
export const VILLAGE_GAP_DAYS = 12;
export const VILLAGES_MOST = 3;
export const VILLAGE_HOUR = 9;
/** How many go (never more than a quarter of the grown-ups), and how long the town has to answer before they go
 *  with its blessing (or without, if it can't spare the makings). */
export const SETTLERS: [number, number] = [2, 5];
export const PARTING_HOURS = 6;
/** What a blessing sends with them. */
export const BLESSING: Partial<Record<Material, number>> = { wood: 12, stone: 6 };
export const BLESSING_FOOD = 12;
/** Where a village goes: this far from the camp (cells), with clear buildable ground round it, and nothing of the
 *  town's built within VILLAGE_KEEP of its middle. */
export const VILLAGE_DIST: [number, number] = [24, 36];
export const VILLAGE_R = 4;
export const VILLAGE_KEEP = 7;
/** How it grows: a share of its people a day while fed, up to VILLAGE_MOST_FOLK. */
export const VILLAGE_GROWTH = 0.035;
export const VILLAGE_MOST_FOLK = 40;
/** How big it is by its people: a hamlet, a village, a town. */
export const VILLAGE_TIERS: readonly { at: number; name: string }[] = [
  { at: 0, name: 'hamlet' },
  { at: 10, name: 'village' },
  { at: 24, name: 'market town' },
];
/** What it makes a day, a head (shared over what its land holds), and the load a cart takes to town. */
export const MAKES_PER_HEAD = 0.45;
export const CART_LOAD = 10;
export const CART_STAY_HOURS = 1;
/** Loyalty (0 to 100): where it starts by the parting (blessed, let go, forbidden and gone anyway); where it drifts
 *  each day by the leader's nature; the share of the gap it drifts a day (so the tax's daily pull settles it
 *  TAX / DRIFT below its rest: heavy tax under a proud leader breaks it away, under a kindly one it only sours). */
export const LOYALTY_START = { blessed: 80, let: 62, forbidden: 30 } as const;
export const LOYALTY_REST = 60;
export const LOYALTY_REST_BY_NATURE: Readonly<Record<string, number>> = { proud: 40, restless: 42, greedy: 44, stern: 48, grumpy: 50, kind: 74, cheerful: 72, pious: 70, jolly: 70, shy: 66 };
export const LOYALTY_DRIFT = 0.04;
/** The tax's pull on it each day (data/economy.ts's levels), a gift's lift a coin, and what helping or refusing does. */
export const TAX_LOYALTY: Readonly<Record<string, number>> = { low: 0.6, fair: 0, heavy: -1.6 };
export const GIFT_COINS = 40;
export const GIFT_LOYALTY = 10;
export const HELPED_LOYALTY = 15;
export const PAID_LOYALTY = 6;
export const REFUSED_LOYALTY = -20;
export const WED_LOYALTY = 5;
export const SENT_HELP_LOYALTY = 2;
/** At or above this it sends its carts as tithe, free; below, it sells them at WORTH_SHARE of their worth. */
export const TITHE_AT = 55;
export const WORTH_SHARE = 0.8;
/** Below this it breaks away; a rebel village wins back at RECONCILE_AT (gifts count half) or when brought to heel. */
export const REBEL_AT = 18;
export const RECONCILE_AT = 45;
export const HEELED_LOYALTY = 50;
/** A rebel village raids the town this often (a day), with this share of a raid's budget; the rebels it sends. */
export const REBEL_RAID_DAILY = 0.14;
export const REBEL_BUDGET_SHARE = 0.6;
/** Each raid on the town: a loyal village (at least HELP_AT, of HELP_FOLK people) sends this many to fight, on
 *  HELP_CHANCE of raids. */
export const HELP_AT = 45;
export const HELP_FOLK = 6;
export const HELP_CHANCE = 0.55;
export const HELP_SENT: [number, number] = [2, 4];
/** Beset: each day a village may be attacked (more as it grows); the town has BESET_HOURS to answer; sending
 *  fighters takes HELPERS of them away for HELP_HOURS, each hurt at HELP_HURT and killed at HELP_KILLS; coins buy
 *  sellswords; left alone it loses a share of its people. */
export const BESET_DAILY = 0.04;
export const BESET_HOURS = 6;
export const HELPERS = 3;
export const HELP_HOURS = 8;
export const HELP_HURT = 0.35;
export const HELP_KILLS = 0.06;
export const SELLSWORDS_COINS = 35;
export const BESET_LOSS: [number, number] = [0.15, 0.35];
export const BESET_LOSS_PAID = 0.08;
export const BESET_OPTIONS = ['Send fighters', `Pay sellswords (${SELLSWORDS_COINS} coins)`, 'Leave them to it'] as const;
export const BESET_FOES = ['wolves', 'bandits', 'a raiding band', 'the restless dead', 'a bear', 'goblins'] as const;
/** A marriage between the village and the town each day (a single on each side). */
export const WED_DAILY = 0.05;
/** The parting's question. */
export const PARTING_OPTIONS = ['Give them our blessing', 'Let them go', 'Forbid it'] as const;

/** Names: a root and an ending, made from the seed. */
export const NAME_ROOTS = ['Ash', 'Bram', 'Cold', 'Dun', 'Elder', 'Fern', 'Gold', 'Hollow', 'Iron', 'Kings', 'Lark', 'Mill', 'Nether', 'Oak', 'Pike', 'Red', 'Stone', 'Thorn', 'Wil', 'Yew', 'Barrow', 'Clay', 'Hazel', 'Swan', 'Wolf'];
export const NAME_ENDS = ['ford', 'by', 'stead', 'ham', 'wick', 'thorpe', 'cot', 'field', 'brook', 'worth', 'well', 'den', 'mere', 'holt', 'ley'];

/** What each kind of ground round a village gives it to make. */
export const GROUND_MAKES: Readonly<Record<string, Material>> = { forest: 'wood', rock: 'stone', hill: 'stone', fertile: 'grain', grass: 'berries', marsh: 'fiber', sand: 'clay', shallows: 'fish', water: 'fish' };

/** A rebel village's raid (never picked at random: sim/villages.ts). */
export const REBEL_RAID: RaidKind = { id: 'village_rebels', name: 'Village rebels', goal: 'steal', goals: { steal: 3, burn: 1 }, steals: 'valuables', enemies: { soldier: 14, bandit_archer: 12, bandit_chief: 30 }, fromDay: 0, weight: 0, speed: 55, bribable: true, plural: true };

/** The village's fighters, sent to a raid, by the age. */
export const MILITIA_BY_ERA: Readonly<Record<string, string[]>> = {
  neolithic: ['rival_spear', 'rival_slinger'],
  medieval: ['soldier', 'bandit_archer'],
  industrial: ['rifleman', 'soldier'],
  modern: ['trooper'],
  space: ['trooper'],
};
