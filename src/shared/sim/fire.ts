// Fire (DESIGN §4, §10): raiders set buildings alight; fire spreads between wooden neighbours and burns
// a building down unless townsfolk beat it out. Stone and brick buildings don't burn.

import { BUILDING_BY_ID } from '../data/buildings';
import { BURN_HOURS, EXTINGUISH_SECONDS, SPREAD_PER_HOUR } from '../data/raids';
import { skillSpeed } from '../data/skills';
import type { Rng } from '../rng';
import { buildingCentre, defOf, footprint } from './buildings';
import { notify, type Building, type GameState, type Person } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';
import { workFactor } from './townsfolk';

/** Wooden buildings burn: more wood, fiber and hide in them than stone, brick and iron. Walls don't. */
export function flammable(b: Pick<Building, 'def'>): boolean {
  const c = BUILDING_BY_ID[b.def].cost;
  const soft = (c.wood ?? 0) + (c.lumber ?? 0) + (c.fiber ?? 0) + (c.hide ?? 0) + (c.cloth ?? 0);
  const hard = (c.stone ?? 0) + (c.bricks ?? 0) + (c.clay ?? 0) + (c.iron ?? 0);
  // (a phylactery is bone and cloth: it burns, and a lich's enemies know it)
  return (soft > hard && b.def !== 'campfire') || b.def === 'phylactery';
}

export const burning = (s: GameState) => s.buildings.filter((b) => b.fire !== undefined);

/** Set a building alight. orce sets anything alight (a meteor strike), not only what burns easily. */
export function setFire(s: GameState, b: Building, force = false): boolean {
  if (b.status !== 'done' || b.fire !== undefined || (!force && !flammable(b))) return false;
  b.fire = 0.001;
  notify(s, `The ${defOf(b).name.toLowerCase()} is on fire!`, true);
  return true;
}

/** Every tick: fires burn on, may spread, and burn buildings down. */
export function updateFires(s: GameState, rng: Rng): void {
  for (const b of burning(s)) {
    b.fire! += 1 / (BURN_HOURS * TICKS_PER_HOUR);
    if (rng.chance(SPREAD_PER_HOUR / TICKS_PER_HOUR)) {
      const next = s.buildings.find((o) => o !== b && o.fire === undefined && gap(o, b) <= 1 && flammable(o) && o.status === 'done');
      if (next) setFire(s, next);
    }
    if (b.fire! >= 1) {
      s.buildings = s.buildings.filter((q) => q !== b);
      notify(s, `The ${defOf(b).name.toLowerCase()} burned down.`, true);
    }
  }
}

/** Cells between two buildings' footprints on the land (0 = touching), across and down both. */
export function gap(a: Building, b: Building): number {
  const p = footprint(a);
  const q = footprint(b);
  const dx = Math.max(0, q.x - (p.x + p.w), p.x - (q.x + q.w));
  const dy = Math.max(0, q.y - (p.y + p.h), p.y - (q.y + q.h));
  return Math.max(dx, dy);
}

/** The nearest fire to put out. */
export function fireToFight(s: GameState, p: Person): Building | null {
  let best: Building | null = null;
  const far = (b: Building) => {
    const c = buildingCentre(b);
    return Math.hypot(c.x - p.x, c.y - p.y);
  };
  for (const b of burning(s)) if (!best || far(b) < far(best)) best = b;
  return best;
}

/** One tick of beating out a fire. Returns true when it's out. */
export function fightFire(s: GameState, p: Person, b: Building): boolean {
  if (b.fire === undefined) return true;
  // a fire that has taken hold is harder to beat out
  const work = (skillSpeed(p.skills.construction.level) * workFactor(s, p)) / (EXTINGUISH_SECONDS * TICK_HZ * (1 + b.fire * 2));
  b.fire -= work;
  if (b.fire > 0) return false;
  delete b.fire;
  notify(s, `The fire at the ${defOf(b).name.toLowerCase()} is out.`);
  return true;
}
