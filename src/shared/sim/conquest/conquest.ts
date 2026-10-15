// The War tab's world on the town (data/conquest.ts): which realms share it and who holds each province (the seasons
// of war move the borders: sim/war/). The world itself is made again from the seed whenever it's wanted (`worldOf`),
// so a save carries only what changes.

import { REALMS_DEFAULT, REALMS_MAX, REALMS_MIN } from '../../data/conquest';
import type { GameState } from '../state';
import { makeWorld, type ConquestWorld } from './world';

export interface ConquestState {
  /** The realms in the world, the town first ('town'), then the rival powers by faction id (sim/factions.ts). */
  realmIds: string[];
  /** Who holds each province (a realm id: the town's, a power's, a rising power's that has come to hold land), or
   *  null for a free one. */
  holder: (string | null)[];
  /** The lairs cleared (a free lair bars a march until then). */
  cleared?: number[];
  /** The powers' armies on the march over the map, and the day each last moved (sim/conquest/rivals.ts). */
  rivalArmies?: import('./rivals').RivalArmy[];
  rivalMoved?: Record<string, number>;
  /** (From the old conquest, when the town raised and marched its own troops by hand: kept for older saves, never
   *  read. The seasons of war, sim/war/, took its place.) */
  recruits?: number;
  chest?: number;
  goods?: Record<string, number>;
  troops?: Record<string, number>;
  training?: unknown[];
  squads?: unknown[];
  nextSquad?: number;
  lastDay?: number;
  armies?: unknown[];
  nextArmy?: number;
  garrisons?: unknown;
  taken?: unknown;
  battles?: unknown[];
  nextBattle?: number;
  lastBattle?: unknown;
  marches?: unknown[];
  captives?: unknown[];
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
