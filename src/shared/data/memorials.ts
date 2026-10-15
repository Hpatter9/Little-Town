// Memory written into the town (the owner's ask): statues raised to its famous dead, and ruins left where buildings fell.
// The statue's building and the numbers of both; the rules are in sim/memorials.ts and sim/ruins.ts.

import type { BuildingDef } from './buildings';

export const STATUE = 'statue';

/** A statue to one of the town's famous dead, raised by the town itself in its square (never built by the planner's
 *  own loop, never pulled down to make room). Which of the dead it is lives on the building (`Building.statue`). */
export const STATUE_BUILDING: BuildingDef = {
  id: STATUE,
  name: 'Statue',
  layer: 'fore',
  width: 1,
  depth: 1,
  cost: { stone: 6 },
  buildSeconds: 60,
  purpose: 'A statue to one of the town’s famous dead, raised in the square so the town remembers them.',
};

/** Who is famous enough for a statue: the founder always; anyone with a title; else this many raiders felled, this
 *  level, or this many journeys made. */
export const FAMOUS_FELLED = 12;
export const FAMOUS_LEVEL = 18;
export const FAMOUS_TRIPS = 5;
/** Statues at most (the square fills over the generations, the oldest dead first); the honoured remembered at most. */
export const STATUES_MOST = 12;
export const HONOURED_MOST = 40;
/** The hour the town decides on a statue (one a day at most, one building at a time). */
export const STATUE_HOUR = 11;
/** The stone in store before one is laid out, as a share of its cost (so it doesn't stall and get set aside). */
export const STATUE_STONE = 1;

/** How long a ruin lies before it is cleared away (game hours), by how it fell; at once when something is built on it. */
export type RuinKind = 'burnt' | 'felled' | 'pulled';
export const RUIN_HOURS: Record<RuinKind, number> = { burnt: 72, felled: 60, pulled: 36 };
/** Ruins kept at once (the oldest cleared first). */
export const RUINS_MOST = 24;
