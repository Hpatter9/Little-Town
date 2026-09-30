// Townsfolk rules: needs, mood, work speed, skill growth, beds, and wanderers arriving at the edge of town.
// All rates are starting values for tuning.

import { TILE, WORLD_WIDTH } from '../constants';
import { ADJACENT_TILES, BUILDING_BY_ID, TAVERN_MARKET_MORALE } from '../data/buildings';
import { TRAITS, ARRIVING_TYPES, TRAIT_BY_ID } from '../data/people';
import { gainXp, type Skill } from '../data/skills';
import { hashSeed, mixSeed, type Rng } from '../rng';
import { CLASS_DEFS, CLASSES, RARE_CLASS_CHANCE } from '../data/classes';
import { defOf } from './buildings';
import { equipAll, gearEffects } from './crafting';
import { friendsOf, hasGraveyard, isChild, rivalsOf } from './social';
import { MOURNING_LAID_TO_REST, MOURNING_MORALE } from '../data/social';
import { operatorSkill } from './operators';
import { occultRevealed, revealOccult } from './occult';
import { becomeMonster } from './monsters';
import { FEED_HOURS, LIVING_AMONG_DEAD_MORALE, MONSTER_ARRIVAL, THIRST_MORALE, TURNING_FEAR_MORALE, UNDEAD_TOWN_ARRIVALS, UNEASY_MORALE, VAMPIRE_DAY_WORK, VAMPIRE_NIGHT_WORK, type MonsterKind } from '../data/monsters';
import { undeadShare } from './turning';
import { DREAD_MORALE, TRIUMPH_MORALE } from './bosses';
import { TAVERN_BASE, TAVERN_PER_LEVEL } from '../data/operators';
import { ASH_MORALE, FALLOUT_MORALE, FREEZE_COLD_MORALE, FREEZE_MORALE, PLAGUE_MORALE, PLAGUE_WORK, SMOG_MORALE } from '../data/doom';
import { isInjured } from './health';
import { tireless, maxHp, campX, makePerson, notify, type GameState, type Person, type Visitor } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { rulesOf } from '../data/origins';
import { originWork, moraleMarks } from './origin';

/** Need drain per game hour. Food lasts about a day; rest about 18 waking hours. */
export const FOOD_PER_HOUR = 1 / 24;
const REST_PER_HOUR = 1 / 18;
/** Rest regained per game hour asleep (in a bed; the ground gives less). */
export const SLEEP_PER_HOUR = 1 / 8;
export const GROUND_SLEEP = 0.7;
/** Below this, people go and eat. */
export const HUNGRY = 0.4;
/** Morale moves toward its target this many points per game hour. */
const MORALE_DRIFT_PER_HOUR = 10;
/** Below this, people sulk and won't work. */
export const SULK_MORALE = 15;
/** Passion and Quick Learner each multiply XP by this. */
const XP_BOOST = 1.5;

/** Wanderers: chance per game hour of one turning up (while a bed is free), and how long they wait. */
const ARRIVAL_BASE = 0.06;
const ARRIVAL_CAMPFIRE = 0.04;
const ARRIVAL_CIRCLE = 0.06;
const VISITOR_WAIT_HOURS = 6;
/** Each point of reputation (from helping strangers) adds to the arrival chance, up to a cap. */
const ARRIVAL_PER_REPUTATION = 0.02;
const ARRIVAL_REPUTATION_MAX = 0.1;

/* ------------------------------------------------------------ needs and mood */

export function drainNeeds(p: Person, asleep: boolean): void {
  if (tireless(p)) return; // (the dead, and machines, neither hunger nor tire)
  const glutton = p.traits.includes('glutton') ? 1.5 : 1;
  p.needs.food = Math.max(0, p.needs.food - (FOOD_PER_HOUR * glutton) / TICKS_PER_HOUR);
  if (!asleep) p.needs.rest = Math.max(0, p.needs.rest - REST_PER_HOUR / TICKS_PER_HOUR);
}

export function isNight(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

/** Time for bed: late at night (unless fully rested), or dead on their feet. */
export function wantsSleep(s: GameState, p: Person): boolean {
  if (tireless(p)) return false;
  return (isNight(calendar(s.tick).hour) && p.needs.rest < 0.9) || p.needs.rest < 0.15;
}

/** Done sleeping: fully rested, or rested enough and it's day. */
export function wantsToWake(s: GameState, p: Person): boolean {
  if (p.downed) return false; // stays in bed until back on their feet
  const h = calendar(s.tick).hour;
  return p.needs.rest >= 1 || (h >= 6 && h < 22 && p.needs.rest >= 0.6);
}

export interface MoodReason {
  text: string;
  value: number;
}

/** What someone's morale is heading toward, and why. */
export function mood(s: GameState, p: Person): { target: number; reasons: MoodReason[] } {
  const reasons: MoodReason[] = [];
  const add = (text: string, value: number) => reasons.push({ text, value });
  const { food, rest } = p.needs;
  if (food <= 0.02) add('Starving', -25);
  else if (food < 0.25) add('Hungry', -10);
  else if (food >= 0.5) add('Well fed', 5);
  if (rest <= 0.02) add('Exhausted', -18);
  else if (rest < 0.2) add('Tired', -8);
  else if (rest >= 0.5) add('Rested', 3);
  if (p.lastSlept === 'bed') add('Slept in a bed', 5);
  else if (p.lastSlept === 'bedroll') add('Slept on a bedroll', -1);
  else if (p.lastSlept === 'ground') add('Slept on the ground', -6);
  const charm = gearEffects(p).morale;
  if (charm) add('Lucky charm', charm);
  const done = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
  if (done('campfire')) add('Warm campfire', 5);
  if (done('storytellers_circle')) add('Stories by the fire', 6);
  // the best of the other morale buildings (a tavern, the elder lodge...)
  const best = s.buildings
    .filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.morale)
    .map((b): [number, string] => {
      const m = BUILDING_BY_ID[b.def].morale!;
      // the tavern is as good as its barkeep
      if (b.def !== 'tavern') return m;
      // (and a tavern by the market is livelier)
      const market = s.buildings.some((q) => q.def === 'market' && q.status === 'done' && Math.abs(q.tile - b.tile) <= ADJACENT_TILES);
      return [Math.round(TAVERN_BASE + operatorSkill(s, 'tavern') * TAVERN_PER_LEVEL) + (market ? TAVERN_MARKET_MORALE : 0), market ? `${m[1]}, by the market` : m[1]];
    })
    .sort((a, b) => b[0] - a[0])[0];
  if (best) add(best[1], best[0]);
  if (p.traits.includes('loner') && s.people.length > 4) add('Too many people (Loner)', -10);
  if (p.downed) add('Badly hurt', -12);
  else if (isInjured(p)) add('Injured', -6);
  if (s.tick < s.mourningUntil) {
    if (hasGraveyard(s)) add('Mourning a death (laid to rest)', MOURNING_LAID_TO_REST);
    else add('Mourning a death', MOURNING_MORALE);
  }
  if (p.grief && s.tick < p.grief.until) add(p.grief.text, p.grief.value);
  if (p.sick) add('Sick with the plague', PLAGUE_MORALE);
  if (s.doom?.phase === 'active' && s.doom.kind === 'ash_winter') add('Ash blots out the sun', ASH_MORALE);
  if (s.doom?.phase === 'active' && s.doom.kind === 'smog' && p.away === null) add('Choking smog', SMOG_MORALE);
  if (s.doom?.phase === 'active' && s.doom.kind === 'meltdown' && p.away === null && !tireless(p)) add('Fallout sickness', FALLOUT_MORALE);
  if (s.doom?.phase === 'active' && s.doom.kind === 'deep_freeze' && p.away === null && !tireless(p)) add(s.doom.cold ? 'Freezing: nothing left to burn' : 'The Deep Freeze', s.doom.cold ? FREEZE_COLD_MORALE : FREEZE_MORALE);
  if (!p.monster && s.people.some((q) => q.monster === 'vampire' && q.away === null)) add('Uneasy nights (a vampire in town)', UNEASY_MORALE);
  if (s.tick < s.celebrationUntil) add('A wedding in town', 5);
  for (const [text, value] of moraleMarks(s)) add(text, value); // (what the town chose in its events)
  // epic bosses: the dread of one at the gates, the triumph of one slain
  if (s.tick < (s.dreadUntil ?? 0)) add('A monster at the gates', DREAD_MORALE);
  if (s.triumph && s.tick < s.triumph.until) add(`Slew ${s.triumph.name}`, TRIUMPH_MORALE);
  // turned townsfolk, and the living who share a town with them
  if (!p.monster && s.people.some((q) => q.monster === 'undead' && q.away === null)) add('Living among the dead', LIVING_AMONG_DEAD_MORALE);
  if (!p.monster && s.tick < (s.turningFearUntil ?? 0)) add('Afraid of being turned', TURNING_FEAR_MORALE);
  if (p.monster === 'vampire' && s.tick - (p.lastFed ?? s.tick) > FEED_HOURS * 1.5 * TICKS_PER_HOUR) add('Thirsting for blood', THIRST_MORALE);
  // the people in their life
  const partner = p.partner == null ? undefined : s.people.find((q) => q.id === p.partner);
  if (partner) add(p.married ? `Married to ${partner.name}` : `In love with ${partner.name}`, p.married ? 6 : 4);
  if (friendsOf(s, p).some((f) => f.id !== p.partner)) add('Has friends', 3);
  const rival = rivalsOf(s, p)[0];
  if (rival) add(`Can't stand ${rival.name}`, -5);
  if (s.people.some((k) => isChild(k) && k.parents?.includes(p.id))) add('A child to raise', 3);
  if (isChild(p)) add(done('school') ? 'Learning at school' : 'Playing', 5);
  const target = Math.max(0, Math.min(100, 50 + reasons.reduce((n, r) => n + r.value, 0)));
  return { target, reasons };
}

/** Ticks between morale updates. */
const MORALE_EVERY = 10;

export function driftMorale(s: GameState, p: Person): void {
  // (working out someone's mood weighs up everyone they know, so it's done once a second, not every tick)
  if (s.tick % MORALE_EVERY !== 0) return;
  // (a machine's spirits hold steady)
  if (p.machine) {
    p.morale = MACHINE_MORALE;
    return;
  }
  const { target } = mood(s, p);
  const step = (MORALE_DRIFT_PER_HOUR / TICKS_PER_HOUR) * MORALE_EVERY;
  p.morale = p.morale < target ? Math.min(target, p.morale + step) : Math.max(target, p.morale - step);
  // (some origins' folk never sink too low: thralls, the fair folk)
  const floor = rulesOf(s).moraleFloor;
  if (floor !== undefined && p.morale < floor) p.morale = floor;
}

/** Barracks (DESIGN §10): XP an hour for everyone with Defend on High, while no raid is on. */
export const DRILL_XP_PER_HOUR = 25;

/** Once an hour: guards drill at the barracks (both their melee and their shooting). */
export function drillGuards(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.raid) return;
  if (!s.buildings.some((b) => b.def === 'barracks' && b.status === 'done')) return;
  for (const p of s.people) {
    if (p.away !== null || p.downed || p.bornTick != null || p.priorities.defend !== 1) continue;
    gainSkill(p, 'melee', DRILL_XP_PER_HOUR);
    gainSkill(p, 'ranged', DRILL_XP_PER_HOUR);
  }
}

/** A machine's steady spirits. */
export const MACHINE_MORALE = 60;

/** Someone joins a town of an origin: raised as one of the dead, made a machine, or (alchemists) changed a little. */
export function joinOrigin(s: GameState, p: Person, rng?: Rng): void {
  const r = rulesOf(s);
  if (r.kin === 'undead' && !p.monster) {
    p.monster = 'undead';
    p.hp = maxHp(p);
  } else if (r.kin === 'machine') p.machine = true;
  if (r.mutate) {
    // (a trait they don't have, decided by who they are, so no randomness shifts)
    const open = TRAITS.filter((t) => !p.traits.includes(t.id) && !p.traits.some((o) => t.excludes?.includes(o)));
    const pick = rng ? rng.pick(open) : open[(p.id * 7) % Math.max(1, open.length)];
    if (pick) {
      p.traits.push(pick.id);
      notify(s, `${p.name} came out of the crucible changed: ${pick.name}.`);
    }
  }
}

/** Worker bots (Robotics): each makes all work this much faster, up to a limit. */
export const BOT_WORK = 0.05;
export const MAX_BOTS = 10;

/** Multiplier on work speed from traits, morale, hunger, tiredness and the hour. */
export function workFactor(s: GameState, p: Person): number {
  let f = 1;
  if (p.traits.includes('hard_worker')) f *= 1.2;
  if (p.traits.includes('lazy')) f *= 0.8;
  if (p.traits.includes('night_owl')) {
    const h = calendar(s.tick).hour;
    f *= h >= 20 || h < 5 ? 1.2 : 0.9;
  }
  if (p.morale >= 70) f *= 1.1;
  else if (p.morale < 30) f *= 0.85;
  if (p.needs.food <= 0.02) f *= 0.7;
  if (p.needs.rest <= 0.02) f *= 0.7;
  if (isInjured(p)) f *= 0.8;
  if (p.sick) f *= PLAGUE_WORK;
  // vampires come alive at night
  if (p.monster === 'vampire') {
    const h = calendar(s.tick).hour;
    f *= h >= 20 || h < 5 ? VAMPIRE_NIGHT_WORK : VAMPIRE_DAY_WORK;
  }
  // worker bots lend a hand with everything
  const uprising = s.doom?.kind === 'rogue_ai' && s.doom.phase === 'active';
  const bots = uprising ? 0 : Math.min(MAX_BOTS, s.items.worker_bot ?? 0);
  if (bots) f *= 1 + BOT_WORK * bots;
  return f * originWork(s, p);
}

/** Grow a skill, faster for passions and Quick Learners. */
export function gainSkill(p: Person, skill: Skill, xp: number): void {
  const k = (p.passions.includes(skill) ? XP_BOOST : 1) * (p.traits.includes('quick_learner') ? XP_BOOST : 1);
  gainXp(p.skills[skill], xp * k);
}

export const traitNames = (p: Person) => p.traits.map((t) => TRAIT_BY_ID[t]?.name ?? t);

/* ------------------------------------------------------------ beds */

export function housingCapacity(s: GameState): number {
  return s.buildings.reduce((n, b) => n + (b.status === 'done' ? (BUILDING_BY_ID[b.def].housing ?? 0) : 0), 0);
}

/** Drop beds that no longer exist; give bedless people a free bed (in id order). */
export function assignBeds(s: GameState): void {
  const used = new Map<number, number>();
  for (const p of s.people) {
    const b = p.bed === null ? undefined : s.buildings.find((q) => q.id === p.bed);
    if (!b || b.status !== 'done' || !defOf(b).housing) p.bed = null;
    else used.set(b.id, (used.get(b.id) ?? 0) + 1);
  }
  for (const p of s.people) {
    if (p.bed !== null) continue;
    const free = s.buildings.find((b) => b.status === 'done' && (defOf(b).housing ?? 0) > (used.get(b.id) ?? 0));
    if (!free) return;
    p.bed = free.id;
    used.set(free.id, (used.get(free.id) ?? 0) + 1);
  }
}

/* ------------------------------------------------------------ wanderers */

/** x at the edge of cleared land on one side of camp (where visitors wait). */
export function campEdgeX(s: GameState, side: -1 | 1): number {
  let t = Math.floor(s.tiles.length / 2);
  while (t + side >= 0 && t + side < s.tiles.length && s.tiles[t + side].terrain === 'clear') t += side;
  return (t + 0.5 - side) * TILE; // a step inside the cleared land
}

/** Once per game hour, maybe a wanderer turns up (only while a bed is free). */
export function maybeArrive(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.visitor) return;
  if (rulesOf(s).noWanderers) return; // (a town that makes its own people)
  if (housingCapacity(s) <= s.people.length) return;
  const done = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
  const chance =
    ARRIVAL_BASE +
    (done('campfire') ? ARRIVAL_CAMPFIRE : 0) +
    (done('storytellers_circle') ? ARRIVAL_CIRCLE : 0) +
    s.buildings.reduce((n, b) => n + (b.status === 'done' ? (BUILDING_BY_ID[b.def]?.arrivals ?? 0) : 0), 0) +
    Math.min(ARRIVAL_REPUTATION_MAX, s.reputation * ARRIVAL_PER_REPUTATION);
  // wanderers shy away from a town where the dead outnumber the living
  // (unless the town was founded by the dead: then they're raised on joining anyway)
  if (!rng.chance(chance * (undeadShare(s) >= 0.5 && rulesOf(s).kin !== 'undead' ? UNDEAD_TOWN_ARRIVALS : 1))) return;

  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  const edge = side < 0 ? 0 : WORLD_WIDTH;
  // once the Occult is known, now and then a monster comes asking (the RNG is only drawn on then)
  const monster = occultRevealed(s) && rng.chance(MONSTER_ARRIVAL) ? rng.pick<MonsterKind>(['werewolf', 'vampire']) : null;
  const type = monster ?? rng.weighted(ARRIVING_TYPES);
  const person = makePerson(rng, s.nextId++, type, edge, [...s.people.map((p) => p.name)]);
  if (monster) becomeMonster(s, person, monster);
  // a rare wanderer is already trained in a special class (decided by the seed, so no randomness shifts)
  const roll = mixSeed(hashSeed(s.seed), person.id * 7919);
  // (one of each calling in a town: never one the town already has)
  const open = CLASSES.filter((k) => !s.people.some((p) => p.cls === k));
  if (!monster && open.length && roll % 1000 < RARE_CLASS_CHANCE * 1000) person.cls = open[Math.floor(roll / 1000) % open.length];
  person.dir = side < 0 ? 1 : -1;
  s.visitor = { person, waitX: campEdgeX(s, side), leavesTick: s.tick + VISITOR_WAIT_HOURS * TICKS_PER_HOUR, leavingTo: null };
  const trained = person.cls ? ` (a ${CLASS_DEFS[person.cls].name}!)` : '';
  notify(s, `${/^[aeiou]/.test(type) ? 'An' : 'A'} ${type}${trained} is coming to camp. See Townsfolk.`, !!person.cls);
}

/** Visitors walk in, wait, and walk off when turned away or tired of waiting. */
export function updateVisitor(s: GameState, walkTo: (p: Person, x: number) => boolean): void {
  const v = s.visitor;
  if (!v) return;
  if (v.leavingTo === null && s.tick >= v.leavesTick) {
    v.leavingTo = edgeBehind(v);
    notify(s, `${v.person.name} got tired of waiting and moved on.`);
  }
  if (v.leavingTo !== null) {
    if (walkTo(v.person, v.leavingTo)) s.visitor = null;
  } else if (walkTo(v.person, v.waitX)) {
    v.person.activity = 'idle';
    v.person.dir = v.waitX < campX(s) ? 1 : -1; // face the camp
  }
}

const edgeBehind = (v: Visitor) => (v.waitX < WORLD_WIDTH / 2 ? 0 : WORLD_WIDTH);

export function acceptVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo !== null) return;
  s.people.push(v.person);
  s.visitor = null;
  joinOrigin(s, v.person);
  assignBeds(s);
  equipAll(s);
  notify(s, `${v.person.name} joined the town.`, true);
  if (v.person.type === 'hermit') revealOccult(s, `${v.person.name} the hermit brought old, forbidden knowledge.`);
}

export function rejectVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo !== null) return;
  v.leavingTo = edgeBehind(v);
}
