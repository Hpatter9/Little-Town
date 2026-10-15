// The powers on the War tab's map (sim/factions.ts holds who they are and how they stand with the town; this is how
// their borders move): in the marching seasons (sim/war/state.ts `warSeason`: spring and summer) a power may march an
// army (its strength a share of its troops: the realm's own `troops`, the same count the hosts use) on a province
// beside its land: free ground is taken, a lair is cleared by a strong enough army, and a province of the town's is
// attacked when the power is at war with the town (its settlement and walls hold it, with a share of the town's
// might, more under the Defence direction; lost, it changes hands). The wars between the powers strike at each
// other's provinces through sim/war/strikes.ts. A destroyed power's provinces go free. And the win: every province
// the town's, or an ally's or a vassal's.

import { FACTION_BY_ID } from '../../data/factions';
import { FORTS } from '../../data/conquest';
import { CROSSROADS_PACE, DEFENCE_PER_TIER, DEFENCE_PER_WALL, MARCH_HOURS, MARCH_PER_CELL, RIVAL_EDGE, RIVAL_LAIR_STRENGTH, RIVAL_LOSS_PER_DEFENCE, RIVAL_MOVE_CHANCE, RIVAL_MOVE_DAYS, RIVAL_PER_PROVINCE, RIVAL_PER_TROOP, RIVAL_SATED } from '../../data/troops';
import { hashSeed, Rng } from '../../rng';
import { realm, townMight } from '../factions';
import { notify, type Faction, type GameState } from '../state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import { warSeason } from '../war/state';
import { holdings, worldOf, type ConquestState } from './conquest';
import type { ConquestWorld } from './world';

export interface RivalArmy {
  realm: string;
  from: number;
  to: number;
  arrive: number;
  strength: number;
  /** The tick it set out (for the map's march line). */
  start?: number;
}

/** A share of the town's might stands behind each of its provinces (more under Defence: walls and militia). */
export const TOWN_LAND_GUARD = 0.25;
export const DEFENCE_GUARD = 1.5;

export const rivalArmiesOf = (c: ConquestState): RivalArmy[] => (c.rivalArmies ??= []);
const factionOf = (s: GameState, id: string): Faction | undefined => realm(s).find((f) => f.id === id);
export const lairCleared = (c: ConquestState, province: number) => (c.cleared ?? []).includes(province);

/** How long a march from one province to the next takes (ticks): by the distance, quicker into a crossroads. */
export function legTicks(w: ConquestWorld, from: number, to: number): number {
  const a = w.provinces[from];
  const b = w.provinces[to];
  const hours = (MARCH_HOURS + Math.hypot(a.x - b.x, a.y - b.y) * MARCH_PER_CELL) * (b.landmark === 'crossroads' ? CROSSROADS_PACE : 1);
  return Math.round(hours * TICKS_PER_HOUR);
}

/** A province's defence: its settlement and walls, and for the town's a share of the town's might. */
export function defenceOf(s: GameState, c: ConquestState, w: ConquestWorld, province: number): number {
  const p = w.provinces[province];
  let d = p.tier * DEFENCE_PER_TIER + FORTS[p.fort].walls * DEFENCE_PER_WALL;
  if (c.holder[province] === 'town') d += townMight(s) * TOWN_LAND_GUARD * (s.direction === 'defense' ? DEFENCE_GUARD : 1);
  return d;
}

/** The powers on the map: the world's own realms and any power that has come to hold land since (a rising power's
 *  seat). */
export function powersOnMap(c: ConquestState): string[] {
  const ids = c.realmIds.slice(1);
  for (const h of c.holder) if (h && h !== 'town' && !ids.includes(h)) ids.push(h);
  return ids;
}

/** Each day: destroyed powers' land goes free; in the marching seasons each power may march into free land, or on a
 *  province of the town's when at war with it. */
export function rivalsDaily(s: GameState, c: ConquestState, w: ConquestWorld): void {
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  c.rivalMoved ??= {};
  const marching = warSeason(s) === 'march';
  for (const id of powersOnMap(c)) {
    const f = factionOf(s, id);
    if (!f) continue;
    if (f.stance === 'destroyed') {
      for (const i of holdings(c, id)) c.holder[i] = null;
      continue;
    }
    if (!marching) continue;
    if (rivalArmiesOf(c).some((a) => a.realm === id)) continue;
    if (day - (c.rivalMoved[id] ?? -RIVAL_MOVE_DAYS) < RIVAL_MOVE_DAYS) continue;
    const rng = new Rng(hashSeed(`${s.seed}:rival:${id}:${day}`));
    const held = holdings(c, id);
    if (!held.length) continue;
    if (!rng.chance((RIVAL_MOVE_CHANCE * (f.temper === 'warlike' ? 1.3 : f.temper === 'greedy' ? 1.1 : 1)) / (1 + held.length * RIVAL_SATED))) continue;
    const strength = f.troops * RIVAL_PER_TROOP + held.length * RIVAL_PER_PROVINCE;
    // what lies beside its land, and what it may take
    const picks: { from: number; to: number; worth: number }[] = [];
    for (const i of held)
      for (const n of w.provinces[i].neighbours) {
        const h = c.holder[n];
        const p = w.provinces[n];
        if (h === id) continue;
        if (p.capitalOf !== null && h !== null) continue; // (a capital is its realm's seat: the town's is the town itself; a power's falls only to a war's strike: sim/war/strikes.ts)
        if (h === null) {
          if (p.landmark === 'lair' && !lairCleared(c, n)) {
            if (strength >= RIVAL_LAIR_STRENGTH) picks.push({ from: i, to: n, worth: 2 + p.tier });
          } else picks.push({ from: i, to: n, worth: 3 + p.tier });
        } else if (h === 'town' && f.stance === 'war' && strength > defenceOf(s, c, w, n) * RIVAL_EDGE) picks.push({ from: i, to: n, worth: 4 + p.tier });
      }
    if (!picks.length) continue;
    picks.sort((a, b) => b.worth - a.worth);
    const best = picks.filter((x) => x.worth === picks[0].worth);
    const pick = best[rng.int(0, best.length - 1)];
    rivalArmiesOf(c).push({ realm: id, from: pick.from, to: pick.to, arrive: s.tick + legTicks(w, pick.from, pick.to), strength, start: s.tick });
    c.rivalMoved[id] = day;
    if (c.holder[pick.to] === 'town') notify(s, `${FACTION_BY_ID[id]?.name ?? id} march on ${w.provinces[pick.to].name}!`, true);
  }
}

/** Each tick: rival armies arriving. */
export function rivalsTick(s: GameState, c: ConquestState): void {
  const armies = c.rivalArmies;
  if (!armies?.length) return;
  const w = worldOf(s);
  if (!w) return;
  for (let i = armies.length - 1; i >= 0; i--) {
    const a = armies[i];
    if (s.tick < a.arrive) continue;
    armies.splice(i, 1);
    const f = factionOf(s, a.realm);
    const p = w.provinces[a.to];
    const name = FACTION_BY_ID[a.realm]?.name ?? a.realm;
    const h = c.holder[a.to];
    if (!f || f.stance === 'destroyed' || h === a.realm) continue;
    if (h === null) {
      // free ground, or a lair: taken (the lair cleared, at a cost in troops)
      if (p.landmark === 'lair' && !lairCleared(c, a.to)) {
        (c.cleared ??= []).push(a.to);
        f.troops = Math.max(1, Math.round(f.troops - 4));
      }
      c.holder[a.to] = a.realm;
      if (p.neighbours.some((n) => c.holder[n] === 'town')) notify(s, `${name} have taken ${p.name}, beside the town's land.`);
      continue;
    }
    const defence = defenceOf(s, c, w, a.to);
    if (a.strength > defence * RIVAL_EDGE) {
      c.holder[a.to] = a.realm;
      f.troops = Math.max(1, Math.round(f.troops - defence * RIVAL_LOSS_PER_DEFENCE * 0.5));
      if (h === 'town') notify(s, `${p.name} has fallen to ${name}.`, true);
    } else {
      f.troops = Math.max(1, Math.round(f.troops - defence * RIVAL_LOSS_PER_DEFENCE));
      if (h === 'town') notify(s, `${name}'s attack on ${p.name} is thrown back.`, true);
    }
  }
}

/** The win: every province held, by the town or a power that stands with it. */
export function checkConquestWin(s: GameState, c: ConquestState, w: ConquestWorld): boolean {
  if (s.gameOver) return false;
  const friends = new Set(realm(s).filter((f) => f.stance === 'alliance' || f.stance === 'vassal').map((f) => f.id));
  for (let i = 0; i < c.holder.length; i++) {
    const h = c.holder[i];
    if (h === null || (h !== 'town' && !friends.has(h))) return false;
  }
  const own = holdings(c, 'town').length;
  const days = Math.floor(s.tick / TICKS_PER_DAY) + 1;
  s.gameOver = {
    tick: s.tick,
    won: true,
    text: `After ${days} days every province of the world answers to the town: ${own} held outright, the rest by its allies and vassals. From a campfire to a crown: you won!`,
  };
  notify(s, 'The world is won: every province is the town\'s, or a friend\'s.', true);
  void w;
  return true;
}
