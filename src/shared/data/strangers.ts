// Strangers of other peoples (the owner's request): a wanderer or a traveller may be of another origin than the
// town's. They bring their people's lifespan (data/lifespans.ts) and look (sim/strangers.ts), and in a town that
// welcomes them they settle like anyone else; a xenophobic people (the `xenophobic` rule in data/origins.ts: the
// Deep Hold) turns them from the gate. A stranger of the Blood Court comes as a vampire in hiding; one of the Moon
// Pack as a werewolf.
import type { OriginId } from './origins';

/** How often a wanderer is of another people, and a traveller. */
export const STRANGER_CHANCE = 0.3;
export const TRAVELLER_STRANGER_CHANCE = 0.5;
/** How often a traveller who leaves the shop well served asks to settle (with a bed free). */
export const SETTLE_CHANCE = 0.05;

/** Which peoples wander, and how often (the town's own is never a stranger; the dead and the machines don't wander). */
export const STRANGER_ORIGINS: [OriginId, number][] = [
  ['settlers', 4],
  ['knights', 2],
  ['druid', 2],
  ['nomads', 2],
  ['alchemists', 1.5],
  ['dwarves', 1.5],
  ['merfolk', 1],
  ['fae', 1],
  ['vampire', 0.4],
  ['werewolf', 0.4],
];
