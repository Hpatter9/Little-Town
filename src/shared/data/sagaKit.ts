// The sagas' shorthands (data/sagas.ts and the sagas of sagas2.ts and sagas3.ts): the events' effects, written out
// here (data/eventKit.ts can't be loaded this early without a cycle), and what a saga asks of the town.

import type { EventEffect, Lever } from './eventKit';
import type { Skill } from './skills';
import type { Stock } from './materials';
import type { Era } from './eras';
import type { GameState } from '../sim/state';
import { calendar } from '../sim/time';

export const mood = (mood: number, hours: number, text: string): EventEffect => ({ mood, hours, text });
export const mod = (lever: Lever, mult: number, hours: number, text: string): EventEffect => ({ mod: lever, mult, hours, text });
export const gain = (stock: Stock): EventEffect => ({ gain: stock });
export const teach = (skill: Skill, levels: number, on: 'who' | 'random' | 'founder' | 'all' = 'who'): EventEffect => ({ skill, levels, on });
export const coin = (n: number): EventEffect => ({ coins: n });
export const rep = (n: number): EventEffect => ({ reputation: n });
export const calm = (h: number): EventEffect => ({ calm: h });
export const raidIn = (h: number): EventEffect => ({ raid: h });

export const has = (s: GameState, ...ids: string[]) => s.buildings.some((b) => ids.includes(b.def) && b.status === 'done');
export const eraAt = (s: GameState, e: Era) => ['neolithic', 'medieval', 'industrial', 'modern', 'space'].indexOf(s.era) >= ['neolithic', 'medieval', 'industrial', 'modern', 'space'].indexOf(e);
export const grown = (s: GameState, n: number) => s.people.filter((p) => p.bornTick == null).length >= n;
export const dayOf = (s: GameState) => s.tick / (600 * 24);
export const byEra = (t: Partial<Record<Era, Record<string, number>>>) => (s: GameState) => t[s.era] ?? t.medieval ?? Object.values(t)[0]!;
/** A wound to someone at random (`hp` of their health), someone's death at this chance, a share of the town falling
 *  sick, and newcomers. */
export const wound = (hp: number): EventEffect => ({ wound: 'random', hp });
export const death = (chance: number, cause: string): EventEffect => ({ kill: 'random', chance, cause });
export const sickly = (share: number): EventEffect => ({ sickShare: share });
export const joins = (n: number, type?: string): EventEffect => (type ? { join: n, type } : { join: n });
export const takes = (what: 'food' | 'stores' | 'coins', share: number): EventEffect => ({ take: what, share });
export const learns = (n: number): EventEffect => ({ learn: n });
/** The town has learned this. */
export const knows = (s: GameState, topic: string) => s.research.done.includes(topic);
/** The town's land. */
export const land = (s: GameState, ...biomes: string[]) => biomes.includes(s.biome ?? 'forest');
/** It is winter in the town. */
export const winter = (s: GameState) => calendar(s.tick).season === 'winter';
