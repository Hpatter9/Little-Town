// Armies on the conquest map (data/conquest.ts, sim/conquest/world.ts): a general's squad and up to ARMY_SQUADS more,
// raised at the town's capital province, marching by the player's order (every march is theirs: the owner's call)
// from province to neighbouring province along the shortest way through land that isn't another realm's, with a train
// of spare troops to leave as garrisons. Arriving at a free province, the army takes it for the town; a lair, or
// another realm's province, waits for the battle (the next step). A province of the town's left without a garrison
// or an army may revolt and go free. While an army is out of the home province its heroes are away from the town
// (`Person.away` is minus the army's id, as a trip's is the trip's id), and come back when it does.

import { ARMY_SQUADS, CROSSROADS_PACE, GARRISON_HOLDS, MARCH_HOURS, MARCH_PER_CELL, REVOLT_CHANCE, REVOLT_GRACE_DAYS, TROOP_BY_ID } from '../../data/troops';
import { hashSeed, Rng } from '../../rng';
import { realm } from '../factions';
import { edgeXY, notify, type GameState, type Person } from '../state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import { worldOf, type Army, type ConquestState, type Squad } from './conquest';
import { battleOfArmy, battlesTick, lairCleared, startBattle } from './battles';
import { squadStrength } from './squads';
import type { ConquestWorld } from './world';

type Result = { ok: boolean; reason?: string; army?: Army };

/** The conquest's armies (an older state is given the fields). */
export function armiesOf(c: ConquestState): Army[] {
  c.armies ??= [];
  c.nextArmy ??= 1;
  c.garrisons ??= {};
  c.taken ??= {};
  return c.armies;
}
/** The town's home province: its capital. */
export const homeProvince = (w: ConquestWorld) => w.realms[0].capital;
/** The army a squad is in, if any. */
export const armyOfSquad = (c: ConquestState, squadId: number) => armiesOf(c).find((a) => a.squads.includes(squadId)) ?? null;
/** The army a hero marches with (away from the town), if any. */
export function armyOfPerson(c: ConquestState, p: Person): Army | null {
  if (p.away === null || p.away >= 0) return null;
  return armiesOf(c).find((a) => a.id === -p.away!) ?? null;
}
const squadOf = (c: ConquestState, id: number) => c.squads.find((q) => q.id === id);
const heroOf = (s: GameState, q: Squad | undefined) => (q ? s.people.find((p) => p.id === q.hero) : undefined);
export const isHome = (w: ConquestWorld, a: Army) => a.going === null && a.at === homeProvince(w);
/** Soldiers in a garrison. */
export const garrisonSize = (c: ConquestState, province: number) => Object.values(c.garrisons?.[province] ?? {}).reduce((n, k) => n + k, 0);
export const trainSize = (a: Army) => Object.values(a.train).reduce((n, k) => n + k, 0);

/* ------------------------------------------------------------ raising */

/** Whether a squad may join an army now: it has a hero at home, fit, and stands in no other army. */
export function squadFree(s: GameState, c: ConquestState, q: Squad): { ok: boolean; why?: string } {
  const hero = heroOf(s, q);
  if (!hero) return { ok: false, why: 'has no hero' };
  if (armyOfSquad(c, q.id)) return { ok: false, why: 'is in an army already' };
  if (hero.away !== null) return { ok: false, why: `${hero.name} is away` };
  if (hero.downed) return { ok: false, why: `${hero.name} is down` };
  return { ok: true };
}
/** Raise an army at home round a general's squad. */
export function raiseArmy(s: GameState, squadId: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const q = c ? squadOf(c, squadId) : undefined;
  if (!c || !w || !q) return { ok: false, reason: 'No such squad' };
  const free = squadFree(s, c, q);
  if (!free.ok) return { ok: false, reason: `${q.name} ${free.why}` };
  const hero = heroOf(s, q)!;
  const army: Army = { id: c.nextArmy!, name: `${hero.name}'s Army`, general: q.id, squads: [q.id], at: homeProvince(w), going: null, arrive: null, path: [], train: {} };
  c.nextArmy!++;
  armiesOf(c).push(army);
  return { ok: true, army };
}
export function addToArmy(s: GameState, armyId: number, squadId: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  const q = c ? squadOf(c, squadId) : undefined;
  if (!c || !w || !a || !q) return { ok: false, reason: 'No such army or squad' };
  if (!isHome(w, a)) return { ok: false, reason: `${a.name} is afield: squads join at home` };
  const free = squadFree(s, c, q);
  if (!free.ok) return { ok: false, reason: `${q.name} ${free.why}` };
  if (a.squads.length >= ARMY_SQUADS) return { ok: false, reason: `${a.name} has its ${ARMY_SQUADS} squads` };
  a.squads.push(q.id);
  return { ok: true, army: a };
}
export function dropFromArmy(s: GameState, armyId: number, squadId: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  if (!c || !w || !a) return { ok: false, reason: 'No such army' };
  if (!isHome(w, a)) return { ok: false, reason: `${a.name} is afield: squads leave it at home` };
  if (squadId === a.general) return { ok: false, reason: 'The general stays; dismiss the army instead' };
  a.squads = a.squads.filter((x) => x !== squadId);
  return { ok: true, army: a };
}
/** Load spare trained troops into the army's train (at home), to leave as garrisons. */
export function loadTrain(s: GameState, armyId: number, troopId: string, n: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  if (!c || !w || !a) return { ok: false, reason: 'No such army' };
  if (!isHome(w, a)) return { ok: false, reason: `${a.name} is afield: troops join at home` };
  if (!TROOP_BY_ID[troopId]) return { ok: false, reason: 'No such troops' };
  n = Math.min(Math.max(1, Math.floor(n)), c.troops[troopId] ?? 0);
  if (n < 1) return { ok: false, reason: `No ${TROOP_BY_ID[troopId].name.toLowerCase()} trained` };
  c.troops[troopId]! -= n;
  a.train[troopId] = (a.train[troopId] ?? 0) + n;
  return { ok: true, army: a };
}
/** Dismiss an army at home: its squads are free again and its train goes back to the troops. */
export function dismissArmy(s: GameState, armyId: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const i = c ? armiesOf(c).findIndex((x) => x.id === armyId) : -1;
  if (!c || !w || i < 0) return { ok: false, reason: 'No such army' };
  const a = c.armies![i];
  if (!isHome(w, a)) return { ok: false, reason: `${a.name} is afield: recall it first` };
  for (const [k, n] of Object.entries(a.train)) c.troops[k] = (c.troops[k] ?? 0) + n;
  c.armies!.splice(i, 1);
  return { ok: true };
}

/* ------------------------------------------------------------ marching */

/** The way from one province to another through land that isn't another realm's (the town's, free, or the
 *  destination itself), the fewest legs; null when there's none. */
export function wayTo(w: ConquestWorld, c: ConquestState, from: number, to: number): number[] | null {
  if (from === to) return [];
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const n of w.provinces[p].neighbours) {
      if (prev.has(n)) continue;
      const h = c.holder[n];
      if (n !== to && h !== null && h !== 'town') continue;
      if (n !== to && h === null && w.provinces[n].landmark === 'lair' && !lairCleared(c, n)) continue; // (a lair bars the way till cleared)
      prev.set(n, p);
      if (n === to) {
        const path: number[] = [];
        for (let x = n; x !== from; x = prev.get(x)!) path.unshift(x);
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}
/** A leg's length in ticks: by how far apart the provinces' middles lie, quicker into a crossroads. */
export function legTicks(w: ConquestWorld, from: number, to: number): number {
  const a = w.provinces[from];
  const b = w.provinces[to];
  const hours = (MARCH_HOURS + Math.hypot(a.x - b.x, a.y - b.y) * MARCH_PER_CELL) * (b.landmark === 'crossroads' ? CROSSROADS_PACE : 1);
  return Math.round(hours * TICKS_PER_HOUR);
}
/** Order an army to a province: it marches there leg by leg (a new order while marching finishes the leg first). */
export function marchArmy(s: GameState, armyId: number, to: number): Result {
  const c = s.conquest;
  const w = worldOf(s);
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  if (!c || !w || !a) return { ok: false, reason: 'No such army' };
  if (to < 0 || to >= w.provinces.length) return { ok: false, reason: 'No such province' };
  if (battleOfArmy(c, a.id)) return { ok: false, reason: `${a.name} is in battle` };
  const h = c.holder[to];
  if (h !== null && h !== 'town') {
    const f = realm(s).find((x) => x.id === h);
    if (f && (f.stance === 'alliance' || f.stance === 'vassal')) return { ok: false, reason: `${w.provinces[to].name} is a friend's: ${f.stance === 'vassal' ? 'a vassal\'s' : 'an ally\'s'} land` };
  }
  const from = a.going ?? a.at;
  const way = wayTo(w, c, from, to);
  if (!way) return { ok: false, reason: `No way to ${w.provinces[to].name} through friendly land` };
  if (!way.length) {
    a.path = [];
    return { ok: true, army: a };
  }
  if (a.going !== null) {
    // finish the leg under way, then the rest
    a.path = way;
    return { ok: true, army: a };
  }
  startLeg(s, w, a, way);
  return { ok: true, army: a };
}
function startLeg(s: GameState, w: ConquestWorld, a: Army, way: number[]): void {
  const next = way[0];
  a.path = way.slice(1);
  a.going = next;
  a.arrive = s.tick + legTicks(w, a.at, next);
  if (a.at === homeProvince(w)) setOut(s, a);
}
/** Order an army home by the shortest friendly way. */
export const recallArmy = (s: GameState, armyId: number): Result => {
  const w = worldOf(s);
  return w ? marchArmy(s, armyId, homeProvince(w)) : { ok: false, reason: 'No world' };
};
/** The heroes leave the town with the army. */
function setOut(s: GameState, a: Army): void {
  const c = s.conquest!;
  const names: string[] = [];
  for (const id of a.squads) {
    const hero = heroOf(s, squadOf(c, id));
    if (!hero || hero.away !== null) continue;
    hero.away = -a.id;
    hero.task = null;
    hero.activity = 'walk';
    hero.blocked = false;
    names.push(hero.name);
  }
  if (names.length) notify(s, `${a.name} marches out: ${names.join(', ')} at its head.`);
}
/** The heroes come home with the army. */
function comeBack(s: GameState, a: Army): void {
  const at = edgeXY(s, 1);
  let i = 0;
  for (const p of s.people) {
    if (p.away !== -a.id) continue;
    p.away = null;
    p.homeAt = s.tick;
    p.x = at.x - i++ * 20;
    p.y = at.y;
    p.dir = -1;
    p.task = null;
    p.activity = 'idle';
  }
}

/* ------------------------------------------------------------ garrisons */

/** Leave `n` soldiers of the army's train in the province it stands in. */
export function garrison(s: GameState, armyId: number, n: number): Result {
  const c = s.conquest;
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  if (!c || !a) return { ok: false, reason: 'No such army' };
  if (a.going !== null) return { ok: false, reason: `${a.name} is on the march` };
  if (c.holder[a.at] !== 'town') return { ok: false, reason: 'Only a province of the town\'s is garrisoned' };
  let left = Math.max(1, Math.floor(n));
  const g = (c.garrisons![a.at] ??= {});
  for (const k of Object.keys(a.train)) {
    const take = Math.min(left, a.train[k]);
    if (take <= 0) continue;
    a.train[k] -= take;
    if (!a.train[k]) delete a.train[k];
    g[k] = (g[k] ?? 0) + take;
    left -= take;
    if (!left) break;
  }
  if (left === Math.max(1, Math.floor(n))) return { ok: false, reason: `${a.name} has no spare troops in its train` };
  return { ok: true, army: a };
}
/** Take the garrison where the army stands into its train. */
export function pickUp(s: GameState, armyId: number): Result {
  const c = s.conquest;
  const a = c ? armiesOf(c).find((x) => x.id === armyId) : undefined;
  if (!c || !a) return { ok: false, reason: 'No such army' };
  if (a.going !== null) return { ok: false, reason: `${a.name} is on the march` };
  const g = c.garrisons![a.at];
  if (!g || !garrisonSize(c, a.at)) return { ok: false, reason: 'No garrison here' };
  for (const [k, n] of Object.entries(g)) a.train[k] = (a.train[k] ?? 0) + n;
  delete c.garrisons![a.at];
  return { ok: true, army: a };
}

/* ------------------------------------------------------------ the hours and the days */

/** Each tick: armies arriving. Free ground is taken; a lair or another realm's land waits for the battle (the next
 *  step). Squads whose hero is gone dissolve, and an army with no squads left. */
export function armiesTick(s: GameState): void {
  const c = s.conquest;
  if (!c?.armies?.length) return;
  const w = worldOf(s);
  if (!w) return;
  battlesTick(s, c);
  for (let i = c.armies.length - 1; i >= 0; i--) {
    const a = c.armies[i];
    // the dead leave the ranks
    a.squads = a.squads.filter((id) => heroOf(s, squadOf(c, id)));
    if (!a.squads.length) {
      for (const [k, n] of Object.entries(a.train)) c.troops[k] = (c.troops[k] ?? 0) + n;
      notify(s, `${a.name}, without a hero left to lead it, breaks up.`);
      c.armies.splice(i, 1);
      continue;
    }
    if (!a.squads.includes(a.general)) a.general = a.squads[0];
    if (a.going === null || a.arrive === null || s.tick < a.arrive) continue;
    arrive(s, w, c, a);
  }
}
function arrive(s: GameState, w: ConquestWorld, c: ConquestState, a: Army): void {
  const p = w.provinces[a.going!];
  a.at = p.id;
  a.going = null;
  a.arrive = null;
  const holder = c.holder[p.id];
  if (holder === null && p.landmark !== 'lair') {
    c.holder[p.id] = 'town';
    c.taken![p.id] = Math.floor(s.tick / TICKS_PER_DAY);
    notify(s, `${a.name} takes ${p.name} for the town.`, true);
  } else if (holder !== 'town') {
    // a lair, or another realm's: the battle (sim/conquest/battles.ts)
    a.path = [];
    startBattle(s, c, a, p.id);
    return;
  }
  if (a.at === homeProvince(w)) {
    comeBack(s, a);
    a.path = [];
    notify(s, `${a.name} is home.`);
    return;
  }
  if (a.path.length) {
    // an enemy now holds the next leg: the march stops here
    const next = a.path[0];
    const h = c.holder[next];
    if (h !== null && h !== 'town' && a.path.length > 1) {
      a.path = [];
      notify(s, `${a.name} halts at ${p.name}: the way on is held against it.`);
      return;
    }
    startLeg(s, w, a, a.path);
  }
}

/** Each day: soldiers afield cost more, and a province of the town's left bare may revolt. */
export function armiesDaily(s: GameState, c: ConquestState, w: ConquestWorld): { afield: number } {
  const armies = armiesOf(c);
  let afield = 0;
  for (const a of armies) {
    const at = a.going ?? a.at;
    if (c.holder[at] === 'town') continue;
    for (const id of a.squads) {
      const q = squadOf(c, id);
      if (q) afield += q.slots.filter((x) => x).length;
    }
    afield += trainSize(a);
  }
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const home = homeProvince(w);
  for (let i = 0; i < c.holder.length; i++) {
    if (c.holder[i] !== 'town' || i === home) continue;
    if (day - (c.taken![i] ?? 0) < REVOLT_GRACE_DAYS) continue;
    if (garrisonSize(c, i) >= GARRISON_HOLDS || armies.some((a) => a.going === null && a.at === i)) continue;
    const rng = new Rng(hashSeed(`${s.seed}:revolt:${i}:${day}`));
    if (rng.next() < REVOLT_CHANCE) {
      c.holder[i] = null;
      delete c.garrisons![i];
      notify(s, `${w.provinces[i].name}, left ungarrisoned, rises and throws off the town's rule.`, true);
    }
  }
  return { afield };
}

/** An army's worth in a clash: its squads together. */
export function armyStrength(s: GameState, c: ConquestState, a: Army): number {
  let n = 0;
  for (const id of a.squads) {
    const q = squadOf(c, id);
    if (q) n += squadStrength(s, q);
  }
  return Math.round(n * 10) / 10;
}
