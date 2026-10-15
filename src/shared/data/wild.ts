// The living wilderness (sim/wild.ts): herds of game that graze, breed and migrate with the seasons, the predators that
// follow them, the hunters' reach, and the woods that spread. Numbers here are starting values to tune.

import type { Season } from '../sim/time';

export type HerdKind = 'deer' | 'boar' | 'camel';
export type PackKind = 'wolves' | 'bears' | 'lions' | 'dogs';

/** What a herd is: how many it holds at most, and the name it goes by in the news. */
export const HERD_DEFS: Record<HerdKind, { plural: string; cap: number; start: [number, number] }> = {
  deer: { plural: 'deer', cap: 16, start: [7, 12] },
  boar: { plural: 'boar', cap: 10, start: [4, 8] },
  camel: { plural: 'camels', cap: 10, start: [4, 8] },
};

/** The game each land has (kinds with their odds). */
export const BIOME_GAME: Record<string, [HerdKind, number][]> = {
  desert: [['camel', 1]],
  jungle: [['boar', 2], ['deer', 1]],
  swamp: [['boar', 2], ['deer', 1]],
  forest: [['deer', 3], ['boar', 1]],
};
export const DEFAULT_GAME: [HerdKind, number][] = [['deer', 3], ['boar', 1]];

/** The hunters of each land (a pack's kind and the foes it fights as: `ENEMIES` ids, the pack's size picks how many). */
export const BIOME_PREDATORS: Record<string, PackKind[]> = {
  desert: ['lions', 'dogs'],
  steppe: ['lions', 'wolves'],
  highlands: ['wolves', 'bears'],
  taiga: ['wolves', 'bears'],
  tundra: ['wolves'],
  jungle: ['dogs'],
  swamp: ['dogs'],
  forest: ['wolves', 'bears'],
};
export const DEFAULT_PREDATORS: PackKind[] = ['wolves'];
export const PACK_NAMES: Record<PackKind, string> = { wolves: 'wolf pack', bears: 'bear', lions: 'pride of lions', dogs: 'pack of wild dogs' };
/** The foes a pack fights as, by its size. */
export function packFoes(kind: PackKind, n: number): Record<string, number> {
  if (kind === 'wolves') return n >= 4 ? { wolf_alpha: 1, wolf: n - 1 } : { wolf: n };
  if (kind === 'bears') return { cave_bear: 1 };
  if (kind === 'lions') return { lion: 1, lioness: Math.max(1, n - 1) };
  return { wild_dog: n + 1 };
}

/** The herds the land holds (when the game is left alone), and how far from the camp they range (cells). */
export const HERD_TARGET = 8;
export const PACK_TARGET = 2;
export const HERD_NEAR = 22;
export const HERD_FAR = 56;
/** How far a herd drifts each hour grazing, and walks each hour migrating (cells). */
export const GRAZE_STEP = 0.18;
export const MIGRATE_STEP = 0.35;
/** The herds keep this far from the town's edge (cells). */
export const HERD_KEEP_OFF = 9;

/** Births an hour for each head by the season (thinned as the herd nears its cap), and the deaths an hour in the cold and
 *  the lean. */
export const BIRTH_RATE: Record<Season, number> = { spring: 0.003, summer: 0.001, autumn: 0, winter: 0 };
export const DEATH_RATE: Record<Season, number> = { spring: 0, summer: 0.0002, autumn: 0.0005, winter: 0.0025 };
/** In spring, each day, the herds the land lacks drift in from beyond the fog, this big. */
export const DRIFT_IN: [number, number] = [4, 6];

/** Predators: hunger gained an hour, what a kill takes off it, and how a hungry pack turns on the town. */
export const HUNGER_RATE = 0.012;
export const KILL_RELIEF = 0.55;
export const KILL_CHANCE = 0.4;
export const PACK_STEP = 0.9;
export const HUNGRY_AT = 0.65;
/** A hungry pack comes to the town's edge to this distance (cells beyond the reach), and rests this many days after. */
export const PACK_STRIKE = 5;
export const PACK_REST_DAYS = 2;
export const PACK_HOURS = 10;
/** Pen animals a raiding pack takes (at most), and how often it gets to the pen. */
export const PEN_TAKE = 3;
export const PEN_STRIKE = 0.6;

/** Hunting (an expedition of type 'hunt'): the nearest herd's distance (cells) up to which the hunting is as good as
 *  ever; further out the yield falls, the way is longer and the road more dangerous. */
export const HUNT_NEAR = 26;
export const HUNT_YIELD_MIN = 0.3;
/** A head of game falls for every this many units of meat the hunters bring in. */
export const HUNT_UNITS_PER_HEAD = 3;
/** Extra odds of a fight on the road for each cell past `HUNT_NEAR`, and the most. */
export const HUNT_RISK_PER_CELL = 0.012;
export const HUNT_RISK_MAX = 0.4;
export const HUNT_TRAVEL_MAX = 1.7;

/** The woods spread: each day (spring and summer more, autumn less) up to this many open cells beside woods grow trees; no
 *  more than this much over the woods the land began with. */
export const SPREAD_PER_DAY: Record<Season, number> = { spring: 7, summer: 4, autumn: 2, winter: 0 };
export const WOOD_CAP = 1.3;
/** A dry year's share, an hour's chance of a wildfire in a dry summer, and the wind's turn each day (radians at most). */
export const DRY_YEAR = 0.4;
export const DRY_FIRE_HOURLY = 1 / 150;
export const WIND_TURN = 1.1;
/** Burnt land regrows richer: its pool is this much fuller, and it comes back this much sooner. */
export const RICH_POOL = 1.8;
export const RICH_DAYS = 3;

/** A flood sometimes shifts the river for good: the chance, and how far the channel moves (cells). */
export const RIVER_SHIFT_CHANCE = 0.2;
export const RIVER_SHIFT: [number, number] = [3, 5];
export const RIVER_REACH = 18;
