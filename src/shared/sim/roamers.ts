// Hostile bands roaming the town's land (data/roamers.ts: the owner's ask). Each hour a band may come out on the open
// land beyond the town: wild beasts, the restless dead by night, bandits later on. It wanders about where it came out,
// and anyone of the town out in the wilds within sight of it is run down; caught, they fight it on the FF screen (a
// `Skirmish`: the expeditions' fight, `startBattle`/`stepBattle`, watchable like a party's), those near by coming to
// help. A finished ring wall keeps them out; without one they keep to the town's edge by day and come right in at
// night. Guards on watch go out after a band near the town (people.ts's patrol), and a land with bands about draws
// fewer travellers (origin.ts `travellerRate`, bands.ts).

import { BIOME_BEASTS } from '../data/places';
import { ENEMIES } from '../data/enemies';
import {
  BANDITS_ROAM_FROM,
  CATCH_PX,
  CHASE_PACE,
  DAY_KEEP_OFF,
  GIVE_UP_CELLS,
  HELP_CELLS,
  NIGHT_FROM,
  NIGHT_UNTIL,
  PATROL_REACH,
  ROAM_DETER,
  ROAM_FIRST_DAY,
  ROAM_HOURLY,
  ROAM_HOURS,
  ROAM_KILLS,
  ROAM_PEOPLE,
  ROAMER_GROUPS,
  ROAMER_NAME,
  ROAMERS_LEAST,
  ROAMERS_MOST,
  ROAMERS_PER,
  SEE_CELLS,
  SKIRMISH_LINGER,
  SKIRMISH_MOST,
  SPAWN_BEYOND,
  SPAWN_SPREAD,
  UNSAFE_CELLS,
  WANDER_CELLS,
  WANDER_PACE,
  type RoamerKind,
} from '../data/roamers';
import { levelOf, xpToLevel } from '../data/levels';
import { hashSeed, Rng } from '../rng';
import { builtOn, depositNear, townRadius } from './buildings';
import { battleLoot, startBattle, stepBattle } from './combat';
import { killPerson, knockDown } from './health';
import { woundFor, woundPerson } from './injuries';
import { groundAt, inMap, wet } from './land';
import { lineOf, ringComplete } from './ringWall';
import { addStock, campXY, maxHp, meet, notify, type Expedition, type FightResult, type GameState, type Person, type Roamer, type Skirmish } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';
import { isChild } from './social';

const CELL = 32;
const FIGHT_XP = 6;

const roll = (s: GameState, ...salt: number[]) => new Rng(hashSeed(`${s.seed}:roam:${salt.join(':')}`));
const night = (hour: number) => hour >= NIGHT_FROM || hour < NIGHT_UNTIL;
const blighted = (s: GameState) => s.origin === 'lich' || s.origin === 'vampire';

/** The box the finished ring wall encloses (px), or null with none standing all round. */
function walledBox(s: GameState): { x0: number; y0: number; x1: number; y1: number } | null {
  const ring = s.ring;
  if (!ring || !(ring.done || ringComplete(s, ring))) return null;
  const line = lineOf(ring);
  if (!line.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of line) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  return { x0: x0 * CELL, y0: y0 * CELL, x1: (x1 + 1) * CELL, y1: (y1 + 1) * CELL };
}

/** How far out the town reaches (px from the camp): the ring's farthest side, else the town's edge. */
function townReach(s: GameState): number {
  const box = walledBox(s);
  const c = campXY(s);
  if (box) return Math.max(c.x - box.x0, box.x1 - c.x, c.y - box.y0, box.y1 - c.y);
  return townRadius(s) * CELL;
}

/** Whether a spot (px) is safe from a band at this hour: within the walls, or (with none) near the camp by day. */
export function sheltered(s: GameState, x: number, y: number): boolean {
  const box = walledBox(s);
  if (box) return x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
  if (night(calendar(s.tick).hour)) return false;
  const c = campXY(s);
  return Math.hypot(x - c.x, y - c.y) < (townRadius(s) - DAY_KEEP_OFF) * CELL;
}

/** Whether a band may stand at a spot (px): on the land, not water, mountain or a building, not in the shelter. */
function walkable(s: GameState, x: number, y: number): boolean {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (!inMap(s.land, cx, cy)) return false;
  const g = groundAt(s.land, cx, cy);
  if (wet(g) || g === 'mountain' || g === 'hall') return false;
  if (builtOn(s, cx, cy)) return false;
  return !sheltered(s, x, y);
}

/** The bands roaming within `UNSAFE_CELLS` of the camp: each puts travellers off (`roadSafety`). */
export function roamersNear(s: GameState): Roamer[] {
  const c = campXY(s);
  return (s.roamers ?? []).filter((r) => Math.hypot(r.x - c.x, r.y - c.y) <= UNSAFE_CELLS * CELL);
}
/** How many travellers still come through, as a share (1 with no band about). */
export const roadSafety = (s: GameState) => 1 / (1 + ROAM_DETER * roamersNear(s).length);

/** Whoever can be run down: out and about, in town, not in a fight already or indoors asleep. */
function prey(s: GameState): Person[] {
  return s.people.filter(
    (p) => p.away === null && !p.downed && p.skirmish === undefined && !(p.task?.type === 'sleep' && p.task.building !== null) && p.activity !== 'drink' && p.task?.type !== 'shelter',
  );
}

/** Every tick: the bands move, chase and catch; the fights go on; each hour a new band may come. */
export function roamersTick(s: GameState): void {
  // (new bands come only to a town running itself: the tests' plain towns meet only those they put there)
  if (s.tick % TICKS_PER_HOUR === 0 && s.autopilot !== false) roamersHourly(s);
  for (const k of [...(s.skirmishes ?? [])]) stepSkirmish(s, k);
  if (!s.roamers?.length) return;
  // (in a raid the land's bands keep off, and nobody is caught)
  if (s.raid) return;
  const folk = prey(s);
  for (const r of [...s.roamers]) {
    if (r.fighting !== undefined) continue;
    if ((s.tick + r.id) % 3 !== 0) continue;
    moveRoamer(s, r, folk);
  }
}

function moveRoamer(s: GameState, r: Roamer, folk: Person[]): void {
  const step = (pace: number, tx: number, ty: number): boolean => {
    const d = Math.hypot(tx - r.x, ty - r.y);
    if (d < 1) return true;
    const k = Math.min(1, (pace * 3) / d);
    const nx = r.x + (tx - r.x) * k;
    const ny = r.y + (ty - r.y) * k;
    if (!walkable(s, nx, ny)) return false;
    if (nx !== r.x) r.dir = nx > r.x ? 1 : -1;
    r.x = nx;
    r.y = ny;
    return true;
  };
  // after someone: run them down (they may have got under cover, or out of reach)
  if (r.chasing !== null) {
    const p = folk.find((q) => q.id === r.chasing);
    const far = Math.hypot(r.x - r.homeX, r.y - r.homeY) > GIVE_UP_CELLS * CELL;
    if (!p || far || sheltered(s, p.x, p.y ?? 0)) r.chasing = null;
    else {
      if (Math.hypot(p.x - r.x, (p.y ?? 0) - r.y) <= CATCH_PX) {
        startSkirmish(s, r, p);
        return;
      }
      if (!step(CHASE_PACE, p.x, p.y ?? 0)) r.chasing = null;
      return;
    }
  }
  // someone in sight, out in the open?
  const seen = folk
    .filter((p) => !sheltered(s, p.x, p.y ?? 0) && Math.hypot(p.x - r.x, (p.y ?? 0) - r.y) <= SEE_CELLS * CELL)
    .sort((a, b) => Math.hypot(a.x - r.x, (a.y ?? 0) - r.y) - Math.hypot(b.x - r.x, (b.y ?? 0) - r.y))[0];
  if (seen) {
    if (r.chasing !== seen.id) notify(s, `${seen.name} is set upon by ${ROAMER_NAME[r.kind]} out on the land!`);
    r.chasing = seen.id;
    return;
  }
  // else wander about where it came out
  if (Math.hypot(r.tx - r.x, r.ty - r.y) < 4 || !step(WANDER_PACE, r.tx, r.ty)) {
    const g = roll(s, r.id, s.tick);
    for (let i = 0; i < 6; i++) {
      const tx = r.homeX + g.range(-WANDER_CELLS, WANDER_CELLS) * CELL;
      const ty = r.homeY + g.range(-WANDER_CELLS, WANDER_CELLS) * CELL;
      if (walkable(s, tx, ty)) {
        r.tx = tx;
        r.ty = ty;
        break;
      }
    }
  }
}

/** Hourly: the dead crumble at dawn, bands wander off, and a new one may come out. */
export function roamersHourly(s: GameState): void {
  const hour = calendar(s.tick).hour;
  s.roamers = (s.roamers ?? []).filter((r) => {
    if (r.fighting !== undefined) return true;
    if (r.until <= s.tick) return false;
    if (r.kind === 'dead' && !night(hour) && !blighted(s)) return false;
    return true;
  });
  if (calendar(s.tick).day - 1 < ROAM_FIRST_DAY) return;
  const grown = s.people.filter((p) => p.away === null && !isChild(p)).length;
  if (grown < ROAM_PEOPLE) return;
  const most = Math.min(ROAMERS_MOST, ROAMERS_LEAST + Math.floor(grown / ROAMERS_PER));
  if (s.roamers.length >= most) return;
  const g = roll(s, s.tick);
  if (!g.chance(ROAM_HOURLY)) return;
  const kinds: RoamerKind[] = ['beasts'];
  if (night(hour) || blighted(s)) kinds.push('dead');
  if (calendar(s.tick).day - 1 >= BANDITS_ROAM_FROM) kinds.push('bandits');
  spawnRoamer(s, g.pick(kinds), g);
}

/** A band comes out on the land beyond the town (null when no spot will do). */
export function spawnRoamer(s: GameState, kind: RoamerKind, g: Rng = roll(s, s.tick, 7)): Roamer | null {
  const groups = (kind === 'beasts' && BIOME_BEASTS[s.biome ?? 'forest']) || ROAMER_GROUPS[kind][s.era] || ROAMER_GROUPS[kind].neolithic!;
  const group = { ...g.pick(groups) };
  if (Object.keys(group).some((id) => !ENEMIES[id])) return null;
  const c = campXY(s);
  const reach = townReach(s) / CELL;
  const open = s.land.open;
  for (let i = 0; i < 24; i++) {
    const a = g.next() * Math.PI * 2;
    const d = Math.min(open - 1, reach + SPAWN_BEYOND + g.next() * SPAWN_SPREAD);
    if (d <= reach + 2) return null;
    const x = c.x + Math.cos(a) * d * CELL;
    const y = c.y + Math.sin(a) * d * CELL;
    if (!walkable(s, x, y)) continue;
    const r: Roamer = { id: s.nextId++, kind, group, x, y, homeX: x, homeY: y, tx: x, ty: y, until: s.tick + Math.round(g.range(ROAM_HOURS[0], ROAM_HOURS[1]) * TICKS_PER_HOUR), chasing: null, dir: 1 };
    (s.roamers ??= []).push(r);
    return r;
  }
  return null;
}

/** The band a guard on watch should go after: the nearest within `PATROL_REACH` of the town's edge (or null). */
export function roamerToHunt(s: GameState, p: Person): Roamer | null {
  if (s.raid) return null;
  const c = campXY(s);
  const reach = townReach(s) + PATROL_REACH * CELL;
  let best: Roamer | null = null;
  let bestD = Infinity;
  for (const r of s.roamers ?? []) {
    if (r.fighting !== undefined || Math.hypot(r.x - c.x, r.y - c.y) > reach) continue;
    const d = Math.hypot(r.x - p.x, r.y - (p.y ?? 0));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/** A guard reaches a band they went after: the fight is on. */
export function guardEngages(s: GameState, p: Person): boolean {
  if (p.skirmish !== undefined) return false;
  const r = (s.roamers ?? []).find((q) => q.fighting === undefined && Math.hypot(q.x - p.x, q.y - (p.y ?? 0)) <= CATCH_PX * 1.5);
  if (!r) return false;
  startSkirmish(s, r, p);
  return true;
}

/** A fight on the land: the one caught, and anyone near enough to help (guards on watch first), up to
 *  `SKIRMISH_MOST`; fought on the FF screen. */
export function startSkirmish(s: GameState, r: Roamer, caught: Person): Skirmish {
  const helpers = s.people
    .filter((q) => q !== caught && q.away === null && !q.downed && q.skirmish === undefined && !isChild(q) && q.task?.type !== 'sleep' && Math.hypot(q.x - r.x, (q.y ?? 0) - r.y) <= HELP_CELLS * CELL)
    .sort((a, b) => Number(!!b.guard) - Number(!!a.guard) || Math.hypot(a.x - r.x, (a.y ?? 0) - r.y) - Math.hypot(b.x - r.x, (b.y ?? 0) - r.y))
    .slice(0, SKIRMISH_MOST - 1);
  const members = [caught, ...helpers];
  const id = s.nextId++;
  const g = roll(s, id, s.tick);
  const e: Expedition = {
    id,
    dest: `wild:${r.kind}`,
    members: members.map((p) => p.id),
    phase: 'work',
    elapsed: 0,
    outTicks: 1,
    workTicks: 1,
    backTicks: 1,
    work: 0,
    loot: {},
    supplies: {},
    recalled: false,
    roles: Object.fromEntries(members.map((p) => [p.id, 'fighter' as const])),
    stance: 'balanced',
    battle: null,
    prompt: null,
    rolled: { outEvent: true, backEvent: true, ambush: true },
    waterskins: 0,
  };
  e.battle = startBattle(members, e.roles, r.group, g);
  meet(s, Object.keys(r.group));
  const k: Skirmish = { id, roamer: r.id, x: r.x, y: r.y, e };
  (s.skirmishes ??= []).push(k);
  r.fighting = id;
  r.chasing = null;
  for (const p of members) {
    p.skirmish = id;
    p.task = null;
    p.activity = 'fight';
    if (p.x !== r.x) p.dir = r.x > p.x ? 1 : -1;
  }
  notify(s, `${names(members)} ${members.length > 1 ? 'fight' : 'fights'} ${ROAMER_NAME[r.kind]} out on the land.`, true);
  return k;
}

const names = (ps: Person[]) => (ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(', ')} and ${ps[ps.length - 1].name}`);

/** The fight goes on a beat; over, its harm is carried back to the people and the band is gone or goes on. */
function stepSkirmish(s: GameState, k: Skirmish): void {
  if (k.ended !== undefined) {
    if (s.tick - k.ended >= SKIRMISH_LINGER) s.skirmishes = (s.skirmishes ?? []).filter((q) => q !== k);
    return;
  }
  const b = k.e.battle;
  const members = k.e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p && p.skirmish === k.id);
  if (!b || !members.length) return endSkirmish(s, k, members, 'lost');
  stepBattle(b, roll(s, k.id, s.tick), { retreatAt: 0.25, mainId: members.some((p) => p.id === s.mainId) ? s.mainId : null });
  if (b.outcome) endSkirmish(s, k, members, b.outcome);
}

function endSkirmish(s: GameState, k: Skirmish, members: Person[], outcome: 'won' | 'retreated' | 'lost'): void {
  const b = k.e.battle;
  const r = (s.roamers ?? []).find((q) => q.id === k.roamer);
  const g = roll(s, k.id, 99);
  const result: FightResult = { tick: s.tick, outcome, members: [], loot: {}, coins: 0, foes: b ? [...new Set(b.fighters.filter((f) => f.side === 'enemy').map((f) => f.name))] : [], boss: null };
  for (const f of b?.fighters ?? []) {
    if (f.side !== 'party' || f.kind !== 'person') continue;
    const p = members.find((q) => q.id === f.ref);
    if (!p) continue;
    const was = p.hp;
    if (f.down && !p.downed) knockDown(s, p);
    else if (!f.down) p.hp = Math.max(1, Math.min(maxHp(p), Math.round((f.hp * maxHp(p)) / Math.max(1, f.maxHp))));
    const harm = f.down ? Math.max(was, maxHp(p) * 0.5) : was - p.hp;
    const foes = b!.fighters.filter((x) => x.side === 'enemy');
    if (harm > 0 && foes.length) woundPerson(s, p, harm, (sev) => woundFor(g.pick(foes).kind, sev, g), g);
    const from = levelOf(p);
    const xpFrom = p.lvXp ?? 0;
    if (f.attacks) gainSkill(p, f.ranged ? 'ranged' : 'melee', f.attacks * FIGHT_XP);
    const to = levelOf(p);
    let xp = (p.lvXp ?? 0) - xpFrom;
    for (let l = from; l < to; l++) xp += xpToLevel(l);
    result.members.push({ id: p.id, name: p.name, xp: Math.round(xp), levelFrom: from, levelTo: to, down: f.down });
  }
  for (const p of members) delete p.skirmish;
  if (outcome === 'won') {
    const loot = b ? battleLoot(b) : {};
    for (const [m, n] of Object.entries(loot)) addStock(result.loot, m as never, n);
    depositNear(s, { x: k.x, y: k.y }, result.loot);
    s.roamers = (s.roamers ?? []).filter((q) => q.id !== k.roamer);
    notify(s, `${names(members)} saw off the ${r ? ROAMER_NAME[r.kind] : 'band'} on the land.`, true);
  } else {
    // (they run for home; whoever went down may not get up: the dead and bandits finish their work, beasts drag one off)
    for (const p of members) if (p.downed && g.chance(ROAM_KILLS)) killPerson(s, p, `was killed by ${r ? ROAMER_NAME[r.kind] : 'a band'} out on the land`);
    // (and it goes off with what it took: a band fights once)
    s.roamers = (s.roamers ?? []).filter((q) => q.id !== k.roamer);
    notify(s, `${names(members)} ${members.length > 1 ? 'were' : 'was'} driven off by ${r ? ROAMER_NAME[r.kind] : 'a band'} on the land.`, true);
  }
  k.e.result = result;
  k.e.battle = null;
  k.ended = s.tick;
}

/** A skirmish shaped as a trip, for the watched fight (snapshot.ts); null when there's none by that id. */
export const skirmishTrip = (s: GameState, id: number | undefined): Expedition | undefined => (id === undefined ? undefined : (s.skirmishes ?? []).find((k) => k.id === id)?.e);
