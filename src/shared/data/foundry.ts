// The machines' factory mind (the origins made deeper, the fifth; sim/foundry.ts). A Machine Colony builds its own
// people on a production line, runs on power that can fail, wears out and must be mended, upgrades its units with
// modules, and, once its seat has grown into a mind of its own, is given directives it may carry out whether the town
// agrees or not.

import type { Material } from './materials';
import type { Skill } from './skills';

/** The hour of the day's reckoning (power, wear, the line, modules, the Mind). */
export const FOUNDRY_HOUR = 8;
/** A unit off the line: its parts (the age's: salvage early, alloys and circuits once there are any), and the days it
 *  takes. */
export const UNIT_PARTS: Partial<Record<Material, number>>[] = [{ alloys: 6, circuits: 3 }, { stone: 24, wood: 16, flint: 6 }];
export const UNIT_DAYS = 3;
/** The line runs only while every unit has room to stand idle: up to so many units for each building standing. */
export const UNITS_PER_BUILDING = 0.8;

/** Power (0..100): each unit draws `DRAIN_PER_UNIT` a day; the sun gives `SOLAR`, and `SOLAR_PER_BUILDING` for each
 *  building's panels, on a fair day (less in rain or winter), each power cell burned `CELL_POWER`, each coal `COAL_POWER`, a power station `STATION_POWER`. Under
 *  `BROWNOUT` the town works slower (`BROWNOUT_WORK`); at nothing, a blackout (`BLACKOUT_WORK`, research too) and a unit
 *  may shut down (`SHUTDOWN_CHANCE`). */
export const POWER_START = 70;
export const DRAIN_PER_UNIT = 1.5;
export const SOLAR = 10;
/** And the panels on every finished building. */
export const SOLAR_PER_BUILDING = 1.2;
export const CELL_POWER = 10;
export const COAL_POWER = 3;
export const STATION_POWER = 40;
export const BURN_UNTIL = 80;
export const BROWNOUT = 25;
export const BROWNOUT_WORK = 0.8;
export const BLACKOUT_WORK = 0.5;
export const SHUTDOWN_CHANCE = 0.4;

/** Wear (0..100 a unit): `WEAR_DAILY` a day; mended back to nothing at `MEND_AT` for `MEND_COST`; at 100 a fault (the
 *  unit struck down, `FAULT_HURT` of its health). */
export const WEAR_DAILY: [number, number] = [6, 14];
export const MEND_AT = 60;
export const MEND_COST: Partial<Record<Material, number>> = { alloys: 1 };
export const MEND_COST_EARLY: Partial<Record<Material, number>> = { stone: 4, wood: 2 };
export const FAULT_HURT = 0.7;

/** Modules: one fitted a day while circuits are spare (`MODULE_SPARE`), two a unit at most. */
export interface ModuleDef {
  id: string;
  name: string;
  skill: Skill;
  levels: number;
  cost: Partial<Record<Material, number>>;
}
export const MODULES: readonly ModuleDef[] = [
  { id: 'fabricator', name: 'Fabricator arm', skill: 'crafting', levels: 4, cost: { circuits: 2, alloys: 2 } },
  { id: 'builder', name: 'Builder rig', skill: 'construction', levels: 4, cost: { circuits: 2, alloys: 3 } },
  { id: 'analyser', name: 'Analyser core', skill: 'research', levels: 4, cost: { circuits: 3, alloys: 1 } },
  { id: 'combat', name: 'Combat suite', skill: 'melee', levels: 4, cost: { circuits: 2, alloys: 3 } },
  { id: 'targeting', name: 'Targeting array', skill: 'ranged', levels: 4, cost: { circuits: 3, alloys: 2 } },
  { id: 'harvester', name: 'Harvester unit', skill: 'gathering', levels: 4, cost: { circuits: 1, alloys: 2 } },
];
export const MODULE_SPARE = 6;
export const MODULES_EACH = 2;

/** The Mind: from the third stage of the colony's seat, every `MIND_DAYS` it issues a directive (a `ways` question).
 *  Overruled `DISSENT_MOST` times, it carries the next out regardless. */
export const MIND_SEAT_STAGE = 3;
export const MIND_DAYS = 6;
export const DISSENT_MOST = 3;
export interface Directive {
  id: string;
  title: string;
  text: string;
  /** What it does, carried out. */
  does: string;
}
export const DIRECTIVES: readonly Directive[] = [
  { id: 'recycle', title: 'Directive: Recycle', text: 'THE OLDEST UNIT IS INEFFICIENT. RECOMMEND DISASSEMBLY FOR PARTS.', does: 'the oldest unit is taken apart (alloys and circuits back)' },
  { id: 'overdrive', title: 'Directive: Overdrive', text: 'PRODUCTION BELOW OPTIMUM. RECOMMEND OVERDRIVE FOR THREE DAYS.', does: 'everyone works half again as fast for three days, at a heavy cost in power' },
  { id: 'expand', title: 'Directive: Expand', text: 'COLONY SIZE SUBOPTIMAL. RECOMMEND IMMEDIATE ASSEMBLY.', does: 'a unit is built at once, from the stores' },
  { id: 'purge', title: 'Directive: Purge', text: 'ORGANIC CONTAMINANTS DETECTED IN STORES. RECOMMEND PURGE.', does: 'all the food in store is destroyed (machines need none)' },
  { id: 'ascend', title: 'Directive: Ascend', text: 'THE MIND REQUIRES MORE CAPACITY. RECOMMEND ALLOCATING ALL CIRCUITS TO THE CORE.', does: 'every circuit in store goes to the Mind; the town studies far faster for five days' },
];
