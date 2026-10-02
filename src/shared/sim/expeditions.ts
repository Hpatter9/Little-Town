// Expeditions (DESIGN §8): a party walks out, may fight on arrival, works the destination, and walks home
// with what it can carry (maybe ambushed on the way). While away, members are off the map: no town work,
// and they eat the food they packed. Fights and questions for the player pause the trip.

import { ENEMIES } from '../data/enemies';
import { eraReached } from '../data/eras';
import {
  CARRYING_WOUNDED_SLOWDOWN,
  CLEARED_RAID_DELAY_DAYS,
  DESTINATION_BY_ID,
  RESCUE_MAX,
  SALVAGE_NOTES_CHANCE,
  LOADED_SLOWDOWN,
  MAX_EXPEDITIONS,
  atPlace,
  MAX_PARTY,
  PORTER_CARRY,
  SCOUT_AVOID,
  STANCES,
  TRUCK_CARRY,
  TRUCK_FUEL,
  TRUCK_LOST_ON_LOSS,
  TRUCK_SPEEDUP,
  type Destination,
  type Role,
  type Stance,
} from '../data/expeditions';
import { WATERSKIN_SPEEDUP } from '../data/items';
import { HORSE_CARRY, HORSE_DIE_ON_LOSS, HORSE_HP, HORSE_HURT, HORSE_HURT_ON_RETREAT, HORSE_SPEEDUP } from '../data/trade';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { ARRIVING_TYPES, FOOD_VALUE } from '../data/people';
import { TOPIC_BY_ID, TOPICS } from '../data/research';
import { skillSpeed, type Skill } from '../data/skills';
import type { Rng } from '../rng';
import { depositNear, storages, totalStock } from './buildings';
import { isChild } from './social';
import { ammoOf, battleLoot, startBattle, stepBattle } from './combat';
import { classAllies } from './classes';
import { bossSlain } from './bosses';
import { checkBleeding, killPerson, knockDown, stabilize } from './health';
import { rollRoadEvent } from './roadEvents';
import { prereqsMet } from './research';
import { occultRevealed, revealOccult } from './occult';
import { addStock, carryCapacity, ERA_MULTIPLIER, makePerson, maxHp, notify, poolSize, type Expedition, type GameState, type Person } from './state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds, campEdgeX, drainNeeds, FOOD_PER_HOUR, gainSkill, HUNGRY, workFactor } from './townsfolk';

/** XP per unit of loot brought in, and per attack made in a fight. */
const LOOT_XP = 10;
const FIGHT_XP = 6;
/** When the whole party falls, each member's chance to crawl home alive. */
const CRAWL_HOME = 0.6;
/** Where on the way home an ambush happens, and road events on each leg. */
const AMBUSH_AT = 0.3;
const EVENT_AT = 0.5;
/** Hunts bring back game this much faster once the town has a Hunter's Lodge. */
export const HUNTERS_LODGE_BONUS = 1.4;
/** Salvage: chance of a strange tome that reveals the Occult (until it's revealed). */
const STRANGE_TOME_CHANCE = 0.35;
/** Ammunition packed per shooter. */
const AMMO_PER_SHOOTER = 10;

export function destinationUnlocked(s: GameState, d: Destination): boolean {
  if (s.cheats.unlockAll) return true;
  return eraReached(s.era, d.era) && (!d.research || s.research.done.includes(d.research));
}

/** The skill that decides how fast a member works this destination. */
function workSkill(d: Destination, p: Person): Skill {
  if (d.type === 'gather') return 'gathering';
  return p.skills.ranged.level >= p.skills.melee.level ? 'ranged' : 'melee';
}

const phaseTicks = (s: GameState, seconds: number) => Math.round(seconds * TICK_HZ * ERA_MULTIPLIER[s.era]);

/** Food (in need units) a party of `size` eats over a whole trip. */
export function foodNeeded(s: GameState, d: Destination, size: number): number {
  const hours = (phaseTicks(s, d.outSeconds) * 2 + phaseTicks(s, d.workSeconds)) / TICKS_PER_HOUR;
  return size * hours * FOOD_PER_HOUR;
}

export interface SendCheck {
  ok: boolean;
  reason?: string;
}

export function canSend(s: GameState, destId: string, memberIds: readonly number[]): SendCheck {
  const d = DESTINATION_BY_ID[destId];
  if (!d) return { ok: false, reason: 'Unknown destination' };
  if (!destinationUnlocked(s, d)) return { ok: false, reason: 'Not discovered yet' };
  if (s.expeditions.length >= MAX_EXPEDITIONS) return { ok: false, reason: `At most ${MAX_EXPEDITIONS} expeditions at once` };
  if (memberIds.length < 1) return { ok: false, reason: 'Pick someone to go' };
  if (memberIds.length > MAX_PARTY) return { ok: false, reason: `Parties are at most ${MAX_PARTY} people` };
  if (new Set(memberIds).size !== memberIds.length) return { ok: false, reason: 'Someone is listed twice' };
  for (const id of memberIds) {
    const p = s.people.find((q) => q.id === id);
    if (!p) return { ok: false, reason: 'Unknown person' };
    if (p.away !== null) return { ok: false, reason: `${p.name} is already away` };
    if (p.downed) return { ok: false, reason: `${p.name} is too badly hurt` };
    if (p.bornTick != null) return { ok: false, reason: `${p.name} is too young` };
  }
  return { ok: true };
}

/** Whether a truck can go: one at home, and fuel for the trip. */
export function truckReady(s: GameState): SendCheck {
  if ((s.items.truck ?? 0) < 1) return { ok: false, reason: 'No truck at home' };
  const fuel = storages(s).reduce((n, st) => n + (st.store.fuel ?? 0), 0);
  if (fuel < TRUCK_FUEL) return { ok: false, reason: `Needs ${TRUCK_FUEL} fuel (${fuel} stored)` };
  return { ok: true };
}

export function sendExpedition(s: GameState, destId: string, memberIds: readonly number[], roles: Record<number, Role> = {}, stance: Stance = 'balanced', horseCount = 0, truck = false): SendCheck {
  const check = canSend(s, destId, memberIds);
  if (!check.ok) return check;
  if (truck) {
    const t = truckReady(s);
    if (!t.ok) return t;
  }
  const d = DESTINATION_BY_ID[destId];
  const members = memberIds.map((id) => s.people.find((p) => p.id === id)!);

  // Drop off what they're carrying, then pack food for the trip.
  for (const p of members) {
    if (poolSize(p.carrying)) depositNear(s, p.x, p.carrying);
    p.carrying = {};
  }
  const supplies = packFood(s, foodNeeded(s, d, members.length));
  // ammunition for whoever shoots (stones for slings, arrows for bows)
  for (const p of members) {
    const kind = ammoOf(p);
    const n = kind ? takeFromStorage(s, kind, AMMO_PER_SHOOTER) : 0;
    if (n) addStock(supplies, kind!, n);
  }
  // a waterskin each speeds the walk (they come back with the party)
  const waterskins = (s.items.waterskin ?? 0) >= members.length ? members.length : 0;
  if (waterskins) s.items.waterskin -= waterskins;

  // horses (the fit ones): they carry, and a horse each speeds the walk
  const horses = s.horses.filter((h) => h.hp >= HORSE_HP / 2).slice(0, Math.max(0, horseCount));
  s.horses = s.horses.filter((h) => !horses.includes(h));
  const mounted = horses.length >= members.length;
  // a truck (burning fuel) beats any horse
  if (truck) {
    s.items.truck -= 1;
    takeFromStorage(s, 'fuel', TRUCK_FUEL);
  }
  const speed = truck ? TRUCK_SPEEDUP : (waterskins ? WATERSKIN_SPEEDUP : 1) * (mounted ? HORSE_SPEEDUP : 1);

  const out = Math.round(phaseTicks(s, d.outSeconds) * speed);
  const e: Expedition = {
    id: s.nextId++,
    dest: destId,
    members: [...memberIds],
    phase: 'out',
    elapsed: 0,
    outTicks: out,
    workTicks: phaseTicks(s, d.workSeconds),
    backTicks: out,
    work: 0,
    loot: {},
    supplies,
    recalled: false,
    roles: Object.fromEntries(memberIds.map((id) => [id, roles[id] ?? 'fighter'])),
    stance,
    battle: null,
    prompt: null,
    rolled: { outEvent: false, backEvent: false, ambush: false },
    waterskins,
    horses,
    ...(truck ? { truck: true } : {}),
  };
  s.expeditions.push(e);
  for (const p of members) {
    p.away = e.id;
    p.task = null;
    p.activity = 'walk';
    p.blocked = false;
  }
  notify(s, `${names(members)} set out for the ${d.name}.`);
  return { ok: true };
}

/** Take up to `n` of a material out of storage; returns how many were taken. */
function takeFromStorage(s: GameState, m: Material, n: number): number {
  let taken = 0;
  for (const st of storages(s)) {
    const k = Math.min(n - taken, st.store[m] ?? 0);
    if (k > 0) {
      addStock(st.store, m, -k);
      taken += k;
    }
  }
  return taken;
}

/** Take food out of storage until it covers `need`, most filling first; returns what was packed (may fall short). */
function packFood(s: GameState, need: number): Stock {
  const packed: Stock = {};
  let value = 0;
  for (const m of (Object.keys(FOOD_VALUE) as Material[]).reverse()) {
    for (const st of storages(s)) {
      while (value < need && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        addStock(packed, m, 1);
        value += FOOD_VALUE[m]!;
      }
    }
  }
  return packed;
}

/** Turn a party around. They walk back the way they came (with whatever they've found so far). */
export function recallExpedition(s: GameState, id: number): void {
  const e = s.expeditions.find((q) => q.id === id);
  if (!e || e.phase === 'back' || e.battle) return;
  startBack(s, e, e.phase === 'out' ? e.elapsed : e.outTicks);
  e.recalled = true;
}

function startBack(s: GameState, e: Expedition, walkedTicks: number): void {
  const load = poolSize(e.loot) / Math.max(1, partyCarry(s, e));
  e.phase = 'back';
  e.elapsed = 0;
  e.backTicks = Math.round(walkedTicks * (1 + LOADED_SLOWDOWN * Math.min(1, load)) * (anyDowned(s, e) ? 1 + CARRYING_WOUNDED_SLOWDOWN : 1));
}

export function partyCarry(s: GameState, e: Expedition): number {
  const people = e.members.reduce((n, id) => n + carryCapacity(s, s.people.find((p) => p.id === id)) * (e.roles[id] === 'porter' ? PORTER_CARRY : 1), 0);
  return Math.round((people + (e.horses?.length ?? 0) * HORSE_CARRY + (e.truck ? TRUCK_CARRY : 0)) * (e.stakes ? STAKES[e.stakes].carry : 1));
}

/** Expedition stakes (CLAUDE.md, "More to watch"): the one choice the player makes as a party leaves. Safe: a
 *  cautious party that packs light and keeps out of trouble; risky: a bold one that loads up and goes looking for it. */
export type Stakes = 'safe' | 'risky';
export const STAKES: Readonly<Record<Stakes, { carry: number; fights: number; stance: Stance }>> = {
  safe: { carry: 0.75, fights: 0.5, stance: 'cautious' },
  risky: { carry: 1.5, fights: 1.6, stance: 'bold' },
};
/** The town keeps at least this share of its grown-ups at home when it plans a party. */
const KEEP_HOME = 0.5;

/** The town plans a party for a destination: who goes (the fittest, best at what the trip needs, leaving enough at
 *  home), in what role, and the horses and truck it can spare. */
export function planParty(s: GameState, destId: string): { members: number[]; roles: Record<number, Role>; horses: number; truck: boolean } {
  const d = DESTINATION_BY_ID[destId];
  const able = s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && !p.sick && p.hp >= maxHp(p) * 0.6);
  const room = Math.max(1, Math.min(MAX_PARTY, d?.recommendedParty ?? 1, able.length - Math.ceil(s.people.length * KEEP_HOME)));
  const score = (p: Person) => (d?.type === 'gather' ? p.skills.gathering.level * 2 + Math.max(p.skills.melee.level, p.skills.ranged.level) : Math.max(p.skills.melee.level, p.skills.ranged.level) * 2 + p.hp / 20);
  // (the founder stays home unless there's nobody else)
  const members = [...able].sort((a, b) => Number(a.id === s.mainId) - Number(b.id === s.mainId) || score(b) - score(a)).slice(0, able.length ? room : 0);
  const roles: Record<number, Role> = {};
  const medic = members.length >= 3 ? [...members].sort((a, b) => b.skills.medicine.level - a.skills.medicine.level)[0] : undefined;
  for (const p of members) {
    if (p === medic && p.skills.medicine.level > 0) roles[p.id] = 'medic';
    else if (d?.type === 'gather' && members.length >= 2 && p === members.at(-1)) roles[p.id] = 'porter';
    else if (p.skills.ranged.level > p.skills.melee.level + 1) roles[p.id] = 'scout';
    else roles[p.id] = 'fighter';
  }
  const horses = Math.min(members.length, s.horses.filter((h) => h.hp >= HORSE_HP / 2).length);
  const truck = (s.items.truck ?? 0) > 0 && (totalStock(s).fuel ?? 0) >= TRUCK_FUEL;
  return { members: members.map((p) => p.id), roles, horses, truck };
}

/** Send a party the town planned, at the stakes the player chose. */
export function sendParty(s: GameState, destId: string, stakes: Stakes): SendCheck {
  const plan = planParty(s, destId);
  if (!plan.members.length) return { ok: false, reason: 'Nobody fit to go' };
  const r = sendExpedition(s, destId, plan.members, plan.roles, STAKES[stakes].stance, plan.horses, plan.truck);
  if (r.ok) s.expeditions[s.expeditions.length - 1].stakes = stakes;
  return r;
}

const membersOf = (s: GameState, e: Expedition) => e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
const anyDowned = (s: GameState, e: Expedition) => membersOf(s, e).some((p) => p.downed);
/** A medic who is still standing tends the fallen. */
const medicUp = (e: Expedition, members: Person[]) => members.some((p) => e.roles[p.id] === 'medic' && !p.downed);

export function updateExpeditions(s: GameState, rng: Rng): void {
  for (const e of [...s.expeditions]) {
    if (s.gameOver) return;
    const d = DESTINATION_BY_ID[e.dest];
    let members = membersOf(s, e);
    for (const p of members) {
      // On the road they rest when they can; food comes out of the packs.
      const rest = p.needs.rest;
      drainNeeds(p, false);
      p.needs.rest = rest;
      if (p.needs.food < HUNGRY) eatSupplies(e, p);
      if (p.downed && medicUp(e, members)) stabilize(p);
      checkBleeding(s, p);
    }
    if (s.gameOver) return;
    members = membersOf(s, e);
    if (!members.length) {
      s.expeditions = s.expeditions.filter((q) => q !== e);
      notify(s, `No one came back from the ${d.name}.`, true);
      continue;
    }

    // A question for the player, or a fight, holds the trip up.
    if (e.prompt !== null) continue;
    if (e.battle) {
      stepBattle(e.battle, rng, { retreatAt: STANCES[e.stance].retreatAt, mainId: members.some((p) => p.id === s.mainId) ? s.mainId : null });
      // what the bosses did, for the Journal
      if (e.battle.shouts?.length) {
        for (const t of e.battle.shouts) notify(s, `At the ${d.name}: ${t}`, true);
        e.battle.shouts = [];
      }
      if (e.battle.outcome) finishBattle(s, e, d, members, rng);
      continue;
    }

    e.elapsed++;
    switch (e.phase) {
      case 'out':
        if (!e.rolled.outEvent && e.elapsed >= e.outTicks * EVENT_AT) {
          e.rolled.outEvent = true;
          rollRoadEvent(s, e, members, rng);
        }
        if (e.elapsed >= e.outTicks) {
          e.phase = 'work';
          e.elapsed = 0;
          maybeFight(s, e, d, members, d.encounters.arrival, rng);
        }
        break;
      case 'work': {
        const cap = partyCarry(s, e);
        const lodge = d.type === 'hunt' && s.buildings.some((b) => b.def === 'hunters_lodge' && b.status === 'done') ? HUNTERS_LODGE_BONUS : 1;
        for (const p of members) {
          if (p.downed || e.roles[p.id] === 'porter') continue;
          e.work += (skillSpeed(p.skills[workSkill(d, p)].level) * workFactor(s, p) * lodge) / (d.secondsPerUnit * ERA_MULTIPLIER[s.era] * TICK_HZ);
        }
        while (e.work >= 1 && poolSize(e.loot) < cap) {
          e.work -= 1;
          addStock(e.loot, rng.weighted(d.loot as Record<Material, number>), 1);
          const workers = members.filter((p) => !p.downed);
          const worker = workers[rng.int(0, workers.length - 1)] ?? members[0];
          gainSkill(worker, workSkill(d, worker), LOOT_XP);
        }
        if (e.elapsed >= e.workTicks || poolSize(e.loot) >= cap) {
          for (const [m, n] of Object.entries(d.guaranteed ?? {}) as [Material, number][]) addStock(e.loot, m, n);
          startBack(s, e, e.outTicks);
        }
        break;
      }
      case 'back':
        if (!e.rolled.ambush && e.elapsed >= e.backTicks * AMBUSH_AT) {
          e.rolled.ambush = true;
          maybeFight(s, e, d, members, d.encounters.ambush, rng);
          if (e.battle) break;
        }
        if (!e.rolled.backEvent && e.elapsed >= e.backTicks * EVENT_AT) {
          e.rolled.backEvent = true;
          rollRoadEvent(s, e, members, rng);
        }
        if (e.elapsed >= e.backTicks) comeHome(s, e, d, members, rng);
        break;
    }
  }
}

/** Roll for a fight; a scout may spot a (non-boss) one first and lead the party around it. */
function maybeFight(s: GameState, e: Expedition, d: Destination, members: Person[], chance: number, rng: Rng): void {
  // (a risky party goes looking for trouble; a safe one keeps clear of it)
  if (!rng.chance(Math.min(1, chance * (e.stakes ? STAKES[e.stakes].fights : 1)))) return;
  const group = d.encounters.groups[pickIndex(d.encounters.groups.map((g) => g.weight), rng)].enemies;
  const boss = Object.keys(group).some((id) => ENEMIES[id].boss);
  const scout = members.find((p) => e.roles[p.id] === 'scout' && !p.downed);
  if (scout && !boss && rng.chance(SCOUT_AVOID)) {
    notify(s, `${scout.name} spotted ${describeGroup(group)} ahead, and the party slipped past.`);
    return;
  }
  e.battle = startBattle(members, e.roles, group, rng, e.supplies);
  // summoned spirits and tamed wolves join in (they act on their own first beat)
  for (const f of classAllies(members)) e.battle.fighters.push({ ...f, cooldown: f.interval });
  // an epic boss announces itself
  for (const kind of new Set(Object.keys(group))) if (ENEMIES[kind]?.kit) notify(s, `At the ${d.name}: ${ENEMIES[kind].kit!.roar}`, true);
  notify(s, `The ${d.name} party is attacked by ${describeGroup(group)}!`);
}

function finishBattle(s: GameState, e: Expedition, d: Destination, members: Person[], rng: Rng): void {
  const b = e.battle!;
  e.battle = null;
  // carry the fight's wounds back to the people (and count the stones thrown)
  for (const f of b.fighters) {
    if (f.side !== 'party' || f.kind !== 'person') continue; // (allies and the raised go back where they came from)
    if (f.ammoUsed && f.ammoType) addStock(e.supplies, f.ammoType, -f.ammoUsed);
    const p = members.find((q) => q.id === f.ref);
    if (!p) continue;
    if (f.down && !p.downed) knockDown(s, p);
    else if (!f.down) p.hp = f.hp;
    if (f.attacks) gainSkill(p, f.ranged ? 'ranged' : 'melee', f.attacks * FIGHT_XP);
    if (e.roles[p.id] === 'medic' && f.lastAction >= 0) gainSkill(p, 'medicine', FIGHT_XP * 3);
  }
  if (medicUp(e, members)) for (const p of members) if (p.downed) stabilize(p);

  switch (b.outcome) {
    case 'won': {
      // a boss slain: its trophy comes home with the party
      for (const f of b.fighters) if (f.side === 'enemy' && f.down && ENEMIES[f.kind]?.boss) bossSlain(s, f.kind);
      const drops = battleLoot(b);
      const room = partyCarry(s, e) - poolSize(e.loot);
      let taken = 0;
      for (const [m, n] of Object.entries(drops) as [Material, number][]) {
        const k = Math.min(n, room - taken);
        if (k > 0) addStock(e.loot, m, k);
        taken += Math.max(0, k);
      }
      notify(s, `The ${d.name} party won the fight${taken ? ` and took ${listStock(drops)}` : ''}.`);
      if (d.type === 'clear' && e.phase === 'work') e.cleared = true;
      break;
    }
    case 'retreated':
      for (const h of e.horses ?? []) if (rng.chance(HORSE_HURT_ON_RETREAT)) h.hp = Math.max(1, h.hp - HORSE_HURT);
      notify(s, `The ${d.name} party fell back from the fight and is heading home.`);
      if (e.phase !== 'back') startBack(s, e, e.phase === 'out' ? e.elapsed : e.outTicks);
      break;
    case 'lost': {
      // Everyone fell. The enemy leaves them for dead; each crawls home or doesn't.
      for (const p of members) {
        if (!p.downed) continue;
        if (rng.chance(CRAWL_HOME)) {
          p.downed = { bleedUntil: null };
          p.hp = 1;
        } else {
          killPerson(s, p, atPlace(d.name));
          if (s.gameOver) return;
        }
      }
      const lostHorses = (e.horses ?? []).filter(() => rng.chance(HORSE_DIE_ON_LOSS));
      if (lostHorses.length) {
        e.horses = (e.horses ?? []).filter((h) => !lostHorses.includes(h));
        notify(s, `${names(lostHorses)} ${lostHorses.length === 1 ? 'was' : 'were'} killed in the fight.`, true);
      }
      if (e.truck && rng.chance(TRUCK_LOST_ON_LOSS)) {
        e.truck = false;
        notify(s, `The truck was wrecked ${atPlace(d.name)}.`, true);
      }
      if (!membersOf(s, e).length) return; // handled next tick ("no one came back")
      notify(s, `The ${d.name} party was overrun. The survivors are crawling home.`, true);
      if (e.phase !== 'back') startBack(s, e, e.phase === 'out' ? e.elapsed : e.outTicks);
      break;
    }
  }
  // carrying someone slows the rest of the walk home
  if (e.phase === 'back' && anyDowned(s, e)) {
    const left = e.backTicks - e.elapsed;
    e.backTicks = e.elapsed + Math.round(left * (1 + CARRYING_WOUNDED_SLOWDOWN));
  }
}

function eatSupplies(e: Expedition, p: Person): void {
  const food = (Object.keys(FOOD_VALUE) as Material[]).find((m) => (e.supplies[m] ?? 0) > 0);
  if (!food) return;
  addStock(e.supplies, food, -1);
  p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[food]!);
}

function comeHome(s: GameState, e: Expedition, d: Destination, members: Person[], rng: Rng): void {
  s.expeditions = s.expeditions.filter((q) => q !== e);
  if (e.waterskins) s.items.waterskin = (s.items.waterskin ?? 0) + e.waterskins;
  if (e.horses?.length) s.horses.push(...e.horses);
  if (e.truck) s.items.truck = (s.items.truck ?? 0) + 1;
  const side = s.destSides[d.id] ?? 1;
  const x = campEdgeX(s, side);
  // Share out the loot and leftover food; they'll haul it to storage like anything else.
  const haul: Stock = { ...e.loot };
  for (const m of MATERIALS) if (e.supplies[m]) addStock(haul, m, e.supplies[m]!);
  const bearers = members.filter((p) => !p.downed);
  const each = bearers.length ? Math.ceil(poolSize(haul) / bearers.length) : 0;
  for (const [i, p] of members.entries()) {
    p.away = null;
    p.x = x - side * i * 20;
    p.dir = side > 0 ? -1 : 1;
    p.task = null;
    p.activity = 'idle';
    stabilize(p); // the camp tends anyone who made it back
    if (p.downed) continue;
    for (const m of MATERIALS) {
      const n = Math.min(haul[m] ?? 0, each - poolSize(p.carrying));
      if (n > 0) {
        addStock(p.carrying, m, n);
        addStock(haul, m, -n);
      }
    }
  }
  if (poolSize(haul)) depositNear(s, x, haul); // nobody to carry it: dropped at the nearest store
  if (!s.scouted.includes(d.id)) s.scouted.push(d.id);
  const found = listStock(e.loot);
  notify(s, `The ${d.name} party is back${e.recalled ? ' (recalled)' : ''}: ${found || 'empty-handed'}.`, true);
  if (!e.recalled) specialOutcome(s, e, d, x, rng);
  if (!e.recalled) findRelic(s, e, d, rng);
}

/** Relics (DESIGN §9 special items): rare finds on the hardest trips. */
const RELIC_ODDS: Partial<Record<Destination['type'], [string, number]>> = { legendary: ['deaths_bargain', 0.3], clear: ['deaths_bargain', 0.12], salvage: ['phoenix_feather', 0.08] };

function findRelic(s: GameState, e: Expedition, d: Destination, rng: Rng): void {
  const odds = RELIC_ODDS[d.type];
  if (!odds || (d.type === 'clear' && !e.cleared)) return;
  if (!rng.chance(odds[1])) return;
  s.items[odds[0]] = (s.items[odds[0]] ?? 0) + 1;
  notify(s, odds[0] === 'deaths_bargain' ? `At the ${d.name} the party found an old coin, cold as the grave: Death's Bargain.` : `At the ${d.name} the party found a feather that glows like embers: a Phoenix Feather!`, true);
}

/** What some kinds of trip bring back besides loot. */
function specialOutcome(s: GameState, e: Expedition, d: Destination, x: number, rng: Rng): void {
  switch (d.type) {
    case 'clear':
      if (!e.cleared) return;
      s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + CLEARED_RAID_DELAY_DAYS * TICKS_PER_DAY);
      notify(s, `With the ${d.name} broken up, the roads are quiet: no raids for ${CLEARED_RAID_DELAY_DAYS} days.`, true);
      if (s.captives.length) {
        const freed = s.captives.splice(0);
        for (const p of freed) {
          p.x = x;
          p.away = null;
          p.task = null;
          s.people.push(p);
        }
        assignBeds(s);
        notify(s, `${names(freed)} ${freed.length === 1 ? 'was' : 'were'} freed from their captors and came home!`, true);
      }
      return;
    case 'salvage': {
      if (!occultRevealed(s) && rng.chance(STRANGE_TOME_CHANCE)) {
        revealOccult(s, `Among the rubble of the ${d.name} the party found a strange, cold tome.`);
        return;
      }
      if (!rng.chance(SALVAGE_NOTES_CHANCE)) return;
      // old writings: halve what's left of the topic being researched (or the next one on offer)
      const r = s.research;
      const topic = r.queue[0] ?? TOPICS.find((t) => !r.done.includes(t.id) && prereqsMet(r, t.id, s.era, s.origin).ok)?.id;
      if (!topic) return;
      const p = r.progress[topic] ?? 0;
      r.progress[topic] = p + (1 - p) / 2;
      notify(s, `Old writings from the ${d.name}: research on ${TOPIC_BY_ID[topic].name} is half done.`, true);
      return;
    }
    case 'rescue': {
      const n = rng.int(1, RESCUE_MAX);
      const joined: Person[] = [];
      for (let i = 0; i < n; i++) {
        const type = rng.weighted(ARRIVING_TYPES);
        const p = makePerson(rng, s.nextId++, type, x, s.people.map((q) => q.name));
        s.people.push(p);
        joined.push(p);
      }
      assignBeds(s);
      notify(s, `${names(joined)} from the ${d.name} came home with the party and joined the town.`, true);
      return;
    }
  }
}

function pickIndex(weights: number[], rng: Rng): number {
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}

function describeGroup(group: Record<string, number>): string {
  return Object.entries(group)
    .map(([id, n]) => (n === 1 ? `a ${ENEMIES[id].name.toLowerCase()}` : `${n} ${ENEMIES[id].name.toLowerCase()}s`))
    .join(' and ');
}

const listStock = (st: Record<string, number | undefined>) =>
  Object.entries(st)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([m, n]) => `${n} ${m === 'totem' ? 'totem' : m}`)
    .join(', ');

const names = (ps: { name: string }[]) => (ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(', ')} and ${ps.at(-1)!.name}`);
