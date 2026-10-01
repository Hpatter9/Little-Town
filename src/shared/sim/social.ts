// Relationships and families (DESIGN §7): people who spend time near each other grow fond of each other
// (friends), or grate (rivals). Two single adults who are very fond become a couple; with Family Life
// researched, couples marry and may welcome children, who grow up over about a week of real time and
// take after a parent. Losing someone close hits hard.

import { NAMES, randomLook } from '../data/people';
import {
  CHILD_CHANCE,
  CHILD_HOURS,
  COUPLE,
  COUPLE_CHANCE,
  FRICTION,
  FRICTION_CHANCE,
  FRIEND,
  GRIEF_FRIEND,
  GRIEF_PARTNER,
  GRAVEYARD_GRIEF,
  MARRY,
  MARRY_CHANCE,
  MAX_CHILDREN,
  NEAR_PX,
  RIVAL,
  SCHOOL_BONUS,
  WARM_PER_HOUR,
  WEDDING_MORALE,
} from '../data/social';
import { SKILLS, type Skill, type SkillLevel } from '../data/skills';
import { hashSeed, mixSeed, type Rng } from '../rng';
import { tireless, maxHp, notify, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';
import { housingCapacity } from './townsfolk';

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export const opinion = (s: GameState, a: number, b: number): number => s.relations[key(a, b)] ?? 0;

/* Who counts as whose friend or rival is asked for everyone's mood, which is n x n opinion lookups: so it's
   worked out once from the relations table and kept until an opinion changes (or the tick moves on). */
const relationsRev = new WeakMap<GameState, number>();
/** Call after writing s.relations directly. */
export const relationsChanged = (s: GameState) => relationsRev.set(s, (relationsRev.get(s) ?? 0) + 1);
interface Ties {
  rev: number;
  tick: number;
  friends: Map<number, Set<number>>;
  rivals: Map<number, Set<number>>;
}
const tiesMemo = new WeakMap<GameState, Ties>();
function ties(s: GameState): Ties {
  const rev = relationsRev.get(s) ?? 0;
  const hour = Math.floor(s.tick / TICKS_PER_HOUR); // (and once an hour anyway, in case something wrote the table directly)
  let t = tiesMemo.get(s);
  if (t && t.rev === rev && t.tick === hour) return t;
  t = { rev, tick: hour, friends: new Map(), rivals: new Map() };
  const put = (m: Map<number, Set<number>>, a: number, b: number) => (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
  for (const k in s.relations) {
    const v = s.relations[k];
    if (v < FRIEND && v > RIVAL) continue;
    const dash = k.indexOf('-');
    const a = Number(k.slice(0, dash));
    const b = Number(k.slice(dash + 1));
    const m = v >= FRIEND ? t.friends : t.rivals;
    put(m, a, b);
    put(m, b, a);
  }
  tiesMemo.set(s, t);
  return t;
}

function adjust(s: GameState, a: number, b: number, by: number): number {
  const v = Math.max(-100, Math.min(100, opinion(s, a, b) + by));
  s.relations[key(a, b)] = v;
  relationsChanged(s);
  return v;
}

export const isChild = (p: Person) => p.bornTick != null;

/** People in town (not away, not a captive) someone could get to know. */
const inTown = (s: GameState) => s.people.filter((p) => p.away === null);

export function friendsOf(s: GameState, p: Person): Person[] {
  const mine = ties(s).friends.get(p.id);
  return mine ? s.people.filter((o) => o !== p && mine.has(o.id)) : [];
}

export function rivalsOf(s: GameState, p: Person): Person[] {
  const mine = ties(s).rivals.get(p.id);
  return mine ? s.people.filter((o) => o !== p && mine.has(o.id)) : [];
}

/** Once an hour: opinions shift, couples form, marry, and children arrive and grow up. */
export function updateSocial(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const here = inTown(s);
  for (let i = 0; i < here.length; i++) {
    for (let j = i + 1; j < here.length; j++) {
      const a = here[i];
      const b = here[j];
      if (Math.abs(a.x - b.x) > NEAR_PX) continue;
      const social = 1 + (a.skills.social.level + b.skills.social.level) / 20;
      const loner = a.traits.includes('loner') || b.traits.includes('loner') ? 0.5 : 1;
      let v = adjust(s, a.id, b.id, WARM_PER_HOUR * chemistry(s, a.id, b.id) * social * loner);
      if (rng.chance(FRICTION_CHANCE * (1 + friction(a) + friction(b)))) v = adjust(s, a.id, b.id, -FRICTION);
      if (v >= COUPLE && canPair(a) && canPair(b) && rng.chance(COUPLE_CHANCE)) {
        a.partner = b.id;
        b.partner = a.id;
        notify(s, `${a.name} and ${b.name} are a couple.`, true);
      }
    }
  }
  families(s, rng);
  growUp(s);
}

/** How well a pair gets on, fixed for the pair (from the world seed and their ids): -0.4 .. 1.4. */
export function chemistry(s: GameState, a: number, b: number): number {
  const h = mixSeed(hashSeed(s.seed), Math.min(a, b) * 7919 + Math.max(a, b));
  return ((h >>> 0) % 1801) / 1000 - 0.4;
}

/** Traits that rub people the wrong way. */
const friction = (p: Person) => ['lazy', 'glutton', 'coward', 'loner'].filter((t) => p.traits.includes(t)).length * 0.5;

const canPair = (p: Person) => !isChild(p) && (p.partner ?? null) === null && !tireless(p);

function families(s: GameState, rng: Rng): void {
  if (!s.research.done.includes('family_life')) return;
  for (const a of inTown(s)) {
    const b = a.partner == null ? undefined : s.people.find((q) => q.id === a.partner);
    if (!b || a.id > b.id || b.away !== null) continue; // each couple once
    if (!a.married && opinion(s, a.id, b.id) >= MARRY && rng.chance(MARRY_CHANCE)) {
      a.married = b.married = true;
      s.celebrationUntil = s.tick + WEDDING_MORALE[1] * TICKS_PER_HOUR;
      notify(s, `${a.name} and ${b.name} were married! The whole town celebrates.`, true);
      continue;
    }
    const kids = s.people.filter((k) => k.parents?.includes(a.id) && k.parents.includes(b.id)).length;
    if (a.married && kids < MAX_CHILDREN && housingCapacity(s) > s.people.length && rng.chance(CHILD_CHANCE)) welcomeChild(s, a, b, rng);
  }
}

function welcomeChild(s: GameState, a: Person, b: Person, rng: Rng): void {
  const taken = [...s.people, ...s.captives].map((p) => p.name);
  const free = NAMES.filter((n) => !taken.includes(n));
  const parent = rng.chance(0.5) ? a : b;
  const passion = parent.passions.length ? rng.pick(parent.passions) : rng.pick(SKILLS);
  const skills = Object.fromEntries(SKILLS.map((k) => [k, { level: 1, xp: 0 }])) as Record<Skill, SkillLevel>;
  const ears = a.look.ears ?? b.look.ears; // (a fae's or a merfolk founder's children have their ears)
  const look = { ...randomLook(rng), skin: rng.chance(0.5) ? a.look.skin : b.look.skin, hairColor: rng.chance(0.5) ? a.look.hairColor : b.look.hairColor, ...(ears ? { ears } : {}) };
  const child: Person = {
    id: s.nextId++,
    name: rng.pick(free.length ? free : NAMES),
    type: 'child',
    look: { ...look, beard: false },
    x: a.x,
    dir: 1,
    skills,
    passions: [passion],
    traits: [],
    needs: { food: 1, rest: 1 },
    morale: 70,
    lastSlept: null,
    bed: null,
    priorities: { haul: 0, construct: 0, farm: 0, craft: 0, research: 0, gather: 0, defend: 0 },
    autoPriorities: false,
    task: null,
    activity: 'idle',
    carrying: {},
    gear: {},
    blocked: false,
    away: null,
    hp: maxHp({ traits: [] }),
    downed: null,
    partner: null,
    bornTick: s.tick,
    parents: [a.id, b.id],
  };
  s.people.push(child);
  adjust(s, child.id, a.id, 60);
  adjust(s, child.id, b.id, 60);
  notify(s, `${a.name} and ${b.name} welcomed a child, ${child.name}.`, true);
}

/** Children come of age: a few skill points (more in their passion), their own priorities. */
function growUp(s: GameState): void {
  for (const p of s.people) {
    if (!isChild(p) || s.tick - p.bornTick! < CHILD_HOURS * TICKS_PER_HOUR) continue;
    p.bornTick = null;
    p.type = 'wanderer';
    const school = s.buildings.some((b) => b.def === 'school' && b.status === 'done') ? SCHOOL_BONUS : 0;
    for (const k of SKILLS) p.skills[k].level = (p.passions.includes(k) ? 5 : 2) + school;
    p.autoPriorities = true;
    p.priorities = { haul: 2, construct: 2, farm: 2, craft: 2, research: 2, gather: 2, defend: 3 };
    notify(s, `${p.name} has grown up and joins the work.`, true);
  }
}

/** A graveyard stands in town. */
export const hasGraveyard = (s: GameState) => s.buildings.some((b) => b.def === 'graveyard' && b.status === 'done');

/** When someone dies, their partner and friends grieve (for half as long once there's a graveyard to lay them in). */
export function grieve(s: GameState, dead: Person): void {
  const eased = hasGraveyard(s) ? GRAVEYARD_GRIEF : 1;
  for (const p of s.people) {
    if (p === dead) continue;
    if (p.partner === dead.id) {
      p.grief = { until: s.tick + GRIEF_PARTNER[1] * eased * TICKS_PER_HOUR, value: GRIEF_PARTNER[0], text: `Lost ${dead.name}` };
      p.partner = null;
      p.married = false;
    } else if (opinion(s, p.id, dead.id) >= FRIEND || p.parents?.includes(dead.id) || dead.parents?.includes(p.id)) {
      p.grief = { until: s.tick + GRIEF_FRIEND[1] * eased * TICKS_PER_HOUR, value: GRIEF_FRIEND[0], text: `Misses ${dead.name}` };
    }
  }
  for (const k of Object.keys(s.relations)) if (k.split('-').includes(String(dead.id))) delete s.relations[k];
  relationsChanged(s);
}
