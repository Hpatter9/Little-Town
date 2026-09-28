// Building operators (DESIGN §7): the best free person for each role is picked automatically; the player
// can pick someone else (from the building's action bar), which sticks until they're gone.

import { OPERATORS } from '../data/operators';
import { isChild } from './social';
import { notify, type Building, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

const roleOf = (b: Building) => (b.status === 'done' ? OPERATORS[b.def] : undefined);

/** Who can run a building: adults at home, not already running another. */
function candidates(s: GameState, b: Building): Person[] {
  const busy = new Set(s.buildings.filter((q) => q !== b && q.operator != null).map((q) => q.operator));
  return s.people.filter((p) => !isChild(p) && !busy.has(p.id));
}

const skillOf = (p: Person, b: Building) => {
  const role = OPERATORS[b.def];
  // a guard captain's worth is their better fighting skill
  return role.skill === 'melee' ? Math.max(p.skills.melee.level, p.skills.ranged.level) : p.skills[role.skill].level;
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

/** Once an hour: fill empty roles with the best free person; drop operators who are gone. */
export function assignOperators(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const b of s.buildings) {
    const role = roleOf(b);
    if (!role) continue;
    if (b.operator != null && !s.people.some((p) => p.id === b.operator)) {
      b.operator = null;
      b.operatorChosen = false;
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
