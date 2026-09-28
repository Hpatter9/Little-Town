// Special classes: rare callings a townsperson can take up once the town has studied them deep into the Occult
// (or that a rare wanderer arrives with). Each changes how they fight, in raids at home and in battles on
// expeditions. They're meant to be rare: only one of each in a town at a time, each needs a real master of its
// skill, and each asks something hard of the town first (its `deed`).

import type { Stock } from './materials';
import type { Skill } from './skills';

/** What a calling asks before anyone can take it up. */
export type ClassDeed =
  /** The town has buried this many of its own (the dead must be known before they can be raised). */
  | { kind: 'burials'; count: number }
  /** A Spirit Totem is given up to bind the spirit (the founder's second life). */
  | { kind: 'totem' }
  /** The candidate has been cut down and come back (only the blooded swear the oath). */
  | { kind: 'scarred' }
  /** Nothing more than the skill. */
  | { kind: 'none' };

export const CLASSES = ['necromancer', 'summoner', 'beast_tamer', 'blood_knight'] as const;
export type ClassId = (typeof CLASSES)[number];

export interface ClassDef {
  name: string;
  description: string;
  /** Research that teaches it. */
  research: string;
  /** Training uses these up, and needs this skill at this level. */
  cost: Stock;
  skill: Skill;
  level: number;
  deed: ClassDeed;
  /** The deed, said for the Train button. */
  deedText: string;
}

export const CLASS_DEFS: Record<ClassId, ClassDef> = {
  necromancer: {
    name: 'Necromancer',
    description: 'Raises fallen enemies to fight for the town (two a fight).',
    research: 'necromancy',
    cost: { bone: 24, herbs: 12 },
    skill: 'research',
    level: 7,
    deed: { kind: 'burials', count: 3 },
    deedText: 'The town must have buried three of its own.',
  },
  summoner: {
    name: 'Summoner',
    description: 'Calls a spirit to fight at their side in every fight.',
    research: 'summoning',
    cost: { herbs: 16, fiber: 12 },
    skill: 'research',
    level: 6,
    deed: { kind: 'totem' },
    deedText: "A Spirit Totem is given up to bind the spirit (the founder's second life).",
  },
  beast_tamer: {
    name: 'Beast Tamer',
    description: 'Fights with a wolf companion, and tames wild beasts that come near.',
    research: 'beast_lore',
    cost: { meat: 20, hide: 10 },
    skill: 'animals',
    level: 6,
    deed: { kind: 'none' },
    deedText: 'Only a true master of animals.',
  },
  blood_knight: {
    name: 'Blood Knight',
    description: 'Heals from the wounds they deal, and hits harder the more hurt they are.',
    research: 'blood_oath',
    cost: { meat: 16, hide: 12 },
    skill: 'melee',
    level: 7,
    deed: { kind: 'scarred' },
    deedText: 'Only someone who has been cut down in battle and lived.',
  },
};

/** Share of damage dealt a Blood Knight heals, and their extra damage below half health. */
export const BLOOD_LIFESTEAL = 0.35;
export const BLOOD_FURY = 1.3;
/** Allies raised by one Necromancer in one fight, and the range (px) they reach in town. */
export const NECRO_RAISES = 2;
export const NECRO_RANGE = 250;
/** Beast Tamer: how close a wild beast must come to be tamed (px), and how often (seconds). */
export const TAME_RANGE = 150;
export const TAME_EVERY = 20;
/** Chance a wanderer arrives already trained in a class. */
export const RARE_CLASS_CHANCE = 0.04;
