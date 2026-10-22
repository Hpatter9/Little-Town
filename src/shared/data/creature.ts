// The great creature (the owner's ask: "a creature like Black and White that learns, has emotions and needs, works with
// the townsfolk, can be good or evil, and grows in size", one of five for every people). The numbers for sim/creature.ts:
// the five kinds, what each does well and needs, the deeds it can do and how good or cruel each is, and how it learns,
// grows and is drawn.

import { PACK_SHEETS } from './packSheets';

export type CreatureKind = 'ape' | 'wolf' | 'bear' | 'bull' | 'golem';
export const CREATURE_KINDS: readonly CreatureKind[] = ['ape', 'wolf', 'bear', 'bull', 'golem'];

/** What it can do: the work it helps with, its play, its misdeeds, and its own needs met. */
export type CreatureDeed =
  | 'haul' | 'build' | 'guard' | 'hunt' | 'farm' | 'play' | 'heal' | 'fight'
  | 'eat_crops' | 'steal' | 'scare' | 'eat_villager'
  | 'eat' | 'sleep' | 'wander';

export type CreatureMood = 'happy' | 'bored' | 'angry' | 'afraid' | 'lonely';

export interface CreatureKindDef {
  name: string;
  /** One line for the pick. */
  blurb: string;
  /** How fast praise and scolding sink in (1 is the usual). */
  learn: number;
  /** What it is good at: each deed's weight and its work multiplied by this (1 when left out). */
  strengths: Partial<Record<CreatureDeed, number>>;
  /** How fast its needs run down, a game hour (of 100). */
  hunger: number;
  rest: number;
  play: number;
  /** How quick it is to anger, and to misdeeds (0 to 1). */
  temper: number;
  /** Its health and blow when grown huge (a young one has a share of it: `sizeShare`). */
  hp: number;
  attack: number;
  /** What it eats: the town's food, or stone (the golem). */
  eats: 'food' | 'stone';
  /** Its stand-in picture until its own art comes (art/iso/creature/<kind>/): a creature sheet, the block on it, and
   *  the scale that draws it a person's height (sim/creature.ts `drawScale` makes it bigger as it grows). Pale ones
   *  are picked, so the tint by its nature shows. */
  look: { sheet: string; block: number; scale: number };
}

export const CREATURE_DEFS: Readonly<Record<CreatureKind, CreatureKindDef>> = {
  ape: {
    name: 'Ape',
    blurb: 'Quick to learn and clever with its hands; it craves company and gets up to mischief.',
    learn: 1.8,
    strengths: { play: 2, heal: 1.8, farm: 1.4, haul: 1.1, steal: 1.5 },
    hunger: 3, rest: 2.5, play: 5, temper: 0.4,
    hp: 130, attack: 14, eats: 'food',
    look: { sheet: 'snowmonkey', block: 0, scale: 1.25 },
  },
  wolf: {
    name: 'Wolf',
    blurb: 'A born hunter that keeps the larder full and the edges watched; hungry, and quick to bare its teeth.',
    learn: 1.1,
    strengths: { hunt: 2.6, guard: 1.4, fight: 1.3, scare: 1.3 },
    hunger: 5, rest: 2.5, play: 3, temper: 0.6,
    hp: 120, attack: 19, eats: 'food',
    look: { sheet: 'werewolf_white', block: 0, scale: +(40 / PACK_SHEETS.werewolf_white).toFixed(2) },
  },
  bear: {
    name: 'Bear',
    blurb: 'A great guard and a terror in a fight; it sleeps long and has a taste for the fields.',
    learn: 1,
    strengths: { guard: 2.6, fight: 1.5, hunt: 1.2, eat_crops: 1.4, sleep: 1.5 },
    hunger: 4.5, rest: 4, play: 2, temper: 0.5,
    hp: 190, attack: 17, eats: 'food',
    look: { sheet: 'bear', block: 5, scale: 1.2 },
  },
  bull: {
    name: 'Bull',
    blurb: 'A horned beast like the minotaurs of old: it hauls and ploughs like ten oxen, and its temper is short.',
    learn: 0.9,
    strengths: { haul: 2.6, farm: 1.5, build: 1.3, scare: 1.2 },
    hunger: 4, rest: 2, play: 2, temper: 0.8,
    hp: 170, attack: 17, eats: 'food',
    look: { sheet: 'minotaur_1', block: 0, scale: +(42 / PACK_SHEETS.minotaur_1).toFixed(2) },
  },
  golem: {
    name: 'Golem',
    blurb: 'Stone that walks: a tireless builder that eats rock, slow to learn and slow to anger.',
    learn: 0.6,
    strengths: { build: 2.8, haul: 1.6, guard: 1.2 },
    hunger: 1.5, rest: 1.5, play: 1.5, temper: 0.3,
    hp: 240, attack: 13, eats: 'stone',
    look: { sheet: 'golems', block: 1, scale: 1.15 },
  },
};

export interface CreatureDeedDef {
  /** How it is told: "The Wolf <did>". */
  did: string;
  /** How its good or evil rating moves when it does it (the rating runs -100 to 100). */
  align: number;
  /** A deed the player is asked to praise or scold. */
  notable: boolean;
  /** Its weight in the hourly choice before anything else bends it. */
  base: number;
  /** A misdeed: anger, boredom and an evil nature make it likelier. */
  bad?: boolean;
  /** Work for the town: a happy beast and a good one does more of it. */
  work?: boolean;
}

export const CREATURE_DEEDS: Readonly<Record<CreatureDeed, CreatureDeedDef>> = {
  haul: { did: 'hauled loads in from the wild', align: 1, notable: true, base: 1.2, work: true },
  build: { did: 'helped raise a building', align: 1, notable: true, base: 1.2, work: true },
  guard: { did: 'stood guard over the town', align: 1, notable: true, base: 0.8, work: true },
  hunt: { did: 'brought home a kill', align: 0, notable: true, base: 1, work: true },
  farm: { did: 'helped in the fields', align: 1, notable: true, base: 1, work: true },
  play: { did: 'played with the children', align: 2, notable: true, base: 0.8 },
  heal: { did: 'tended someone who was hurt', align: 4, notable: true, base: 0.5 },
  fight: { did: 'fought the raiders', align: 2, notable: true, base: 0 },
  eat_crops: { did: 'ate the crops in a field', align: -2, notable: true, base: 0.25, bad: true },
  steal: { did: 'raided the stores', align: -3, notable: true, base: 0.2, bad: true },
  scare: { did: 'terrified one of the townsfolk', align: -4, notable: true, base: 0.15, bad: true },
  eat_villager: { did: 'killed and ate one of the townsfolk', align: -25, notable: true, base: 0.012, bad: true },
  eat: { did: 'ate its fill', align: 0, notable: false, base: 0.3 },
  sleep: { did: 'slept', align: 0, notable: false, base: 0.3 },
  wander: { did: 'wandered about the town', align: 0, notable: false, base: 0.6 },
};

/** The research that brings it (the second age, every people's): data/research.ts. */
export const CREATURE_TOPIC = 'great_beasts';
/** The saga it comes in (data/creatureSaga.ts). */
export const CREATURE_SAGA = 'great_beast';

/** Praise moves a deed's learned weight up this much (times the kind's `learn`), a scolding down; the weight runs between
 *  -LEARN_MOST and LEARN_MOST, and the deed's weight is multiplied by 2 to its power. */
export const LEARN_STEP = 0.5;
export const LEARN_MOST = 3;
/** A praise-or-scold card stands this many game hours, then counts as neither. */
export const ASK_HOURS = 4;
/** And a new one is put no sooner than this many game hours after the last (a game hour is a minute of play). */
export const ASK_GAP_HOURS = 3;
/** Young to huge over this many paced days (sim/time.ts `paceDay`): about sixty days of the game. */
export const GROW_PACED_DAYS = 24;
/** How big it starts (of 1). */
export const BORN_SIZE = 0.1;
/** A starving beast loses this much health an hour, and a fed one mends this much. */
export const STARVE_HP = 3;
export const MEND_HP = 2;
/** Food it eats from the stores in one go (in units of food value), and stone for a golem. */
export const MEAL = 4;
/** Hours it sleeps once it lies down (and when the player sends it to rest). */
export const SLEEP_HOURS = 5;
/** Below this a need is pressing (its mood turns), and neglected (its temper worsens) below `NEGLECT_AT`. */
export const NEED_LOW = 30;
export const NEGLECT_AT = 15;

/** How big a stage is (of 1), for the card. */
export function sizeStage(size: number): 'young' | 'grown' | 'great' | 'huge' {
  return size < 0.3 ? 'young' : size < 0.6 ? 'grown' : size < 0.9 ? 'great' : 'huge';
}
/** Its share of a huge one's health and blow. */
export const sizeShare = (size: number) => 0.35 + 0.65 * size;
/** How much larger than a person it is drawn. */
export const drawScale = (size: number) => 0.9 + 1.6 * size;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (from: number, to: number, t: number) =>
  (lerp((from >> 16) & 255, (to >> 16) & 255, t) << 16) | (lerp((from >> 8) & 255, (to >> 8) & 255, t) << 8) | lerp(from & 255, to & 255, t);
/** The tint at the good end (a bright, warm gold), the middle (none), and the evil end (a dark red-black). */
export const TINT_GOOD = 0xffe7a0;
export const TINT_EVIL = 0x5a1a1e;
/** Its look by its good or evil rating (-100 to 100): smoothly from warm and bright to dark and red. */
export function creatureTint(align: number): number {
  const a = Math.max(-100, Math.min(100, align)) / 100;
  return a >= 0 ? mix(0xffffff, TINT_GOOD, a) : mix(0xffffff, TINT_EVIL, -a);
}
/** A word for the rating. */
export function alignWord(align: number): string {
  return align >= 60 ? 'Saintly' : align >= 25 ? 'Good' : align > -25 ? 'Torn' : align > -60 ? 'Cruel' : 'Wicked';
}
