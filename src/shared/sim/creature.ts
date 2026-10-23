// The God creature (the owner's ask, after Black & White: a creature that learns, has feelings and needs, works with
// the townsfolk, can be good or evil, and grows; one of five for every people: data/creature.ts). It comes in a saga
// (data/creatureSaga.ts) once the town has studied Great Beasts (`CREATURE_TOPIC`): signs, a found beast, and the
// player's pick of the five (`adoptCreature`). Then, every game hour with the autopilot on (`creatureHourly`):
//  - its needs run down (hunger, rest, play: 0 to 100), and its mood follows them (`moodOf`): hungry or neglected it
//    angers, left alone it grows lonely or bored, hurt or in a raid it is afraid;
//  - it chooses a deed (`chooseDeed`): each deed's weight from its kind's strengths, its needs, its mood, its nature
//    (a good beast does good, a cruel one cruelty) and what it has learned (`weights`, 2 to the power of the weight);
//  - the deed is done (`doDeed`): real work for the town (hauling, building, guarding, hunting, the fields, healing,
//    the children's play) or harm (crops eaten, the stores raided, a villager terrified or eaten), and its good or
//    evil rating (`align`, -100 to 100) moves by the deed (data `CREATURE_DEEDS[deed].align`);
//  - a notable deed puts a small card to the player (`ask`): praise makes that deed likelier, a scolding less likely
//    (`teachCreature`); unanswered in `ASK_HOURS` it counts as neither. Praise is its attention too (play).
// It grows from young to huge over `GROW_PACED_DAYS` paced days (slower when it is hungry), and bigger is stronger
// (`sizeShare`). Starved, or beaten in a raid, it can die. Every roll is from its own side stream; the player's
// commands (feed, rest, praise, scold) work with the autopilot off too.

import { ASK_GAP_HOURS, ASK_HOURS, BORN_SIZE, HIDE_HURT, RAID_DEATH, creatureUnit, CREATURE_SAGA, CREATURE_TOPIC, CREATURE_DEEDS, CREATURE_DEFS, GROW_PACED_DAYS, LEARN_MOST, LEARN_STEP, MEAL, MEND_HP, NEED_LOW, NEGLECT_AT, SLEEP_HOURS, STARVE_HP, alignWord, creatureTint, drawScale, sizeShare, sizeStage, type CreatureDeed, type CreatureKind, type CreatureMood } from '../data/creature';
import { DANGER_PACE } from '../data/pace';
import { FOOD_VALUE } from '../data/people';
import type { Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, deliveredShare, depositNear, storages } from './buildings';
import { takeFromStorage } from './expeditions';
import { cropOf, isField } from './farming';
import { killPerson } from './health';
import { CELL, type Pt } from './land';
import { beginSaga } from './sagas';
import { isChild } from './social';
import { campXY, maxHp, notify, type GameState, type Raid, type Raider } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from './time';
import { walk, type Walker } from './walk';

export interface CreatureState extends Walker {
  kind: CreatureKind;
  name: string;
  /** When it came (tick). */
  born: number;
  /** How big it is (BORN_SIZE to 1). */
  size: number;
  hp: number;
  /** Good (100) to evil (-100). */
  align: number;
  /** Its needs, 100 met to 0 pressing. */
  hunger: number;
  rest: number;
  play: number;
  /** Its passing feelings (0 to 100): anger from hunger, neglect and scolding; fear from wounds and raids. */
  anger: number;
  fear: number;
  /** Hours lately with a need neglected: it makes it worse-tempered. */
  neglect: number;
  /** What it has learned: each deed's weight (praise up, scolding down). */
  weights: Partial<Record<CreatureDeed, number>>;
  /** Times each deed was praised and scolded. */
  praised: Partial<Record<CreatureDeed, number>>;
  scolded: Partial<Record<CreatureDeed, number>>;
  /** What it is doing, till when, and where. */
  doing: CreatureDeed;
  until: number;
  /** The last notable deed, waiting on praise or scolding (gone once answered or lapsed). */
  ask?: { id: number; deed: CreatureDeed; tick: number; text: string };
  /** When it last asked (the asks are spaced `ASK_GAP_HOURS` apart, so the cards don't come every minute). */
  asked?: number;
  /** When it was last praised (tick): the map shows its joy. */
  praisedAt?: number;
  /** The work it has done for the town, by deed. */
  done: Partial<Record<CreatureDeed, number>>;
  /** Its last few deeds told, newest last. */
  log: string[];
  /** Dead, when and how (it stays for the card). */
  dead?: { tick: number; cause: string };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const rngOf = (s: GameState, salt: number) => new Rng(hashSeed(`${s.seed}:creature:${s.tick}:${salt}`));
const def = (c: CreatureState) => CREATURE_DEFS[c.kind];
/** The creature, if it lives. */
export const creatureOf = (s: GameState): CreatureState | null => (s.creature && !s.creature.dead ? s.creature : null);
const LOG_MOST = 8;

/** Its health when unhurt, by kind and size. */
export const creatureMaxHp = (c: Pick<CreatureState, 'kind' | 'size'>) => Math.round(CREATURE_DEFS[c.kind].hp * sizeShare(c.size));
/** Its blow, by kind and size. */
export const creatureAttack = (c: Pick<CreatureState, 'kind' | 'size'>) => Math.round(CREATURE_DEFS[c.kind].attack * sizeShare(c.size));
/** How much a deed's work is worth: bigger, and good at it, is more. */
const workOf = (c: CreatureState, d: CreatureDeed) => sizeShare(c.size) * (def(c).strengths[d] ?? 1);

/** The names a beast is given, by kind (the first that's free of the townsfolk's own). */
const NAMES: Record<CreatureKind, string[]> = {
  ape: ['Bramble', 'Old Knuckle', 'Mossback', 'Pip'],
  wolf: ['Greyfang', 'Ash', 'Moonjaw', 'Sleet'],
  bear: ['Bruin', 'Honeypaw', 'Old Thunder', 'Barley'],
  bull: ['Ironhorn', 'Thudd', 'Blackhoof', 'Bellow'],
  golem: ['Flint', 'Cairn', 'Old Granite', 'Pebble'],
};

/** The beast is the town's: the kind the player picked (the saga's choice), by the camp. */
export function adoptCreature(s: GameState, kind: CreatureKind): CreatureState {
  const at = campXY(s);
  const taken = new Set(s.people.map((p) => p.name));
  const name = NAMES[kind].find((n) => !taken.has(n)) ?? NAMES[kind][0];
  const c: CreatureState = {
    kind, name, born: s.tick, size: BORN_SIZE, hp: 0, align: 0,
    hunger: 80, rest: 80, play: 70, anger: 0, fear: 0, neglect: 0,
    weights: {}, praised: {}, scolded: {}, done: {}, log: [],
    doing: 'wander', until: s.tick,
    x: at.x + CELL * 2, y: at.y + CELL, dir: 1,
  };
  c.hp = creatureMaxHp(c);
  s.creature = c;
  notify(s, `${name} the ${def(c).name} is the town's now. Praise and scold it to teach it.`, true);
  return c;
}

/* ------------------------------------------------------------ the hour */

/** Every tick: it walks where its deed takes it; on the hour, it lives (autopilot only). */
export function creatureTick(s: GameState): void {
  const c = creatureOf(s);
  if (!c) return;
  if (c.goal && c.doing !== 'sleep' && !inRaid(s)) walk(s, c, c.goal, c.size > 0.6 ? 4.2 : 4.8, undefined, s.tick);
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  if (c.ask && s.tick - c.ask.tick >= ASK_HOURS * TICKS_PER_HOUR) c.ask = undefined; // (unanswered: neither)
  if (s.autopilot === false || s.gameOver) return;
  creatureHourly(s, c);
}

/** One game hour of the creature's life. */
export function creatureHourly(s: GameState, c: CreatureState): void {
  needsHour(s, c);
  if (c.dead) return;
  if (s.tick < c.until && c.doing === 'sleep') return; // (asleep: let it be)
  if (inRaid(s)) return; // (it is fighting: `creatureRaidOver` tells of it)
  const rng = rngOf(s, 1);
  const deed = chooseDeed(s, c, rng);
  // (a deed waiting on an answer is left to stand; the next is asked about only after a while)
  const ask = !c.ask && s.tick - (c.asked ?? -Infinity) >= ASK_GAP_HOURS * TICKS_PER_HOUR;
  doDeed(s, c, deed, rng, ask);
}

/** Its needs run down, it grows (or starves), and its feelings follow. */
function needsHour(s: GameState, c: CreatureState): void {
  const d = def(c);
  const big = 0.7 + 0.6 * c.size; // (a bigger beast eats more)
  const asleep = c.doing === 'sleep' && s.tick < c.until;
  c.hunger = clamp(c.hunger - d.hunger * big);
  c.rest = asleep ? clamp(c.rest + 18) : clamp(c.rest - d.rest);
  c.play = clamp(c.play - d.play);
  const low = Math.min(c.hunger, c.rest, c.play);
  c.neglect = low < NEGLECT_AT ? c.neglect + 1 : Math.max(0, c.neglect - 0.5);
  // (hunger and neglect anger it, the worse its temper; fed and minded, it calms)
  const sore = (c.hunger < NEED_LOW ? 6 : 0) + (c.rest < NEGLECT_AT ? 3 : 0) + Math.min(10, c.neglect);
  c.anger = clamp(c.anger + sore * (0.5 + d.temper) - (sore ? 0 : 5));
  c.fear = clamp(c.fear - 8 + (s.raid?.phase === 'active' && c.hp < creatureMaxHp(c) * 0.5 ? 25 : 0));
  // (it grows, slowly when hungry)
  const grow = 1 / (GROW_PACED_DAYS * DANGER_PACE * 24);
  c.size = Math.min(1, c.size + grow * (c.hunger > NEED_LOW ? 1 : 0.3));
  const most = creatureMaxHp(c);
  if (c.hunger <= 0) {
    c.hp -= STARVE_HP * (1 + c.size);
    if (c.hp <= 0) return creatureDies(s, c, 'starved');
  } else if (c.hunger > NEED_LOW) c.hp = Math.min(most, c.hp + MEND_HP * (1 + c.size));
}

/** Its mood: the most pressing feeling or need. */
export function moodOf(c: Pick<CreatureState, 'fear' | 'anger' | 'play' | 'hunger'>): CreatureMood {
  if (c.fear >= 50) return 'afraid';
  if (c.anger >= 50) return 'angry';
  if (c.play < NEED_LOW) return 'lonely';
  if (c.play < 55) return 'bored';
  return 'happy';
}

const MOOD_BEND: Record<CreatureMood, { work: number; bad: number; play: number; wander: number }> = {
  happy: { work: 1.5, bad: 0.5, play: 1, wander: 1 },
  bored: { work: 0.9, bad: 2, play: 1.5, wander: 1.5 },
  lonely: { work: 0.7, bad: 1.6, play: 3, wander: 1 },
  angry: { work: 0.5, bad: 3.5, play: 0.3, wander: 1 },
  afraid: { work: 0.4, bad: 0.6, play: 0.3, wander: 2.5 },
};

/** What it could do this hour, and where (a deed with nothing to do it to is left out). */
function chances(s: GameState, c: CreatureState): { deed: CreatureDeed; at: Pt; on?: number }[] {
  const home = s.people.filter((p) => p.away === null && !p.downed);
  const camp = campXY(s);
  const out: { deed: CreatureDeed; at: Pt; on?: number }[] = [];
  const store = storages(s)[0];
  const storeAt = store ? buildingCentre(store) : camp;
  const h = Math.floor(s.tick / TICKS_PER_HOUR);
  out.push({ deed: 'wander', at: { x: camp.x + ((h % 7) - 3) * CELL, y: camp.y + ((h % 5) - 2) * CELL } });
  out.push({ deed: 'sleep', at: { x: camp.x + CELL * 3, y: camp.y + CELL * 2 } });
  if (store) out.push({ deed: 'eat', at: storeAt }, { deed: 'steal', at: storeAt }, { deed: 'haul', at: storeAt });
  const site = s.buildings.find((b) => b.status === 'blueprint' && deliveredShare(b) > b.progress + 0.02);
  if (site) out.push({ deed: 'build', at: buildingCentre(site), on: site.id });
  const growing = s.buildings.find((b) => isField(b) && cropOf(b).stage === 'growing');
  if (growing) out.push({ deed: 'farm', at: buildingCentre(growing), on: growing.id }, { deed: 'eat_crops', at: buildingCentre(growing), on: growing.id });
  out.push({ deed: 'hunt', at: { x: camp.x - CELL * 12, y: camp.y + CELL * 4 } });
  if (calendarOf(s).hour >= 19 || calendarOf(s).hour < 6) out.push({ deed: 'guard', at: { x: camp.x + CELL * 6, y: camp.y } });
  const child = home.find((p) => isChild(p));
  if (child) out.push({ deed: 'play', at: { x: child.x, y: child.y }, on: child.id });
  const hurt = home.find((p) => p.hp < maxHp(p) * 0.7);
  if (hurt) out.push({ deed: 'heal', at: { x: hurt.x, y: hurt.y }, on: hurt.id });
  const victims = home.filter((p) => p.id !== s.mainId && !isChild(p));
  if (victims.length) {
    const v = victims[h % victims.length];
    out.push({ deed: 'scare', at: { x: v.x, y: v.y }, on: v.id });
    // (only a cruel beast or a starving, raging one would; and never while the town has but a handful)
    if ((c.align < -40 || (c.hunger < 10 && c.anger >= 60)) && home.length > 4) out.push({ deed: 'eat_villager', at: { x: v.x, y: v.y }, on: v.id });
  }
  return out;
}

/** The weight of a deed now: kind, needs, mood, nature and what it has learned. Exported for the tests. */
export function deedWeight(c: CreatureState, deed: CreatureDeed): number {
  const d = CREATURE_DEEDS[deed];
  const k = def(c);
  const bend = MOOD_BEND[moodOf(c)];
  let w = d.base * (k.strengths[deed] ?? 1);
  if (d.work) w *= bend.work;
  if (d.bad) w *= bend.bad * (0.5 + k.temper);
  if (deed === 'play') w *= bend.play * (1 + (100 - c.play) / 50);
  if (deed === 'wander') w *= bend.wander;
  if (deed === 'eat') w *= c.hunger < 50 ? 1 + (60 - c.hunger) / 6 : 0.2;
  if (deed === 'eat_crops' || deed === 'steal' || deed === 'hunt') w *= c.hunger < NEED_LOW ? 2.5 : 1;
  if (deed === 'sleep') w *= c.rest < NEED_LOW ? 1 + (NEED_LOW - c.rest) / 3 : c.rest < 60 ? 0.6 : 0.1;
  // (a good beast leans to good deeds, a cruel one to cruel)
  if (d.align) w *= Math.max(0.15, 1 + (Math.sign(d.align) * c.align) / 100);
  return w * 2 ** (c.weights[deed] ?? 0);
}

/** What it does this hour (drawn by weight). */
export function chooseDeed(s: GameState, c: CreatureState, rng: Rng): CreatureDeed {
  const opts = chances(s, c);
  const ws = opts.map((o) => deedWeight(c, o.deed));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < opts.length; i++) if ((r -= ws[i]) <= 0) return opts[i].deed;
  return opts[opts.length - 1].deed;
}

/** Food from the stores, most filling first, until `need` (food value) is met; returns what was eaten. */
function eatFood(s: GameState, need: number): number {
  let got = 0;
  for (const m of Object.keys(FOOD_VALUE) as Material[]) {
    const v = FOOD_VALUE[m]!;
    while (got < need && takeFromStorage(s, m, 1)) got += v;
    if (got >= need) break;
  }
  return got;
}

/** It does a deed: the town gains or suffers, its needs and nature move, and the player may be asked about it. */
export function doDeed(s: GameState, c: CreatureState, deed: CreatureDeed, rng: Rng, ask = true): void {
  const opt = chances(s, c).find((o) => o.deed === deed);
  const camp = campXY(s);
  c.doing = deed;
  c.until = s.tick + TICKS_PER_HOUR;
  c.goal = opt?.at ?? camp;
  c.path = undefined;
  const k = def(c);
  const f = workOf(c, deed);
  const on = s.people.find((p) => p.id === opt?.on);
  let what = CREATURE_DEEDS[deed].did;
  switch (deed) {
    case 'haul': {
      const n = Math.max(1, Math.round(3 * f));
      depositNear(s, camp, { wood: n, stone: Math.ceil(n / 2) });
      bump(c, 'haul', n + Math.ceil(n / 2));
      what = `hauled ${n + Math.ceil(n / 2)} loads of wood and stone in from the wild`;
      break;
    }
    case 'build': {
      const b = s.buildings.find((q) => q.id === opt?.on);
      if (b) b.progress = Math.min(deliveredShare(b) - 0.001, b.progress + 0.06 * f);
      bump(c, 'build', 1);
      break;
    }
    case 'guard':
      for (const p of s.people) if (p.away === null && !isChild(p)) p.morale = clamp(p.morale + 1);
      bump(c, 'guard', 1);
      break;
    case 'hunt': {
      const n = Math.max(1, Math.round(2 * f));
      depositNear(s, camp, rng.chance(0.4) ? { meat: n, hide: 1 } : { meat: n });
      c.hunger = clamp(c.hunger + 15);
      bump(c, 'hunt', n);
      break;
    }
    case 'farm': {
      const b = s.buildings.find((q) => q.id === opt?.on);
      if (b) cropOf(b).growth = Math.min(0.999, cropOf(b).growth + 0.05 * f);
      bump(c, 'farm', 1);
      break;
    }
    case 'play':
      for (const p of s.people) if (p.away === null && isChild(p)) p.morale = clamp(p.morale + 6);
      c.play = clamp(c.play + 35);
      c.anger = clamp(c.anger - 10);
      bump(c, 'play', 1);
      break;
    case 'heal':
      if (on) on.hp = Math.min(maxHp(on), on.hp + Math.round(15 * f));
      bump(c, 'heal', 1);
      what = on ? `tended ${on.name}'s wounds` : what;
      break;
    case 'fight':
      c.fear = clamp(c.fear + 5);
      bump(c, 'fight', 1);
      break;
    case 'eat_crops': {
      const b = s.buildings.find((q) => q.id === opt?.on);
      if (b) cropOf(b).growth = Math.max(0, cropOf(b).growth - 0.35);
      c.hunger = clamp(c.hunger + 40);
      break;
    }
    case 'steal':
      c.hunger = clamp(c.hunger + 10 * eatFood(s, MEAL * 2));
      c.play = clamp(c.play + 10);
      break;
    case 'scare':
      if (on) on.morale = clamp(on.morale - 12);
      c.play = clamp(c.play + 15);
      what = on ? `terrified ${on.name}` : what;
      break;
    case 'eat_villager':
      if (on) {
        what = `killed and ate ${on.name}`;
        killPerson(s, on, `killed and eaten by ${c.name} the ${k.name}`);
      }
      c.hunger = 100;
      c.anger = clamp(c.anger - 40);
      break;
    case 'eat': {
      const got = k.eats === 'stone' ? takeFromStorage(s, 'stone', MEAL) * 0.6 : eatFood(s, MEAL);
      c.hunger = clamp(c.hunger + got * 15);
      break;
    }
    case 'sleep':
      c.until = s.tick + SLEEP_HOURS * TICKS_PER_HOUR;
      break;
    case 'wander':
      c.play = clamp(c.play + 4);
      break;
  }
  const dd = CREATURE_DEEDS[deed];
  c.align = clamp(c.align + dd.align, -100, 100);
  if (!dd.notable) return;
  const text = `${c.name} the ${k.name} ${what}.`;
  c.log.push(text);
  if (c.log.length > LOG_MOST) c.log.splice(0, c.log.length - LOG_MOST);
  if (ask) {
    c.ask = { id: s.nextId++, deed, tick: s.tick, text };
    c.asked = s.tick;
  }
  if (dd.bad || deed === 'heal') notify(s, text, deed === 'eat_villager');
}

const bump = (c: CreatureState, d: CreatureDeed, n: number) => (c.done[d] = (c.done[d] ?? 0) + n);

function creatureDies(s: GameState, c: CreatureState, cause: string): void {
  c.dead = { tick: s.tick, cause };
  c.hp = 0;
  c.ask = undefined;
  c.goal = undefined;
  c.path = undefined;
  notify(s, `${c.name} the ${def(c).name} is dead: ${cause}.`, true);
}

/* ------------------------------------------------------------ raids */

/** Its unit in the raid under way, if it is fighting there. */
const unitOf = (s: GameState): Raider | undefined => s.raid?.raiders.find((rd) => rd.creature);
/** Whether it is out fighting in a raid now (the map leaves it to the raid's own drawing). */
export const inRaid = (s: GameState) => !!unitOf(s) && s.raid?.phase !== 'warning';

/** A raid comes: it goes out to fight as a big unit, as strong as it is grown (from raids.ts startRaid), unless it is
 *  too badly hurt (autopilot only). */
export function creatureAllies(s: GameState, raid: Raid, make: (kind: string) => Raider): boolean {
  const c = creatureOf(s);
  if (!c || s.autopilot === false || c.hp < creatureMaxHp(c) * HIDE_HURT) return false;
  const a = make(creatureUnit(c.kind));
  const k = sizeShare(c.size);
  a.maxHp = creatureMaxHp(c);
  a.hp = Math.max(1, Math.round(c.hp));
  a.might = k;
  a.creature = true;
  raid.raiders.push(a);
  notify(s, `${c.name} the ${def(c).name} goes out to meet the raiders.`);
  return true;
}

/** A raid over (from raids.ts endRaid): its health as the fight left it; beaten down, it may die (`RAID_DEATH`), else it
 *  limps home. A fight is a deed (it is braver and better for it), and the player is asked about it. */
export function creatureRaidOver(s: GameState, raid: Raid): void {
  const c = creatureOf(s);
  const a = raid.raiders.find((rd) => rd.creature);
  if (!c || !a) return;
  const rng = rngOf(s, 2);
  if (a.down || a.hp <= 0) {
    if (rng.chance(RAID_DEATH)) return creatureDies(s, c, 'killed fighting the raiders');
    c.hp = Math.max(1, Math.round(creatureMaxHp(c) * 0.15));
    c.fear = clamp(c.fear + 40);
    notify(s, `${c.name} the ${def(c).name} was beaten down by the raiders, and limps home.`, true);
  } else c.hp = Math.max(1, Math.min(creatureMaxHp(c), a.hp));
  c.x = a.x;
  c.y = a.y;
  c.path = undefined;
  doDeed(s, c, 'fight', rng, !c.ask);
}

/* ------------------------------------------------------------ the player's part */

/** Praise or scold its last notable deed: that deed grows likelier or less likely. Its nature moves with deeds, not
 *  with praise. Returns whether there was a deed to answer. */
export function teachCreature(s: GameState, praise: boolean): boolean {
  const c = creatureOf(s);
  if (!c?.ask) return false;
  const d = c.ask.deed;
  learn(c, d, praise ? 1 : -1);
  (praise ? c.praised : c.scolded)[d] = ((praise ? c.praised : c.scolded)[d] ?? 0) + 1;
  // (praise is attention; a scolding stings)
  if (praise) {
    c.play = clamp(c.play + 10);
    c.praisedAt = s.tick;
  } else c.anger = clamp(c.anger + 4 * (0.5 + def(c).temper));
  c.ask = undefined;
  return true;
}

/** A deed's learned weight moves by one step of praise (1) or scolding (-1). */
export function learn(c: CreatureState, d: CreatureDeed, by: number): void {
  c.weights[d] = Math.max(-LEARN_MOST, Math.min(LEARN_MOST, (c.weights[d] ?? 0) + by * LEARN_STEP * def(c).learn));
}

/** The player feeds it from the stores (stone for a golem): hunger met, and it likes the attention. */
export function feedCreature(s: GameState): boolean {
  const c = creatureOf(s);
  if (!c) return false;
  const got = def(c).eats === 'stone' ? takeFromStorage(s, 'stone', MEAL) * 0.6 : eatFood(s, MEAL);
  if (got <= 0) return false;
  c.hunger = clamp(c.hunger + got * 15);
  c.play = clamp(c.play + 8);
  c.anger = clamp(c.anger - 8);
  return true;
}

/** The player sends it to rest: it lies down by the camp. */
export function restCreature(s: GameState): boolean {
  const c = creatureOf(s);
  if (!c) return false;
  const camp = campXY(s);
  c.doing = 'sleep';
  c.until = s.tick + SLEEP_HOURS * TICKS_PER_HOUR;
  c.goal = { x: camp.x + CELL * 3, y: camp.y + CELL * 2 };
  c.path = undefined;
  return true;
}

/* ------------------------------------------------------------ seen */

export interface CreatureView {
  kind: CreatureKind;
  kindName: string;
  name: string;
  x: number;
  y: number;
  dir: 1 | -1;
  size: number;
  stage: string;
  /** How much larger than a person to draw it, and its tint by its nature. */
  scale: number;
  tint: number;
  align: number;
  alignWord: string;
  mood: CreatureMood;
  hunger: number;
  rest: number;
  play: number;
  hp: number;
  maxHp: number;
  ageDays: number;
  doing: CreatureDeed;
  asleep: boolean;
  /** Out fighting in a raid (drawn there, as a raider of the town's side). */
  fighting: boolean;
  /** The deeds it has learned to like and to shun, most first. */
  liked: string[];
  shunned: string[];
  ask: { id: number; text: string } | null;
  log: string[];
  dead: string | null;
  /** Ticks since it was last praised (left out if never): the map shows its joy. */
  praisedAgo?: number;
}

const DEED_NAMES: Record<CreatureDeed, string> = {
  haul: 'hauling', build: 'building', guard: 'guarding', hunt: 'hunting', farm: 'the fields', play: 'playing with children',
  heal: 'healing', fight: 'fighting raiders', eat_crops: 'eating crops', steal: 'raiding the stores', scare: 'scaring folk',
  eat_villager: 'eating folk', eat: 'eating', sleep: 'sleeping', wander: 'wandering',
};
export const deedName = (d: CreatureDeed) => DEED_NAMES[d];

export function creatureView(s: GameState): CreatureView | null {
  const c = s.creature;
  if (!c) return null;
  const learned = (Object.entries(c.weights) as [CreatureDeed, number][]).filter(([, w]) => Math.abs(w) >= 0.25);
  return {
    kind: c.kind, kindName: def(c).name, name: c.name, x: c.x, y: c.y, dir: c.dir,
    size: c.size, stage: sizeStage(c.size), scale: drawScale(c.size), tint: creatureTint(c.align),
    align: Math.round(c.align), alignWord: alignWord(c.align), mood: moodOf(c),
    hunger: Math.round(c.hunger), rest: Math.round(c.rest), play: Math.round(c.play),
    hp: Math.max(0, Math.round(c.hp)), maxHp: creatureMaxHp(c), ageDays: Math.floor((s.tick - c.born) / TICKS_PER_DAY),
    doing: c.doing, asleep: c.doing === 'sleep' && s.tick < c.until, fighting: inRaid(s),
    liked: learned.filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => DEED_NAMES[d]),
    shunned: learned.filter(([, w]) => w < 0).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([d]) => DEED_NAMES[d]),
    ask: c.ask ? { id: c.ask.id, text: c.ask.text } : null,
    log: c.log.slice(-4),
    dead: c.dead ? c.dead.cause : null,
    ...(c.praisedAt !== undefined ? { praisedAgo: s.tick - c.praisedAt } : {}),
  };
}

/** Once the town has studied God Creatures, its saga begins (once): the beast comes in it (autopilot only). */
export function creatureArrives(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver || s.creature) return;
  if (!s.research.done.includes(CREATURE_TOPIC)) return;
  if ((s.sagas ?? []).some((r) => r.id === CREATURE_SAGA) || (s.sagasDone ?? []).some((d) => d.id === CREATURE_SAGA)) return;
  beginSaga(s, CREATURE_SAGA);
}
