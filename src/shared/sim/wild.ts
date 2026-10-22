// The living wilderness (the owner's ask): the land beyond the town is an ecosystem. Game lives in herds that graze,
// breed and walk to their winter ground and back with the seasons; packs of predators follow them, and when the game is
// scarce or far they turn on the town, taking pen animals and sending a small band out at whoever is on the land (a
// roaming band, sim/roamers.ts, with no raid budget). Hunters (an expedition of type 'hunt') take real game from the
// nearest herd: hunted out near town, the herds are further off, the hunting poorer and the road longer and more
// dangerous; left alone, the herds breed back and new ones drift in each spring. The woods spread into open land (up to a
// cap) and wildfires/rivers are in disasters.ts and rivers.ts. Everything here draws on its own seeded stream ('wild'),
// runs only with the autopilot on, and lives in the optional `GameState.wild`.

import {
  BIOME_GAME,
  BIOME_PREDATORS,
  BIRTH_RATE,
  DEATH_RATE,
  DEFAULT_GAME,
  DEFAULT_PREDATORS,
  DRIFT_IN,
  DRY_FIRE_HOURLY,
  DRY_YEAR,
  GRAZE_STEP,
  HERD_DEFS,
  HERD_FAR,
  HERD_KEEP_OFF,
  HERD_NEAR,
  HERD_TARGET,
  HUNGER_RATE,
  HUNGRY_AT,
  HUNT_NEAR,
  HUNT_UNITS_PER_HEAD,
  HUNT_RISK_MAX,
  HUNT_RISK_PER_CELL,
  HUNT_TRAVEL_MAX,
  HUNT_YIELD_MIN,
  KILL_CHANCE,
  KILL_RELIEF,
  MIGRATE_STEP,
  PACK_HOURS,
  PACK_NAMES,
  PACK_REST_DAYS,
  PACK_STEP,
  PACK_STRIKE,
  PACK_TARGET,
  PEN_STRIKE,
  PEN_TAKE,
  SPREAD_PER_DAY,
  WIND_TURN,
  WOOD_CAP,
  packFoes,
  type HerdKind,
  type PackKind,
} from '../data/wild';
import { BUILDING_BY_ID } from '../data/buildings';
import { ROAM_FIRST_DAY, ROAM_PEOPLE } from '../data/roamers';
import { TERRAIN } from '../data/terrain';
import type { Material } from '../data/materials';
import { Rng, hashSeed } from '../rng';
import { builtOn, buildingCentre, footprint, townRadius } from './buildings';
import { CELL, cellAt, groundAt, idx, inMap, isRoad, setGround, wearAt, WEAR_SHOW, type Ground } from './land';
import { blighted } from './blight';
import { herdOf, isPen } from './livestock';
import { sheltered, spawnRoamerAt, townReachCells } from './roamers';
import { isChild } from './social';
import { notify, type GameState } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, type Calendar, calendarOf } from './time';
import { drought } from './doom';
import { raining, startDisaster, woodsNear } from './disasters';

/** A herd of game (cells from the land's corner): where it is now, its summer ground (a) and winter ground (b). */
export interface Herd {
  id: number;
  kind: HerdKind;
  x: number;
  y: number;
  n: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
/** A pack of predators following the game. `hunger` runs 0 (fed) to 1; `out` is the roaming band it sent against the
 *  town (a roamer's id); it rests until `rest`. */
export interface Pack {
  id: number;
  kind: PackKind;
  x: number;
  y: number;
  n: number;
  hunger: number;
  out?: number;
  rest?: number;
}
export interface Wild {
  herds: Herd[];
  packs: Pack[];
  /** The wind's heading today (radians; 0 blows east, a quarter turn south) and the day it was last drawn. */
  wind: number;
  windDay: number;
  /** Game taken by hunters in all, and the count towards the next head. */
  shot: number;
  tally: number;
  /** The woods the land began with (cells), and the cells grown since. */
  woodBase?: number;
  grown: number;
}

const rngFor = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:wild:${salt.join(':')}`));
const campCells = (s: GameState) => ({ x: s.land.camp.x + 0.5, y: s.land.camp.y + 0.5 });
const distCamp = (s: GameState, x: number, y: number) => Math.hypot(x - s.land.camp.x, y - s.land.camp.y);

/** Where the game and the hunters may stand: open ground, clear of the town. */
function grazable(s: GameState, x: number, y: number, keep = HERD_KEEP_OFF): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (!inMap(s.land, cx, cy)) return false;
  const g = groundAt(s.land, cx, cy);
  if (g !== 'grass' && g !== 'forest' && g !== 'fertile' && g !== 'hill' && g !== 'sand' && g !== 'marsh') return false;
  const d = distCamp(s, x, y);
  return d >= townReachCells(s) + keep && d <= HERD_FAR + 20;
}

const pickKind = <T extends string>(g: Rng, table: [T, number][]): T => {
  let r = g.next() * table.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of table) if ((r -= w) < 0) return k;
  return table[0][0];
};
const gameOf = (s: GameState) => BIOME_GAME[s.biome ?? 'forest'] ?? DEFAULT_GAME;
const hunters = (s: GameState) => BIOME_PREDATORS[s.biome ?? 'forest'] ?? DEFAULT_PREDATORS;

/** A spot (cells) on grazable ground between two distances of the camp, or null. */
function spotAround(s: GameState, g: Rng, near: number, far: number): { x: number; y: number } | null {
  const reach = townReachCells(s);
  for (let i = 0; i < 30; i++) {
    const a = g.next() * Math.PI * 2;
    const d = Math.max(reach + HERD_KEEP_OFF, near) + g.next() * (far - near);
    const x = s.land.camp.x + 0.5 + Math.cos(a) * d;
    const y = s.land.camp.y + 0.5 + Math.sin(a) * d;
    if (grazable(s, x, y)) return { x, y };
  }
  return null;
}

function newHerd(s: GameState, w: Wild, g: Rng, at: { x: number; y: number }, n: number): Herd {
  const kind = pickKind(g, gameOf(s));
  // (its winter ground: some way off, where the land allows; else it stays put)
  let b = at;
  for (let i = 0; i < 12; i++) {
    const a = g.next() * Math.PI * 2;
    const d = g.range(9, 18);
    const x = at.x + Math.cos(a) * d;
    const y = at.y + Math.sin(a) * d;
    if (grazable(s, x, y)) {
      b = { x, y };
      break;
    }
  }
  const h: Herd = { id: s.nextId++, kind, x: at.x, y: at.y, n, ax: at.x, ay: at.y, bx: b.x, by: b.y };
  w.herds.push(h);
  return h;
}

/** The wild the first time it's asked for: the herds spread over the land, and a pack or two following them. */
function seed(s: GameState): Wild {
  const g = rngFor(s, 'seed');
  const w: Wild = { herds: [], packs: [], wind: g.next() * Math.PI * 2, windDay: -1, shot: 0, tally: 0, grown: 0 };
  s.wild = w;
  for (let i = 0; i < HERD_TARGET; i++) {
    const at = spotAround(s, g, HERD_NEAR, HERD_FAR);
    if (!at) continue;
    const kind = pickKind(g, gameOf(s));
    const [lo, hi] = HERD_DEFS[kind].start;
    const h = newHerd(s, w, g, at, g.int(lo, hi));
    h.kind = kind;
  }
  for (let i = 0; i < PACK_TARGET; i++) newPack(s, w, g);
  return w;
}

function newPack(s: GameState, w: Wild, g: Rng): Pack | null {
  const at = spotAround(s, g, HERD_NEAR, HERD_FAR);
  if (!at) return null;
  const kind = g.pick(hunters(s));
  const p: Pack = { id: s.nextId++, kind, x: at.x, y: at.y, n: kind === 'bears' ? 1 : g.int(3, 5), hunger: g.range(0.1, 0.4) };
  w.packs.push(p);
  return p;
}

/** The nearest herd of two or more to a spot (cells). */
function nearestHerd(w: Wild, x: number, y: number, within = Infinity): Herd | null {
  let best: Herd | null = null;
  let bd = within;
  for (const h of w.herds) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (h.n >= 2 && d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}

/** Each tick from sim.ts: the hour's turn of the wild. */
export function wildHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const w = s.wild ?? seed(s);
  const cal = calendarOf(s);
  const g = rngFor(s, s.tick);
  // (the wind turns a little each day)
  if (w.windDay !== cal.day) {
    w.windDay = cal.day;
    w.wind += g.range(-WIND_TURN, WIND_TURN);
  }
  for (const h of w.herds) stepHerd(s, h, g, cal.season);
  w.herds = w.herds.filter((h) => h.n >= 2);
  if (cal.hour === 6) {
    driftIn(s, w, g, cal.season);
    spreadWoods(s, w, g, cal.season);
  }
  for (const p of [...w.packs]) stepPack(s, w, p, g);
  w.packs = w.packs.filter((p) => p.n >= 2 || (p.kind === 'bears' && p.n >= 1));
  if (cal.hour === 18 && cal.season === 'autumn' && w.packs.length < PACK_TARGET && w.herds.reduce((a, h) => a + h.n, 0) >= 20) newPack(s, w, g);
  wildfireStart(s, w, g, cal);
}

/** A step along (tx, ty), turning aside round ground it can't stand on. */
function walkTo(s: GameState, o: { x: number; y: number }, tx: number, ty: number, step: number, keep: number): void {
  const d = Math.hypot(tx - o.x, ty - o.y);
  if (d < 0.05) return;
  const a0 = Math.atan2(ty - o.y, tx - o.x);
  const k = Math.min(step, d);
  for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
    const x = o.x + Math.cos(a0 + turn) * k;
    const y = o.y + Math.sin(a0 + turn) * k;
    if (grazable(s, x, y, keep)) {
      o.x = x;
      o.y = y;
      return;
    }
  }
}

function stepHerd(s: GameState, h: Herd, g: Rng, season: string): void {
  const def = HERD_DEFS[h.kind];
  // (to the winter ground in autumn and winter, back to the summer ground in spring)
  const [tx, ty] = season === 'autumn' || season === 'winter' ? [h.bx, h.by] : [h.ax, h.ay];
  if (Math.hypot(tx - h.x, ty - h.y) > 1.2) walkTo(s, h, tx, ty, MIGRATE_STEP, HERD_KEEP_OFF);
  else walkTo(s, h, h.x + g.range(-1, 1), h.y + g.range(-1, 1), GRAZE_STEP, HERD_KEEP_OFF);
  const season_ = season as 'spring';
  const room = Math.max(0, 1 - h.n / def.cap);
  let born = 0;
  let died = 0;
  const br = BIRTH_RATE[season_] * room;
  const dr = DEATH_RATE[season_];
  for (let i = 0; i < h.n; i++) {
    if (br && g.chance(br)) born++;
    if (dr && g.chance(dr)) died++;
  }
  h.n = Math.max(0, Math.min(def.cap, h.n + born - died));
}

/** In spring, a herd the land lacks drifts in from beyond the fog. */
function driftIn(s: GameState, w: Wild, g: Rng, season: string): void {
  if (season !== 'spring' || w.herds.length >= HERD_TARGET) return;
  const at = spotAround(s, g, HERD_FAR + 4, HERD_FAR + 14);
  if (at) newHerd(s, w, g, at, g.int(DRIFT_IN[0], DRIFT_IN[1]));
}

const dirName = (s: GameState, x: number, y: number) => {
  const dx = x - s.land.camp.x;
  const dy = y - s.land.camp.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
};

function stepPack(s: GameState, w: Wild, p: Pack, g: Rng): void {
  const reach = townReachCells(s);
  // (it has a band out against the town: it waits for it to be seen off, then drops back to the wild)
  if (p.out !== undefined) {
    if ((s.roamers ?? []).some((r) => r.id === p.out)) return;
    p.out = undefined;
    p.hunger = 0.25;
    p.rest = s.tick + PACK_REST_DAYS * TICKS_PER_DAY;
    if (p.n > 2 && g.chance(0.5)) p.n--;
    return;
  }
  p.hunger = Math.min(1, p.hunger + HUNGER_RATE);
  const resting = p.rest !== undefined && s.tick < p.rest;
  const prey = nearestHerd(w, p.x, p.y, 40);
  const grown = s.people.filter((q) => q.away === null && !isChild(q)).length;
  const ready = calendarOf(s).day - 1 >= ROAM_FIRST_DAY && grown >= ROAM_PEOPLE && !s.raid && s.origin !== 'lich' && s.origin !== 'vampire';
  // (hungry, and no game near enough, or starving: it turns on the town)
  if (ready && !resting && p.hunger >= HUNGRY_AT && (!prey || Math.hypot(prey.x - p.x, prey.y - p.y) > 30 || p.hunger >= 0.9)) {
    const c = campCells(s);
    const pen = penTarget(s, p);
    const to = pen ?? c;
    walkTo(s, p, to.x, to.y, PACK_STEP * 1.3, 1);
    if (distCamp(s, p.x, p.y) <= reach + PACK_STRIKE) strike(s, p, g);
    return;
  }
  if (prey) {
    walkTo(s, p, prey.x, prey.y, PACK_STEP, reach + 4);
    if (Math.hypot(prey.x - p.x, prey.y - p.y) < 2 && p.hunger > 0.25 && g.chance(KILL_CHANCE)) {
      prey.n--;
      p.hunger = Math.max(0, p.hunger - KILL_RELIEF);
      // (the herd scatters away from the kill)
      walkTo(s, prey, prey.x + (prey.x - p.x) * 4, prey.y + (prey.y - p.y) * 4, 3, HERD_KEEP_OFF);
    }
    return;
  }
  walkTo(s, p, p.x + g.range(-6, 6), p.y + g.range(-6, 6), PACK_STEP, reach + 4);
}

/** The pen a hungry pack heads for: the nearest with animals in it that nothing shelters (cells). */
function penTarget(s: GameState, p: Pack): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const b of s.buildings) {
    if (!isPen(b) || (b.herd?.head ?? 0) <= 0) continue;
    const c = buildingCentre(b);
    if (sheltered(s, c.x, c.y)) continue;
    const d = Math.hypot(c.x / CELL - p.x, c.y / CELL - p.y);
    if (d < bd) {
      bd = d;
      best = { x: c.x / CELL, y: c.y / CELL };
    }
  }
  return best;
}

/** A hungry pack reaches the town's edge: a small band comes out at whoever is on the land, and it raids a pen. */
function strike(s: GameState, p: Pack, g: Rng): void {
  const px = { x: p.x * CELL, y: p.y * CELL };
  const foes = packFoes(p.kind, p.n);
  const r = spawnRoamerAt(s, foes, px, px, { name: PACK_NAMES[p.kind] }, PACK_HOURS);
  if (!r) {
    walkTo(s, p, p.x + g.range(-1, 1), p.y + g.range(-1, 1), 1, 1);
    return;
  }
  p.out = r.id;
  p.hunger = 0.3;
  let line = `Hunger has driven a ${PACK_NAMES[p.kind]} out of the wild to the ${dirName(s, p.x, p.y)}: it's after anyone it finds on the land.`;
  const pens = s.buildings.filter((b) => isPen(b) && (b.herd?.head ?? 0) > 0 && !sheltered(s, buildingCentre(b).x, buildingCentre(b).y));
  if (pens.length && g.chance(PEN_STRIKE)) {
    const pen = g.pick(pens);
    const h = herdOf(s, pen);
    const n = Math.min(h.head, g.int(1, PEN_TAKE));
    h.head -= n;
    line += ` It got at the ${BUILDING_BY_ID[pen.def].name.toLowerCase()} first and took ${n}.`;
  }
  notify(s, line, true);
}

/* ------------------------------------------------------------ hunting */

/** The nearest herd's distance from the camp (cells), or Infinity with none. */
export function gameDistance(s: GameState): number {
  const h = s.wild && nearestHerd(s.wild, s.land.camp.x + 0.5, s.land.camp.y + 0.5);
  return h ? distCamp(s, h.x, h.y) : Infinity;
}

/** What the game near town makes of a hunt: its yield (a share of the usual), the way's length, and the added odds of a
 *  fight on the road. Neutral for a town the wild isn't running for. */
export function huntFactors(s: GameState): { yield: number; travel: number; risk: number } {
  if (!s.wild) return { yield: 1, travel: 1, risk: 0 };
  const over = Math.max(0, gameDistance(s) - HUNT_NEAR);
  const far = Number.isFinite(over) ? over : 60;
  return {
    yield: Math.max(HUNT_YIELD_MIN, 1 - far / 55),
    travel: Math.min(HUNT_TRAVEL_MAX, 1 + far / 60),
    risk: Math.min(HUNT_RISK_MAX, far * HUNT_RISK_PER_CELL),
  };
}

/** The hunters bring in a unit of game: now and then a head falls from the nearest herd. */
export function huntedUnit(s: GameState, units: number): void {
  const w = s.wild;
  if (!w) return;
  w.tally += units;
  while (w.tally >= HUNT_UNITS_PER_HEAD) {
    w.tally -= HUNT_UNITS_PER_HEAD;
    const h = nearestHerd(w, s.land.camp.x + 0.5, s.land.camp.y + 0.5);
    if (!h) return;
    h.n--;
    w.shot++;
    if (h.n < 2) notify(s, `The last of the ${HERD_DEFS[h.kind].plural} to the ${dirName(s, h.x, h.y)} have been hunted out: the hunters will range further.`);
  }
}

/* ------------------------------------------------------------ the woods spread */

/** Daily: open ground beside woods grows trees, a few cells at a time (never over the town, a road, a worn path or the
 *  woods' cap), so the woodcutters' clearings fill in and the forest creeps out. */
function spreadWoods(s: GameState, w: Wild, g: Rng, season: string): void {
  const per = SPREAD_PER_DAY[season as 'spring'] ?? 0;
  const m = s.land;
  const open = m.open;
  const c = m.camp;
  const reach = Math.ceil(townRadius(s)) + 5;
  let woods = 0;
  const x0 = Math.max(1, Math.floor(c.x - open));
  const x1 = Math.min(m.w - 2, Math.ceil(c.x + open));
  const y0 = Math.max(1, Math.floor(c.y - open));
  const y1 = Math.min(m.h - 2, Math.ceil(c.y + open));
  const isForest = (x: number, y: number) => groundAt(m, x, y) === 'forest';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isForest(x, y)) woods++;
  w.woodBase ??= woods;
  if (!per || woods >= w.woodBase * WOOD_CAP) return;
  const cand: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (groundAt(m, x, y) !== 'grass') continue;
      if (Math.hypot(x - c.x, y - c.y) > open - 2 || Math.hypot(x - c.x, y - c.y) < reach) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isForest(x + dx, y + dy)) n++;
      if (n >= 3) cand.push(idx(m, x, y));
    }
  if (!cand.length) return;
  let yards: Set<number> | null = null;
  let done = 0;
  for (let tries = 0; tries < per * 4 && done < per && cand.length; tries++) {
    const k = g.int(0, cand.length - 1);
    const i = cand[k];
    cand.splice(k, 1);
    const { x, y } = cellAt(m, i);
    if (!yards) {
      yards = new Set();
      for (const b of s.buildings) {
        const f = footprint(b);
        for (let yy = f.y - 1; yy <= f.y + f.h; yy++) for (let xx = f.x - 1; xx <= f.x + f.w; xx++) if (inMap(m, xx, yy)) yards.add(idx(m, xx, yy));
      }
    }
    if (builtOn(s, x, y) || isRoad(m, x, y) || yards.has(i) || wearAt(m, i) >= WEAR_SHOW || blighted(s, x, y) || m.regrow?.[i]) continue;
    growTrees(m, i, x, y, g);
    w.grown++;
    done++;
  }
}

function growTrees(m: GameState['land'], i: number, x: number, y: number, g: Rng): void {
  setGround(m, x, y, 'forest' as Ground);
  const pool: Partial<Record<Material, number>> = {};
  for (const [mat, [lo, hi]] of Object.entries(TERRAIN.forest.pool) as [Material, [number, number]][]) {
    // (young woods hold less than an old one)
    const n = Math.max(0, Math.floor(g.int(lo, hi) / 2));
    if (n > 0) pool[mat] = n;
  }
  m.pools[i] = pool;
}

/* ------------------------------------------------------------ wildfires in dry summers */

/** Whether this year is a dry one (a share of years, and every drought). */
export function dryYear(s: GameState): boolean {
  if (drought(s)) return true;
  return (hashSeed(`${s.seed}:dry:${calendarOf(s).year}`) % 1000) / 1000 < DRY_YEAR;
}

/** In a dry summer, now and then the woods catch (a disaster's wildfire, which the wind drives: sim/disasters.ts). */
function wildfireStart(s: GameState, w: Wild, g: Rng, cal: Calendar): void {
  if (cal.season !== 'summer' || s.disaster || s.raid || !dryYear(s) || raining(s)) return;
  if (!g.chance(DRY_FIRE_HOURLY)) return;
  if (!woodsNear(s).length) return;
  const d = startDisaster(s, 'wildfire');
  d.dry = true;
  d.wind = w.wind;
}

/** What the map draws (px): the herds, the packs, and the wind's heading. */
export interface WildView {
  herds: { id: number; kind: HerdKind; x: number; y: number; n: number }[];
  packs: { id: number; kind: PackKind; x: number; y: number; n: number; hungry: boolean; out: boolean }[];
  wind: number;
}
export function wildView(s: GameState): WildView | undefined {
  const w = s.wild;
  if (!w) return undefined;
  return {
    herds: w.herds.map((h) => ({ id: h.id, kind: h.kind, x: Math.round(h.x * CELL), y: Math.round(h.y * CELL), n: h.n })),
    packs: w.packs.map((p) => ({ id: p.id, kind: p.kind, x: Math.round(p.x * CELL), y: Math.round(p.y * CELL), n: p.n, hungry: p.hunger >= HUNGRY_AT, out: p.out !== undefined })),
    wind: Math.round(w.wind * 100) / 100,
  };
}
