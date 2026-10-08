// Leisure (the owner's ask: things for the townsfolk to do, to lift their spirits). The places built for fun
// (data/recreation.ts `LEISURE`: the village green, a quoits pitch, a sparring yard, a jetty, a garden, a bandstand;
// the theatre, bathhouse and cinema too) are used: someone whose spirits are low takes a break there before the day's
// work, and anyone with nothing to do goes there rather than wander, by day, where a spot is free, never more than a
// share of the grown-ups at once (the `relax` task in people.ts). A visit lifts the spirits at once and for a day after
// (`Person.fun`, in mood()); a bout in the yard teaches a little of the blade, an hour on the jetty may bring a fish
// home. Children play on the green and the pitch.

import { LEISURE, type LeisureDef } from '../data/recreation';
import type { Rng } from '../rng';
import { buildingCentre, footprint } from './buildings';
import { attending } from './ceremonies';
import { CELL, type Pt } from './land';
import { drinking } from './nightOut';
import { busyNow, onShift } from './people';
import { isChild } from './social';
import { addStock, remember, type Building, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { gainSkill, HUNGRY } from './townsfolk';

/** Spirits under this take a break before their work; a break is never sooner than this many hours after the last
 *  (shorter for someone with nothing else to do), by day, and never more than this share of the grown-ups at once. */
export const RELAX_BELOW = 55;
export const RELAX_GAP_HOURS = 10;
export const RELAX_IDLE_GAP_HOURS = 3;
export const RELAX_SHARE = 0.34;
export const RELAX_FROM = 7;
export const RELAX_UNTIL = 21;
/** How long the lift of a break stays as a reason in the mood; the yard's lesson; the jetty's odds of a fish. */
export const FUN_LASTS_HOURS = 24;
export const SPAR_XP = 2;
export const CATCH_CHANCE = 0.4;

/** What is done at a building, if it is a place of leisure standing. */
export const leisureAt = (b: Building): LeisureDef | undefined => (b.status === 'done' ? LEISURE[b.def] : undefined);
/** Who is taking a break there. */
export const relaxersAt = (s: GameState, b: Building): number => s.people.filter((p) => p.task?.type === 'relax' && p.task.building === b.id).length;

/** The place of leisure someone would go to now, if any: the nearest with a spot free (children where children play),
 *  by day, when they're fed and rested, free of the town's business, and (unless `idle`: nothing else to do) their
 *  spirits are low; not within the gap of their last break, nor past the share of the town that may be at play. */
export function wantsRelax(s: GameState, p: Person, idle: boolean): Building | null {
  if (s.raid || p.away !== null || p.downed || p.sick || p.machine) return null;
  if (p.needs.food < HUNGRY || p.needs.rest < 0.3) return null;
  const hour = calendar(s.tick).hour;
  if (hour < RELAX_FROM || hour >= RELAX_UNTIL) return null;
  if (!idle && p.morale >= RELAX_BELOW) return null;
  const gap = (idle ? RELAX_IDLE_GAP_HOURS : RELAX_GAP_HOURS) * TICKS_PER_HOUR;
  if (p.relaxedAt !== undefined && s.tick - p.relaxedAt < gap) return null;
  if (busyNow(s, p) || attending(s, p) || drinking(s, p) || (p.guard && onShift(s, p))) return null;
  const child = isChild(p);
  if (!child) {
    const grown = s.people.filter((q) => q.away === null && !isChild(q)).length;
    const relaxing = s.people.filter((q) => q !== p && q.task?.type === 'relax' && !isChild(q)).length;
    if (relaxing >= Math.max(1, Math.ceil(grown * RELAX_SHARE))) return null;
  }
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of s.buildings) {
    const def = leisureAt(b);
    if (!def || (child && !def.children) || relaxersAt(s, b) >= def.spots) continue;
    const c = buildingCentre(b);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

/** How long a visit lasts, in ticks. */
export const relaxTicks = (b: Building): number => Math.round((LEISURE[b.def]?.hours ?? 1) * TICKS_PER_HOUR);

/** A spot on the place's ground for the i-th visitor (by their id): the cells of its footprint in turn, each a little
 *  off its middle. */
export function relaxSpot(b: Building, i: number): Pt {
  const f = footprint(b);
  const n = Math.max(1, f.w * f.h);
  const k = ((i % n) + n) % n;
  return { x: (f.x + (k % f.w) + 0.5) * CELL + ((i * 7) % 11) - 5, y: (f.y + Math.floor(k / f.w) + 0.5) * CELL + ((i * 5) % 9) - 4 };
}

/** The break is over: spirits lifted now and for a day, the yard's lesson learned, the jetty's catch landed. */
export function finishRelax(s: GameState, p: Person, b: Building, def: LeisureDef, rng: Rng): void {
  p.morale = Math.min(100, p.morale + def.fun);
  p.fun = { text: def.text, value: Math.round(def.fun / 2), until: s.tick + FUN_LASTS_HOURS * TICKS_PER_HOUR };
  p.relaxedAt = s.tick;
  remember(s, p, def.text);
  if (def.activity === 'spar') gainSkill(p, 'melee', SPAR_XP);
  if (def.activity === 'fish' && rng.chance(CATCH_CHANCE)) {
    const store = s.buildings.find((q) => q.def === 'campfire' && q.status === 'done') ?? s.buildings.find((q) => q.status === 'done');
    if (store) {
      addStock(store.store, 'fish', 1);
      remember(s, p, 'A fish off the jetty, for the pot');
    }
  }
  void b;
}
