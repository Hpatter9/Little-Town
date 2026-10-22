// How far things see, in land cells (sim/fog.ts): the fog of war lifts within these rings.

/** What a townsperson sees by day, in cells. */
export const SIGHT_BASE = 8;
/** What the founder adds. */
export const SIGHT_FOUNDER = 1;
/** What is lost at night, and the least anyone sees. */
export const SIGHT_NIGHT = 2;
export const SIGHT_LEAST = 4;
/** More for the callings that live in the wild (a class id: cells added). */
export const SIGHT_CLASS: Record<string, number> = { ranger: 4, hunter: 3, archer: 2, assassin: 1, beast_tamer: 1, druid: 1, shapeshifter: 1, samurai: 1 };

/** What a finished building sees. */
export const SIGHT_BUILDING = 4;
/** What a piece of the ring wall sees (the gaps between the neighbours are covered). */
export const SIGHT_WALL = 2;
/** The tall and watching ones: a watchtower, every gate, and the town's seat. */
export const SIGHT_TALL = 12;
export const TALL_BUILDINGS: readonly string[] = ['watchtower', 'palisade_gate', 'stone_gate', 'brick_gate', 'concrete_gate'];

/** The land about the founding spot that starts explored, in cells. */
export const START_EXPLORED = 16;
/** The fog is worked out every this many ticks. */
export const FOG_EVERY = 5;

/** The callings that go out to the fog's edge when they have nothing to do (a class id): sim/explore.ts. */
export const SCOUT_CLASSES: readonly string[] = ['ranger', 'hunter'];
/** How far past the town's reach the scouts range, and the most that is ever sent (cells from the camp). */
export const EXPLORE_BEYOND = 18;
/** How many scouts are out at once: this, and one more for every EXPLORE_PER_PEOPLE grown-ups. */
export const EXPLORE_QUOTA = 1;
export const EXPLORE_PER_PEOPLE = 10;
/** When the town has found no room for a building, anyone idle may go and look (for this long after, in hours). */
export const FOG_NEED_HOURS = 36;
/** What the founder is sent out for: a day's exploring in a compass direction (the eight winds, 0 north, clockwise). */
export const EXPLORE_DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
