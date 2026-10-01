// Shared test setup.

import { JOBS, type Job, type Priority } from '../src/shared/data/people';
import { maxHp, newGame, type GameState } from '../src/shared/sim/state';

/** Priorities with every job Low (Defend off), except the ones given. */
export function priorities(set: Partial<Record<Job, Priority>>): Record<Job, Priority> {
  return { ...(Object.fromEntries(JOBS.map((j) => [j, j === 'defend' ? 0 : 3])) as Record<Job, Priority>), ...set };
}

/**
 * A new game with the variables that muddy timing and stock checks removed: the founder has no traits
 * and full needs, and the camp has no starting food (so nothing gets eaten out of storage).
 */
export function plainGame(seed: string): GameState {
  const s = newGame(seed);
  const main = s.people[0];
  main.traits = [];
  main.hp = maxHp(main);
  main.needs = { food: 1, rest: 1 };
  s.buildings.find((b) => b.def === 'campfire')!.store = {};
  s.autopilot = false; // (the town's own planner stays out of tests of single mechanics)
  s.nextEventTick = Number.MAX_SAFE_INTEGER; // (and so do the choice events)
  s.battles = false; // (and raids are fought in the town, not on the battle map: battle.test.ts tests that)
  return s;
}
