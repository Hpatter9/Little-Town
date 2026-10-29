// Giving chase (the owner's ask: "when hunting down after a raid, there should be a way to catch them. Like they start much
// much closer and we go first"). When a raid ends with raiders who got away, the town may give chase for `CHASE_HOURS`:
// `noteFugitives` (from raids.ts `endRaid`) keeps them on `s.chaseOffer`, and the `giveChase` command raises a Raid of its
// own (`Raid.chase`) fought on the tactics board. The fugitives are wounded, still carrying their loot, and already
// running (the board's `broken`); the town's fittest fighters (`CHASE_FIGHTERS`) start `CHASE_GAP` tiles behind them and
// take the first turns. Raiders who reach the far edge are gone for good; those struck down give up their loot, which
// goes back into the stores. Only with the autopilot on. Draws nothing from the town's stream.

import type { Rng } from '../rng';
import { ENEMIES } from '../data/enemies';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { depositNear } from './buildings';
import { startTactics, stepTactics, tacticsOver } from './tactics';
import { addStock, notify, poolSize, type GameState, type Raid, type Raider } from './state';
import { TICKS_PER_HOUR } from './time';
import { fighters } from './battle';

/** How long after a raid the trail stays warm (game hours), the most that run, and the town's side of it. */
export const CHASE_HOURS = 3;
export const CHASE_RUNNERS = 8;
export const CHASE_FIGHTERS = 6;
/** Tiles between the town's front and the nearest fugitive as it begins; the raiders' column, from their far edge. */
export const CHASE_GAP = 3;
export const CHASE_AT = 6;
/** The share of its health a fugitive has at most (the running tires them). */
export const CHASE_WOUNDED = 0.7;

export interface ChaseOffer {
  tick: number;
  until: number;
  /** The raid's kind id and name, and the end of the world it came from. */
  kind: string;
  name: string;
  side: -1 | 1;
  runners: Raider[];
}

/** The raid is over (raids.ts endRaid): those who got away may be chased. */
export function noteFugitives(s: GameState, r: Raid, name: string): void {
  s.chaseOffer = undefined;
  if (s.autopilot === false || r.chase || r.turned || r.mercy === 'spared') return;
  const runners = r.raiders.filter((rd) => !rd.ally && rd.gone && !rd.down && !rd.runDown && !rd.taken).slice(0, CHASE_RUNNERS);
  if (!runners.length) return;
  s.chaseOffer = { tick: s.tick, until: s.tick + CHASE_HOURS * TICKS_PER_HOUR, kind: r.kind, name, side: r.side, runners: runners.map((rd) => ({ ...rd, carrying: { ...rd.carrying }, bt: undefined })) };
}

/** Whether the chase can be given now. */
export function canChase(s: GameState): boolean {
  const o = s.chaseOffer;
  return !!o && !s.raid && s.tick < o.until && fighters(s).length > 0;
}

/** The town's fittest standing fighters, the most health first. */
export const chasers = (s: GameState) => [...fighters(s)].sort((a, b) => b.hp - a.hp || a.id - b.id).slice(0, CHASE_FIGHTERS);

/** The command: ride out after the fugitives. */
export function giveChase(s: GameState): boolean {
  if (!canChase(s)) return false;
  const o = s.chaseOffer!;
  s.chaseOffer = undefined;
  const raiders = o.runners.map((rd) => ({ ...rd, gone: false, down: false, fleeing: true, hp: Math.max(1, Math.min(rd.hp, Math.ceil(rd.maxHp * CHASE_WOUNDED))), bt: undefined }));
  const r: Raid = { id: s.nextId++, kind: o.kind, side: o.side, phase: 'active', arrivesTick: s.tick, leavesTick: s.tick + 2 * TICKS_PER_HOUR, raiders, prompt: null, chase: true };
  s.raid = r;
  startTactics(s, r);
  return true;
}

/** Each tick of the chase (raids.ts updateRaid hands the raid over). */
export function updateChase(s: GameState, r: Raid, rng: Rng): void {
  if (!r.tactics) return void (s.raid = null);
  if (r.tactics.phase !== 'done') stepTactics(s, r, rng);
  if (r.tactics.phase !== 'done') return;
  s.raid = null;
  tacticsOver(s, r);
  const caught = r.raiders.filter((rd) => rd.down && !rd.ally);
  const loot: Stock = {};
  for (const rd of caught) {
    for (const m of MATERIALS) if (rd.carrying[m]) addStock(loot, m, rd.carrying[m]!);
    for (const [m, n] of Object.entries(ENEMIES[rd.kind].loot)) if (n) addStock(loot, m as Material, n);
  }
  const at = caught[0] ?? r.raiders[0];
  if (poolSize(loot) > 0 && at) depositNear(s, { x: Math.max(0, at.x), y: at.y }, loot);
  const took = MATERIALS.filter((m) => loot[m]).map((m) => `${loot[m]} ${m}`);
  const left = r.raiders.length - caught.length;
  notify(s, caught.length ? `The chase is over: ${caught.length} caught${left ? `, ${left} got away` : ''}.${took.length ? ` Recovered ${took.join(', ')}.` : ''}` : 'The chase is over: they got away.', true);
}
