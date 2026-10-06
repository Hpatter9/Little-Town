// Expeditions (DESIGN §8): a party walks out, may fight on arrival, works the destination, and walks home
// with what it can carry (maybe ambushed on the way). While away, members are off the map: no town work,
// and they eat the food they packed. Fights and questions for the player pause the trip.

import { assaultDestination, assaultOver, assaultTargets, isAssaultDest, leviesFor, planAssault } from './factions';
import { ASSAULT_MOST } from '../data/factions';
import { boatDef, boatHome, fleet, freeBoat, sailSpeed, sailsTo, seaHour } from './boats';
import { payParty } from './economy';
import { homeFromTrip } from './ambition';
import { payBounty } from './parties';
import { woundFor, woundPerson } from './injuries';
import { levelOf, xpToLevel } from '../data/levels';
import { crossroads, debrief } from './muster';
import { ENEMIES } from '../data/enemies';
import { eraReached } from '../data/eras';
import { HIDDEN_IN, HOME_REGION, REGION_BY_ID, regionScouted } from '../data/regions';
import {
  CARRYING_WOUNDED_SLOWDOWN,
  CLEARED_RAID_DELAY_DAYS,
  DESTINATION_BY_ID,
  DESTINATIONS,
  MAX_DELVERS,
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
  the,
  The,
} from '../data/expeditions';
import { WATERSKIN_SPEEDUP } from '../data/items';
import { HORSE_CARRY, HORSE_DIE_ON_LOSS, HORSE_HP, HORSE_HURT, HORSE_HURT_ON_RETREAT, HORSE_SPEEDUP } from '../data/trade';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { ARRIVING_TYPES, FOOD_VALUE } from '../data/people';
import { TOPIC_BY_ID, TOPICS } from '../data/research';
import { skillSpeed, type Skill } from '../data/skills';
import { hashSeed, Rng } from '../rng';
import { depositNear, storages, totalStock } from './buildings';
import { isChild } from './social';
import { ammoOf, battleLoot, startBattle, stepBattle, unitFighter, type Battle } from './combat';
import { classAllies } from './classes';
import { bossSlain } from './bosses';
import { delveHome, quietHours, startDelve, stepDelve } from './delves';
import { joinTown, questsDone } from './quests';
import { checkBleeding, killPerson, knockDown, stabilize } from './health';
import { rollRoadEvent } from './roadEvents';
import { prereqsMet } from './research';
import { occultRevealed, revealOccult } from './occult';
import type { Pt } from './land';
import { isPlaceDest } from '../data/places';
import { TRADE_HIDDEN } from '../data/minerals';
import { placeCleared, placeDestination, placeOfDest } from './places';
import { isSagaDest, sagaDestOf, sagaTripHome } from './sagas';
import { huntDestOf, huntHome, isHuntDest } from './hunts';
import { HUNT_DEST, HUNT_PARTY, isPackDest } from '../data/pack';
import { packDestinationOf, packDestUnlocked, packHome } from './pack';
import { tireless, townFull, addStock, carryCapacity, earn, ERA_MULTIPLIER, makePerson, maxHp, meet, notify, poolSize, type Expedition, type FightResult, type GameState, type Person } from './state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds, campEdge, drainNeeds, FOOD_PER_HOUR, gainSkill, HUNGRY, workFactor } from './townsfolk';

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

/** A destination by id: the world's, or one of the places on the town's own land (sim/places.ts). */
export function destinationOf(s: GameState, id: string): Destination | undefined {
  if (isPlaceDest(id)) {
    const p = placeOfDest(s, id);
    return p ? placeDestination(s, p) : undefined;
  }
  if (isPackDest(id) || id === HUNT_DEST) return packDestinationOf(s, id);
  if (isSagaDest(id)) return sagaDestOf(s, id);
  if (isHuntDest(id)) return huntDestOf(s, id);
  if (isAssaultDest(id)) return assaultDestination(s, id);
  return DESTINATION_BY_ID[id];
}

export function destinationUnlocked(s: GameState, d: Destination): boolean {
  // (the Moon Pack's hunt, and the rival packs' lairs while they stand)
  if (isPackDest(d.id) || d.id === HUNT_DEST) return packDestUnlocked(s, d.id);
  // (a saga's place: while the saga waits on a party there)
  if (isSagaDest(d.id)) return !!sagaDestOf(s, d.id);
  // (a hunt on the guild's board)
  if (isHuntDest(d.id)) return !!huntDestOf(s, d.id);
  // (an assault: on a power at war, or a dungeon on the board)
  if (isAssaultDest(d.id)) return assaultTargets(s, (id) => !destinationHidden(s, id) && !!DESTINATION_BY_ID[id] && destinationUnlocked(s, DESTINATION_BY_ID[id])).includes(d.id);
  // (a place on the town's land: while it's found and waiting)
  if (isPlaceDest(d.id)) {
    const p = placeOfDest(s, d.id);
    return !!p && p.found !== null && p.state === 'waiting';
  }
  // (a dungeon lies quiet a while after it's cleared)
  if (d.type === 'delve' && quietHours(s, d.id) > 0) return false;
  if (s.cheats.unlockAll) return !destinationHidden(s, d.id);
  return !destinationHidden(s, d.id) && eraReached(s.era, d.era) && (!d.research || s.research.done.includes(d.research));
}

/** Whether a region of the world map has been mapped (home always has). */
export const regionKnown = (s: GameState, region: string) => region === HOME_REGION || (s.regions ?? []).includes(region);
/** Whether a destination is off the board: a place in a region not yet mapped, or a region's scouting trip once it's
 *  mapped. */
export function destinationHidden(s: GameState, id: string): boolean {
  const scouts = regionScouted(id);
  if (scouts) return regionKnown(s, scouts);
  const region = HIDDEN_IN[id] ?? TRADE_HIDDEN[id];
  return !!region && !regionKnown(s, region);
}

/** A scouting party is home: their region is on the map now, and whatever was hidden there with it. */
function mapRegion(s: GameState, region: string): void {
  if (regionKnown(s, region)) return;
  (s.regions ??= []).push(region);
  const found = DESTINATIONS.filter((d) => (HIDDEN_IN[d.id] ?? TRADE_HIDDEN[d.id]) === region).map((d) => d.name);
  const r = REGION_BY_ID[region];
  notify(s, `The scouts have mapped ${r.name.replace(/^The /, 'the ')}${found.length ? `, and found ${found.length > 1 ? `${found.slice(0, -1).join(', ')} and ${found.at(-1)}` : found[0]}` : ''}.`, true);
}

/** The skill that decides how fast a member works this destination. */
function workSkill(d: Destination, p: Person): Skill {
  if (d.type === 'gather') return 'gathering';
  if (d.type === 'trade') return 'social';
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
  const d = destinationOf(s, destId);
  if (!d) return { ok: false, reason: 'Unknown destination' };
  if (!destinationUnlocked(s, d)) return { ok: false, reason: 'Not discovered yet' };
  if (s.expeditions.length >= MAX_EXPEDITIONS) return { ok: false, reason: `At most ${MAX_EXPEDITIONS} expeditions at once` };
  if (memberIds.length < 1) return { ok: false, reason: 'Pick someone to go' };
  if (d.coins && (s.coins ?? 0) < d.coins) return { ok: false, reason: `Needs ${d.coins} coins for the purse` };
  // (an island: only a boat reaches it, and she takes no more than her crew)
  const boat = sailsTo(d) ? freeBoat(s) : undefined;
  if (d.byBoat && !boat) return { ok: false, reason: 'Needs a seaworthy boat' };
  const most = boat && d.byBoat ? Math.min(boatDef(boat).crew, MAX_DELVERS) : d.type === 'delve' || isPlaceDest(d.id) || isPackDest(d.id) ? MAX_DELVERS : d.id === HUNT_DEST ? HUNT_PARTY : isAssaultDest(d.id) ? ASSAULT_MOST : MAX_PARTY;
  if (memberIds.length > most) return { ok: false, reason: `Parties are at most ${most} people` };
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

export function sendExpedition(s: GameState, destId: string, memberIds: readonly number[], roles: Record<number, Role> = {}, stance: Stance = 'balanced', horseCount = 0, truck = false, opts: { rations?: number; extraTorches?: number } = {}): SendCheck {
  const check = canSend(s, destId, memberIds);
  if (!check.ok) return check;
  if (truck) {
    const t = truckReady(s);
    if (!t.ok) return t;
  }
  const d = destinationOf(s, destId)!;
  const members = memberIds.map((id) => s.people.find((p) => p.id === id)!);
  // (a trade caravan takes its purse with it: spent at the market, what it buys comes home as loot)
  if (d.coins) {
    s.coins = (s.coins ?? 0) - d.coins;
    earn(s, 'goods', -d.coins);
  }

  // Drop off what they're carrying, then pack food for the trip.
  for (const p of members) {
    if (poolSize(p.carrying)) depositNear(s, p.x, p.carrying);
    p.carrying = {};
  }
  // (food for those who eat: the dead and machines march on nothing)
  const supplies = packFood(s, foodNeeded(s, d, members.filter((p) => !tireless(p)).length) * (opts.rations ?? 1));
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
  // (by boat, to an island or along the water, at her speed: no horse beats her there)
  const boat = sailsTo(d) && members.length <= Math.max(MAX_PARTY, freeBoat(s) ? boatDef(freeBoat(s)!).crew : 0) ? freeBoat(s) : undefined;
  const speed = boat ? 1 / sailSpeed(boat) : truck ? TRUCK_SPEEDUP : (waterskins ? WATERSKIN_SPEEDUP : 1) * (mounted ? HORSE_SPEEDUP : 1);

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
    ...(boat ? { boat: boat.id } : {}),
    ...(opts.extraTorches ? { extraTorches: opts.extraTorches } : {}),
  };
  // (an assault: its waves planned as they march, sim/factions.ts)
  const assault = planAssault(s, destId, new Rng(hashSeed(`${s.seed}:${s.tick}:assault`)));
  if (assault) e.assault = assault;
  s.expeditions.push(e);
  if (boat) boat.away = e.id;
  // (a delve: its rooms rolled and its torches packed)
  if (d.type === 'delve') startDelve(s, e, (m, n) => takeFromStorage(s, m, n));
  for (const p of members) {
    p.away = e.id;
    p.task = null;
    p.activity = 'walk';
    p.blocked = false;
  }
  notify(s, `${names(members)} set out for ${the(d.name)}${boat ? ` in the ${boat.name}` : ''}.`);
  return { ok: true };
}

/** Take up to `n` of a material out of storage; returns how many were taken. */
export function takeFromStorage(s: GameState, m: Material, n: number): number {
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
  const boat = e.boat ? fleet(s).find((b) => b.id === e.boat) : undefined;
  const hold = boat ? boatDef(boat).cargo : 0;
  return Math.round((people + (e.horses?.length ?? 0) * HORSE_CARRY + (e.truck ? TRUCK_CARRY : 0) + hold) * (e.stakes ? STAKES[e.stakes].carry : 1));
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
  const d = destinationOf(s, destId)!;
  const able = s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && !p.sick && p.hp >= maxHp(p) * 0.6);
  const room = Math.max(1, Math.min(MAX_PARTY, d?.recommendedParty ?? 1, able.length - Math.ceil(s.people.length * KEEP_HOME)));
  const score = (p: Person) => (d?.type === 'gather' ? p.skills.gathering.level * 2 + Math.max(p.skills.melee.level, p.skills.ranged.level) : Math.max(p.skills.melee.level, p.skills.ranged.level) * 2 + p.hp / 20);
  // (the founder stays home unless there's nobody else)
  const members = [...able].sort((a, b) => Number(a.id === s.mainId) - Number(b.id === s.mainId) || score(b) - score(a)).slice(0, able.length ? room : 0);
  const roles = rolesFor(members, d);
  const horses = Math.min(members.length, s.horses.filter((h) => h.hp >= HORSE_HP / 2).length);
  const truck = (s.items.truck ?? 0) > 0 && (totalStock(s).fuel ?? 0) >= TRUCK_FUEL;
  return { members: members.map((p) => p.id), roles, horses, truck };
}

/** Who does what in a party: the best healer of three or more tends the rest, a gatherer's last carries, the sharp-eyed
 *  scout ahead, and the rest fight. */
export function rolesFor(members: Person[], d: Destination | undefined): Record<number, Role> {
  const roles: Record<number, Role> = {};
  const medic = members.length >= 3 ? [...members].sort((a, b) => b.skills.medicine.level - a.skills.medicine.level)[0] : undefined;
  for (const p of members) {
    if (p === medic && p.skills.medicine.level > 0) roles[p.id] = 'medic';
    else if (d?.type === 'gather' && members.length >= 2 && p === members.at(-1)) roles[p.id] = 'porter';
    else if (p.skills.ranged.level > p.skills.melee.level + 1) roles[p.id] = 'scout';
    else roles[p.id] = 'fighter';
  }
  return roles;
}

/** Send a delving party the player picked (who goes is theirs to choose; the town sets the roles), at the stakes chosen. */
export function sendDelve(s: GameState, destId: string, memberIds: readonly number[], stakes: Stakes): SendCheck {
  const d = destinationOf(s, destId);
  // (a dungeon, or a fight at one of the places on the town's land: the player picks who goes)
  if (d?.type !== 'delve' && !(d && (isPlaceDest(d.id) || isPackDest(d.id)))) return { ok: false, reason: 'Not a dungeon' };
  const members = memberIds.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const plan = planParty(s, destId);
  const r = sendExpedition(s, destId, members.map((p) => p.id), rolesFor(members, d), STAKES[stakes].stance, Math.min(plan.horses, members.length), plan.truck);
  if (r.ok) s.expeditions[s.expeditions.length - 1].stakes = stakes;
  return r;
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
    const d = destinationOf(s, e.dest)!;
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
      notify(s, `No one came back from ${the(d.name)}.`, true);
      continue;
    }

    // A question for the player, or a fight, holds the trip up.
    if (e.prompt !== null) continue;
    if (e.battle) {
      stepBattle(e.battle, rng, { retreatAt: STANCES[e.stance].retreatAt, mainId: members.some((p) => p.id === s.mainId) ? s.mainId : null });
      // what the bosses did, for the Journal
      if (e.battle.shouts?.length) {
        for (const t of e.battle.shouts) notify(s, `At ${the(d.name)}: ${t}`, true);
        e.battle.shouts = [];
      }
      if (e.battle.outcome) finishBattle(s, e, d, members, rng);
      continue;
    }

    e.elapsed++;
    // (at sea: each hour out and back may bring a storm, the sea's foes or pirates, sim/boats.ts)
    if (e.boat && e.phase !== 'work' && e.elapsed % TICKS_PER_HOUR === 0) {
      seaHour(s, e, members, rng, (group) => fightGroup(s, e, d, members, group, false, rng));
      if (s.gameOver) return;
      members = membersOf(s, e);
      if (e.wrecked && e.phase !== 'back') startBack(s, e, e.elapsed);
      if (e.battle) continue;
    }
    switch (e.phase) {
      case 'out':
        if (!e.rolled.outEvent && e.elapsed >= e.outTicks * EVENT_AT) {
          e.rolled.outEvent = true;
          if (!crossroads(s, e, members, rng)) rollRoadEvent(s, e, members, rng);
        }
        if (e.elapsed >= e.outTicks) {
          e.phase = 'work';
          e.elapsed = 0;
          maybeFight(s, e, d, members, d.encounters.arrival, rng);
        }
        break;
      case 'work': {
        // (a delve goes room by room instead: sim/delves.ts)
        if (e.delve) {
          stepDelve(s, e, members, {
            back: () => startBack(s, e, e.outTicks),
            fight: (group, boss) => fightGroup(s, e, d, members, group, boss, rng),
            room: () => partyCarry(s, e) - poolSize(e.loot),
          });
          break;
        }
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
          if (!crossroads(s, e, members, rng)) rollRoadEvent(s, e, members, rng);
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
  if (scout && !boss && !e.assault && rng.chance(SCOUT_AVOID)) {
    notify(s, `${scout.name} spotted ${describeGroup(group)} ahead, and the party slipped past.`);
    return;
  }
  fightGroup(s, e, d, members, group, boss, rng);
}

/** A fight with a group of foes (on the road, at the site, or in a delve's room). */
function fightGroup(s: GameState, e: Expedition, d: Destination, members: Person[], group: Record<string, number>, _boss: boolean, rng: Rng): Battle {
  // (an assault at its target: the first wave, the rest waiting to come on in the same fight: combat.ts)
  const storm = e.assault && e.phase === 'work' && e.assault.wave === 0 ? e.assault : undefined;
  if (storm) group = storm.waves[0];
  e.battle = startBattle(members, e.roles, group, rng, e.supplies);
  if (storm) {
    // (the town's allies and vassals send levies to fight beside it: sim/factions.ts)
    const levies = leviesFor(s, storm.target, rng);
    levies.forEach((l, i) => e.battle!.fighters.push({ ...unitFighter(l.kind, 'party', -900000 - i), cooldown: 3 + i }));
    if (levies.length) notify(s, `${levies.length} levies from the town's allies and vassals march with ${the(d.name)} party.`, true);
    e.battle.waves = storm.waves.slice(1);
    e.battle.wave = 1;
    storm.wave = 1;
    meet(s, storm.waves.flatMap((w) => Object.keys(w)));
  }
  meet(s, Object.keys(group)); // (the Bestiary)
  // summoned spirits and tamed wolves join in (they act on their own first beat)
  for (const f of classAllies(members)) e.battle.fighters.push({ ...f, cooldown: f.interval });
  // an epic boss announces itself
  for (const kind of new Set(Object.keys(group))) if (ENEMIES[kind]?.kit) notify(s, `At ${the(d.name)}: ${ENEMIES[kind].kit!.roar}`, true);
  notify(s, `${The(d.name)} party is attacked by ${describeGroup(group)}!`);
  return e.battle;
}

function finishBattle(s: GameState, e: Expedition, d: Destination, members: Person[], rng: Rng): void {
  const b = e.battle!;
  e.battle = null;
  // the victory screen's tally: each member's experience and levels before and after
  const result: FightResult = { tick: s.tick, outcome: b.outcome ?? 'won', members: [], loot: {}, coins: 0, foes: [...new Set(b.fighters.filter((f) => f.side === 'enemy').map((f) => f.name))], boss: b.fighters.find((f) => f.side === 'enemy' && ENEMIES[f.kind]?.boss)?.name ?? null };
  // carry the fight's wounds back to the people (and count the stones thrown)
  for (const f of b.fighters) {
    if (f.side !== 'party' || f.kind !== 'person') continue; // (allies and the raised go back where they came from)
    if (f.ammoUsed && f.ammoType) addStock(e.supplies, f.ammoType, -f.ammoUsed);
    const p = members.find((q) => q.id === f.ref);
    if (!p) continue;
    const was = p.hp;
    if (f.down && !p.downed) knockDown(s, p);
    else if (!f.down) p.hp = Math.max(1, Math.min(maxHp(p), Math.round((f.hp * maxHp(p)) / Math.max(1, f.maxHp)))); // (back to the town's reckoning of their health)
    // (the fight's harm, as wounds on the body: one or two, from what they fought: sim/injuries.ts)
    const harm = f.down ? Math.max(was, maxHp(p) * 0.5) : was - p.hp;
    const foes = b.fighters.filter((x) => x.side === 'enemy');
    if (harm > 0 && foes.length) {
      const by = rng.pick(foes).kind;
      const blows = harm > maxHp(p) * 0.3 ? 2 : 1;
      for (let i = 0; i < blows; i++) woundPerson(s, p, harm / blows, (sev) => woundFor(by, sev, rng), rng);
    }
    const levelFrom = levelOf(p);
    const xpFrom = p.lvXp ?? 0;
    if (f.attacks) gainSkill(p, f.ranged ? 'ranged' : 'melee', f.attacks * FIGHT_XP);
    if (e.roles[p.id] === 'medic' && f.lastAction >= 0) gainSkill(p, 'medicine', FIGHT_XP * 3);
    // (the experience shown: what the level gained, levels crossed counted whole)
    const levelTo = levelOf(p);
    let xp = (p.lvXp ?? 0) - xpFrom;
    for (let l = levelFrom; l < levelTo; l++) xp += xpToLevel(l);
    result.members.push({ id: p.id, name: p.name, xp: Math.round(xp), levelFrom, levelTo, down: f.down });
  }
  e.result = result;
  if (medicUp(e, members)) for (const p of members) if (p.downed) stabilize(p);

  switch (b.outcome) {
    case 'won': {
      // a boss slain: its trophy comes home with the party (its purse goes to the town: shown on the victory screen)
      const coinsBefore = s.coins ?? 0;
      for (const f of b.fighters) if (f.side === 'enemy' && f.down && ENEMIES[f.kind]?.boss) bossSlain(s, f.kind);
      result.coins = (s.coins ?? 0) - coinsBefore;
      // (a boss's purse is the party's, split among them: data/economy.ts)
      if (result.coins > 0) {
        s.coins = (s.coins ?? 0) - result.coins;
        earn(s, 'events', -result.coins);
        payParty(s, members.filter((p) => !p.downed || true), result.coins, 'A share of the spoils');
      }
      const drops = battleLoot(b);
      const room = partyCarry(s, e) - poolSize(e.loot);
      let taken = 0;
      for (const [m, n] of Object.entries(drops) as [Material, number][]) {
        const k = Math.min(n, room - taken);
        if (k > 0) {
          addStock(e.loot, m, k);
          addStock(result.loot, m, k);
        }
        taken += Math.max(0, k);
      }
      notify(s, `${The(d.name)} party won the fight${taken ? ` and took ${listStock(drops)}` : ''}.`);
      if (d.type === 'clear' && e.phase === 'work') {
        e.cleared = true;
        placeCleared(s, e.dest, e.loot, rng); // (a place on the town's land: its hoard too)
      }
      break;
    }
    case 'retreated':
      for (const h of e.horses ?? []) if (rng.chance(HORSE_HURT_ON_RETREAT)) h.hp = Math.max(1, h.hp - HORSE_HURT);
      notify(s, `${The(d.name)} party fell back from the fight and is heading home.`);
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
      notify(s, `${The(d.name)} party was overrun. The survivors are crawling home.`, true);
      if (e.phase !== 'back') startBack(s, e, e.phase === 'out' ? e.elapsed : e.outTicks);
      break;
    }
  }
  // an assault's end: the whole of it won, or not (sim/factions.ts)
  if (e.assault && e.assault.wave > 0) {
    const won = b.outcome === 'won';
    const said = assaultOver(s, e.assault.target, won, e.loot, rng);
    e.assault = undefined;
    if (said) notify(s, said, true);
    if (won && e.phase === 'work') startBack(s, e, e.outTicks);
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
  boatHome(s, e);
  const side = s.destSides[d.id] ?? 1;
  const at = campEdge(s, side);
  // Share out the loot and leftover food; they'll haul it to storage like anything else.
  const haul: Stock = { ...e.loot };
  for (const m of MATERIALS) if (e.supplies[m]) addStock(haul, m, e.supplies[m]!);
  const bearers = members.filter((p) => !p.downed);
  const each = bearers.length ? Math.ceil(poolSize(haul) / bearers.length) : 0;
  for (const [i, p] of members.entries()) {
    p.away = null;
    homeFromTrip(s, p); // (a trip counted: an adventurer may settle down, sim/ambition.ts)
    p.homeAt = s.tick; // (rested before the next: sim/parties.ts)
    p.x = at.x - side * i * 20;
    p.y = at.y;
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
  if (poolSize(haul)) depositNear(s, at, haul); // nobody to carry it: dropped at the nearest store
  if (!s.scouted.includes(d.id)) s.scouted.push(d.id);
  const mapped = regionScouted(d.id);
  if (mapped && !e.recalled) mapRegion(s, mapped);
  const found = listStock(e.loot);
  notify(s, `${The(d.name)} party is back${e.recalled ? ' (recalled)' : ''}: ${found || 'empty-handed'}.`, true);
  if (!e.recalled) specialOutcome(s, e, d, at, rng);
  // (a delve: quests on a cleared dungeon, and a rival won over)
  const party = e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  delveHome(s, e, rng, { quests: (id) => questsDone(s, id, at, rng, party), join: () => joinTown(s, at, rng) });
  packHome(s, e, rng);
  sagaTripHome(s, e);
  huntHome(s, e, party);
  payBounty(s, e, party); // (a bounty the treasury posted on the place, if they did the job)
  if (!e.recalled) findRelic(s, e, d, rng);
  debrief(s, e, d); // (a party the player sent: what it cost and won, sim/muster.ts)
}

/** Relics (DESIGN §9 special items): rare finds on the hardest trips. */
const RELIC_ODDS: Partial<Record<Destination['type'], [string, number]>> = { legendary: ['deaths_bargain', 0.3], clear: ['deaths_bargain', 0.12], salvage: ['phoenix_feather', 0.08] };

function findRelic(s: GameState, e: Expedition, d: Destination, rng: Rng): void {
  const odds = RELIC_ODDS[d.type];
  if (!odds || (d.type === 'clear' && !e.cleared)) return;
  if (!rng.chance(odds[1])) return;
  s.items[odds[0]] = (s.items[odds[0]] ?? 0) + 1;
  notify(s, odds[0] === 'deaths_bargain' ? `At ${the(d.name)} the party found an old coin, cold as the grave: Death's Bargain.` : `At ${the(d.name)} the party found a feather that glows like embers: a Phoenix Feather!`, true);
}

/** What some kinds of trip bring back besides loot. */
function specialOutcome(s: GameState, e: Expedition, d: Destination, at: Pt, rng: Rng): void {
  switch (d.type) {
    case 'clear':
      if (!e.cleared) return;
      s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + CLEARED_RAID_DELAY_DAYS * TICKS_PER_DAY);
      notify(s, `With ${the(d.name)} broken up, the roads are quiet: no raids for ${CLEARED_RAID_DELAY_DAYS} days.`, true);
      if (s.captives.length) {
        const freed = s.captives.splice(0);
        for (const p of freed) {
          p.x = at.x;
          p.y = at.y;
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
        revealOccult(s, `Among the rubble of ${the(d.name)} the party found a strange, cold tome.`);
        return;
      }
      if (!rng.chance(SALVAGE_NOTES_CHANCE)) return;
      // old writings: halve what's left of the topic being researched (or the next one on offer)
      const r = s.research;
      const topic = r.queue[0] ?? TOPICS.find((t) => !r.done.includes(t.id) && prereqsMet(r, t.id, s.era, s.origin).ok)?.id;
      if (!topic) return;
      const p = r.progress[topic] ?? 0;
      r.progress[topic] = p + (1 - p) / 2;
      notify(s, `Old writings from ${the(d.name)}: research on ${TOPIC_BY_ID[topic].name} is half done.`, true);
      return;
    }
    case 'rescue': {
      const n = rng.int(1, RESCUE_MAX);
      const joined: Person[] = [];
      for (let i = 0; i < n && !townFull(s); i++) {
        const type = rng.weighted(ARRIVING_TYPES);
        const p = makePerson(rng, s.nextId++, type, at, s.people.map((q) => q.name));
        s.people.push(p);
        joined.push(p);
      }
      assignBeds(s);
      if (!joined.length) {
        notify(s, `The captives from ${the(d.name)} thank the party and go home: the town is as big as you want it.`, true);
        return;
      }
      notify(s, `${names(joined)} from ${the(d.name)} came home with the party and joined the town.`, true);
      return;
    }
  }
}

function pickIndex(weights: number[], rng: Rng): number {
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}

/** A foe's name in the plural ("wolves", "skeleton warriors", "giant rats"). */
const pluralWord = (w: string) =>
  /(wolf|elf|thief)$/.test(w) ? `${w.slice(0, -1)}ves` : /man$/.test(w) ? `${w.slice(0, -3)}men` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;
/** "crossbowmen", "knights of the order" (the head word takes the plural, not the end). */
const plural = (name: string) => {
  const at = name.indexOf(' of ');
  return at > 0 ? pluralWord(name.slice(0, at)) + name.slice(at) : pluralWord(name);
};

function describeGroup(group: Record<string, number>): string {
  return Object.entries(group)
    .map(([id, n]) => {
      const name = ENEMIES[id].name;
      // (a named one keeps its name: "The Queen of the Wild Hunt", not "a the queen...")
      if (/^the /i.test(name) || ENEMIES[id].boss) return n === 1 ? name : `${n} of ${name}`;
      const low = name.toLowerCase();
      return n === 1 ? `${/^[aeiou]/.test(low) ? 'an' : 'a'} ${low}` : `${n} ${plural(low)}`;
    })
    .join(' and ');
}

const listStock = (st: Record<string, number | undefined>) =>
  Object.entries(st)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([m, n]) => `${n} ${m === 'totem' ? 'totem' : m}`)
    .join(', ');

const names = (ps: { name: string }[]) => (ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(', ')} and ${ps.at(-1)!.name}`);
