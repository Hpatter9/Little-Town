// Town alignment (the owner's ask: good and evil, with a bar). One score from -100 (wicked) to +100 (radiant) that
// moves with the player's answers, what the town does, and who runs it (sim/alignment.ts). Each people starts where
// its lore puts it and drifts back toward that when nothing pushes. Past the thresholds each end opens things.
import type { OriginId } from './origins';
import type { NatureId } from './natures';

export const ALIGN_MAX = 100;
/** Past these, the town is of the light (GOOD_AT, DEEP_GOOD_AT) or the dark (EVIL_AT, DEEP_EVIL_AT). */
export const GOOD_AT = 35;
export const DEEP_GOOD_AT = 60;
export const EVIL_AT = -35;
export const DEEP_EVIL_AT = -60;
/** Points an answer's weight (-4..+4) moves the bar by. */
export const POINTS_PER_WEIGHT = 4;
/** The share of the way back toward the people's home each hour. */
export const DRIFT_PER_HOUR = 0.002;
/** A people whose home point is this dark or darker (vampires, liches, orcs) drifts back toward its own home; every
 *  other people drifts toward neutral, so the town's choices and deeds decide where its bar stands. */
export const DARK_HOME = -15;
export const driftTargetOf = (origin: OriginId | undefined): number => (homeOf(origin) <= DARK_HOME ? homeOf(origin) : 0);

export interface AlignBand {
  from: number;
  name: string;
  /** What the town is called when it's at this end (for the bar's label). */
  line: string;
}
/** Highest `from` first. */
export const ALIGN_BANDS: readonly AlignBand[] = [
  { from: DEEP_GOOD_AT, name: 'Radiant', line: 'A beacon: the weak walk miles to be taken in.' },
  { from: GOOD_AT, name: 'Good', line: 'Known for mercy: pilgrims come, and neighbours deal fairly.' },
  { from: 12, name: 'Kindly', line: 'Decent folk, mostly.' },
  { from: -12, name: 'Even', line: 'Neither kind nor cruel: the town does what it must.' },
  { from: EVIL_AT, name: 'Hard', line: 'Hard folk with hard ways.' },
  { from: DEEP_EVIL_AT, name: 'Cruel', line: 'Feared: raiders think twice, and shadows deal here.' },
  { from: -ALIGN_MAX - 1, name: 'Wicked', line: 'A name spoken low. Few dare to cross it.' },
];
export const bandOf = (score: number): AlignBand => ALIGN_BANDS.find((b) => score >= b.from) ?? ALIGN_BANDS[ALIGN_BANDS.length - 1];

/** Where each people's lore puts it, and where it drifts back to. */
export const ORIGIN_HOME: Partial<Record<OriginId, number>> = { vampire: -45, lich: -50, orcs: -15, werewolf: -10, knights: 40, druid: 35, dwarves: 5, fae: -5 };
export const homeOf = (origin: OriginId | undefined): number => ORIGIN_HOME[origin ?? 'settlers'] ?? 0;

/** How kind (+) or harsh (-) a nature is, as a lean for the leader's pull and for what the town would pick. */
export const NATURE_LEAN: Partial<Record<NatureId, number>> = { kind: 0.6, pious: 0.4, cheerful: 0.25, jolly: 0.2, dreamy: 0.1, shy: 0.1, stern: -0.35, greedy: -0.5, proud: -0.25, grumpy: -0.2, gloomy: -0.15, bold: -0.05 };

/** What passing a law (or repealing it, the opposite) says about the town, in points. */
export const LAW_ALIGN: Record<string, number> = { poor_relief: 4, rest_day: 2, temple_tithe: 1, harsh_law: -5, conscription: -2, curfew: -2, market_charter: -1 };
/** What a sentence says, by words in the trial's report (sim/politics.ts `sentence`). */
export const SENTENCE_ALIGN: readonly [RegExp, number][] = [
  [/is hanged/, -10],
  [/is exiled/, -3],
  [/in the stocks/, -1],
  [/is pardoned/, 3],
];
/** Deaths the town brings about itself, by words in the cause. */
export const DEED_ALIGN: readonly [RegExp, number][] = [[/sacrific|ritual|offered up/i, -8]];

/** Standing the town has with the powers: kept to a small drift each unlock. */
export const PILGRIM_CHANCE_PER_DAY = 0.12;
export const THIEVES_TAKE_PER_DAY = 1;
/** Raids are this much bigger or smaller by alignment (fear deters raiders; the light draws the dark). */
export function raidAlignMult(score: number): number {
  return score <= DEEP_EVIL_AT ? 0.8 : score <= EVIL_AT ? 0.9 : score >= DEEP_GOOD_AT ? 1.1 : 1;
}
/** Morale from alignment: the light lifts spirits; a dark that isn't the people's own weighs on them. */
export function alignMood(score: number, home: number): number {
  return score >= GOOD_AT ? 2 : score <= EVIL_AT && home > -20 ? -3 : 0;
}

/** The alignment weight (-4..+4) of each answer, in order, of the events in alignEvents.ts (the older events' are in eventAlign.ts). */
export const ALIGN_EVENT_WEIGHTS: Record<string, readonly number[]> = {
  pilgrims_come: [3, 2, -2],
  holy_order: [2, 1, -1],
  thieves_offer: [-3, -2, 2],
  dark_bargain: [-4, -2, 3],
  foes_treat: [-1, -1, 1],
  fall_reckoning: [-4, -2, 3],
  fall_exodus: [-2, 1, 2],
  redemption_penance: [3, 2, -3],
  redemption_shadow: [2, -1, -2],
};

/* ------------------------------------------------------------ the second axis: order to chaos */

/** Past these the town is of order (law, drill, tradition) or of chaos (freedom, rowdiness, the gamble). */
export const ORDER_AT = 35;
export const CHAOS_AT = -35;
/** Where each people's lore puts it on the second axis. */
export const ORIGIN_ORDER_HOME: Partial<Record<OriginId, number>> = { knights: 35, robot: 40, dwarves: 25, lich: 20, vampire: 10, alchemists: 10, orcs: -20, fae: -30, werewolf: -10, nomads: -15, druid: -5 };
export const orderHomeOf = (origin: OriginId | undefined): number => ORIGIN_ORDER_HOME[origin ?? 'settlers'] ?? 0;
export const ORDER_LEAN: Partial<Record<NatureId, number>> = { stern: 0.6, proud: 0.35, pious: 0.3, shy: 0.1, greedy: 0.1, bold: -0.2, restless: -0.5, jolly: -0.3, dreamy: -0.3, curious: -0.2, cheerful: -0.1 };
export const LAW_ORDER: Record<string, number> = { curfew: 4, conscription: 4, harsh_law: 5, rest_day: 2, temple_tithe: 2, market_charter: 1, poor_relief: 0 };
export const SENTENCE_ORDER: readonly [RegExp, number][] = [
  [/is hanged/, 4],
  [/is exiled/, 2],
  [/in the stocks|is fined/, 2],
  [/is pardoned/, -2],
];

/* ------------------------------------------------------------ what the town is called */

/** The title the town carries ("Ashford the Merciful"), from where it stands on both axes; null near the middle. */
export function titleOf(good: number, order: number): string | null {
  if (good >= DEEP_GOOD_AT) return order >= 25 ? 'the Righteous' : 'the Radiant';
  if (good >= GOOD_AT) return order >= 25 ? 'the Just' : order <= -25 ? 'the Free' : 'the Merciful';
  if (good <= DEEP_EVIL_AT) return order >= 25 ? 'the Iron' : order <= -25 ? 'the Dread' : 'the Cruel';
  if (good <= EVIL_AT) return order >= 25 ? 'the Ruthless' : order <= -25 ? 'the Lawless' : 'the Hard';
  if (order >= ORDER_AT) return 'the Steadfast';
  if (order <= CHAOS_AT) return 'the Unruly';
  return null;
}
export function orderBandName(order: number): string {
  return order >= 60 ? 'Rigid' : order >= ORDER_AT ? 'Orderly' : order > 12 ? 'Ordered' : order >= -12 ? 'Balanced' : order > CHAOS_AT ? 'Loose' : order > -60 ? 'Unruly' : 'Anarchic';
}

/* ------------------------------------------------------------ the Great Enemy's pact (greatEnemy.ts hooks) */

export const PACT_DAYS = 40;
export const LIEUTENANT_DAYS = 90;
/** The share of the treasury the Enemy's levy takes each day, by kind. */
export const PACT_LEVY = 0.04;
export const LIEUTENANT_LEVY = 0.08;
/** Every so many days the lieutenant's host takes one of the town's grown-ups into its ranks. */
export const LIEUTENANT_TAKES_EVERY = 12;
/** Raids on a town in the Enemy's service are this much smaller. */
export const LIEUTENANT_RAID_MULT = 0.7;
/** A good town draws the Enemy's hate: its plan runs this much faster. */
export function enemyHaste(score: number): number {
  return score >= DEEP_GOOD_AT ? 0.15 : score >= GOOD_AT ? 0.08 : 0;
}

/* ------------------------------------------------------------ falls and redemptions */

/** A swing this far, inside this many days, is a fall (good to evil) or a redemption (evil to good), once each. */
export const ARC_DAYS = 60;
export const ARC_FROM = 20;

/** Order weights of the alignment events (the others are in eventOrder.ts). */
export const ALIGN_EVENT_ORDER: Record<string, readonly number[]> = {
  pilgrims_come: [1, 0, 1],
  holy_order: [3, 1, -1],
  thieves_offer: [-3, -1, 2],
  dark_bargain: [-2, -1, 2],
  foes_treat: [-1, 1, 2],
  fall_reckoning: [-3, 1, 2],
  fall_exodus: [-1, 2, 1],
  redemption_penance: [3, 1, -2],
  redemption_shadow: [2, -1, 0],
};
