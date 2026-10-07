// The rival realms on the conquest map (sim/factions.ts holds who they are and how they stand with the town; this
// is what they do on the map): each day a power may march an army (its strength a share of its troops: the realm's
// own `troops` are the same count the hosts and the Realm tab use) on a province beside its land: free ground is
// taken; a lair is cleared by a strong enough army; a province of the town's is attacked when the power is at war
// (the garrison and the walls hold it, or an army of the town's standing there; lost, it changes hands); another
// power's when the two are at feud (sim/worldLife.ts). A destroyed power's provinces go free. And the win: every
// province the town's, or an ally's or a vassal's (the owner's call: by conquest or alliance).

import { FACTION_BY_ID } from '../../data/factions';
import { FORTS } from '../../data/conquest';
import { DEFENCE_PER_TIER, DEFENCE_PER_WALL, RIVAL_EDGE, RIVAL_LAIR_STRENGTH, RIVAL_LOSS_PER_DEFENCE, RIVAL_MOVE_CHANCE, RIVAL_MOVE_DAYS, RIVAL_PER_PROVINCE, RIVAL_PER_TROOP, RIVAL_SATED, TROOP_BY_ID } from '../../data/troops';
import { hashSeed, Rng } from '../../rng';
import { realm } from '../factions';
import { notify, type Faction, type GameState } from '../state';
import { TICKS_PER_DAY } from '../time';
import { armiesOf, armyStrength, legTicks } from './armies';
import { lairCleared } from './battles';
import { holdings, worldOf, type ConquestState } from './conquest';
import { troopWorth } from './squads';
import type { ConquestWorld } from './world';

export interface RivalArmy {
  realm: string;
  from: number;
  to: number;
  arrive: number;
  strength: number;
}

export const rivalArmiesOf = (c: ConquestState): RivalArmy[] => (c.rivalArmies ??= []);
const factionOf = (s: GameState, id: string): Faction | undefined => realm(s).find((f) => f.id === id);
/** A province's defence against a rival: the town's garrison and army, else its settlement and walls. */
export function defenceOf(s: GameState, c: ConquestState, w: ConquestWorld, province: number): number {
  const p = w.provinces[province];
  let d = p.tier * DEFENCE_PER_TIER + FORTS[p.fort].walls * DEFENCE_PER_WALL;
  if (c.holder[province] === 'town') {
    for (const [k, n] of Object.entries(c.garrisons?.[province] ?? {})) d += (TROOP_BY_ID[k] ? troopWorth(TROOP_BY_ID[k]) : 1) * n;
    for (const a of armiesOf(c)) if (a.going === null && a.at === province) d += armyStrength(s, c, a);
  }
  return d;
}
const feuding = (s: GameState, a: string, b: string) => (s.feuds ?? []).some((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));

/** Each day: destroyed powers' land goes free; each power may march. */
export function rivalsDaily(s: GameState, c: ConquestState, w: ConquestWorld): void {
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  c.rivalMoved ??= {};
  for (const id of c.realmIds.slice(1)) {
    const f = factionOf(s, id);
    if (!f) continue;
    if (f.stance === 'destroyed') {
      for (const i of holdings(c, id)) c.holder[i] = null;
      continue;
    }
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
        if (p.capitalOf !== null && h !== null) continue; // (a capital is its realm's seat: the town's is the town itself, taken only by its fall; a rival's only by the town's armies)
        if (h === null) {
          if (p.landmark === 'lair' && !lairCleared(c, n)) {
            if (strength >= RIVAL_LAIR_STRENGTH) picks.push({ from: i, to: n, worth: 2 + p.tier });
          } else picks.push({ from: i, to: n, worth: 3 + p.tier });
        } else if (h === 'town') {
          if (f.stance === 'war' && strength > defenceOf(s, c, w, n) * RIVAL_EDGE) picks.push({ from: i, to: n, worth: 4 + p.tier });
        } else if (feuding(s, id, h) && strength > defenceOf(s, c, w, n) * RIVAL_EDGE) picks.push({ from: i, to: n, worth: 2 + p.tier });
      }
    if (!picks.length) continue;
    picks.sort((a, b) => b.worth - a.worth);
    const best = picks.filter((x) => x.worth === picks[0].worth);
    const pick = best[rng.int(0, best.length - 1)];
    rivalArmiesOf(c).push({ realm: id, from: pick.from, to: pick.to, arrive: s.tick + legTicks(w, pick.from, pick.to), strength });
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
      // taken
      const was = h;
      c.holder[a.to] = a.realm;
      delete c.garrisons?.[a.to];
      f.troops = Math.max(1, Math.round(f.troops - defence * RIVAL_LOSS_PER_DEFENCE * 0.5));
      if (was === 'town') {
        // an army of the town's standing there falls back
        for (const own of armiesOf(c)) if (own.going === null && own.at === a.to) {
          const back = p.neighbours.find((n) => c.holder[n] === 'town') ?? w.realms[0].capital;
          own.at = back;
          own.path = [];
        }
        notify(s, `${p.name} has fallen to ${name}.`, true);
      }
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
