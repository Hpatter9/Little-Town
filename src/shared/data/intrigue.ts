// House intrigue (sim/intrigue.ts; the owner's ask on the ruling house: "They can own more of the town and make more
// money, maybe start a mafia, try and take over the council with bribes, blackmail, murder"). The numbers and the words.
// Money is in the first era's coins: the sim scales it with `PURSE_SCALE[era]`.
import type { NatureId } from './natures';

/** The intrigue stirs at this hour of the small hours (after the night's crime, before the dynasty's dawn), from this
 *  day, in a town of at least this many grown-ups. */
export const INTRIGUE_HOUR = 3;
export const INTRIGUE_FROM_DAY = 8;
export const INTRIGUE_PEOPLE = 5;

/* ---- holdings and wealth */
/** The share of a rent or a till's takings a house's landlord sends to the family chest (the house's purse). */
export const HOUSE_TITHE = 0.35;
/** A house buys a building at most once a day when its purse is this many times the price, and never owns more than
 *  this share of the town's sellable buildings. */
export const BUY_SPARE = 1.25;
export const OWN_SHARE_MOST = 0.4;
/** The town pays a house a land rent for each field and workshop it owns, a day (coins, scaled), out of what the
 *  treasury holds above its keep. A house with a hard member keeps this war chest (coins, scaled) before it buys land. */
export const LAND_RENT = 1;
export const WAR_CHEST = 40;
/** A forced sale: a neighbour in debt this deep sells to a rich house, at this share of the price. */
export const FORCED_DEBT = 30;
export const FORCED_PRICE = 0.7;
/** The town sells its homes and shops (not its public works) at this share of their worth. */
export const TOWN_SELLS_AT = 0.9;
/** A house's wealth in its strength (`strengthOf`): the purse over this, up to the cap. */
export const WEALTH_PER_STRENGTH = 25;
export const WEALTH_STRENGTH_MOST = 40;

/* ---- the mafia */
export const MAFIA_FROM_DAY = 14;
/** A house turns to crime on a day: this chance, once its purse is this many coins (scaled) and it has a hard member. */
export const MAFIA_CHANCE = 0.05;
export const MAFIA_PURSE = 60;
export const MAFIA_MOST = 2;
export const MUSCLE_MOST = 3;
export const MUSCLE_WAGE = 3;
/** Natures that make a boss (and the muscle's temper). */
export const HARD_NATURES: readonly NatureId[] = ['stern', 'greedy', 'proud', 'grumpy', 'bold'];
/** Protection: this share of a shop's yesterday takings (a tavern pays more), at least this much. */
export const PROTECTION_SHARE = 0.18;
export const TAVERN_SHARE = 0.25;
export const PROTECTION_LEAST = 2;
/** A venue that has not paid yet is called on with this chance a day. */
export const PROTECTION_CALL = 0.5;
/** A shopkeeper of these natures refuses at this chance; a refusal is an "accident". */
export const REFUSE_NATURES: readonly NatureId[] = ['bold', 'stern', 'proud', 'grumpy'];
export const REFUSE_CHANCE = 0.45;
/** An accident: damage to the shop (its health share left), a beating (share of the keeper's health), and the chance a
 *  beating is the end of them. */
export const ACCIDENT_HP = 0.6;
export const ACCIDENT_BEAT = 0.4;
export const ACCIDENT_DEADLY = 0.1;
/** Smuggling with the caravans: a share of the day's trade skimmed from the treasury. */
export const SMUGGLE_SHARE = 0.1;
/** The treasury's own venues are skimmed at this share of their takings. */
export const TILL_SKIM = 0.1;
/** Heat (what the watch knows): gained from each racket and accident, lost each day; the chance of being found out a
 *  day is EXPOSE_BASE + heat x EXPOSE_HEAT + a guard's EXPOSE_GUARD. */
export const HEAT_PER_TAKE = 0.6;
export const HEAT_PER_ACCIDENT = 3;
export const HEAT_COOL = 0.4;
export const EXPOSE_BASE = 0.008;
export const EXPOSE_HEAT = 0.0012;
export const EXPOSE_GUARD = 0.006;
export const EXPOSE_HARSH = 0.01;
/** An arrest goes wrong: the boss fights and falls. */
export const ARREST_DEADLY = 0.2;
/** Caught and tried, the ring breaks up with this chance; else it lies low this many days. */
export const BREAK_UP = 0.55;
export const LIE_LOW_DAYS = 10;

/* ---- the council's seats */
/** A held councillor's vote counts as this many (themselves, and those who follow them). */
export const SEAT_VOTES = 3;
/** A hold lasts this many days (blackmail a half again as long). */
export const HOLD_DAYS = 24;
export const BLACKMAIL_LONGER = 1.5;
/** A house schemes: a chance a day once its purse is this many coins, a gap between its schemes, and the most plots
 *  alive in the town. */
export const SCHEME_CHANCE = 0.12;
export const SCHEME_PURSE = 35;
export const SCHEME_GAP_DAYS = 4;
export const SCHEMES_MOST = 3;
/** A bribe's cost (coins, scaled), and who takes it (natures, with their weight). */
export const BRIBE_COST = 30;
export const BRIBE_TAKERS: Partial<Record<NatureId, number>> = { greedy: 3, restless: 2, proud: 1.5, gloomy: 1.2, jolly: 1.2, cheerful: 1, curious: 1, shy: 0.8, dreamy: 0.8, kind: 0.5, bold: 0.5, grumpy: 0.6, stern: 0.3, pious: 0.2 };
/** Blackmail: the natures that give in, and those that fight back. */
export const BLACKMAIL_FOLDS: readonly NatureId[] = ['shy', 'gloomy', 'kind', 'dreamy', 'cheerful', 'greedy', 'pious'];
export const BLACKMAIL_FIGHTS = 0.3;
/** A cornered target kills the blackmailer with this chance. */
export const CORNERED_KILLS = 0.08;
/** Fear: the natures that bow to a beating, and the chance of one hurting. */
export const FEAR_BOWS: readonly NatureId[] = ['shy', 'gloomy', 'kind', 'dreamy', 'cheerful', 'jolly'];
export const FEAR_BEAT = 0.3;
/** The weight of each method by what the house has: bribes, blackmail, fear, and murder (only for hard houses, a
 *  hot feud or the ring). */
export const METHOD_WEIGHT = { bribe: 4, blackmail: 3, fear: 2, murder: 1.2 } as const;
export type Method = keyof typeof METHOD_WEIGHT;
/** The laws the ring wants gone (and none passed that bind it). */
export const RING_HATES: readonly string[] = ['harsh_law', 'curfew'];

/* ---- murder */
/** A hired knife strikes: the chance it works, less a guard's bite; a clean "accident" or not; the chance the town
 *  pins it on somebody else; a failed knife dies; one taken alive may name its master. */
export const MURDER_SUCCESS = 0.78;
export const MURDER_GUARD = 0.05;
export const ACCIDENT_SHARE = 0.6;
export const FRAME_CHANCE = 0.5;
export const KNIFE_FALLS = 0.5;
export const KNIFE_NAMES = 0.4;
/** A murder comes to light each day with this chance (more with the watch, and when the wrong man hangs). */
export const UNCOVER_BASE = 0.018;
export const UNCOVER_GUARD = 0.008;
export const UNCOVER_FRAMED = 0.01;
/** Chance a house wronged by a proven murder swears revenge, and how soon it strikes. */
export const REVENGE_CHANCE = 0.55;
export const REVENGE_DAYS = [3, 9] as const;
/** The deaths: how a clean accident reads in the record. */
export const ACCIDENTS = ['in a fall on the cellar stair', 'of a sudden sickness', 'in the river, they say a slip', 'in a fire in the night', 'of a fever that came on overnight', 'under a cart, the carter swears he never saw'];
export const KILLINGS = ['stabbed in an alley', 'struck down in the dark', 'strangled in their bed'];
/** The house that is found out is shunned: the town's morale mark. */
export const SHAME_MORALE = -4;
export const SHAME_DAYS = 2;
/** Three known crimes and the house head is run out of town. */
export const BANISH_AT = 3;

/** Whispers: most kept, how long they last (days) and the chance a hidden deed is whispered of. */
export const WHISPER_MOST = 8;
export const WHISPER_DAYS = 12;
export const WHISPER_CHANCE = 0.6;
export const LOG_MOST = 40;

/** What a house says it is, for the Families tab. */
export const HOLDING_NAMES = { homes: 'homes', shops: 'shops', works: 'workshops', fields: 'fields' } as const;
