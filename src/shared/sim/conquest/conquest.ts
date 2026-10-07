// The conquest's state on the town (data/conquest.ts): which realms share the world and who holds each province. The
// world itself is made again from the seed whenever it's wanted (`worldOf`), so a save carries only what changes.

import { REALMS_DEFAULT, REALMS_MAX, REALMS_MIN } from '../../data/conquest';
import type { GameState } from '../state';
import { makeWorld, type ConquestWorld } from './world';

export interface ConquestState {
  /** The realms in the world, the town first ('town'), then the rival powers by faction id (sim/factions.ts). */
  realmIds: string[];
  /** Who holds each province (a realm id), or null for a free one. */
  holder: (string | null)[];
}

const cache = new WeakMap<ConquestState, ConquestWorld>();
/** The world of a town's conquest (rebuilt from the seed and cached on the state), or null for a town without one. */
export function worldOf(s: Pick<GameState, 'seed' | 'conquest'>): ConquestWorld | null {
  const c = s.conquest;
  if (!c) return null;
  let w = cache.get(c);
  if (!w || w.seed !== s.seed) {
    w = makeWorld(s.seed, c.realmIds);
    cache.set(c, w);
  }
  return w;
}

/** The conquest as founded: the world's realms holding their starting provinces. */
export function foundConquest(seed: string, realmIds: string[]): ConquestState {
  const ids = realmIds.slice(0, Math.max(REALMS_MIN, Math.min(REALMS_MAX, realmIds.length)));
  const world = makeWorld(seed, ids);
  const holder: (string | null)[] = world.provinces.map(() => null);
  for (const r of world.realms) for (const p of r.starts) holder[p] = r.id;
  const c: ConquestState = { realmIds: ids, holder };
  cache.set(c, world);
  return c;
}

/** How many realms a new world has for a chosen number (the default when none is chosen). */
export const realmCount = (n: number | undefined) => Math.max(REALMS_MIN, Math.min(REALMS_MAX, Math.round(n ?? REALMS_DEFAULT)));

/** The provinces a realm holds. */
export const holdings = (c: ConquestState, realm: string): number[] => c.holder.map((h, i) => (h === realm ? i : -1)).filter((i) => i >= 0);
