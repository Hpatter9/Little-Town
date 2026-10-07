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
  /** The town's recruits waiting to be trained (from the provinces it holds), its trained troops by kind, the batches
   *  training, and its squads (sim/conquest/squads.ts). */
  recruits: number;
  /** The war chest and the war stores: what the provinces yield (coins, their materials), kept apart from the town's
   *  treasury and stores so the conquest never bends the town's own economy; troops are paid from them first. */
  chest: number;
  goods: Record<string, number>;
  troops: Record<string, number>;
  training: { troop: string; n: number; done: number }[];
  squads: Squad[];
  nextSquad: number;
  /** The tick of the last daily reckoning (yields, upkeep). */
  lastDay?: number;
}

/** A hero of the town and the troops in formation round them (data/troops.ts SQUAD_SLOTS: nine places, three rows). */
export interface Squad {
  id: number;
  name: string;
  hero: number;
  /** A troop kind in each place, or null. */
  slots: (string | null)[];
  /** Fights won together (a squad's own seasoning). */
  battles: number;
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
  const c: ConquestState = { realmIds: ids, holder, recruits: 0, chest: 0, goods: {}, troops: {}, training: [], squads: [], nextSquad: 1 };
  cache.set(c, world);
  return c;
}

/** How many realms a new world has for a chosen number (the default when none is chosen). */
export const realmCount = (n: number | undefined) => Math.max(REALMS_MIN, Math.min(REALMS_MAX, Math.round(n ?? REALMS_DEFAULT)));

/** The provinces a realm holds. */
export const holdings = (c: ConquestState, realm: string): number[] => c.holder.map((h, i) => (h === realm ? i : -1)).filter((i) => i >= 0);
