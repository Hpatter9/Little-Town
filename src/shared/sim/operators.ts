// Building operators (DESIGN §7): the best free person for each role is picked automatically; the player
// can pick someone else (from the building's action bar), which sticks until they're gone.

import { OPERATORS } from '../data/operators';
import { AMBITIONS, JOB_PULL } from '../data/ambitions';
import { ambitionOf } from './ambition';
import { isChild } from './social';
import { notify, type Building, type GameState, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** A job's holder: the person running the building, if they're at home and on their feet. */
export function holderOf(s: GameState, b: Building): Person | undefined {
  if (b.operator == null || b.status !== 'done' || !OPERATORS[b.def]) return undefined;
  const p = s.people.find((q) => q.id === b.operator);
  return p && p.away === null && !p.downed ? p : undefined;
}
/** The building someone holds the job at, if any. */
export const jobOf = (s: GameState, p: Person): Building | undefined => s.buildings.find((b) => b.operator === p.id && b.status === 'done' && !!OPERATORS[b.def]);
/** Whether someone is this building's job holder (they work there first, and `HOLDER_EDGE` faster). */
export const holds = (p: Person, b: Building | undefined) => !!b && b.operator === p.id;
/** A free hand this much better than an unchosen holder takes the job over (once a day). */
const TAKE_OVER_EDGE = 2;

const roleOf = (b: Building) => (b.status === 'done' ? OPERATORS[b.def] : undefined);

/** Who can run a building: adults at home, not already running another. */
function candidates(s: GameState, b: Building): Person[] {
  const busy = new Set(s.buildings.filter((q) => q !== b && q.operator != null).map((q) => q.operator));
  return s.people.filter((p) => !isChild(p) && !busy.has(p.id));
}

const skillOf = (p: Person, b: Building) => {
  const role = OPERATORS[b.def];
  // a guard captain's worth is their better fighting skill
  const level = role.skill === 'melee' ? Math.max(p.skills.melee.level, p.skills.ranged.level) : p.skills[role.skill].level;
  // (a post of the kind they dream of counts for more: data/ambitions.ts)
  return level + (AMBITIONS[ambitionOf(p)].skill === role.skill ? JOB_PULL : 0);
};

/** The operator of a building, if there is one and they're at home and on their feet. */
export function operatorOf(s: GameState, def: string): Person | undefined {
  const b = s.buildings.find((q) => q.def === def && q.status === 'done' && q.operator != null);
  const p = b ? s.people.find((q) => q.id === b.operator) : undefined;
  return p && p.away === null && !p.downed ? p : undefined;
}

/** The operator's skill level for a building kind (0 when nobody runs it). */
export function operatorSkill(s: GameState, def: string): number {
  const p = operatorOf(s, def);
  const b = s.buildings.find((q) => q.def === def && q.status === 'done');
  return p && b ? skillOf(p, b) : 0;
}

/** Once an hour: fill empty roles with the best free person (the venues, the infirmary and the tower first, then
 *  the stations, the newest kinds first); drop operators who are gone. Once a day a much better free hand takes an
 *  unchosen job over. */
export function assignOperators(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const daily = s.tick % TICKS_PER_DAY === 0;
  const worth = (b: Building) => (OPERATORS[b.def].skill === 'crafting' || OPERATORS[b.def].skill === 'gathering' ? 0 : 10) + s.buildings.indexOf(b) / 1000;
  for (const b of [...s.buildings].filter((q) => roleOf(q)).sort((x, y) => worth(y) - worth(x))) {
    const role = roleOf(b)!;
    if (b.operator != null && !s.people.some((p) => p.id === b.operator)) {
      b.operator = null;
      b.operatorChosen = false;
    }
    if (b.operator != null && daily && !b.operatorChosen) {
      const now = s.people.find((p) => p.id === b.operator)!;
      const better = candidates(s, b).sort((x, y) => skillOf(y, b) - skillOf(x, b))[0];
      if (better && better !== now && skillOf(better, b) >= skillOf(now, b) + TAKE_OVER_EDGE) {
        b.operator = better.id;
        notify(s, `${better.name} is the ${role.title.toLowerCase()} now, in ${now.name}'s place.`);
      }
      continue;
    }
    if (b.operator != null) continue;
    const best = candidates(s, b).sort((x, y) => skillOf(y, b) - skillOf(x, b))[0];
    if (!best) continue;
    b.operator = best.id;
    notify(s, `${best.name} is now the ${role.title.toLowerCase()}.`);
  }
}

/** The player picks the next candidate for a role (cycling through them by skill). */
export function cycleOperator(s: GameState, buildingId: number): void {
  const b = s.buildings.find((q) => q.id === buildingId);
  if (!b || !roleOf(b)) return;
  const list = candidates(s, b).sort((x, y) => skillOf(y, b) - skillOf(x, b));
  if (!list.length) return;
  const i = list.findIndex((p) => p.id === b.operator);
  b.operator = list[(i + 1) % list.length].id;
  b.operatorChosen = true;
}
