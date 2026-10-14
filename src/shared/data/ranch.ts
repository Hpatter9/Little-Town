// The monster ranch (the owner's ask: the beasts tamed in raids given a home). A Beast Ranch (`RANCH_BUILDING`, merged
// into BUILDINGS) holds the town's beasts: bred (their traits passed on, `BEAST_TRAITS`), trained by the ranch's
// Beastmaster (an operator role: data/operators.ts), ridden, and set to work guarding, hauling and hunting. They eat from
// the stores, sicken, grow old and die. The town runs it all itself (sim/ranch.ts); the player may name a beast and
// forbid its sale. The numbers here; the rules in sim/ranch.ts.

import type { BuildingDef } from './buildings';

export const RANCH_BUILDING: BuildingDef = {
  id: 'beast_ranch',
  name: 'Beast Ranch',
  layer: 'mid',
  width: 4,
  depth: 3,
  cost: { wood: 20, stone: 6, hide: 4 },
  buildSeconds: 150,
  research: 'domestication',
  purpose: 'Pens, a shelter and feed for the beasts the town has tamed: here they are bred, trained, ridden and set to work.',
};

/** Beasts a ranch holds, and how many the town keeps tethered by the fire before it has one. */
export const RANCH_ROOM = 6;
export const LOOSE_ROOM = 2;
/** The town builds a ranch once it holds a beast (or has a Beast Tamer) and has this many grown-ups; at most this many
 *  ranches, a second when the first is full. */
export const RANCH_PEOPLE = 4;
/** With no beast yet, it builds one at this many, for its Beastmaster to catch beasts left on the field after raids. */
export const RANCH_PEOPLE_UNASKED = 6;
export const RANCHES_MOST = 2;
/** The ranch's day: feeding, breeding, training, the work's haul (hour of the day). */
export const RANCH_HOUR = 7;

/** A downed beast left on the field after a raid may be caught and brought in, with a ranch to keep it and someone to
 *  catch it (a Beastmaster or a Beast Tamer at home). */
export const CATCH_DOWNED = 0.2;

/* ------------------------------------------------------------ feeding */

/** What eats grass and grain rather than meat, by its name. */
export const GRAZERS = /goat|ram|horse|pony|deer|stag|boar|mammoth|camel|ox|bison|yak|elk|tortoise|turtle|beetle|slug|snail/;
export const GRAZER_FOOD = ['grain', 'vegetables', 'berries', 'fruit', 'kelp'] as const;
export const MEAT_FOOD = ['meat', 'fish', 'dried_meat'] as const;
/** Units a day: one, and one more for every few tiers. */
export const feedOf = (tier: number) => 1 + Math.floor(tier / 3);
/** Days unfed before a beast breaks out and runs off. */
export const HUNGRY_FLEE = 3;
/** The town sells a beast rather than feed it when the stores hold under this many days of food. */
export const SELL_FOOD_DAYS = 1;

/* ------------------------------------------------------------ life */

/** A beast's span in days by its tier, old from `OLD_SHARE` of it; each morning an old beast may die. */
export const lifespanOf = (tier: number) => 36 + tier * 6;
export const OLD_SHARE = 0.75;
export const OLD_DEATH = 0.08;
/** A cub is grown (works, breeds, fights) after this many days. */
export const GROWN_DAYS = 4;

/** Sickness: the daily chance (more when hungry or crowded), how long, and the odds of dying of it each day untended
 *  or with a Beastmaster; a Beastmaster cures it at `TEND_CURE` plus `TEND_PER_LEVEL` a level of Animals. */
export const SICK_DAILY = 0.02;
export const SICK_HUNGRY = 0.06;
export const SICK_CROWDED = 0.03;
export const SICK_DAYS = 3;
export const SICK_DEATH = 0.12;
export const SICK_DEATH_TENDED = 0.03;
export const TEND_CURE = 0.3;
export const TEND_PER_LEVEL = 0.02;

/* ------------------------------------------------------------ breeding */

/** A pair of one kind, both grown and fed, with room: the daily chance of a cub (a fertile parent doubles it). */
export const BREED_DAILY = 0.1;
/** Each parent's trait passes on at this chance; a new trait comes now and then. A cub has at most `TRAITS_MOST`. */
export const INHERIT = 0.5;
export const MUTATE = 0.15;
export const TRAITS_MOST = 3;

/* ------------------------------------------------------------ training and work */

/** Experience a day from the Beastmaster, more by their Animals level; a level costs `LEVEL_XP` times the level. */
export const TRAIN_XP = 8;
export const TRAIN_PER_LEVEL = 0.1;
export const LEVEL_XP = 20;
export const BEAST_LEVEL_MOST = 20;
/** Each level makes a beast this much stronger (health and blows). */
export const PER_LEVEL = 0.06;

export type BeastJob = 'guard' | 'haul' | 'hunt' | 'ride' | 'rest';
export const JOB_NAMES: Record<BeastJob, string> = { guard: 'Guarding the town', haul: 'Hauling', hunt: 'Hunting', ride: 'Ridden', rest: 'Resting' };

/** What the beasts that can carry a rider are. */
export const RIDEABLE = /wolf|horse|pony|boar|bear|lion|tiger|panther|drake|wyvern|griffin|gryphon|elk|stag|camel|mammoth|ox|yak|lizard|raptor|hound|dog/;
/** A rider's blows in a raid, by the mount's tier. */
export const rideFight = (tier: number) => 1.1 + tier * 0.02;
/** A day's haul (wood or stone) and hunt (meat; a hide now and then), by tier; the hunt may hurt the hunter. */
export const haulOf = (tier: number) => 3 + Math.floor(tier);
export const huntOf = (tier: number) => 2 + Math.floor(tier / 2);
export const HUNT_HIDE = 0.4;
export const HUNT_HURT = 0.06;

/** A beast's price: by tier, level and its good traits, less its bad ones. */
export const BEAST_PRICE = 15;
export const priceOf = (tier: number, level: number, good: number, bad: number) => Math.round(BEAST_PRICE * tier * (1 + level * 0.08) * (1 + good * 0.15) * Math.max(0.5, 1 - bad * 0.2));

/* ------------------------------------------------------------ traits */

export type TraitId = 'strong' | 'hardy' | 'swift' | 'fierce' | 'keen' | 'gentle' | 'fertile' | 'longlived' | 'sickly' | 'skittish';

export interface BeastTrait {
  name: string;
  text: string;
  /** Multipliers: blows, health, the hunt, the haul, training; breeding, lifespan and sickness. */
  damage?: number;
  hp?: number;
  hunt?: number;
  haul?: number;
  train?: number;
  breed?: number;
  life?: number;
  sick?: number;
  /** Quicker to act (the interval between blows times this). */
  speed?: number;
  /** A trait the ranch would sooner breed out. */
  bad?: boolean;
}

export const BEAST_TRAITS: Record<TraitId, BeastTrait> = {
  strong: { name: 'Strong', text: 'Hits harder and hauls more', damage: 1.2, haul: 1.3 },
  hardy: { name: 'Hardy', text: 'Tougher, and seldom sickens', hp: 1.25, sick: 0.5 },
  swift: { name: 'Swift', text: 'Quick on its feet: it acts sooner in a fight', speed: 0.85 },
  fierce: { name: 'Fierce', text: 'A born fighter: harder blows, a fine guard', damage: 1.12 },
  keen: { name: 'Keen-nosed', text: 'A fine hunter: half as much again from the hunt', hunt: 1.5 },
  gentle: { name: 'Gentle', text: 'Takes to training and a rider', train: 1.35 },
  fertile: { name: 'Fertile', text: 'Breeds readily', breed: 2 },
  longlived: { name: 'Long-lived', text: 'Lives half as long again', life: 1.5 },
  sickly: { name: 'Sickly', text: 'Prone to sickness', sick: 2, bad: true },
  skittish: { name: 'Skittish', text: 'Shies from a fight', damage: 0.85, bad: true },
};
export const TRAIT_IDS = Object.keys(BEAST_TRAITS) as TraitId[];

/** The names the ranch gives its beasts (the player may give another). */
export const BEAST_NAMES = [
  'Bramble', 'Ash', 'Thistle', 'Grizzle', 'Fang', 'Moss', 'Ember', 'Rook', 'Sorrel', 'Tusk', 'Pebble', 'Bracken', 'Smudge', 'Hob', 'Juniper', 'Cinder',
  'Gristle', 'Nettle', 'Barley', 'Duchess', 'Brute', 'Flint', 'Hazel', 'Grumble', 'Biscuit', 'Wort', 'Storm', 'Clover', 'Tallow', 'Midge', 'Boggart', 'Pip',
  'Old Ned', 'Saffron', 'Whisker', 'Burdock', 'Quill', 'Mallow', 'Gorse', 'Snapper',
];
