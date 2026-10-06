// A raid fought as a tactics battle (the owner's ask, after Final Fantasy Tactics): a board of the town's own land cut
// out round the gate, every cell a tile with a height (hills and rock stand up, the river lies low, a building is a
// block nobody crosses), the town's fighters and the raiders on it one to a tile, facing a way. Turns come by a clock
// like FFT's CT: each fighter's charge fills by their speed (a townsperson's Dexterity, a raider's quickness), and
// whoever reaches 100 first moves (as far as they can walk, climbing no higher than they can jump) and acts. A blow
// from above bites harder, from the side harder still, from behind hardest. The raiders make for the town's edge (the
// last row of the board): whoever gets there is through, into the town, as from the trail. The town plays every turn
// itself. It is part of the deterministic sim, as the trail battle is: `Raid.tactics`, the raiders' `bt` keeping the
// town's own raid loop off them while they are on the board.

import { ENEMIES } from '../data/enemies';
import { RAID_KIND_BY_ID } from '../data/raids';
import { castsMagic } from '../data/classes';
import type { Rng } from '../rng';
import { hashSeed, mixSeed } from '../rng';
import { attributesOf } from './attributes';
import { fighters, gateCell, ranged } from './battle';
import { footprint } from './buildings';
import { weaponOf, weaponRange } from './combat';
import { CELL, groundAt, isRoad, type Ground } from './land';
import { attackPerson, defenderAttack } from './raids';
import { BUILDING_BY_ID } from '../data/buildings';
import { maxHp, notify, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';

/* ------------------------------------------------------------ the shapes of things */

export interface TacTile {
  /** Height in steps. */
  h: number;
  g: Ground;
  /** The land cell it is. */
  lx: number;
  ly: number;
  road?: boolean;
  /** A building stands here (nobody crosses), or a wall (the town's fighters may stand on it, the raiders may not). */
  block?: 'building' | 'wall';
  /** Trees: cover (harder to hit). */
  tree?: boolean;
}

export interface TacUnit {
  /** 'p<id>' a townsperson, 'r<id>' a raider (or an ally of the town). */
  key: string;
  foe: boolean;
  u: number;
  v: number;
  /** 0 +u, 1 +v, 2 -u, 3 -v. */
  facing: number;
  ct: number;
}

export interface TacAct {
  key: string;
  path: [number, number][];
  /** Tiles walked so far. */
  step: number;
  target?: string;
  /** What it does when it gets there. */
  kind: 'strike' | 'shoot' | 'cast' | 'wait' | 'flee';
  stage: 'move' | 'act' | 'beat';
  /** The tick the stage moves on. */
  next: number;
}

export interface Tactics {
  w: number;
  h: number;
  /** The board's corner on the land, and the side the raiders come from (-1 west, 1 east). */
  x0: number;
  y0: number;
  side: -1 | 1;
  tiles: TacTile[];
  units: TacUnit[];
  /** Raiders still to come on (ids), at the far edge as room is made. */
  waiting: number[];
  act?: TacAct;
  phase: 'fighting' | 'done';
  turns: number;
  killed: number;
  through: number;
  started: number;
  /** Numbers and misses over the tiles, for the drawing. */
  hits: { u: number; v: number; text: string; foe: boolean; tick: number }[];
}

/* ------------------------------------------------------------ tuning */

/** The board, in tiles: along the raiders' way in, and across it. */
export const BOARD_W = 13;
export const BOARD_H = 11;
/** Rows of the board on the town's side of the gate. */
const TOWN_ROWS = 3;
/** Ticks a fighter takes to walk a tile, the pause after a blow, and after a turn spent waiting. */
const MOVE_TICKS = 3;
const ACT_TICKS = 2;
const BEAT_TICKS = 6;
const WAIT_TICKS = 2;
/** Blows from above, beside and behind (FFT's angles), and the height's part (per step, both ways). */
export const SIDE_MULT = 1.25;
export const BACK_MULT = 1.5;
export const HEIGHT_STEP = 0.1;
/** The town's ground and the raiders' (the trail battle's `GROUND`). */
const GROUND = 1.2;
/** A raider breaks below this share of its health (not a boss). */
const ROUT = 0.15;
/** Trees turn this share of blows aside. */
const COVER = 0.2;
/** Heights of the ground. */
const BASE: Record<Ground, number> = { water: 0, shallows: 0, marsh: 1, sand: 1, grass: 1, fertile: 1, forest: 1, hall: 1, hill: 2, rock: 3, mountain: 6 };
const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export const tacticsOn = (s: GameState) => s.battleStyle === 'tactics';

/* ------------------------------------------------------------ the board */

const tileAt = (t: Tactics, u: number, v: number): TacTile | null => (u >= 0 && v >= 0 && u < t.w && v < t.h ? t.tiles[v * t.w + u] : null);
export const landOf = (t: Pick<Tactics, 'x0' | 'y0' | 'w' | 'side'>, u: number, v: number): [number, number] => [t.side < 0 ? t.x0 + u : t.x0 + (t.w - 1 - u), t.y0 + v];

/** A little relief on the open ground (a smooth noise by the seed), so the board is never a flat table. */
function relief(seed: number, x: number, y: number): number {
  const at = (cx: number, cy: number) => (mixSeed(seed, 0x7ac, cx, cy) >>> 0) / 4294967296;
  const fx = x / 3;
  const fy = y / 3;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const sx = fx - ix;
  const sy = fy - iy;
  const a = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
  const b = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/** Cut the board out of the land round the gate on the raid's side. */
export function makeBoard(s: GameState, side: -1 | 1): Omit<Tactics, 'units' | 'waiting' | 'phase' | 'turns' | 'killed' | 'through' | 'started' | 'hits'> {
  const m = s.land;
  const w = BOARD_W;
  const h = BOARD_H;
  const gate = gateCell(s, side);
  const along = w - 1 - TOWN_ROWS; // (the gate's row on the board)
  let x0 = side < 0 ? gate.x - along : gate.x - (w - 1 - along);
  x0 = Math.max(0, Math.min(m.w - w, x0));
  const y0 = Math.max(0, Math.min(m.h - h, gate.y - Math.floor(h / 2)));
  const seed = hashSeed(s.seed);
  const b = { w, h, x0, y0, side, tiles: [] as TacTile[] };
  const under = new Map<number, 'building' | 'wall'>();
  for (const x of s.buildings) {
    if (x.status !== 'done' || x.fire !== undefined) continue;
    const def = BUILDING_BY_ID[x.def];
    if (!def || def.id === 'campfire') continue;
    const f = footprint(x);
    const gate = /gate/.test(def.id);
    if (gate) continue; // (a gate stands open: the way in)
    const kind = def.hp ? 'wall' : 'building';
    for (let yy = f.y; yy < f.y + f.h; yy++) for (let xx = f.x; xx < f.x + f.w; xx++) under.set(yy * m.w + xx, kind);
  }
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const [lx, ly] = landOf(b, u, v);
      const g = groundAt(m, lx, ly);
      const road = isRoad(m, lx, ly);
      let hh = BASE[g];
      if (!road && (g === 'grass' || g === 'fertile' || g === 'forest' || g === 'hill' || g === 'sand')) hh += Math.round(relief(seed, lx, ly) * (g === 'hill' ? 2 : 1.4));
      const block = under.get(ly * m.w + lx);
      const tile: TacTile = { h: hh + (block === 'wall' ? 2 : block === 'building' ? 3 : 0), g, lx, ly };
      if (road) tile.road = true;
      if (block) tile.block = block;
      if (g === 'forest' && !block && !road) tile.tree = true;
      b.tiles.push(tile);
    }
  return b;
}

/** Whether a side may stand on a tile. */
function standable(tile: TacTile | null, foe: boolean): boolean {
  if (!tile) return false;
  if (tile.g === 'water' || tile.g === 'mountain') return false;
  if (tile.block === 'building') return false;
  if (tile.block === 'wall' && foe) return false;
  return true;
}

/* ------------------------------------------------------------ who's who */

const personOf = (s: GameState, key: string) => (key[0] === 'p' ? s.people.find((p) => p.id === +key.slice(1)) : undefined);
const raiderOf = (r: Raid, key: string) => (key[0] === 'r' ? r.raiders.find((q) => q.id === +key.slice(1)) : undefined);

interface Stats {
  speed: number;
  move: number;
  jump: number;
  reach: number;
  shooter: boolean;
}

function statsOf(s: GameState, r: Raid, u: TacUnit): Stats {
  const p = personOf(s, u.key);
  if (p) {
    const dex = attributesOf(p).dex;
    const shooter = ranged(p);
    const magic = castsMagic(p.cls);
    const reach = shooter ? Math.max(2, Math.min(6, Math.round(weaponRange(p, true)))) : magic ? 4 : weaponOf(p).reach ? 2 : 1;
    return { speed: 6 + dex * 0.25, move: 3 + (dex >= 16 ? 1 : 0), jump: 2, reach, shooter: shooter || magic };
  }
  const rd = raiderOf(r, u.key)!;
  const def = ENEMIES[rd.kind];
  const pace = RAID_KIND_BY_ID[r.kind]?.speed ?? 40;
  return { speed: 7 + 4 / Math.max(0.6, def.interval), move: pace >= 60 ? 4 : 3, jump: pace >= 60 ? 3 : 2, reach: def.ranged ? 4 : 1, shooter: def.ranged };
}

/* ------------------------------------------------------------ starting */

/** The raiders have come: cut the board, set the town's fighters along its town end, the raiders at the far edge. */
export function startTactics(s: GameState, r: Raid): void {
  const board = makeBoard(s, r.side);
  const t: Tactics = { ...board, units: [], waiting: [], phase: 'fighting', turns: 0, killed: 0, through: 0, started: s.tick, hits: [] };
  r.tactics = t;
  r.leavesTick = Math.max(r.leavesTick, s.tick + 3 * TICKS_PER_HOUR);
  // the town's fighters: blockers in the front row, shooters behind them, the town's allies with the blockers
  const folk = fighters(s).sort((a, b) => (ranged(a) || castsMagic(a.cls) ? 1 : 0) - (ranged(b) || castsMagic(b.cls) ? 1 : 0) || b.hp - a.hp);
  const allies = r.raiders.filter((q) => q.ally && !q.down && !q.gone);
  const rows = [t.w - 1 - TOWN_ROWS, t.w - TOWN_ROWS, t.w - TOWN_ROWS + 1, t.w - 1];
  const order = across(t.h);
  const place = (key: string, shooter: boolean) => {
    for (const u of shooter ? [...rows].reverse() : rows)
      for (const v of order) {
        const tile = tileAt(t, u, v);
        if (!standable(tile, false) || t.units.some((x) => x.u === u && x.v === v)) continue;
        t.units.push({ key, foe: false, u, v, facing: 2, ct: 0 });
        return true;
      }
    return false;
  };
  for (const p of folk) place(`p${p.id}`, ranged(p) || castsMagic(p.cls));
  for (const a of allies) place(`r${a.id}`, ENEMIES[a.kind].ranged);
  // the raiders: as many as the far edge holds now, the rest as room is made
  for (const rd of r.raiders) {
    if (rd.ally || rd.down || rd.gone) continue;
    rd.bt = { d: 0, lane: 0, wave: 0 };
    t.waiting.push(rd.id);
  }
  spawn(r, t);
  // (each starts with a little charge, by the seed, so the first turns aren't all at once)
  for (const u of t.units) u.ct = ((mixSeed(hashSeed(s.seed), s.tick, hashSeed(u.key)) >>> 0) % 40);
  syncPlaces(s, r, t);
  notify(s, `${t.waiting.length + t.units.filter((u) => u.foe).length} raiders on the field: the battle is joined!`, true);
}

/** Rows across the board from the middle out. */
function across(h: number): number[] {
  const mid = Math.floor(h / 2);
  const out = [mid];
  for (let d = 1; out.length < h; d++) {
    if (mid - d >= 0) out.push(mid - d);
    if (mid + d < h) out.push(mid + d);
  }
  return out;
}

/** Bring waiting raiders on at the far edge, while there's room there. */
function spawn(r: Raid, t: Tactics): void {
  const order = across(t.h);
  while (t.waiting.length) {
    let spot: [number, number] | null = null;
    for (const u of [0, 1])
      for (const v of order) {
        if (spot) break;
        if (standable(tileAt(t, u, v), true) && !t.units.some((x) => x.u === u && x.v === v)) spot = [u, v];
      }
    if (!spot) return;
    const id = t.waiting.shift()!;
    const rd = r.raiders.find((q) => q.id === id);
    if (!rd || rd.down || rd.gone) continue;
    t.units.push({ key: `r${id}`, foe: true, u: spot[0], v: spot[1], facing: 0, ct: 0 });
  }
}

/** Everyone on the board stands where their tile is on the land (the map, the towers, the recap see them there). */
function syncPlaces(s: GameState, r: Raid, t: Tactics): void {
  for (const u of t.units) {
    const [lx, ly] = landOf(t, u.u, u.v);
    const x = (lx + 0.5) * CELL;
    const y = (ly + 0.5) * CELL;
    const p = personOf(s, u.key);
    const q = p ?? raiderOf(r, u.key);
    if (!q) continue;
    q.x = x;
    q.y = y;
    const dx = DIRS[u.facing][0] * (t.side < 0 ? 1 : -1);
    if (dx) q.dir = dx > 0 ? 1 : -1;
  }
}

/* ------------------------------------------------------------ the turns */

/** One tick of the battle: the one whose turn it is walks and acts; else the clock runs to the next. False once it's
 *  over (the raiders left are the town's business, as from the trail). */
export function stepTactics(s: GameState, r: Raid, rng: Rng): boolean {
  const t = r.tactics;
  if (!t || t.phase === 'done') return false;
  // (the fallen, the gone and the hurt off the board; raiders who joined since, summoned or called, come on)
  t.units = t.units.filter((u) => {
    const p = personOf(s, u.key);
    if (u.key[0] === 'p') return !!p && !p.downed && p.away === null;
    const rd = raiderOf(r, u.key);
    return !!rd && !rd.down && !rd.gone && !(rd.bt?.out && !rd.ally);
  });
  for (const rd of r.raiders)
    if (!rd.ally && !rd.down && !rd.gone && !rd.bt) {
      rd.bt = { d: 0, lane: 0, wave: 0 };
      t.waiting.push(rd.id);
    }
  spawn(r, t);
  if (t.hits.length) t.hits = t.hits.filter((x) => s.tick - x.tick < 2 * TICK_HZ);
  const foes = t.units.filter((u) => u.foe);
  if (!foes.length && !t.waiting.length) return finish(s, r, t, `The battle is won: ${t.killed} raiders down${t.through ? `, ${t.through} got through` : ''}.`);
  if (!t.units.some((u) => !u.foe)) {
    // (nobody left standing on the field: the raiders walk on into the town)
    for (const u of foes) through(s, r, t, u);
    for (const id of t.waiting) {
      const rd = r.raiders.find((q) => q.id === id);
      if (rd?.bt) rd.bt.out = true;
    }
    t.waiting = [];
    return finish(s, r, t, `The field is lost: the raiders are into the town!`);
  }
  if (t.act) {
    play(s, r, t, rng);
    syncPlaces(s, r, t);
    return true;
  }
  // the clock: run it on to the next whose charge is full, and start their turn
  const stats = new Map(t.units.map((u) => [u.key, statsOf(s, r, u)]));
  let next = t.units.filter((u) => u.ct >= 100);
  if (!next.length) {
    const need = Math.min(...t.units.map((u) => (100 - u.ct) / stats.get(u.key)!.speed));
    for (const u of t.units) u.ct += stats.get(u.key)!.speed * need;
    next = t.units.filter((u) => u.ct >= 100 - 1e-6);
  }
  const me = next.sort((a, b) => b.ct - a.ct || (a.key < b.key ? -1 : 1))[0];
  me.ct = Math.max(0, me.ct - 100);
  t.turns++;
  t.act = plan(s, r, t, me, stats.get(me.key)!);
  syncPlaces(s, r, t);
  return true;
}

function finish(s: GameState, r: Raid, t: Tactics, text: string): boolean {
  t.phase = 'done';
  t.act = undefined;
  notify(s, text, true);
  r.leavesTick = Math.max(Math.min(r.leavesTick, s.tick + TICKS_PER_HOUR), s.tick + Math.round(TICKS_PER_HOUR / 4));
  return false;
}

/** Tiles a fighter can reach this turn: walking round the other side, through their own, climbing no more than they
 *  jump (dropping one more), each step a tile (marsh two). Their own tile is one. */
function reachable(t: Tactics, me: TacUnit, st: Stats): Map<number, { cost: number; from: number }> {
  const out = new Map<number, { cost: number; from: number }>();
  const start = me.v * t.w + me.u;
  out.set(start, { cost: 0, from: -1 });
  const queue = [start];
  const taken = new Map(t.units.map((u) => [u.v * t.w + u.u, u]));
  while (queue.length) {
    queue.sort((a, b) => out.get(a)!.cost - out.get(b)!.cost);
    const i = queue.shift()!;
    const here = t.tiles[i];
    const c = out.get(i)!.cost;
    for (const [du, dv] of DIRS) {
      const u = (i % t.w) + du;
      const v = Math.floor(i / t.w) + dv;
      const tile = tileAt(t, u, v);
      if (!standable(tile, me.foe)) continue;
      const rise = tile!.h - here.h;
      if (rise > st.jump || -rise > st.jump + 1) continue;
      const other = taken.get(v * t.w + u);
      if (other && other.foe !== me.foe) continue;
      const cost = c + (tile!.g === 'marsh' || tile!.g === 'shallows' ? 2 : 1);
      if (cost > st.move) continue;
      const j = v * t.w + u;
      if (out.has(j) && out.get(j)!.cost <= cost) continue;
      out.set(j, { cost, from: i });
      queue.push(j);
    }
  }
  // (nobody ends on a tile someone else stands on)
  for (const [j] of out) if (j !== start && taken.has(j)) out.delete(j);
  return out;
}

function pathTo(t: Tactics, reach: Map<number, { cost: number; from: number }>, j: number): [number, number][] {
  const path: [number, number][] = [];
  for (let i = j; i !== -1 && reach.has(i); i = reach.get(i)!.from) path.unshift([i % t.w, Math.floor(i / t.w)]);
  return path;
}

/** How many tiles apart, as the board counts reach. */
const apart = (a: { u: number; v: number }, b: { u: number; v: number }) => Math.abs(a.u - b.u) + Math.abs(a.v - b.v);

/** The angle of a blow: from in front 1, beside `SIDE_MULT`, behind `BACK_MULT`; and the height's part. */
export function blowMult(t: Pick<Tactics, 'tiles' | 'w'>, from: { u: number; v: number }, to: TacUnit): number {
  const du = to.u - from.u;
  const dv = to.v - from.v;
  // the way the blow travels, as one of the four
  const way = Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 0 : 2) : dv > 0 ? 1 : 3;
  const angle = way === to.facing ? BACK_MULT : (way + 2) % 4 === to.facing ? 1 : SIDE_MULT;
  const hf = t.tiles[from.v * t.w + from.u]?.h ?? 0;
  const ht = t.tiles[to.v * t.w + to.u]?.h ?? 0;
  const height = 1 + HEIGHT_STEP * Math.max(-3, Math.min(3, hf - ht));
  return angle * height;
}

/** What a fighter will do this turn: where to walk, and whom to strike from there. */
function plan(s: GameState, r: Raid, t: Tactics, me: TacUnit, st: Stats): TacAct {
  const reach = reachable(t, me, st);
  const foes = t.units.filter((u) => u.foe !== me.foe);
  const rd = raiderOf(r, me.key);
  const base = { key: me.key, step: 0, stage: 'move' as const, next: s.tick };
  // a raider breaking (or one whose raid is giving up) runs for the far edge
  if (me.foe && rd && !rd.ally && ((!ENEMIES[rd.kind].kit && rd.hp < rd.maxHp * ROUT) || s.tick >= r.leavesTick)) {
    let best = me.v * t.w + me.u;
    for (const [j] of reach) if (j % t.w < best % t.w) best = j;
    return { ...base, path: pathTo(t, reach, best), kind: 'flee' };
  }
  const tile = (j: number) => t.tiles[j];
  // the best blow it can strike from anywhere it can reach
  let best: { j: number; target: TacUnit; score: number } | null = null;
  for (const [j, info] of reach) {
    const at = { u: j % t.w, v: Math.floor(j / t.w) };
    const h = tile(j).h;
    for (const f of foes) {
      const fh = tileAt(t, f.u, f.v)!.h;
      const d = apart(at, f);
      // (a shot reaches a step further for every two of height above; a blade only up or down a jump's worth)
      const range = st.reach + (st.shooter ? Math.max(0, Math.floor((h - fh) / 2)) : 0);
      if (d > range || d === 0) continue;
      if (!st.shooter && Math.abs(h - fh) > st.jump) continue;
      const hurt = foeHurt(s, r, f);
      let score = blowMult(t, at, f) * 10 + hurt * 6 - info.cost * 0.3 + h * 0.4;
      // (the town strikes first at whoever is nearest getting through; the raiders like a shooter left alone)
      if (!me.foe) score += f.u * 0.5;
      // (a shooter would rather not stand next to a foe)
      if (st.shooter) score -= foes.filter((o) => apart(o, at) <= 1).length * 4;
      if (!best || score > best.score) best = { j, target: f, score };
    }
  }
  if (best) return { ...base, path: pathTo(t, reach, best.j), target: best.target.key, kind: st.shooter ? (rd || !castsMagic(personOf(s, me.key)?.cls) ? 'shoot' : 'cast') : 'strike' };
  // none in reach: the raiders walk on for the town's edge; the town's fighters close on the raider nearest it
  let goal = me.v * t.w + me.u;
  let goalScore = -Infinity;
  const chase = me.foe ? null : foes.sort((a, b) => b.u - a.u)[0];
  for (const [j, info] of reach) {
    const at = { u: j % t.w, v: Math.floor(j / t.w) };
    const score = me.foe ? at.u * 2 - info.cost * 0.1 + tile(j).h * 0.1 : chase ? -apart(at, chase) * 2 + tile(j).h * 0.2 - (st.shooter ? Math.abs(apart(at, chase) - st.reach) : 0) : 0;
    if (score > goalScore) {
      goalScore = score;
      goal = j;
    }
  }
  return { ...base, path: pathTo(t, reach, goal), kind: 'wait' };
}

/** How hurt a unit is (0 whole, 1 nearly down). */
function foeHurt(s: GameState, r: Raid, u: TacUnit): number {
  const p = personOf(s, u.key);
  if (p) return 1 - p.hp / Math.max(1, maxHp(p));
  const rd = raiderOf(r, u.key);
  return rd ? 1 - rd.hp / Math.max(1, rd.maxHp) : 0;
}

/** The turn under way, a stage at a time: a tile a few ticks, then the blow, then a beat. */
function play(s: GameState, r: Raid, t: Tactics, rng: Rng): void {
  const a = t.act!;
  if (s.tick < a.next) return;
  const me = t.units.find((u) => u.key === a.key);
  if (!me) {
    t.act = undefined;
    return;
  }
  if (a.stage === 'move') {
    if (a.step + 1 < a.path.length) {
      a.step++;
      const [u, v] = a.path[a.step];
      const du = u - me.u;
      const dv = v - me.v;
      me.facing = du > 0 ? 0 : du < 0 ? 2 : dv > 0 ? 1 : 3;
      me.u = u;
      me.v = v;
      a.next = s.tick + MOVE_TICKS;
      if (me.foe && !raiderOf(r, me.key)?.ally && a.kind !== 'flee' && me.u >= t.w - 1) {
        through(s, r, t, me);
        t.act = undefined;
      }
      return;
    }
    a.stage = 'act';
    a.next = s.tick + ACT_TICKS;
    return;
  }
  if (a.stage === 'act') {
    const target = a.target ? t.units.find((u) => u.key === a.target) : undefined;
    if (a.kind === 'flee' && me.u === 0) {
      const rd = raiderOf(r, me.key);
      if (rd) rd.gone = true;
      t.units = t.units.filter((u) => u !== me);
    } else if (target) strike(s, r, t, me, target, rng);
    a.stage = 'beat';
    a.next = s.tick + (target ? BEAT_TICKS : WAIT_TICKS);
    return;
  }
  t.act = undefined;
}

/** A blow: the town's through `defenderAttack`, the raiders' through `attackPerson`, so wounds, deaths, the recap and
 *  the rest are as in any raid; the angle and the height scale it. */
function strike(s: GameState, r: Raid, t: Tactics, me: TacUnit, target: TacUnit, rng: Rng): void {
  const du = target.u - me.u;
  const dv = target.v - me.v;
  me.facing = Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 0 : 2) : dv > 0 ? 1 : 3;
  const mult = blowMult(t, me, target);
  const cover = tileAt(t, target.u, target.v)?.tree && rng.next() < COVER;
  const mark = (text: string) => t.hits.push({ u: target.u, v: target.v, text, foe: target.foe, tick: s.tick });
  const p = personOf(s, me.key);
  const tp = personOf(s, target.key);
  const trd = raiderOf(r, target.key);
  const rd = raiderOf(r, me.key);
  if (cover) {
    mark('Cover');
    if (p) p.lastBlow = s.tick;
    if (rd) rd.lastAction = s.tick;
    return;
  }
  if (p && trd) {
    const was = trd.hp;
    defenderAttack(s, p, trd, rng, p.id === s.mainId ? 4 : 0, GROUND * mult);
    mark(trd.hp < was ? `${Math.round(was - trd.hp)}` : 'Miss');
    if (trd.down) t.killed++;
    return;
  }
  if (rd && tp) {
    const was = tp.hp;
    const might = rd.might;
    rd.might = (might ?? 1) * mult;
    attackPerson(s, rd, tp, rng);
    rd.might = might;
    mark(tp.hp < was ? `${Math.round(was - tp.hp)}` : 'Miss');
    return;
  }
  // (raider on raider: an ally of the town and a raider)
  if (rd && trd) {
    const def = ENEMIES[rd.kind];
    rd.lastAction = s.tick;
    if (rng.next() < def.accuracy - ENEMIES[trd.kind].dodge) {
      const dmg = Math.round(rng.int(def.damage[0], def.damage[1]) * (rd.might ?? 1) * mult);
      trd.hp = Math.max(0, trd.hp - dmg);
      trd.lastHit = s.tick;
      if (trd.hp === 0) {
        trd.down = true;
        if (!trd.ally) t.killed++;
      }
      mark(`${dmg}`);
    } else mark('Miss');
  }
}

/** A raider at the town's edge of the board: through, into the town (raids.ts takes it on from there). */
function through(s: GameState, r: Raid, t: Tactics, u: TacUnit): void {
  const rd = raiderOf(r, u.key);
  if (!rd) return;
  const [lx, ly] = landOf(t, Math.min(t.w - 1, u.u), u.v);
  rd.x = (lx + 0.5) * CELL;
  rd.y = (ly + 0.5) * CELL;
  rd.dir = t.side < 0 ? 1 : -1;
  if (rd.bt) rd.bt.out = true;
  t.through++;
  t.units = t.units.filter((x) => x !== u);
  notify(s, `A ${ENEMIES[rd.kind].name.toLowerCase()} got through to the town!`);
}

/* ------------------------------------------------------------ what the renderer sees */

export interface TacticsView {
  w: number;
  h: number;
  side: -1 | 1;
  tiles: TacTile[];
  units: { key: string; foe: boolean; ally: boolean; ref: number; u: number; v: number; facing: number; ct: number; name: string; hp: number; max: number }[];
  /** Whose turn it is, what they're at, and on whom. */
  act: { key: string; kind: TacAct['kind']; stage: TacAct['stage']; target?: string; path: [number, number][] } | null;
  /** The turns coming, by name (the CT order). */
  order: { key: string; name: string; foe: boolean }[];
  hits: { u: number; v: number; text: string; foe: boolean; age: number }[];
  turns: number;
  killed: number;
  through: number;
  waiting: number;
  phase: Tactics['phase'];
}

export function tacticsView(s: GameState): TacticsView | null {
  const r = s.raid;
  const t = r?.tactics;
  if (!r || !t || t.phase === 'done') return null;
  const units = t.units.map((u) => {
    const p = personOf(s, u.key);
    const rd = raiderOf(r, u.key);
    return {
      key: u.key,
      foe: u.foe,
      ally: !!rd?.ally,
      ref: +u.key.slice(1),
      u: u.u,
      v: u.v,
      facing: u.facing,
      ct: Math.round(u.ct),
      name: p ? p.name : rd ? ENEMIES[rd.kind].name : '?',
      hp: Math.round(p ? p.hp : (rd?.hp ?? 0)),
      max: Math.round(p ? maxHp(p) : (rd?.maxHp ?? 1)),
    };
  });
  // (the turns to come: the clock run forward on a copy)
  const sim = t.units.map((u) => ({ key: u.key, foe: u.foe, ct: u.ct, speed: statsOf(s, r, u).speed }));
  const order: TacticsView['order'] = [];
  for (let i = 0; i < 8 && sim.length; i++) {
    let ready = sim.filter((u) => u.ct >= 100);
    if (!ready.length) {
      const need = Math.min(...sim.map((u) => (100 - u.ct) / u.speed));
      for (const u of sim) u.ct += u.speed * need;
      ready = sim.filter((u) => u.ct >= 100 - 1e-6);
    }
    const me = ready.sort((a, b) => b.ct - a.ct || (a.key < b.key ? -1 : 1))[0];
    me.ct -= 100;
    order.push({ key: me.key, name: units.find((x) => x.key === me.key)?.name ?? '?', foe: me.foe });
  }
  return {
    w: t.w,
    h: t.h,
    side: t.side,
    tiles: t.tiles,
    units,
    act: t.act ? { key: t.act.key, kind: t.act.kind, stage: t.act.stage, path: t.act.stage === 'move' ? t.act.path.slice(t.act.step) : [], ...(t.act.target ? { target: t.act.target } : {}) } : null,
    order,
    hits: t.hits.map((x) => ({ u: x.u, v: x.v, text: x.text, foe: x.foe, age: s.tick - x.tick })),
    turns: t.turns,
    killed: t.killed,
    through: t.through,
    waiting: t.waiting.length,
    phase: t.phase,
  };
}

/** Whether someone is on the tactics board now (people.ts leaves them standing where the battle puts them). */
export const onBoard = (s: GameState, p: Person): boolean => !!s.raid?.tactics && s.raid.tactics.phase !== 'done' && s.raid.tactics.units.some((u) => u.key === `p${p.id}`);

/** Whether a tactics battle is under way (the battle speed applies). */
export const inTactics = (s: GameState) => !!s.raid?.tactics && s.raid.tactics.phase !== 'done';

/** A raider's place on the board, if it's on it (for anyone who asks). */
export const raiderOnBoard = (s: GameState, rd: Raider): boolean => !!s.raid?.tactics?.units.some((u) => u.key === `r${rd.id}`);
