// Sickbeds (the owner's ask: the hurt nursed in beds, as prisoners are kept in cells). Each healing building has its
// beds (`SICKBEDS` in data/prisons.ts); the downed and the badly hurt (under `SICK_AT` of their health) go to a free
// one and lie there till they're mended (`MENDED`), getting up only to eat (people.ts `chooseTask`/`doSleep`). Only
// those in a sickbed have the building's healing (health.ts `heal`, injuries.ts): the walking wounded mend at home's
// pace. The planner builds another healing building when the hurt outnumber the beds.

import { BUILDING_BY_ID } from '../data/buildings';
import { MENDED, SICK_AT, SICKBED_REST, SICKBEDS } from '../data/prisons';
import { dist, maxHp, tireless, type Building, type GameState, type Person } from './state';
import { buildingCentre } from './buildings';

/** A building's sickbeds (0 for one that has none, or isn't finished). */
export const sickbedsIn = (b: Building) => (b.status === 'done' ? (SICKBEDS[b.def] ?? 0) : 0);
/** All the town's sickbeds. */
export const sickbedsOf = (s: GameState) => s.buildings.reduce((t, b) => t + sickbedsIn(b), 0);

/** Whoever is lying in (or making for) a sickbed in `b`. */
export const patientsIn = (s: GameState, b: Building) => s.people.filter((p) => p.away === null && p.task?.type === 'sleep' && p.task.sick && p.task.building === b.id);

/** Wants a sickbed: struck down, or badly hurt (the dead and machines mend themselves). */
export const needsSickbed = (p: Person) => p.away === null && !tireless(p) && (!!p.downed || p.hp < maxHp(p) * SICK_AT);
/** Mended enough to get up from a sickbed. */
export const mended = (p: Person) => !p.downed && p.hp >= maxHp(p) * MENDED;

/** A free sickbed for `p` (the one they're in already, else the best-tended with room, nearest first). */
export function sickbedFor(s: GameState, p: Person): Building | undefined {
  const t = p.task;
  if (t?.type === 'sleep' && t.sick && t.building !== null) {
    const b = s.buildings.find((q) => q.id === t.building && sickbedsIn(q) > 0);
    if (b) return b;
  }
  return s.buildings
    .filter((b) => sickbedsIn(b) > patientsIn(s, b).filter((q) => q !== p).length)
    .sort((a, b) => (BUILDING_BY_ID[b.def]?.healing ?? 1) - (BUILDING_BY_ID[a.def]?.healing ?? 1) || dist(buildingCentre(a), p) - dist(buildingCentre(b), p))[0];
}

/** Lying in a sickbed now: the healing building's pace for them (with `SICKBED_REST` on top), else null. */
export function sickbedHealing(s: GameState, p: Person): number | null {
  if (p.task?.type !== 'sleep' || !p.task.sick || p.activity !== 'sleep') return null;
  const b = s.buildings.find((q) => q.id === (p.task as { building: number | null }).building);
  if (!b || !sickbedsIn(b)) return null;
  return (BUILDING_BY_ID[b.def]?.healing ?? 1) * SICKBED_REST;
}
