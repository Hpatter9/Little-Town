// Playing the founder: the player steers the founder (the person `s.mainId`) with a few orders. Go to a building, work
// a job for the day, rest at home, give coins to the town, and name an heir. The orders are commands (sim/commands.ts);
// the founder's task choice reads `s.founderOrder` (sim/people.ts `founderTask`). Everyone else lives on their own.

import { JOBS, type Job } from '../data/people';
import { settleShops } from './founderShops';
import { isChild } from './social';
import { maxHp, notify, type GameState, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** What the founder has been told to do, if anything. A walk ends when they arrive; a job lasts the day; a rest lasts
 *  `REST_HOURS`. */
export type FounderOrder = { kind: 'go'; building: number } | { kind: 'work'; job: Job; until: number } | { kind: 'rest'; until: number };

/** The steps the founder's gifts to the town come in. */
export const GIVE_STEPS = [5, 20, 50] as const;
/** A rest: how long, and what each hour of it mends (a share of full health, and morale points). */
export const REST_HOURS = 6;
const REST_HEAL = 0.06;
const REST_MORALE = 3;

export const founderOf = (s: GameState): Person | undefined => s.people.find((p) => p.id === s.mainId);

/** Is the person a grown-up who could be named heir (alive, in town or away, not the founder)? */
export const canBeHeir = (s: GameState, p: Person): boolean => p.id !== s.mainId && !isChild(p) && !p.monster;

/** Tell the founder to walk to a building. */
export function founderGo(s: GameState, building: number): void {
  const f = founderOf(s);
  const b = s.buildings.find((x) => x.id === building && x.status === 'done');
  if (!f || !b || f.away !== null || f.downed) return;
  s.founderOrder = { kind: 'go', building };
  f.task = null;
}

/** Tell the founder to work a job for the day (null: back to the town's choice). Their own priority for it is raised. */
export function founderWork(s: GameState, job: Job | null): void {
  const f = founderOf(s);
  if (!f) return;
  if (job === null || !JOBS.includes(job)) {
    if (s.founderOrder?.kind === 'work') s.founderOrder = undefined;
    return;
  }
  s.founderOrder = { kind: 'work', job, until: s.tick + TICKS_PER_DAY };
  f.task = null;
}

/** Send the founder home to rest. */
export function founderRest(s: GameState): void {
  const f = founderOf(s);
  if (!f || f.away !== null) return;
  s.founderOrder = { kind: 'rest', until: s.tick + REST_HOURS * TICKS_PER_HOUR };
  f.task = null;
}

/** Move coins from the founder's purse to the town's treasury. */
export function founderGive(s: GameState, amount: number): void {
  const f = founderOf(s);
  if (!f || !Number.isInteger(amount) || amount <= 0) return;
  const give = Math.min(amount, Math.floor(f.coins ?? 0));
  if (give <= 0) return;
  f.coins = (f.coins ?? 0) - give;
  s.coins = (s.coins ?? 0) + give;
  notify(s, `${f.name} gives ${give} coin${give === 1 ? '' : 's'} to the town.`);
}

/** Name the founder's heir (a grown-up), or clear the choice with null. */
export function founderHeir(s: GameState, id: number | null): void {
  if (id === null) {
    s.heirId = undefined;
    return;
  }
  const p = s.people.find((q) => q.id === id);
  if (!p || !canBeHeir(s, p)) return;
  s.heirId = p.id;
  notify(s, `${p.name} is named the heir.`, true);
}

/** Once an hour of a rest: the founder mends a little and their spirits lift. Called from the step. */
export function founderTick(s: GameState): void {
  settleShops(s);
  const o = s.founderOrder;
  const f = founderOf(s);
  if (!o || !f) return;
  if (o.kind !== 'go' && s.tick >= o.until) {
    s.founderOrder = undefined;
    return;
  }
  if (o.kind === 'rest' && s.tick % TICKS_PER_HOUR === 0 && f.task?.type === 'sleep' && f.activity === 'sleep') {
    f.hp = Math.min(maxHp(f), f.hp + maxHp(f) * REST_HEAL);
    f.morale = Math.min(100, f.morale + REST_MORALE);
  }
}
