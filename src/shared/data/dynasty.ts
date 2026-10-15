// Generations and dynasties (sim/dynasty.ts): the numbers and words. A child's upbringing leans their skills and nature
// (a lean, never a rule); feuds and alliances pass between families; one house rules, rises, peaks and falls; and a
// fine item comes down the line as an heirloom.
import type { NatureId } from './natures';
import type { Skill } from './skills';

/** What a child can lean toward. */
export type LeanId = 'fight' | 'farm' | 'trade' | 'magic';
export const LEANS: readonly LeanId[] = ['fight', 'farm', 'trade', 'magic'];

export interface LeanDef {
  name: string;
  /** Levels of each skill at full strength (scaled down by the strength, rounded). */
  skills: Partial<Record<Skill, number>>;
  /** The passion it may give. */
  passion: Skill;
  /** The natures it leans to. */
  natures: NatureId[];
  /** How it reads: "raised through raids". */
  raised: string;
}

export const LEAN_DEFS: Record<LeanId, LeanDef> = {
  fight: { name: 'the fighting callings', skills: { melee: 3, ranged: 1 }, passion: 'melee', natures: ['bold', 'stern', 'proud'], raised: 'raised through raids and hard watches' },
  farm: { name: 'the plough and thrift', skills: { farming: 2, gathering: 1, cooking: 1 }, passion: 'farming', natures: ['greedy', 'stern', 'pious'], raised: 'raised through hungry years' },
  trade: { name: 'trade', skills: { social: 2, crafting: 1 }, passion: 'social', natures: ['greedy', 'jolly', 'curious', 'cheerful'], raised: 'raised in a trading town' },
  magic: { name: 'the arcane', skills: { research: 3, medicine: 1 }, passion: 'research', natures: ['dreamy', 'curious', 'pious'], raised: 'raised by casters' },
};

/** A child's days of exposure count toward a strength 0..1: raids lived through, hungry days, and a trading town's
 *  days (the share of a good day's trade). */
export const RAIDS_FULL = 3;
export const HUNGER_DAYS_FULL = 4;
/** A day is hungry when this share of the town has an empty belly. */
export const HUNGRY_SHARE = 0.25;
export const HUNGRY_BELLY = 0.3;
/** Yesterday's trade income (coins) that makes a day a fully trading one. */
export const TRADE_DAY_COINS = 60;
export const TRADE_AVG_FULL = 0.8;
/** A parent's calling adds this much strength (each; both parents together make a full lean). */
export const PARENT_LEAN = 0.5;
/** Below this a lean is too faint to show. */
export const LEAN_LEAST = 0.25;
/** At most this many leans show in one child. */
export const LEANS_MOST = 2;
/** The chance a lean turns a nature its way: this much at full strength, never more than the cap. */
export const NATURE_LEAN = 0.4;

/** Feuds: the heat an offence starts at, the most heat, and the days between incidents of a hot one (checked daily:
 *  the chance of an incident is heat / FEUD_INCIDENT_DIV). */
export const FEUD_HEAT: Record<'murder' | 'assault' | 'theft' | 'jilted' | 'vandalism' | 'sentence', number> = { murder: 60, assault: 30, theft: 25, jilted: 35, vandalism: 20, sentence: 15 };
export const FEUD_MOST = 6;
export const FEUD_HEAT_MAX = 100;
export const FEUD_INCIDENT_DIV = 400;
export const FEUD_PRESSURE = -3;
/** The grown-ups of two houses sour on each other by this much the day a feud begins. */
export const FEUD_START = -15;
export const FEUD_FLOOR = -70;
/** Each incident raises the heat a little. */
export const FEUD_INCIDENT_HEAT = 4;
export const FEUD_KEPT = 16;
/** A shared ordeal (a raid that cost a life, a famine) may end a feud: the chance. A council ruling, too, at each meeting. */
export const ORDEAL_END = 0.35;
export const COUNCIL_END = 0.3;
/** Jilting: the daily chance, for an unmarried couple with a third party warmer to one of them. */
export const JILT_CHANCE = 0.08;

/** Alliances: the strength a raid fought side by side adds, the strength that is declared, the most, and the daily
 *  warmth between allied houses' members. */
export const BOND_RAID = 12;
export const BOND_DECLARED = 30;
export const BOND_MAX = 100;
export const BOND_WARM = 1;
export const BOND_NEWCOMER = 12;
export const BOND_KEPT = 20;

/** The ruling house: strength is the sum of its people's worth; the number needed to be a challenger, and by what
 *  margin, for how many days, to take the seat. */
export const RISE_LEAST = 30;
export const RISE_MARGIN = 1.35;
export const RISE_DAYS = 8;
/** Stage cuts, as shares of the house's best strength: a house under DECLINE_BELOW of its peak is declining. A house
 *  is `rising` while young or still setting new peaks. */
export const DECLINE_BELOW = 0.75;
export const YOUNG_DAYS = 12;
/** A lost heir: how much strength it costs (a share) for how many days, and the town's mood. */
export const CRISIS_SHARE = 0.3;
export const CRISIS_DAYS = 15;
export const HEIR_MORALE = -8;
export const HEIR_MORALE_DAYS = 3;
/** A scandal in the ruling house. */
export const SCANDAL_STRENGTH = 15;
export const SCANDAL_DAYS = 20;
/** The fall of a house, and the rise of one, for the families' spirits (the sore mark, in days). */
export const FALL_SORE = -6;
export const RISE_WARM = 5;
export const FALL_DAYS = 2;

/** Heirlooms: an Epic (or better) piece, or any unique, held by someone of a family. */
export const HEIRLOOM_GRADE = 4;
export const HEIRLOOMS_MOST = 10;
export const HEIRLOOM_STORY_MOST = 14;
/** Days missing before it's called lost. */
export const HEIRLOOM_MISSING_DAYS = 2;
export const HEIRLOOM_LOST_SORE = -8;
export const HEIRLOOM_LOST_DAYS = 3;

export const DYNASTY_LOG_MOST = 60;

export const STAGE_TEXT: Record<'rising' | 'peak' | 'declining', string> = {
  rising: 'on the rise',
  peak: 'at the height of its power',
  declining: 'in decline',
};
