// Townsfolk rules: needs, mood, work speed, skill growth, beds, and wanderers arriving at the edge of town.
// All rates are starting values for tuning.

import { coverOf, makeSpecial, secretJoined, specialFor } from './specials';
import { injuryMood, injuryWork } from './injuries';
import { TAX } from '../data/economy';
import { moneyTown } from './economy';
import { taxRate } from './treasury';
import { ageWork } from './ageing';
import { POP_SOFT_CAP } from '../data/pace';
import { ADJACENT_TILES, BUILDING_BY_ID, TAVERN_MARKET_MORALE } from '../data/buildings';
import { TRAITS, ARRIVING_TYPES, TRAIT_BY_ID, FOOD_VALUE } from '../data/people';
import { gainXp, type Skill } from '../data/skills';
import { hashSeed, mixSeed, type Rng } from '../rng';
import { STAGE_LEVELS } from '../data/classes';
import { callingName } from '../data/founderClasses';
import { stageOf } from '../data/levels';
import { aCalling, assignClass, gainLevelXp } from './classes';

/** Chance a wanderer arrives seasoned: a few levels in, their class already theirs. */
const SEASONED_CHANCE = 0.08;
/** Of those, the share who are legends: ascended to their class's last stage. */
const LEGEND_CHANCE = 0.03;
import { defOf, townRadius } from './buildings';
import { CELL, type Pt } from './land';
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
import { townFull, tireless, maxHp, campX, campXY, edgeXY, makePerson, notify, sideOf, type GameState, type Person, type Visitor } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { ORIGIN_DEFS, rulesOf } from '../data/origins';
import { natureOf } from '../data/natures';
import { makeStranger, oneOf, strangerOrigin, welcomes } from './strangers';
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

/** Hunger while asleep, as a share of awake. */
export const ASLEEP_HUNGER = 0.5;

export function drainNeeds(p: Person, asleep: boolean): void {
  if (tireless(p)) return; // (the dead, and machines, neither hunger nor tire)
  const glutton = p.traits.includes('glutton') ? 1.5 : 1;
  // (asleep, they burn half as much: a night in bed no longer empties a belly that was merely peckish at bedtime)
  p.needs.food = Math.max(0, p.needs.food - (FOOD_PER_HOUR * glutton * (asleep ? ASLEEP_HUNGER : 1)) / TICKS_PER_HOUR);
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
  // (the tax lever, data/economy.ts: once there's money to tax)
  if (moneyTown(s) && p.bornTick == null && TAX[taxRate(s)].morale) add(`${TAX[taxRate(s)].name} taxes`, TAX[taxRate(s)].morale);
  if (p.guard) add('Paid to keep watch', 2);
  if (p.traits.includes('loner') && s.people.length > 4) add('Too many people (Loner)', -10);
  if (p.downed) add('Badly hurt', -12);
  else if (isInjured(p)) add('Injured', -6);
  if (s.tick < s.mourningUntil) {
    if (hasGraveyard(s)) add('Mourning a death (laid to rest)', MOURNING_LAID_TO_REST);
    else add('Mourning a death', MOURNING_MORALE);
  }
  if (p.grief && s.tick < p.grief.until) add(p.grief.text, p.grief.value);
  if (p.sore && s.tick < p.sore.until) add(p.sore.text, p.sore.value);
  {
    const im = injuryMood(p);
    if (im.pain) add('In pain', im.pain);
    if (im.comfort) add('A glass eye', im.comfort);
  }
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
  // (their nature nudges where their spirits settle: data/natures.ts)
  const target = Math.max(0, Math.min(100, mood(s, p).target + natureOf(p).mood));
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
  } else if (r.kin === 'werewolf' && !p.monster) {
    p.monster = 'werewolf';
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
  let f = natureOf(p).work;
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
  f *= injuryWork(p); // (what their wounds, scars and lost parts leave them: sim/injuries.ts)
  if (p.sick) f *= PLAGUE_WORK;
  f *= ageWork(s, p); // (elders slow down)
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
  gainLevelXp(p, skill, xp * k);
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
  // (whoever owns a home sleeps in it: the rest take what's free)
  for (const p of s.people) {
    if (p.bed !== null) continue;
    const own = s.buildings.find((b) => b.owner === p.id && b.status === 'done' && (defOf(b).housing ?? 0) > (used.get(b.id) ?? 0));
    if (!own) continue;
    p.bed = own.id;
    used.set(own.id, (used.get(own.id) ?? 0) + 1);
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

/** The edge of the town on one side of camp, on its row (where visitors wait and parties come home), in px. */
export function campEdge(s: GameState, side: -1 | 1): Pt {
  const c = campXY(s);
  const x = c.x + side * (townRadius(s) + 1.5) * CELL;
  return { x: Math.max(CELL / 2, Math.min((s.land.w - 0.5) * CELL, x)), y: c.y };
}

/** Once per game hour, maybe a wanderer turns up (only while a bed is free). */
export function maybeArrive(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.visitor) return;
  if (rulesOf(s).noWanderers) return; // (a town that makes its own people)
  if (townFull(s)) return; // (as big as the player wants it)
  if (housingCapacity(s) <= s.people.length) return;
  // (the owner's rule: people join by the player's leave, a prisoner won over, or birth; so wanderers come seldom,
  // and each is a question. A town whose gates are free (the horde) takes them in itself, as often as they come.)
  if (!rulesOf(s).freeJoin && s.tick - (s.lastVisit ?? -Infinity) < VISIT_GAP_HOURS * TICKS_PER_HOUR) return;
  const done = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
  const chance =
    ARRIVAL_BASE +
    (done('campfire') ? ARRIVAL_CAMPFIRE : 0) +
    (done('storytellers_circle') ? ARRIVAL_CIRCLE : 0) +
    s.buildings.reduce((n, b) => n + (b.status === 'done' ? (BUILDING_BY_ID[b.def]?.arrivals ?? 0) : 0), 0) +
    Math.min(ARRIVAL_REPUTATION_MAX, s.reputation * ARRIVAL_PER_REPUTATION);
  // wanderers shy away from a town where the dead outnumber the living
  // (unless the town was founded by the dead: then they're raised on joining anyway)
  // (and fewer come as a town fills: past POP_SOFT_CAP it grows only by its own children: data/pace.ts)
  const room = Math.max(0, 1 - s.people.length / POP_SOFT_CAP);
  if (!rng.chance(chance * room * (undeadShare(s) >= 0.5 && rulesOf(s).kin !== 'undead' ? UNDEAD_TOWN_ARRIVALS : 1))) return;

  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  const edge = edgeXY(s, side);
  // once the Occult is known, now and then a monster comes asking (the RNG is only drawn on then)
  const monster = occultRevealed(s) && rng.chance(MONSTER_ARRIVAL) ? rng.pick<MonsterKind>(['werewolf', 'vampire']) : null;
  const type = monster ?? rng.weighted(ARRIVING_TYPES);
  const person = makePerson(rng, s.nextId++, type, edge, [...s.people.map((p) => p.name)]);
  if (monster) becomeMonster(s, person, monster);
  // a stranger of another people (sim/strangers.ts): their look and span are theirs; a xenophobic town turns them away
  const origin = monster ? null : strangerOrigin(s, rng);
  if (origin) {
    makeStranger(s, person, origin);
    if (!welcomes(s, origin)) {
      s.nextId--;
      notify(s, `A wanderer, ${oneOf(origin)}, was turned from the gate: ${ORIGIN_DEFS[s.origin!].name} keep to their own.`);
      return;
    }
  }
  // a rare wanderer is already trained in a special class (decided by the seed, so no randomness shifts)
  const roll = mixSeed(hashSeed(s.seed), person.id * 7919);
  // (one of each calling in a town: never one the town already has)
  // (a seasoned wanderer: some levels behind them, and their class from the start)
  if (!monster && roll % 1000 < SEASONED_CHANCE * 1000) {
    person.level = 3 + (Math.floor(roll / 1000) % 10);
    assignClass(s, person);
    // (once in a long while, a legend walks in: high level, and ascended)
    if (roll % 100000 < LEGEND_CHANCE * 100000) {
      person.level = STAGE_LEVELS[4] + (roll % 5);
      person.ascended = true;
      person.stageSeen = stageOf(person);
    }
  }
  person.dir = side < 0 ? 1 : -1;
  const wait = campEdge(s, side);
  s.visitor = { person, waitX: wait.x, waitY: wait.y, leavesTick: s.tick + VISITOR_WAIT_HOURS * TICKS_PER_HOUR, leavingTo: null };
  s.lastVisit = s.tick;
  const trained = person.cls ? ` (${aCalling(callingName(person, stageOf(person))!)}, level ${person.level}!)` : '';
  const who = origin ? `${oneOf(origin)} (a ${type})` : `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`;
  notify(s, `${who[0].toUpperCase()}${who.slice(1)}${trained} is coming to camp. See Townsfolk.`, !!person.cls);
  if (!rulesOf(s).freeJoin) askVisitor(s, who, trained);
}

/** A secret stranger at the gate (sim/specials.ts), come in an event's turn: a wanderer under a cover story, asking in
 *  like any other. False if there's nobody to send (one already waiting, the town full, or every kind met). */
export function secretStranger(s: GameState, rng: Rng): boolean {
  if (s.visitor || townFull(s) || rulesOf(s).noWanderers) return false;
  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  const person = makePerson(rng, s.nextId++, 'wanderer', edgeXY(s, side), [...s.people.map((p) => p.name)]);
  const special = specialFor(s, person);
  if (!special) {
    s.nextId--;
    return false;
  }
  makeSpecial(s, person, special);
  person.dir = side < 0 ? 1 : -1;
  const wait = campEdge(s, side);
  s.visitor = { person, waitX: wait.x, waitY: wait.y, leavesTick: s.tick + VISITOR_WAIT_HOURS * TICKS_PER_HOUR, leavingTo: null };
  const who = coverOf(person);
  notify(s, `${who[0].toUpperCase()}${who.slice(1)} is coming to camp. See Townsfolk.`, true);
  if (!rulesOf(s).freeJoin) askVisitor(s, who, '');
  return true;
}

/** The question a wanderer at the gate puts to the player (unless the town's gates are free): in, or on their way.
 *  Unanswered, they're taken in when their wait is up if the stores hold a day's food a head, else sent on. */
export function askVisitor(s: GameState, who: string, trained: string): void {
  const v = s.visitor;
  if (!v) return;
  const skills = (['gathering', 'farming', 'crafting', 'construction', 'melee', 'ranged', 'research', 'medicine', 'social'] as const)
    .map((k) => [k, v.person.skills[k].level] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, l]) => `${k} ${l}`)
    .join(', ');
  s.prompts.push({
    id: s.nextId++,
    kind: 'visitor',
    expedition: null,
    title: `${v.person.name} asks to join`,
    text: `${who[0].toUpperCase()}${who.slice(1)}${trained} stands at the edge of town and asks to stay. Best at ${skills}. ${housingCapacity(s) > s.people.length ? 'There is a bed for them.' : 'There is no bed free.'}`,
    options: VISITOR_OPTIONS,
    // (left unanswered, a newcomer is let in unless the stores are nearly bare: a town whose player is away still grows,
    // and builds them a home; the choice is the player's whenever they answer)
    defaultOption: foodPerHead(s) >= 1 ? 0 : 1,
    expiresTick: v.leavesTick + TICKS_PER_HOUR, // (they tire of waiting first, and take their question with them)
  });
}
export const VISITOR_OPTIONS = ['Take them in', 'Send them on'];
/** Game hours between one wanderer at the gate and the next (a town whose gates are free has no such wait). */
export const VISIT_GAP_HOURS = 48;

/** Days of food in store a head (a newcomer's question defaults to no when it's under one). */
function foodPerHead(s: GameState): number {
  let food = 0;
  for (const b of s.buildings) for (const [m, n] of Object.entries(b.store)) food += (FOOD_VALUE[m] ?? 0) * (n ?? 0);
  return food / Math.max(1, s.people.length);
}

/** The player's answer to a wanderer's asking. */
export function answerVisitor(s: GameState, option: string): void {
  if (option === VISITOR_OPTIONS[0]) acceptVisitor(s);
  else rejectVisitor(s);
}

/** Visitors walk in, wait, and walk off when turned away or tired of waiting. */
export function updateVisitor(s: GameState, walkTo: (p: Person, to: Pt) => boolean): void {
  const v = s.visitor;
  if (!v) return;
  if (v.leavingTo === null && s.tick >= v.leavesTick) {
    // (left unanswered, the question's default stands: in, when the stores can feed one more)
    const asked = s.prompts.find((q) => q.kind === 'visitor');
    if (asked && asked.defaultOption === 0) {
      acceptVisitor(s);
      return;
    }
    v.leavingTo = edgeBehind(s, v);
    s.prompts = s.prompts.filter((q) => q.kind !== 'visitor');
    notify(s, `${v.person.name} got tired of waiting and moved on.`);
  }
  if (v.leavingTo !== null) {
    if (walkTo(v.person, v.leavingTo)) s.visitor = null;
  } else if (walkTo(v.person, { x: v.waitX, y: v.waitY })) {
    v.person.activity = 'idle';
    v.person.dir = v.waitX < campX(s) ? 1 : -1; // face the camp
  }
}

const edgeBehind = (s: GameState, v: Visitor) => edgeXY(s, sideOf(s, { x: v.waitX, y: v.waitY }));

export function acceptVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo !== null) return;
  s.people.push(v.person);
  s.visitor = null;
  s.prompts = s.prompts.filter((q) => q.kind !== 'visitor');
  joinOrigin(s, v.person);
  assignBeds(s);
  equipAll(s);
  notify(s, `${v.person.name} joined the town.`, true);
  secretJoined(s, v.person);
  if (v.person.type === 'hermit') revealOccult(s, `${v.person.name} the hermit brought old, forbidden knowledge.`);
}

export function rejectVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo !== null) return;
  v.leavingTo = edgeBehind(s, v);
  s.prompts = s.prompts.filter((q) => q.kind !== 'visitor');
}

/* ------------------------------------------------------------ the town's kin, kept */

/** The bone tints of the raised dead, by who they are. */
const BONE: string[] = ['#d8d0b8', '#c8c0a8', '#b8b8a4', '#a8b0a0', '#e0d8c4'];

/** The look of one raised from the dead: the LPC skeleton body in a bone tint, no hair; the clothes they died in. */
export function raisedLook(p: Person): void {
  p.look.body = 'skeleton';
  p.look.skin = BONE[p.id % BONE.length];
  p.look.hair = 'none';
  p.look.beard = false;
}

/** Each hour the town's kin rule is kept (the owner's call: the lich's village is the dead alone): whoever came in
 *  living, by whatever door (a wanderer, a captive brought home, a raider come round, a rival won over, a quest's
 *  captive, a child), is made kin: raised in a lich town (and looks it), bitten in a pack, remade in a colony. The lich
 *  themself is left as they are. */
export function keepKin(s: GameState): void {
  const kin = rulesOf(s).kin;
  if (!kin) return;
  for (const p of s.people) {
    if (s.lich && p.id === s.mainId) continue;
    if (kin === 'undead') {
      if (p.monster !== 'undead') {
        p.monster = 'undead';
        delete p.lastFed;
        p.hp = maxHp(p);
        notify(s, `${p.name} is dead, and risen: the dead welcome the dead.`, true);
      }
      if (p.look.body !== 'skeleton') raisedLook(p);
    } else if (kin === 'werewolf') {
      if (p.monster !== 'werewolf') {
        p.monster = 'werewolf';
        p.hp = maxHp(p);
        notify(s, `${p.name} was bitten under the moon, and runs with the pack now.`, true);
      }
    } else if (kin === 'machine' && !p.machine) {
      p.machine = true;
      notify(s, `${p.name} was remade: a machine of the colony now.`, true);
    }
  }
}
