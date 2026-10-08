// A raid fought as a tactics battle, after Final Fantasy Tactics (the owner's ask). A board of the town's own land is
// cut out round the gate: every cell a tile with a height (hills and rock stand up, the river lies low, a building is a
// block nobody crosses, a wall a rampart the town's fighters may stand on), the town's fighters and the raiders on it
// one to a tile, each facing a way. Turns come by a clock like FFT's CT: each fighter's charge fills by their speed (a
// townsperson's Dexterity, a raider's quickness), and whoever reaches 100 first takes a turn: a move (as far as they
// can walk, climbing no higher than they can jump) and an act (a blow, a shot, a spell or a skill from their kit), in
// either order, then a facing. A blow from above bites harder, from the side harder still, from behind hardest; a
// shot reaches further from high ground and less far by night; trees turn blows aside, and rain spoils the archers'
// aim. The town's towers take turns of their own and its traps lie on the board. Struck down, a townsperson lies with a
// count of three on the field: three of their turns pass and they are lost for good, unless a friend tends them first
// or the battle is won. Fallen raiders sometimes leave a chest. A raid led by a chief or a boss is broken when its
// leader falls; a big one comes on in waves. The raiders make for the town's end of the board, and whoever reaches it
// is through, into the town. The town plays every turn itself unless the player takes charge (`auto` off: each of
// the town's fighters waits on their turn for the player's orders, and acts alone if none come).
//
// It is part of the deterministic sim, as the trail battle is: `Raid.tactics`; the raiders' `bt` keeps the town's own
// raid loop off them while they are on the board. Blows go through `defenderAttack` and `attackPerson`, so wounds,
// deaths, prisoners and the raid's recap work as in any raid.

import { BUILDING_BY_ID } from '../data/buildings';
import { castsMagic, CLASS_DEFS } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { RAID_KIND_BY_ID } from '../data/raids';
import { TILE } from '../constants';
import type { Rng } from '../rng';
import { hashSeed, mixSeed } from '../rng';
import { aimOf, canPay, held, kitOf, takeTurn, tickStatuses, useAction, type Arena, type Combatant, type Kit, type KitAction, type Statuses } from './actions';
import { aimTiles, areaLabel, areaOf, areaTiles, spreads, SPREAD_POWER, type TacArea, type Tile } from './tacticsArea';
import { attributesOf } from './attributes';
import { fighters, gateCell, ranged } from './battle';
import { footprint } from './buildings';
import { ally } from './classes';
import { personFighter, weaponOf, weaponRange } from './combat';
import { fireAt } from './defenses';
import { giveCoins } from './economy';
import { killPerson } from './health';
import { CELL, groundAt, isRoad, type Ground } from './land';
import { before, credit, TOWERS } from './raidRecap';
import { attackPerson, defenderAttack } from './raids';
import { GATE_OF, GRATE_OF, isGrate, WALL_KINDS } from './ringWall';
import { maxHp, notify, type GameState, type Person, type Raid, type Raider } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { runtime } from './watchAsk';
import { enemyArmor } from '../data/enemies';
import { levelOf, stageOf } from '../data/levels';
import { callingName } from '../data/founderClasses';

/* ------------------------------------------------------------ the shapes of things */

export interface TacTile {
  /** Height in steps. */
  h: number;
  g: Ground;
  /** The land cell it is. */
  lx: number;
  ly: number;
  road?: boolean;
  /** A wall (the town's fighters may stand on it, the raiders may not), a boulder (nobody crosses), or (older boards) a
   *  building. */
  block?: 'building' | 'wall' | 'rock';
  /** A tower standing on the wall here (a building id, for its picture). */
  bld?: number;
  /** The town's wall or gate drawn on this tile (a building def: the palisade, stone, brick...). */
  wall?: string;
  /** The gate in the wall: the way in, open to all. */
  gate?: boolean;
  /** Trees and bushes: cover (harder to hit). */
  tree?: boolean;
  bush?: boolean;
  /** One of the town's traps (a building id), sprung by the first raider to step on it. */
  trap?: number;
}

export interface TacUnit {
  /** 'p<id>' a townsperson, 'r<id>' a raider (or an ally of the town), 't<id>' one of the town's towers. */
  key: string;
  foe: boolean;
  u: number;
  v: number;
  /** 0 +u, 1 +v, 2 -u, 3 -v. */
  facing: number;
  ct: number;
  /** Struck down on the field: turns left before they're lost (FFT's count of three). */
  count?: number;
  /** A townsperson's spells and skills, and the statuses on them (a raider's are on its `bt.st`). */
  kit?: Kit;
  st?: Statuses;
}

/** A chest a fallen raider left: whoever of the town ends a move on it takes it. */
export interface TacChest {
  u: number;
  v: number;
  coins: number;
  item?: string;
}

/** What happened on the board lately, for the drawing: a blow, a shot, a spell or skill (by name), a heal, a tower's
 *  bolt, a chest opened, someone tended or lost. */
export interface TacFx {
  tick: number;
  kind: 'blow' | 'shot' | 'act' | 'tend' | 'tower' | 'chest' | 'lost' | 'trap' | 'stun' | 'area';
  /** The area a spell or skill fell on ('area': its tiles in `to`; foe or friend by `foe`). */
  foe?: boolean;
  from: [number, number];
  to: [number, number][];
  name?: string;
  /** An ultimate (the screen shakes). */
  ult?: boolean;
}

/** A turn waiting on the player's orders. */
export interface TacAwait {
  key: string;
  moved: boolean;
  acted: boolean;
  /** Where they stood when the turn began (a move may be taken back until they act). */
  from: [number, number];
  /** The tick the town takes the turn over if no order comes. */
  until: number;
}

export interface TacAct {
  key: string;
  path: [number, number][];
  /** Tiles walked so far. */
  step: number;
  target?: string;
  /** A chosen spell or skill (its kit id), and the tile it's aimed at. */
  skill?: string;
  at?: [number, number];
  /** What it does when it gets there. */
  kind: 'strike' | 'shoot' | 'cast' | 'wait' | 'flee' | 'tend' | 'chest' | 'move';
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
  await?: TacAwait;
  /** The town plays its own turns (false: the player gives the orders). */
  auto: boolean;
  phase: 'fighting' | 'done';
  turns: number;
  killed: number;
  through: number;
  lost: number;
  started: number;
  /** The raid's leader (a unit key) and whether it has fallen: the rest break when it does. */
  leader?: string;
  broken?: boolean;
  chests: TacChest[];
  /** Numbers and misses over the tiles, for the drawing. */
  hits: { u: number; v: number; text: string; foe: boolean; tick: number; heal?: boolean }[];
  fx: TacFx[];
  /** A word across the screen: the battle begun, reinforcements, a leader fallen, the end. */
  banner?: { text: string; tick: number; kind: 'start' | 'wave' | 'leader' | 'win' | 'lose' | 'lost' };
  /** The ending, once there is one. */
  outcome?: 'won' | 'lost' | 'fled';
}

/* ------------------------------------------------------------ tuning */

/** The board, in tiles: along the raiders' way in, and across it; a big raid's is bigger. */
export const BOARD_W = 17;
export const BOARD_H = 14;
const BIG_W = 21;
const BIG_H = 17;
const BIG_AT = 24;
/** Rows of the board on the town's side of the gate. */
const TOWN_ROWS = 3;
/** Ticks a fighter takes to walk a tile, before and after a blow, and after a turn spent waiting. */
const MOVE_TICKS = 3;
const ACT_TICKS = 3;
const BEAT_TICKS = 7;
const WAIT_TICKS = 3;
/** Blows from beside and behind (FFT's angles), and the height's part (per step, both ways, up to three). */
export const SIDE_MULT = 1.25;
export const BACK_MULT = 1.5;
export const HEIGHT_STEP = 0.1;
/** How many raiders are on the field at once: at least this many, else this many for each of the town's fighters. */
const WAVE_LEAST = 2;
const WAVE_PER_FIGHTER = 1.25;
/** The town's ground: its blows bite harder (the trail battle's `GROUND` and more), the raiders' less, since the
 *  board has no blockers holding the raiders back one at a time and no long walk under the towers. */
const GROUND = 1.35;
export const HOME_GUARD = 0.8;
/** A small town's few hold their own ground harder still: a founder alone meets a wolf as the trail's blockers did. */
function guardOf(t: Tactics): number {
  const folk = t.units.filter((u) => u.key[0] === 'p').length;
  return folk <= 2 ? 0.6 : folk <= 4 ? 0.7 : HOME_GUARD;
}
/** A raider breaks below this share of its health (not a boss). */
const ROUT = 0.15;
/** Trees turn this share of blows aside; rain and night this much more of shots. */
const COVER = 0.2;
const RAIN_MISS = 0.15;
/** How far spells and skills reach at most (tiles); each one's own reach and area are in tacticsArea.ts. */
export const SPELL_REACH = 4;
/** FFT's count: turns a townsperson lies struck down on the field before they're lost. */
export const DOWN_COUNT = 3;
/** Health someone tended on the field gets up with. */
const TENDED_HP = 0.25;
/** A fallen raider leaves a chest this often; what's in it. */
const CHEST_CHANCE = 0.3;
const CHEST_COINS: [number, number] = [4, 16];
const CHEST_ITEM = 0.3;
/** How long a turn waits on the player's orders before the town takes it (ticks of play). */
export const AWAIT_TICKS = 40 * TICK_HZ;
/** Speeds: a townsperson's from Dexterity, a raider's from how often it strikes; a tower's own. */
const TOWER_SPEED = 7;
/** Heights of the ground. */
const BASE: Record<Ground, number> = { water: 0, shallows: 0, marsh: 1, sand: 1, grass: 1, fertile: 1, forest: 1, hall: 1, hill: 2, rock: 3, mountain: 6 };
const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Whether raids are fought on the board (unset: yes; the trail when the player picks it, and in the tests). */
export const tacticsOn = (s: GameState) => s.battleStyle !== 'trail';

/* ------------------------------------------------------------ the board */

const tileAt = (t: Pick<Tactics, 'w' | 'h' | 'tiles'>, u: number, v: number): TacTile | null => (u >= 0 && v >= 0 && u < t.w && v < t.h ? t.tiles[v * t.w + u] : null);
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

/** The ground that rolls (the rest keeps its height), how much, and how thick the field's boulders and thickets lie. */
const ROLLING = new Set<Ground>(['grass', 'fertile', 'forest', 'hill', 'sand', 'marsh']);
const RELIEF = 2.2;
const RELIEF_HILL = 3;
const BOULDERS = 0.035;
const THICKETS = 0.06;

const isTrap = (def: string) => {
  const d = BUILDING_BY_ID[def];
  return !!d?.defense && d.layer === 'fore' && d.defense.range < TILE;
};

/** Cut the board out of the land round the gate on the raid's side. */
export function makeBoard(s: GameState, side: -1 | 1, big = false, salt = 0): Pick<Tactics, 'w' | 'h' | 'x0' | 'y0' | 'side' | 'tiles'> {
  const m = s.land;
  const w = big ? BIG_W : BOARD_W;
  const h = big ? BIG_H : BOARD_H;
  const gate = gateCell(s, side);
  const along = w - 1 - TOWN_ROWS; // (the gate's row on the board: the town's wall runs across it)
  let x0 = side < 0 ? gate.x - along : gate.x - (w - 1 - along);
  x0 = Math.max(0, Math.min(m.w - w, x0));
  const y0 = Math.max(0, Math.min(m.h - h, gate.y - Math.floor(h / 2)));
  const seed = hashSeed(s.seed);
  const b = { w, h, x0, y0, side, tiles: [] as TacTile[] };
  // (the town's traps where they stand; its buildings are left off: the board is the field before the town, and the
  // town is its wall)
  const traps = new Map<number, number>();
  for (const x of s.buildings) {
    if (x.status !== 'done' || x.fire !== undefined || !isTrap(x.def)) continue;
    const f = footprint(x);
    traps.set(f.y * m.w + f.x, x.id);
  }
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const [lx, ly] = landOf(b, u, v);
      const g = groundAt(m, lx, ly);
      const road = isRoad(m, lx, ly);
      let hh = BASE[g];
      if (!road && ROLLING.has(g)) hh += Math.round(relief(seed ^ salt, lx, ly) * (g === 'hill' ? RELIEF_HILL : RELIEF));
      const tile: TacTile = { h: hh, g, lx, ly };
      if (road) tile.road = true;
      if (g === 'forest' && !road) tile.tree = true;
      b.tiles.push(tile);
    }
  fords(b);
  lieOfTheLand(b, along, mixSeed(seed, 0x51de, salt));
  // the town's wall across the board at the gate's row, its gate in the middle (open: the way in)
  const wall = townWall(s);
  // (the wall meets water: a grate the river runs through and nobody does, once the town has built one; till then
  // the gap is a way in: sim/ringWall.ts)
  const grated = s.buildings.some((x) => x.status === 'done' && isGrate(x.def));
  const mid = Math.floor(h / 2);
  const gates = new Set([mid - 1, mid]);
  for (let v = 0; v < h; v++) {
    const tile = tileAt(b, along, v)!;
    if (tile.g === 'mountain') continue;
    if (tile.g === 'water' || tile.g === 'shallows') {
      if (!grated) continue;
      delete tile.trap;
      tile.block = 'wall';
      tile.wall = GRATE_OF[wall] ?? wall;
      tile.h += 2;
      continue;
    }
    delete tile.tree;
    delete tile.bush;
    delete tile.trap;
    if (tile.block === 'rock') delete tile.block;
    if (gates.has(v)) {
      tile.gate = true;
      tile.wall = GATE_OF[wall] ?? 'palisade_gate';
      tile.road = true;
    } else {
      tile.block = 'wall';
      tile.wall = wall;
      tile.h += 2;
    }
  }
  // (the town's side of the wall is kept clear, and the way to the gate open)
  for (let u = along + 1; u < w; u++)
    for (let v = 0; v < h; v++) {
      const tile = tileAt(b, u, v)!;
      if (tile.block === 'rock') delete tile.block;
      delete tile.bush;
    }
  for (const v of gates)
    for (let u = along - 2; u < along; u++) {
      const tile = tileAt(b, u, v);
      if (tile?.block === 'rock') delete tile.block;
    }
  // (the town's towers stand on the wall, out from the gate either side)
  const posts: number[] = [];
  for (let d = 2; d < h; d += 2) posts.push(mid + d, mid - 1 - d);
  for (const x of s.buildings) {
    const d = BUILDING_BY_ID[x.def]?.defense;
    if (!d || x.status !== 'done' || isTrap(x.def)) continue;
    while (posts.length) {
      const tile = tileAt(b, along, posts.shift()!);
      if (tile?.block !== 'wall') continue;
      tile.bld = x.id;
      break;
    }
  }
  layTraps(b, [...traps.values()], along, mixSeed(seed, 0x7a95, salt));
  return b;
}

/** The town's wall as the board draws it: the ring's, else the best it has built, else a palisade. */
function townWall(s: GameState): string {
  if (s.ring?.wall) return s.ring.wall;
  let best = 'palisade_wall';
  for (const x of s.buildings) {
    if (x.status !== 'done' || !(WALL_KINDS as readonly string[]).includes(x.def)) continue;
    if ((BUILDING_BY_ID[x.def]?.hp ?? 0) > (BUILDING_BY_ID[best]?.hp ?? 0)) best = x.def;
  }
  return best;
}

/** The lie of the land, a little different every battle: a rise or two, a hollow, boulders strewn about, thickets for
 *  cover (on the field before the wall; the land's own woods, water and hills stay as they are). */
function lieOfTheLand(b: Pick<Tactics, 'w' | 'h' | 'tiles'>, along: number, seed: number): void {
  let k = 0;
  const roll = () => (mixSeed(seed, 0x1a5d, k++) >>> 0) / 4294967296;
  const open = (t: TacTile | null) => !!t && !t.road && !t.block && ROLLING.has(t.g);
  // rises and hollows: a round lump of ground raised or sunk, a step at its rim, two at its heart
  const lumps = 2 + Math.floor(roll() * 3);
  for (let i = 0; i < lumps; i++) {
    const cu = 1 + Math.floor(roll() * (along - 3));
    const cv = Math.floor(roll() * b.h);
    const r = 1.5 + roll() * 2.5;
    const up = roll() < 0.75 ? 1 : -1;
    for (let v = 0; v < b.h; v++)
      for (let u = 0; u < along - 1; u++) {
        const d = Math.hypot(u - cu, v - cv);
        if (d > r) continue;
        const t = tileAt(b, u, v)!;
        if (!open(t)) continue;
        t.h = Math.max(1, t.h + up * (d < r * 0.5 ? 2 : 1));
      }
  }
  // boulders, alone or in a little heap, and thickets
  const boulders = Math.floor(b.w * b.h * BOULDERS);
  for (let i = 0; i < boulders; i++) {
    const u = 1 + Math.floor(roll() * (along - 3));
    const v = Math.floor(roll() * b.h);
    const t = tileAt(b, u, v);
    if (!open(t) || t!.tree) continue;
    t!.block = 'rock';
    t!.h += 1;
  }
  const bushes = Math.floor(b.w * b.h * THICKETS);
  for (let i = 0; i < bushes; i++) {
    const u = Math.floor(roll() * (along - 1));
    const v = Math.floor(roll() * b.h);
    const t = tileAt(b, u, v);
    if (open(t) && !t!.tree) t!.bush = true;
  }
}

/** Water this close (tiles, four ways) to a bank is waded: a river or a stream is shallows on the board, crossed at
 *  two moves a tile and lying low (the banks above it strike down into it); only wide water (a lake's middle, the
 *  sea) stays deep. (The owner's complaint: a river across the field let nobody cross, so the raiders and the town
 *  stood on their banks; on the land itself raiders wade a river, battle.ts `FORD`.) */
export const FORD_DEPTH = 2;
function fords(b: Pick<Tactics, 'w' | 'h' | 'tiles'>): void {
  const near = new Array<number>(b.tiles.length).fill(999);
  const queue: number[] = [];
  b.tiles.forEach((t, i) => {
    if (t.g !== 'water' && t.g !== 'mountain') {
      near[i] = 0;
      queue.push(i);
    }
  });
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    if (near[i] >= FORD_DEPTH) continue;
    const [u, v] = [i % b.w, Math.floor(i / b.w)];
    for (const [du, dv] of DIRS) {
      const nu = u + du;
      const nv = v + dv;
      if (nu < 0 || nv < 0 || nu >= b.w || nv >= b.h) continue;
      const j = nv * b.w + nu;
      if (near[j] <= near[i] + 1 || b.tiles[j].g !== 'water') continue;
      near[j] = near[i] + 1;
      queue.push(j);
    }
  }
  b.tiles.forEach((t, i) => {
    if (t.g === 'water' && near[i] <= FORD_DEPTH) t.g = 'shallows';
  });
}

/** Whether someone may stand on a tile (a swimmer in the water too). */
function standable(tile: TacTile | null, foe: boolean, swim = false): boolean {
  if (!tile) return false;
  if (tile.g === 'mountain') return false;
  if (tile.g === 'water' && !swim) return false;
  if (tile.block === 'building' || tile.block === 'rock') return false;
  if (tile.block === 'wall' && foe) return false;
  return true;
}

/* ------------------------------------------------------------ who's who */

const personOf = (s: GameState, key: string) => (key[0] === 'p' ? s.people.find((p) => p.id === +key.slice(1)) : undefined);
const raiderOf = (r: Raid, key: string) => (key[0] === 'r' ? r.raiders.find((q) => q.id === +key.slice(1)) : undefined);
const towerOf = (s: GameState, key: string) => (key[0] === 't' ? s.buildings.find((b) => b.id === +key.slice(1)) : undefined);

export interface TacStats {
  speed: number;
  move: number;
  jump: number;
  reach: number;
  shooter: boolean;
}

/** How a unit moves and reaches. */
export function statsOf(s: GameState, r: Raid, u: TacUnit): TacStats {
  const tower = towerOf(s, u.key);
  if (tower) return { speed: TOWER_SPEED, move: 0, jump: 0, reach: Math.max(2, Math.round((BUILDING_BY_ID[tower.def].defense?.range ?? TILE * 3) / TILE)), shooter: true };
  const p = personOf(s, u.key);
  if (p) {
    const dex = attributesOf(p).dex;
    const shooter = ranged(p);
    const magic = castsMagic(p.cls);
    const reach = shooter ? Math.max(2, Math.min(6, Math.round(weaponRange(p, true)))) : magic ? 4 : weaponOf(p).reach ? 2 : 1;
    // (a nimble one walks further; a heavily armoured one less)
    const heavy = (weaponOf(p).speed ?? 1) > 1.2 ? 1 : 0;
    return { speed: 6 + dex * 0.25, move: Math.max(2, 3 + (dex >= 16 ? 1 : 0) + (dex >= 26 ? 1 : 0) - heavy), jump: 2 + (dex >= 20 ? 1 : 0), reach, shooter: shooter || magic };
  }
  const rd = raiderOf(r, u.key)!;
  const def = ENEMIES[rd.kind];
  const pace = RAID_KIND_BY_ID[r.kind]?.speed ?? 40;
  const big = def.boss || !!def.kit;
  return { speed: 6 + 3 / Math.max(0.6, def.interval), move: pace >= 60 ? 4 : big ? 3 : 3, jump: pace >= 60 ? 3 : 2, reach: def.ranged ? 4 : 1, shooter: def.ranged };
}

/** Whether the board's fighters of a town swim (a shore town's). */
const swims = (s: GameState) => s.origin === 'merfolk';

/* ------------------------------------------------------------ starting */

/** The raiders have come: cut the board, set the town's fighters along its town end, the raiders at the far edge. */
export function startTactics(s: GameState, r: Raid): void {
  const foes = r.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone);
  const folk = fighters(s);
  const board = makeBoard(s, r.side, foes.length + folk.length >= BIG_AT || !!r.host, s.tick);
  const auto = s.tacticsAuto !== false || !!r.alone || runtime.quiet || s.autopilot === false;
  const t: Tactics = { ...board, units: [], waiting: [], auto, phase: 'fighting', turns: 0, killed: 0, through: 0, lost: 0, started: s.tick, hits: [], fx: [], chests: [] };
  r.tactics = t;
  r.leavesTick = Math.max(r.leavesTick, s.tick + 3 * TICKS_PER_HOUR);
  // the town's fighters: blockers in the front rows, shooters behind them, the town's allies with the blockers
  const sorted = [...folk].sort((a, b) => (ranged(a) || castsMagic(a.cls) ? 1 : 0) - (ranged(b) || castsMagic(b.cls) ? 1 : 0) || b.hp - a.hp);
  const allies = r.raiders.filter((q) => q.ally && !q.down && !q.gone);
  const rows = [t.w - 1 - TOWN_ROWS, t.w - TOWN_ROWS, t.w - TOWN_ROWS + 1, t.w - 1];
  const order = across(t.h);
  const place = (key: string, shooter: boolean, extra?: Partial<TacUnit>) => {
    for (const u of shooter ? [...rows].reverse() : rows)
      for (const v of order) {
        const tile = tileAt(t, u, v);
        if (!standable(tile, false, swims(s)) || t.units.some((x) => x.u === u && x.v === v)) continue;
        t.units.push({ key, foe: false, u, v, facing: 2, ct: 0, ...extra });
        return true;
      }
    return false;
  };
  for (const p of sorted) place(`p${p.id}`, ranged(p) || castsMagic(p.cls), { kit: kitOf(p), st: {} });
  for (const a of allies) place(`r${a.id}`, ENEMIES[a.kind].ranged);
  // the town's towers on the board take turns of their own (they stand on their blocks)
  for (const b of s.buildings) {
    const d = BUILDING_BY_ID[b.def]?.defense;
    if (!d || b.status !== 'done' || isTrap(b.def)) continue;
    for (let i = 0; i < t.tiles.length; i++) {
      const tile = t.tiles[i];
      if (tile.bld !== b.id) continue;
      t.units.push({ key: `t${b.id}`, foe: false, u: i % t.w, v: Math.floor(i / t.w), facing: 2, ct: 0 });
      break;
    }
  }
  // the raiders: as many as the far edge holds now, the rest as room is made (a big raid comes on in waves)
  const chief = (id: string) => !!ENEMIES[id].kit || !!ENEMIES[id].boss || RAID_KIND_BY_ID[r.kind]?.leader === id || /chief|captain|alpha|warlord|lord|king|queen|matriarch|elder/.test(id);
  const lead = foes.filter((rd) => chief(rd.kind)).sort((a, b) => b.maxHp - a.maxHp)[0];
  // (the leader comes on last, behind its own)
  for (const rd of [...foes.filter((q) => q !== lead), ...(lead ? [lead] : [])]) {
    rd.bt = { d: 0, lane: 0, wave: 0 };
    t.waiting.push(rd.id);
  }
  if (lead) t.leader = `r${lead.id}`;
  spawn(s, r, t);
  // (each starts with a little charge, by the seed, so the first turns aren't all at once)
  for (const u of t.units) u.ct = ((mixSeed(hashSeed(s.seed), s.tick, hashSeed(u.key)) >>> 0) % 40) + (u.foe ? 0 : 40);
  syncPlaces(s, r, t);
  t.banner = { text: lead ? `Defeat ${ENEMIES[lead.kind].name}!` : 'Rout the raiders!', tick: s.tick, kind: 'start' };
  notify(s, `${foes.length} raiders on the field: the battle is joined!`, true);
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
function spawn(s: GameState, r: Raid, t: Tactics): void {
  const order = across(t.h);
  let came = 0;
  // (no more on the field at once than the town has fighters on it, give or take: a big raid comes on in waves)
  const folk = t.units.filter((u) => !u.foe && u.key[0] !== 't').length;
  const most = Math.max(WAVE_LEAST, Math.ceil(folk * WAVE_PER_FIGHTER));
  while (t.waiting.length && t.units.filter((u) => u.foe).length < most) {
    let spot: [number, number] | null = null;
    for (const u of [0, 1])
      for (const v of order) {
        if (spot) break;
        if (standable(tileAt(t, u, v), true, true) && !t.units.some((x) => x.u === u && x.v === v)) spot = [u, v];
      }
    if (!spot) break;
    const id = t.waiting.shift()!;
    const rd = r.raiders.find((q) => q.id === id);
    if (!rd || rd.down || rd.gone) continue;
    t.units.push({ key: `r${id}`, foe: true, u: spot[0], v: spot[1], facing: 0, ct: t.turns ? 30 : 0 });
    came++;
  }
  if (came >= 2 && t.turns > 0) t.banner = { text: 'Reinforcements!', tick: s.tick, kind: 'wave' };
}

/** The town's traps are laid out on the field the raiders cross, a different spread every battle (the owner's ask: by
 *  the gate the raiders never reached them): each on a free tile `TRAP_FIELD_FROM` columns in from the raiders' edge
 *  up to `TRAP_FIELD_TO` short of the wall, most of them toward the middle rows, where the ways to the gate run. */
export const TRAP_FIELD_FROM = 3;
export const TRAP_FIELD_TO = 3;
export function layTraps(b: Pick<Tactics, 'w' | 'h' | 'tiles'>, ids: number[], along: number, seed: number): void {
  const lo = Math.min(TRAP_FIELD_FROM, along - 1);
  const hi = Math.max(lo, along - TRAP_FIELD_TO);
  const mid = (b.h - 1) / 2;
  let k = 0;
  for (const id of ids) {
    for (let tries = 0; tries < 40; tries++, k++) {
      const r1 = (mixSeed(seed, 1, k) >>> 0) / 4294967296;
      const r2 = (mixSeed(seed, 2, k) >>> 0) / 4294967296;
      const r3 = (mixSeed(seed, 3, k) >>> 0) / 4294967296;
      const u = lo + Math.floor(r1 * (hi - lo + 1));
      // (the rows: the middle half twice as likely as the edges)
      const v = Math.round(r3 < 0.67 ? mid + (r2 - 0.5) * b.h * 0.5 : r2 * (b.h - 1));
      const tile = b.tiles[v * b.w + u];
      if (!tile || tile.block || tile.trap !== undefined || tile.g === 'water' || tile.g === 'shallows' || tile.g === 'mountain') continue;
      tile.trap = id;
      break;
    }
  }
}

/** Everyone on the board stands where their tile is on the land (the map, the towers, the recap see them there). */
function syncPlaces(s: GameState, r: Raid, t: Tactics): void {
  for (const u of t.units) {
    if (u.key[0] === 't') continue;
    const [lx, ly] = landOf(t, u.u, u.v);
    const x = (lx + 0.5) * CELL;
    const y = (ly + 0.5) * CELL;
    const q = personOf(s, u.key) ?? raiderOf(r, u.key);
    if (!q) continue;
    q.x = x;
    q.y = y;
    const dx = DIRS[u.facing][0] * (t.side < 0 ? 1 : -1);
    if (dx) q.dir = dx > 0 ? 1 : -1;
  }
}

/* ------------------------------------------------------------ the fighters as the spells see them */

function asPerson(u: TacUnit, q: Person): Combatant {
  const f = personFighter(q, 'fighter', 'front');
  return {
    side: 'party',
    ref: q.id,
    kind: 'person',
    name: q.name,
    get hp() { return q.hp; },
    set hp(v) { q.hp = Math.max(0, Math.round(v)); },
    maxHp: f.maxHp,
    get down() { return !!q.downed || q.hp <= 0; },
    set down(_v) { /* (a townsperson falls through attackPerson, not here) */ },
    damage: f.damage,
    accuracy: f.accuracy,
    dodge: f.dodge,
    armor: f.armor,
    interval: f.interval,
    cooldown: 0,
    ranged: f.ranged,
    st: (u.st ??= {}),
    kit: u.kit,
  };
}

function asRaider(rd: Raider): Combatant {
  const d = ENEMIES[rd.kind];
  return {
    side: rd.ally ? 'party' : 'enemy',
    ref: rd.id,
    kind: rd.kind,
    name: d.name,
    get hp() { return rd.hp; },
    set hp(v) { rd.hp = Math.max(0, Math.round(v)); },
    maxHp: rd.maxHp,
    get down() { return rd.down; },
    set down(v) { rd.down = v; },
    damage: d.damage,
    accuracy: d.accuracy,
    dodge: d.dodge,
    armor: enemyArmor(rd.kind),
    interval: Math.round(d.interval * TICK_HZ),
    get cooldown() { return rd.cooldown; },
    set cooldown(v) { rd.cooldown = v; },
    ranged: d.ranged,
    st: rd.bt ? (rd.bt.st ??= {}) : {},
  };
}

/** The board as a spell or skill sees it: the caster, the foes and friends it may touch. */
function arenaFor(s: GameState, r: Raid, t: Tactics, me: TacUnit, foes: TacUnit[], friends: TacUnit[], rng: Rng): (Arena & { me: Combatant }) | null {
  const p = personOf(s, me.key);
  if (!p) return null;
  const c = (u: TacUnit): Combatant | null => {
    const q = personOf(s, u.key);
    if (q) return asPerson(u, q);
    const rd = raiderOf(r, u.key);
    return rd ? asRaider(rd) : null;
  };
  const self = asPerson(me, p);
  const others = [...friends, ...foes].filter((u) => u !== me).map(c).filter((x): x is Combatant => !!x);
  return {
    me: self,
    tick: s.tick,
    rng,
    all: () => [self, ...others],
    summon: (_user, kind) => {
      if (!ENEMIES[kind]) return null;
      // (called up on a free tile beside the caster: it fights for the town for the rest of the battle)
      for (const [du, dv] of DIRS) {
        const u = me.u + du;
        const v = me.v + dv;
        if (!standable(tileAt(t, u, v), false) || t.units.some((x) => x.u === u && x.v === v)) continue;
        const [lx, ly] = landOf(t, u, v);
        const a = ally(s, kind, (lx + 0.5) * CELL, -r.side as 1 | -1, (ly + 0.5) * CELL);
        a.conjuredAt = s.tick;
        r.raiders.push(a);
        t.units.push({ key: `r${a.id}`, foe: false, u, v, facing: me.facing, ct: 50 });
        return asRaider(a);
      }
      return null;
    },
    log: (user, name, targets, meta) => {
      const at = targets.map((x) => t.units.find((u) => u.key === (x.kind === 'person' ? `p${x.ref}` : `r${x.ref}`))).filter((u): u is TacUnit => !!u);
      t.fx.push({ tick: s.tick, kind: 'act', from: [me.u, me.v], to: at.map((u) => [u.u, u.v] as [number, number]), name, ult: !!meta?.ult });
      if (meta?.ult) notify(s, `${user.name} unleashes ${name}!`, true);
    },
  };
}

/* ------------------------------------------------------------ the turns */

/** One tick of the battle: the one whose turn it is walks and acts; else the clock runs to the next. False once it's
 *  over (the raiders left are the town's business, as from the trail). */
export function stepTactics(s: GameState, r: Raid, rng: Rng): boolean {
  const t = r.tactics;
  if (!t || t.phase === 'done') return false;
  tidy(s, r, t, rng);
  // lingering statuses (poison, regeneration...) on everyone
  statuses(s, r, t, rng);
  if (t.hits.length) t.hits = t.hits.filter((x) => s.tick - x.tick < 2 * TICK_HZ);
  if (t.fx.length) t.fx = t.fx.filter((x) => s.tick - x.tick < 2 * TICK_HZ);
  const foes = t.units.filter((u) => u.foe);
  const standing = t.units.filter((u) => !u.foe && u.key[0] !== 't' && u.count === undefined);
  if (!foes.length && !t.waiting.length) return finish(s, r, t, 'won', `Victory! ${t.killed} raiders down${t.through ? `, ${t.through} got through` : ''}.`);
  if (!standing.length && !t.act) {
    // (nobody left standing on the field: the raiders walk on into the town)
    for (const u of foes) through(s, r, t, u);
    for (const id of t.waiting) {
      const rd = r.raiders.find((q) => q.id === id);
      if (rd?.bt) rd.bt.out = true;
    }
    t.waiting = [];
    return finish(s, r, t, 'lost', 'The field is lost: the raiders are into the town!');
  }
  if (t.act) {
    play(s, r, t, rng);
    syncPlaces(s, r, t);
    return true;
  }
  // the player's orders: the turn waits on them, and the town takes it if none come
  if (t.await) {
    if (t.auto || s.tick >= t.await.until || runtime.quiet || r.alone) {
      const me = t.units.find((u) => u.key === t.await!.key);
      const left = t.await;
      t.await = undefined;
      if (me && !left.acted) t.act = plan(s, r, t, me, statsOf(s, r, me), rng, left.moved);
    }
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
  beginTurn(s, r, t, me, stats.get(me.key)!, rng);
  syncPlaces(s, r, t);
  return true;
}

/** The fallen and the gone off the board (a townsperson struck down lies there with their count); raiders who joined
 *  since, summoned or called, come on. */
function tidy(s: GameState, r: Raid, t: Tactics, rng: Rng): void {
  t.units = t.units.filter((u) => {
    if (u.key[0] === 't') return !!towerOf(s, u.key) && towerOf(s, u.key)!.status === 'done';
    const p = personOf(s, u.key);
    if (u.key[0] === 'p') {
      if (!p || p.away !== null) return false;
      if (p.downed && u.count === undefined) {
        u.count = DOWN_COUNT;
        notify(s, `${p.name} is down! ${DOWN_COUNT} turns to reach them.`);
      } else if (!p.downed && u.count !== undefined) u.count = undefined; // (back on their feet: a medkit, a spell)
      return true;
    }
    const rd = raiderOf(r, u.key);
    if (!rd || rd.gone || (rd.bt?.out && !rd.ally)) return false;
    if (rd.down) {
      fallen(s, r, t, u, rng);
      return false;
    }
    return true;
  });
  for (const rd of r.raiders)
    if (!rd.ally && !rd.down && !rd.gone && !rd.bt) {
      rd.bt = { d: 0, lane: 0, wave: 0 };
      t.waiting.push(rd.id);
    }
  spawn(s, r, t);
}

/** A raider has fallen on the board: counted, maybe a chest, and its leader's fall breaks the rest. */
function fallen(s: GameState, r: Raid, t: Tactics, u: TacUnit, rng: Rng): void {
  const rd = raiderOf(r, u.key);
  if (!rd || rd.ally) return;
  t.killed++;
  if (!t.chests.some((c) => c.u === u.u && c.v === u.v) && rng.next() < CHEST_CHANCE) t.chests.push({ u: u.u, v: u.v, coins: rng.int(...CHEST_COINS), ...(rng.next() < CHEST_ITEM ? { item: 'medkit' } : {}) });
  if (t.leader === u.key && !t.broken) {
    t.broken = true;
    t.banner = { text: `${ENEMIES[rd.kind].name} has fallen!`, tick: s.tick, kind: 'leader' };
    notify(s, `${ENEMIES[rd.kind].name} has fallen! The raiders lose heart.`, true);
  }
}

/** Each tick: the statuses on everyone run (a poison's bite, regeneration). */
function statuses(s: GameState, r: Raid, t: Tactics, rng: Rng): void {
  const arena: Arena = { tick: s.tick, rng, all: () => [], summon: () => null, log: () => {} };
  for (const u of t.units) {
    if (u.key[0] === 't') continue;
    const p = personOf(s, u.key);
    if (p) {
      if (!u.st || u.count !== undefined) continue;
      const proxy = { get hp() { return p.hp; }, set hp(v: number) { p.hp = Math.max(1, Math.round(v)); }, down: false, maxHp: maxHp(p), kind: 'person', st: u.st, kit: u.kit } as unknown as Combatant;
      tickStatuses(arena, proxy);
      continue;
    }
    const rd = raiderOf(r, u.key);
    if (!rd?.bt?.st) continue;
    const proxy = { get hp() { return rd.hp; }, set hp(v: number) { rd.hp = Math.max(0, Math.round(v)); }, get down() { return rd.down; }, set down(v: boolean) { rd.down = v; }, maxHp: rd.maxHp, kind: rd.kind, st: rd.bt.st } as unknown as Combatant;
    tickStatuses(arena, proxy);
  }
}

/** A turn begins: a tower shoots, the fallen count down, the stunned stand, the player's fighters wait on orders, and
 *  everyone else plans. */
function beginTurn(s: GameState, r: Raid, t: Tactics, me: TacUnit, st: TacStats, rng: Rng): void {
  if (me.key[0] === 't') return towerTurn(s, r, t, me, st, rng);
  if (me.count !== undefined) {
    me.count--;
    const p = personOf(s, me.key);
    if (me.count > 0 || !p) return;
    // (their count is out: they're lost, unless it's the founder, whom the town always carries off)
    if (p.id === s.mainId) {
      me.count = 1;
      return;
    }
    t.fx.push({ tick: s.tick, kind: 'lost', from: [me.u, me.v], to: [] });
    t.lost++;
    t.banner = { text: `${p.name} is lost`, tick: s.tick, kind: 'lost' };
    t.units = t.units.filter((u) => u !== me);
    killPerson(s, p, 'on the field of battle');
    return;
  }
  // (stunned, asleep, frozen: they stand)
  const st2 = me.key[0] === 'p' ? me.st : raiderOf(r, me.key)?.bt?.st;
  if (st2 && held({ st: st2 } as Combatant, s.tick)) {
    t.fx.push({ tick: s.tick, kind: 'stun', from: [me.u, me.v], to: [] });
    t.act = { key: me.key, path: [[me.u, me.v]], step: 0, kind: 'wait', stage: 'beat', next: s.tick + WAIT_TICKS };
    return;
  }
  if (!me.foe && me.key[0] === 'p' && !t.auto && !runtime.quiet && !r.alone) {
    t.await = { key: me.key, moved: false, acted: false, from: [me.u, me.v], until: s.tick + AWAIT_TICKS };
    return;
  }
  t.act = plan(s, r, t, me, st, rng);
}

/** A tower's turn: a bolt at the raider in its reach nearest the town's end. */
function towerTurn(s: GameState, r: Raid, t: Tactics, me: TacUnit, st: TacStats, rng: Rng): void {
  const b = towerOf(s, me.key);
  const d = b && BUILDING_BY_ID[b.def].defense;
  if (!b || !d || (b.readyTick ?? 0) > s.tick + 0) return;
  const target = t.units.filter((u) => u.foe && apart(u, me) <= st.reach).sort((a, c) => c.u - a.u)[0];
  const rd = target && raiderOf(r, target.key);
  if (!target || !rd) return;
  const was = before(r.raiders);
  const hp = rd.hp;
  const near = (x: Raider, px: number) => r.raiders.filter((o) => o !== x && !o.down && !o.gone && !o.ally && Math.hypot(o.x - x.x, o.y - x.y) <= px);
  fireAt(s, rng, d, rd, near, (x, dmg) => hurt(s, x, dmg));
  credit(s, TOWERS, was);
  t.fx.push({ tick: s.tick, kind: 'tower', from: [me.u, me.v], to: [[target.u, target.v]] });
  t.hits.push({ u: target.u, v: target.v, text: rd.hp < hp ? `${Math.round(hp - rd.hp)}` : 'Miss', foe: true, tick: s.tick });
  t.act = { key: me.key, path: [[me.u, me.v]], step: 0, kind: 'shoot', stage: 'beat', next: s.tick + BEAT_TICKS };
}

function hurt(s: GameState, rd: Raider, dmg: number): void {
  if (rd.down || rd.gone) return;
  rd.hp = Math.max(0, Math.round(rd.hp - dmg));
  rd.lastHit = s.tick;
  if (rd.hp === 0) rd.down = true;
}

function finish(s: GameState, r: Raid, t: Tactics, outcome: Tactics['outcome'], text: string): boolean {
  t.phase = 'done';
  t.act = undefined;
  t.await = undefined;
  t.outcome = outcome;
  t.banner = { text: outcome === 'won' ? 'Victory!' : outcome === 'lost' ? 'Defeat' : 'The raiders flee', tick: s.tick, kind: outcome === 'won' ? 'win' : 'lose' };
  notify(s, text, true);
  r.leavesTick = Math.max(Math.min(r.leavesTick, s.tick + TICKS_PER_HOUR), s.tick + Math.round(TICKS_PER_HOUR / 4));
  return false;
}

/** Tiles a fighter can reach this turn: walking round the other side, through their own, climbing no more than they
 *  jump (dropping one more), each step a tile (marsh and the shallows two). Their own tile is one. */
export function reachable(s: GameState, t: Tactics, me: TacUnit, st: TacStats): Map<number, { cost: number; from: number }> {
  const out = new Map<number, { cost: number; from: number }>();
  const start = me.v * t.w + me.u;
  out.set(start, { cost: 0, from: -1 });
  if (st.move <= 0) return out;
  const queue = [start];
  const taken = new Map(t.units.map((u) => [u.v * t.w + u.u, u]));
  const swim = !me.foe && swims(s);
  while (queue.length) {
    queue.sort((a, b) => out.get(a)!.cost - out.get(b)!.cost);
    const i = queue.shift()!;
    const here = t.tiles[i];
    const c = out.get(i)!.cost;
    for (const [du, dv] of DIRS) {
      const u = (i % t.w) + du;
      const v = Math.floor(i / t.w) + dv;
      const tile = tileAt(t, u, v);
      if (!standable(tile, me.foe, swim || me.foe)) continue;
      const rise = tile!.h - here.h;
      if (rise > st.jump || -rise > st.jump + 1) continue;
      const other = taken.get(v * t.w + u);
      if (other && other.foe !== me.foe && other.count === undefined) continue;
      const cost = c + (tile!.g === 'marsh' || tile!.g === 'shallows' || tile!.g === 'water' ? 2 : 1);
      if (cost > st.move) continue;
      const j = v * t.w + u;
      if (out.has(j) && out.get(j)!.cost <= cost) continue;
      out.set(j, { cost, from: i });
      queue.push(j);
    }
  }
  // (nobody ends on a tile someone else stands or lies on)
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

/** How far a shot reaches from a tile: further from high ground, less by night. */
function shotReach(s: GameState, st: TacStats, from: TacTile, to: TacTile): number {
  if (!st.shooter) return st.reach;
  const h = calendar(s.tick).hour;
  const dark = h >= 21 || h < 5 ? 1 : 0;
  return Math.max(1, st.reach + Math.max(0, Math.floor((from.h - to.h) / 2)) - dark);
}

/** Whether `from` can strike `target` from tile `at`. */
function canStrike(s: GameState, t: Tactics, st: TacStats, at: { u: number; v: number }, target: TacUnit): boolean {
  const a = tileAt(t, at.u, at.v);
  const b = tileAt(t, target.u, target.v);
  if (!a || !b) return false;
  const d = apart(at, target);
  if (d === 0 || d > shotReach(s, st, a, b)) return false;
  return st.shooter || Math.abs(a.h - b.h) <= st.jump;
}

/** What a fighter will do this turn: where to walk, and whom to strike (or tend, or open) from there. */
function plan(s: GameState, r: Raid, t: Tactics, me: TacUnit, st: TacStats, rng: Rng, moved = false): TacAct {
  const reach = moved ? new Map([[me.v * t.w + me.u, { cost: 0, from: -1 }]]) : reachable(s, t, me, st);
  const foes = t.units.filter((u) => u.foe !== me.foe && u.key[0] !== 't' && u.count === undefined);
  const rd = raiderOf(r, me.key);
  const base = { key: me.key, step: 0, stage: 'move' as const, next: s.tick };
  // a raider breaking (its leader fallen, its own health gone, or its raid giving up) runs for the far edge
  if (me.foe && rd && !rd.ally && ((!ENEMIES[rd.kind].kit && (rd.hp < rd.maxHp * ROUT || t.broken)) || s.tick >= r.leavesTick)) {
    let best = me.v * t.w + me.u;
    for (const [j] of reach) if (j % t.w < best % t.w) best = j;
    return { ...base, path: pathTo(t, reach, best), kind: 'flee' };
  }
  const tile = (j: number) => t.tiles[j];
  // the town's: a friend struck down within reach is tended first (a healer always; anyone with nobody to strike)
  if (!me.foe && me.key[0] === 'p') {
    const p = personOf(s, me.key)!;
    const healer = CLASS_DEFS[p.cls as keyof typeof CLASS_DEFS]?.role === 'healer';
    const downed = t.units.filter((u) => !u.foe && u.count !== undefined);
    for (const d of downed) {
      let spot: number | null = null;
      for (const [j] of reach) if (apart({ u: j % t.w, v: Math.floor(j / t.w) }, d) === 1 && (spot === null || reach.get(j)!.cost < reach.get(spot)!.cost)) spot = j;
      if (spot === null) continue;
      const struck = foes.some((f) => [...reach.keys()].some((j) => canStrike(s, t, st, { u: j % t.w, v: Math.floor(j / t.w) }, f)));
      if (healer || !struck || (d.count ?? 3) <= 1) return { ...base, path: pathTo(t, reach, spot), target: d.key, kind: 'tend' };
    }
  }
  // the best blow it can strike from anywhere it can reach
  let best: { j: number; target: TacUnit; score: number } | null = null;
  for (const [j, info] of reach) {
    const at = { u: j % t.w, v: Math.floor(j / t.w) };
    const h = tile(j).h;
    for (const f of foes) {
      if (!canStrike(s, t, st, at, f)) continue;
      const hurt = foeHurt(s, r, f);
      let score = blowMult(t, at, f) * 10 + hurt * 6 - info.cost * 0.3 + h * 0.4;
      // (the town strikes first at whoever is nearest getting through, and at the leader; the raiders at the weak)
      if (!me.foe) score += f.u * 0.5 + (t.leader === f.key ? 3 : 0);
      // (a shooter would rather not stand next to a foe)
      if (st.shooter) score -= foes.filter((o) => apart(o, at) <= 1).length * 4;
      // (a chest on the way is taken too)
      if (!me.foe && t.chests.some((c) => c.u === at.u && c.v === at.v)) score += 3;
      if (!best || score > best.score) best = { j, target: f, score };
    }
  }
  if (best) {
    const p = personOf(s, me.key);
    return { ...base, path: pathTo(t, reach, best.j), target: best.target.key, kind: st.shooter ? (rd || !castsMagic(p?.cls) ? 'shoot' : 'cast') : 'strike' };
  }
  // none in reach: a chest close by, else the raiders walk on for the town's edge and the town's fighters close on the
  // raider nearest it (a shooter keeping its distance)
  if (!me.foe) {
    const chest = t.chests.find((c) => reach.has(c.v * t.w + c.u) && !t.units.some((u) => u.u === c.u && u.v === c.v));
    if (chest) return { ...base, path: pathTo(t, reach, chest.v * t.w + chest.u), kind: 'chest' };
  }
  let goal = me.v * t.w + me.u;
  let goalScore = -Infinity;
  const chase = me.foe ? null : [...foes].sort((a, b) => b.u - a.u)[0];
  const toTown = me.foe ? wayIn(t, st) : null;
  for (const [j, info] of reach) {
    const at = { u: j % t.w, v: Math.floor(j / t.w) };
    const score = me.foe ? -(toTown![j] ?? 999) * 2 - info.cost * 0.1 + tile(j).h * 0.1 : chase ? -apart(at, chase) * 2 + tile(j).h * 0.2 - (st.shooter ? Math.abs(apart(at, chase) - st.reach) : 0) : 0;
    if (score > goalScore) {
      goalScore = score;
      goal = j;
    }
  }
  void rng;
  return { ...base, path: pathTo(t, reach, goal), kind: 'wait' };
}

/** How many steps each tile is from the town's end of the board for a raider (round the wall, through the gate). */
function wayIn(t: Tactics, st: TacStats): number[] {
  const dist: number[] = new Array(t.tiles.length).fill(999);
  const queue: number[] = [];
  for (let v = 0; v < t.h; v++) {
    const j = v * t.w + t.w - 1;
    if (!standable(t.tiles[j], true)) continue;
    dist[j] = 0;
    queue.push(j);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const [u, v] = [i % t.w, Math.floor(i / t.w)];
    for (const [du, dv] of DIRS) {
      const n = tileAt(t, u + du, v + dv);
      const j = (v + dv) * t.w + u + du;
      if (!n || dist[j] <= dist[i] + 1 || !standable(n, true) || Math.abs(n.h - t.tiles[i].h) > Math.max(2, st.jump)) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** The tiles a fighter's weapon reaches from where they stand (the height they could strike up or down to aside). */
function attackTiles(t: Tactics, me: TacUnit, st: TacStats): [number, number][] {
  const out: [number, number][] = [];
  const r = Math.max(1, Math.floor(st.reach));
  for (let v = Math.max(0, me.v - r); v <= Math.min(t.h - 1, me.v + r); v++)
    for (let u = Math.max(0, me.u - r); u <= Math.min(t.w - 1, me.u + r); u++) {
      const d = Math.abs(u - me.u) + Math.abs(v - me.v);
      if (d >= 1 && d <= r) out.push([u, v]);
    }
  return out;
}

/** How hurt a unit is (0 whole, 1 nearly down). */
function foeHurt(s: GameState, r: Raid, u: TacUnit): number {
  const p = personOf(s, u.key);
  if (p) return 1 - p.hp / Math.max(1, maxHp(p));
  const rd = raiderOf(r, u.key);
  return rd ? 1 - rd.hp / Math.max(1, rd.maxHp) : 0;
}

/** The turn under way, a stage at a time: a tile a few ticks, then the act, then a beat. */
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
      const tile = tileAt(t, u, v);
      // (a raider steps on one of the town's traps)
      if (me.foe && tile?.trap !== undefined) springTrap(s, r, t, me, tile, rng);
      if (me.foe && !raiderOf(r, me.key)?.ally && a.kind !== 'flee' && me.u >= t.w - 1) {
        through(s, r, t, me);
        t.act = undefined;
      }
      return;
    }
    // (a chest underfoot is taken)
    if (!me.foe && me.key[0] === 'p') openChest(s, t, me);
    if (a.kind === 'move') {
      // (the player's move: back to their orders)
      t.act = undefined;
      if (t.await) t.await.moved = true;
      return;
    }
    a.stage = 'act';
    a.next = s.tick + ACT_TICKS;
    return;
  }
  if (a.stage === 'act') {
    const target = a.target ? t.units.find((u) => u.key === a.target) : undefined;
    let did = false;
    if (a.kind === 'flee' && me.u === 0) {
      const rd = raiderOf(r, me.key);
      if (rd) rd.gone = true;
      t.units = t.units.filter((u) => u !== me);
    } else if (a.kind === 'tend' && target && apart(me, target) <= 1) did = tend(s, t, me, target);
    else if (a.skill) did = cast(s, r, t, me, a.skill, a.at ?? (target ? [target.u, target.v] : [me.u, me.v]), rng);
    else if (target && target.count === undefined && canStrike(s, t, statsOf(s, r, me), me, target)) {
      // (a caster reaches for a spell or skill first, if one's worth it; else the blow)
      did = (me.key[0] === 'p' && !t.await && kitTurn(s, r, t, me, rng)) || (strike(s, r, t, me, target, rng), true);
    } else if (me.key[0] === 'p' && !t.await) did = kitTurn(s, r, t, me, rng);
    if (t.await) t.await.acted = true;
    a.stage = 'beat';
    a.next = s.tick + (did ? BEAT_TICKS : WAIT_TICKS);
    return;
  }
  t.act = undefined;
  // (the player's turn goes on until they've moved and acted, or wait)
  if (t.await && (!t.await.moved || !t.await.acted)) return;
  if (t.await) endTurn(t);
}

/** A spell or skill from the kit, the town choosing it: every one it can use, aimed at every tile in its reach, scored by
 *  whom its area would touch (foes for harm and hindrance, the hurt for mending); the best is cast, else nothing (and
 *  the blow is struck). A summons, which needs no aim, is the last resort. */
function kitTurn(s: GameState, r: Raid, t: Tactics, me: TacUnit, rng: Rng): boolean {
  if (!me.kit?.actions.length) return false;
  const best = bestCast(s, r, t, me);
  if (best) return cast(s, r, t, me, best.act.id, best.at, rng);
  // (nothing worth aiming: call up help if the kit can)
  const summons = me.kit.actions.filter((a) => a.use === 'summon');
  if (!summons.length) return false;
  const friends = t.units.filter((u) => u.foe === me.foe && u.key[0] !== 't' && u.count === undefined);
  const arena = arenaFor(s, r, t, me, [], friends, rng);
  if (!arena) return false;
  const all = me.kit.actions;
  me.kit.actions = summons;
  arena.me.kit = me.kit;
  const used = takeTurn(arena, arena.me);
  me.kit.actions = all;
  if (used) personOf(s, me.key)!.lastBlow = s.tick;
  return used;
}

/** Whom an area touches: the side it's meant for, standing (not struck down), towers aside. */
function touchedBy(t: Tactics, me: TacUnit, tiles: readonly Tile[], foe: boolean): TacUnit[] {
  const on = new Set(tiles.map(([u, v]) => v * t.w + u));
  return t.units.filter((u) => u.key[0] !== 't' && u.count === undefined && (u.foe !== me.foe) === foe && on.has(u.v * t.w + u.u));
}

/** The town's pick of spell or skill and where to aim it (null: nothing worth it). */
export function bestCast(s: GameState, r: Raid, t: Tactics, me: TacUnit): { act: KitAction; at: Tile; score: number } | null {
  const p = personOf(s, me.key);
  if (!p || !me.kit) return null;
  const pay = asPerson(me, p);
  const reach = statsOf(s, r, me).reach;
  let best: { act: KitAction; at: Tile; score: number } | null = null;
  for (const act of me.kit.actions) {
    if (act.ready > s.tick || !canPay(pay, act) || held(pay, s.tick)) continue;
    // (in place of a blow the town reaches only for what strikes, mends or hinders: a turn spent on a blessing for
    // oneself is a blow not struck, and the blessings come in the player's hands)
    if (act.use !== 'attack' && act.use !== 'heal' && act.use !== 'control') continue;
    const area = areaOf(act, reach);
    const foe = aimOf(act) === 'foe';
    for (const at of aimTiles(area, [me.u, me.v], t.w, t.h)) {
      const hit = touchedBy(t, me, areaTiles(area, [me.u, me.v], at, t.w, t.h), foe);
      if (!hit.length) continue;
      let score: number;
      if (act.use === 'heal') {
        // (the hurt it would mend; none worth it, no cast)
        const need = hit.reduce((n, u) => n + foeHurt(s, r, u), 0);
        if (need < 0.35) continue;
        score = need * 4;
      } else if (act.use === 'control') {
        if (hit.length < 2) continue;
        score = hit.length * 2;
      } else score = hit.length * 3 + hit.reduce((n, u) => n + foeHurt(s, r, u), 0) + (t.leader && hit.some((u) => u.key === t.leader) ? 2 : 0);
      // (an ultimate is the thing to do once the gauge is full; a skill's blow beats a plain one, and more beat one)
      if (act.pool === 'limit') score += 100;
      if (!best || score > best.score) best = { act, at, score };
    }
  }
  return best;
}

/** A spell or skill cast at a tile: on whoever its area touches (the side it's for). An act meant for one cast over a
 *  wider area touches all in it, each a little lighter (`SPREAD_POWER`). */
function cast(s: GameState, r: Raid, t: Tactics, me: TacUnit, id: string, at: Tile, rng: Rng): boolean {
  const act = me.kit?.actions.find((x) => x.id === id);
  if (!act) return false;
  const area = areaOf(act, statsOf(s, r, me).reach);
  const aim = aimOf(act);
  const tiles = areaTiles(area, [me.u, me.v], at, t.w, t.h);
  const foes = aim === 'foe' ? touchedBy(t, me, tiles, true) : [];
  const friends = aim === 'friend' ? touchedBy(t, me, tiles, false) : [];
  const arena = arenaFor(s, r, t, me, foes, friends, rng);
  if (!arena) return false;
  const hp = healthOf(s, r, [...foes, ...friends, me]);
  const wide = spreads(area);
  const use: KitAction = wide
    ? {
        ...act,
        effects: act.effects.map((e) => {
          const target = e.target === 'foe' ? 'foes' : e.target === 'ally' || e.target === 'weakest' ? 'allies' : e.target;
          return target === e.target ? e : { ...e, target, ...(e.power !== undefined ? { power: e.power * SPREAD_POWER } : {}) };
        }),
      }
    : act;
  if (!useAction(arena, arena.me, use)) return false;
  act.ready = use.ready;
  if (area.shape !== 'self') t.fx.push({ tick: s.tick, kind: 'area', from: [me.u, me.v], to: tiles.map(([u, v]) => [u, v] as [number, number]), foe: aim === 'foe' });
  // (facing the mark)
  if (at[0] !== me.u || at[1] !== me.v) me.facing = Math.abs(at[0] - me.u) >= Math.abs(at[1] - me.v) ? (at[0] > me.u ? 0 : 2) : at[1] > me.v ? 1 : 3;
  numbers(s, r, t, hp);
  personOf(s, me.key)!.lastBlow = s.tick;
  return true;
}

function healthOf(s: GameState, r: Raid, us: TacUnit[]): Map<TacUnit, number> {
  return new Map(us.map((u) => [u, personOf(s, u.key)?.hp ?? raiderOf(r, u.key)?.hp ?? 0]));
}
/** The numbers over whoever a spell or skill touched: harm in white or red, healing in green. */
function numbers(s: GameState, r: Raid, t: Tactics, was: Map<TacUnit, number>): void {
  for (const [u, hp] of was) {
    const now = personOf(s, u.key)?.hp ?? raiderOf(r, u.key)?.hp ?? 0;
    if (now < hp) t.hits.push({ u: u.u, v: u.v, text: `${Math.round(hp - now)}`, foe: u.foe, tick: s.tick });
    else if (now > hp) t.hits.push({ u: u.u, v: u.v, text: `+${Math.round(now - hp)}`, foe: u.foe, tick: s.tick, heal: true });
  }
}

/** A friend struck down, tended where they lie: up again, a little hurt. */
function tend(s: GameState, t: Tactics, me: TacUnit, target: TacUnit): boolean {
  const p = personOf(s, target.key);
  if (!p || !p.downed) return false;
  p.downed = null;
  p.hp = Math.max(p.hp, Math.round(maxHp(p) * TENDED_HP));
  target.count = undefined;
  target.ct = 0;
  t.fx.push({ tick: s.tick, kind: 'tend', from: [me.u, me.v], to: [[target.u, target.v]] });
  t.hits.push({ u: target.u, v: target.v, text: 'Back up!', foe: false, tick: s.tick, heal: true });
  const by = personOf(s, me.key);
  notify(s, `${by?.name ?? 'Someone'} gets ${p.name} back on their feet.`);
  return true;
}

/** A chest under their feet: the coins to them, anything else to the stores. */
function openChest(s: GameState, t: Tactics, me: TacUnit): void {
  const c = t.chests.find((x) => x.u === me.u && x.v === me.v);
  const p = personOf(s, me.key);
  if (!c || !p) return;
  t.chests = t.chests.filter((x) => x !== c);
  giveCoins(s, p, c.coins, 'a chest on the field');
  if (c.item) s.items[c.item] = (s.items[c.item] ?? 0) + 1;
  t.fx.push({ tick: s.tick, kind: 'chest', from: [me.u, me.v], to: [] });
  t.hits.push({ u: me.u, v: me.v, text: `${c.coins} coins${c.item ? ' + a medkit' : ''}`, foe: false, tick: s.tick, heal: true });
}

/** A raider on one of the town's traps: it bites once, then waits to be reset. */
function springTrap(s: GameState, r: Raid, t: Tactics, me: TacUnit, tile: TacTile, rng: Rng): void {
  const b = s.buildings.find((x) => x.id === tile.trap);
  const d = b && BUILDING_BY_ID[b.def].defense;
  const rd = raiderOf(r, me.key);
  if (!b || !d || !rd || (b.readyTick ?? 0) > s.tick) return;
  b.readyTick = s.tick + Math.round(d.interval * TICK_HZ);
  const was = before(r.raiders);
  const hp = rd.hp;
  fireAt(s, rng, { ...d, accuracy: 2 }, rd, () => [], (x, dmg) => hurt(s, x, dmg));
  credit(s, TOWERS, was);
  t.fx.push({ tick: s.tick, kind: 'trap', from: [me.u, me.v], to: [[me.u, me.v]] });
  t.hits.push({ u: me.u, v: me.v, text: `${Math.round(hp - rd.hp)}`, foe: true, tick: s.tick });
}

/** A blow: the town's through `defenderAttack`, the raiders' through `attackPerson`, so wounds, deaths, the recap and
 *  the rest are as in any raid; the angle and the height scale it, trees and rain turn some aside. */
function strike(s: GameState, r: Raid, t: Tactics, me: TacUnit, target: TacUnit, rng: Rng): void {
  const du = target.u - me.u;
  const dv = target.v - me.v;
  me.facing = Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 0 : 2) : dv > 0 ? 1 : 3;
  const st = statsOf(s, r, me);
  const mult = blowMult(t, me, target);
  const w = weatherAt(s.seed, s.tick, null).kind;
  const wet = st.shooter && (w === 'rain' || w === 'storm' || w === 'snow' || w === 'fog');
  const under = tileAt(t, target.u, target.v);
  const cover = ((under?.tree || under?.bush) && rng.next() < COVER) || (wet && rng.next() < RAIN_MISS);
  const mark = (text: string) => t.hits.push({ u: target.u, v: target.v, text, foe: target.foe, tick: s.tick });
  t.fx.push({ tick: s.tick, kind: st.shooter ? 'shot' : 'blow', from: [me.u, me.v], to: [[target.u, target.v]] });
  const p = personOf(s, me.key);
  const tp = personOf(s, target.key);
  const trd = raiderOf(r, target.key);
  const rd = raiderOf(r, me.key);
  if (cover) {
    mark(under?.tree || under?.bush ? 'Cover' : 'Miss');
    if (p) p.lastBlow = s.tick;
    if (rd) rd.lastAction = s.tick;
    return;
  }
  if (p && trd) {
    const was = trd.hp;
    defenderAttack(s, p, trd, rng, p.id === s.mainId ? 4 : 0, GROUND * mult);
    mark(trd.hp < was ? `${Math.round(was - trd.hp)}` : 'Miss');
    return;
  }
  if (rd && tp) {
    const was = tp.hp;
    const might = rd.might;
    rd.might = (might ?? 1) * mult * guardOf(t);
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
      hurt(s, trd, dmg);
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

/** The player's turn is over: they face the nearest foe. */
function endTurn(t: Tactics): void {
  t.await = undefined;
}

/* ------------------------------------------------------------ the player's orders */

export type TacticsOrder =
  | { op: 'auto'; on: boolean }
  | { op: 'move'; u: number; v: number }
  | { op: 'undo' }
  | { op: 'attack'; target: string }
  | { op: 'skill'; skill: string; target?: string; at?: [number, number] }
  | { op: 'tend'; target: string }
  | { op: 'wait'; facing?: number };

/** An order for the fighter whose turn waits on the player. False when it can't be done. */
export function tacticsOrder(s: GameState, o: TacticsOrder): boolean {
  const r = s.raid;
  const t = r?.tactics;
  if (o.op === 'auto') {
    s.tacticsAuto = o.on;
    if (t) t.auto = o.on;
    return true;
  }
  if (!r || !t || !t.await || t.act || t.phase === 'done') return false;
  const me = t.units.find((u) => u.key === t.await!.key);
  if (!me) return false;
  const st = statsOf(s, r, me);
  const base = { key: me.key, step: 0, next: s.tick };
  switch (o.op) {
    case 'move': {
      if (t.await.moved) return false;
      const reach = reachable(s, t, me, st);
      const j = o.v * t.w + o.u;
      if (!reach.has(j) || j === me.v * t.w + me.u) return false;
      t.act = { ...base, path: pathTo(t, reach, j), kind: 'move', stage: 'move' };
      return true;
    }
    case 'undo': {
      if (!t.await.moved || t.await.acted) return false;
      [me.u, me.v] = t.await.from;
      t.await.moved = false;
      syncPlaces(s, r, t);
      return true;
    }
    case 'attack': {
      const target = t.units.find((u) => u.key === o.target);
      if (t.await.acted || !target || target.foe === me.foe || target.count !== undefined || target.key[0] === 't' || !canStrike(s, t, st, me, target)) return false;
      t.act = { ...base, path: [[me.u, me.v]], target: target.key, kind: st.shooter ? 'shoot' : 'strike', stage: 'act' };
      return true;
    }
    case 'skill': {
      const act = me.kit?.actions.find((x) => x.id === o.skill);
      if (t.await.acted || !act || act.ready > s.tick) return false;
      const target = o.target ? t.units.find((u) => u.key === o.target) : undefined;
      const area = areaOf(act, st.reach);
      const at: Tile = o.at ?? (target ? [target.u, target.v] : [me.u, me.v]);
      if (!aimTiles(area, [me.u, me.v], t.w, t.h).some(([u, v]) => u === at[0] && v === at[1])) return false;
      t.act = { ...base, path: [[me.u, me.v]], skill: act.id, at: [at[0], at[1]], kind: 'cast', stage: 'act' };
      return true;
    }
    case 'tend': {
      const target = t.units.find((u) => u.key === o.target);
      if (t.await.acted || !target || target.count === undefined || apart(target, me) > 1) return false;
      t.act = { ...base, path: [[me.u, me.v]], target: target.key, kind: 'tend', stage: 'act' };
      return true;
    }
    case 'wait': {
      if (o.facing !== undefined && o.facing >= 0 && o.facing < 4) me.facing = o.facing;
      // (FFT: a turn that neither moved nor acted comes round sooner)
      if (!t.await.moved && !t.await.acted) me.ct = Math.min(99, me.ct + 40);
      else if (!t.await.moved || !t.await.acted) me.ct = Math.min(99, me.ct + 20);
      t.await = undefined;
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------ what the renderer sees */

export interface TacUnitView {
  key: string;
  foe: boolean;
  ally: boolean;
  tower: boolean;
  ref: number;
  u: number;
  v: number;
  facing: number;
  ct: number;
  name: string;
  /** A townsperson's calling and level; a raider's kind. */
  title: string;
  level: number;
  hp: number;
  max: number;
  /** Struck down: turns left. */
  count: number | null;
  leader: boolean;
  /** Statuses on them, by name. */
  st: string[];
  move: number;
  jump: number;
  reach: number;
}

export interface TacticsView {
  w: number;
  h: number;
  side: -1 | 1;
  tiles: TacTile[];
  units: TacUnitView[];
  /** Whose turn it is, what they're at, and on whom. */
  act: { key: string; kind: TacAct['kind']; stage: TacAct['stage']; target?: string; skill?: string; at?: [number, number]; path: [number, number][] } | null;
  /** A turn waiting on the player: where they can go, whom they can strike or tend, their spells and skills. */
  orders: {
    key: string;
    moved: boolean;
    acted: boolean;
    left: number;
    reach: [number, number][];
    strike: string[];
    tend: string[];
    /** The tiles their weapon reaches from where they stand (the attack's range). */
    attack: [number, number][];
    /** Each spell and skill: whom it's for, its reach and area (`tacticsArea.ts`), where it may be aimed, and who stands
     *  where it could fall. */
    skills: { id: string; name: string; aim: 'foe' | 'friend' | 'self'; ready: boolean; cost: number; pool: KitAction['pool']; area: TacArea; label: string; tiles: [number, number][]; targets: string[] }[];
  } | null;
  auto: boolean;
  /** The turns coming, by name (the CT order). */
  order: { key: string; name: string; foe: boolean }[];
  hits: { u: number; v: number; text: string; foe: boolean; age: number; heal?: boolean }[];
  fx: (Omit<TacFx, 'tick'> & { age: number })[];
  chests: { u: number; v: number }[];
  banner: { text: string; age: number; kind: NonNullable<Tactics['banner']>['kind'] } | null;
  turns: number;
  killed: number;
  through: number;
  lost: number;
  waiting: number;
  phase: Tactics['phase'];
  objective: string;
  /** The weather and the hour, as they bear on the fight. */
  conditions: string;
  night: boolean;
  /** The battle's speed (1, 2, 3). */
  speed: number;
}

export function tacticsView(s: GameState): TacticsView | null {
  if (s.tacticsEnded && s.tick >= s.tacticsEnded.until) s.tacticsEnded = undefined;
  const r = s.raid?.tactics ? s.raid : s.tacticsEnded?.raid;
  const t = r?.tactics;
  if (!r || !t) return null;
  // (the board stays up a few seconds after the end, for the last word)
  if (t.phase === 'done' && (!t.banner || s.tick - t.banner.tick > END_LINGER)) return null;
  const units: TacUnitView[] = t.units.map((u) => {
    const p = personOf(s, u.key);
    const rd = raiderOf(r, u.key);
    const tw = towerOf(s, u.key);
    const st = statsOf(s, r, u);
    const sts = p ? u.st : rd?.bt?.st;
    return {
      key: u.key,
      foe: u.foe,
      ally: !!rd?.ally,
      tower: !!tw,
      ref: +u.key.slice(1),
      u: u.u,
      v: u.v,
      facing: u.facing,
      ct: Math.round(u.ct),
      name: p ? p.name : rd ? ENEMIES[rd.kind].name : tw ? BUILDING_BY_ID[tw.def].name : '?',
      title: p ? `${callingName(p, stageOf(p)) ?? 'Townsperson'}` : rd ? (rd.ally ? 'Ally' : ENEMIES[rd.kind].boss || ENEMIES[rd.kind].kit ? 'Boss' : 'Raider') : 'Tower',
      level: p ? levelOf(p) : 0,
      hp: Math.round(p ? p.hp : (rd?.hp ?? 0)),
      max: Math.round(p ? maxHp(p) : (rd?.maxHp ?? 1)),
      count: u.count ?? null,
      leader: t.leader === u.key,
      st: Object.entries(sts ?? {})
        .filter(([, x]) => x && x.until > s.tick)
        .map(([k]) => k),
      move: st.move,
      jump: st.jump,
      reach: st.reach,
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
  let orders: TacticsView['orders'] = null;
  if (t.await && !t.act) {
    const me = t.units.find((u) => u.key === t.await!.key);
    if (me) {
      const st = statsOf(s, r, me);
      const reach = t.await.moved ? [] : [...reachable(s, t, me, st).keys()].map((j) => [j % t.w, Math.floor(j / t.w)] as [number, number]);
      const foes = t.units.filter((u) => u.foe !== me.foe && u.key[0] !== 't' && u.count === undefined);
      const friends = t.units.filter((u) => u.foe === me.foe && u.key[0] !== 't' && u.count === undefined);
      orders = {
        key: me.key,
        moved: t.await.moved,
        acted: t.await.acted,
        left: Math.max(0, Math.ceil((t.await.until - s.tick) / TICK_HZ)),
        reach,
        strike: t.await.acted ? [] : foes.filter((f) => canStrike(s, t, st, me, f)).map((f) => f.key),
        tend: t.await.acted ? [] : t.units.filter((u) => !u.foe && u.count !== undefined && apart(u, me) <= 1).map((u) => u.key),
        attack: t.await.acted ? [] : attackTiles(t, me, st),
        skills: (me.kit?.actions ?? []).map((a) => {
          const aim = aimOf(a);
          const area = areaOf(a, st.reach);
          const tiles = aimTiles(area, [me.u, me.v], t.w, t.h);
          const pool = aim === 'foe' ? foes : aim === 'friend' ? friends : [me];
          const could = new Set<number>();
          for (const at of tiles) for (const [u, v] of areaTiles(area, [me.u, me.v], at, t.w, t.h)) could.add(v * t.w + u);
          return {
            id: a.id,
            name: a.name,
            aim,
            ready: a.ready <= s.tick && !t.await!.acted,
            cost: a.cost,
            pool: a.pool,
            area,
            label: areaLabel(area),
            tiles: tiles.map(([u, v]) => [u, v] as [number, number]),
            targets: aim === 'self' ? [me.key] : pool.filter((u) => could.has(u.v * t.w + u.u)).map((u) => u.key),
          };
        }),
      };
    }
  }
  const h = calendar(s.tick).hour;
  const night = h >= 21 || h < 5;
  const w = weatherAt(s.seed, s.tick, null).kind;
  const leader = t.leader ? raiderOf(r, t.leader) : undefined;
  return {
    w: t.w,
    h: t.h,
    side: t.side,
    tiles: t.tiles,
    units,
    act: t.act ? { key: t.act.key, kind: t.act.kind, stage: t.act.stage, path: t.act.stage === 'move' ? t.act.path.slice(t.act.step) : [], ...(t.act.target ? { target: t.act.target } : {}), ...(t.act.skill ? { skill: t.act.skill } : {}), ...(t.act.at ? { at: t.act.at } : {}) } : null,
    orders,
    auto: t.auto,
    order,
    hits: t.hits.map((x) => ({ u: x.u, v: x.v, text: x.text, foe: x.foe, age: s.tick - x.tick, ...(x.heal ? { heal: true } : {}) })),
    fx: t.fx.map((x) => ({ kind: x.kind, from: x.from, to: x.to, age: s.tick - x.tick, ...(x.name ? { name: x.name } : {}), ...(x.ult ? { ult: true } : {}), ...(x.foe !== undefined ? { foe: x.foe } : {}) })),
    chests: t.chests.map((c) => ({ u: c.u, v: c.v })),
    banner: t.banner && s.tick - t.banner.tick < 4 * TICK_HZ ? { text: t.banner.text, age: s.tick - t.banner.tick, kind: t.banner.kind } : null,
    turns: t.turns,
    killed: t.killed,
    through: t.through,
    lost: t.lost,
    waiting: t.waiting.length,
    phase: t.phase,
    objective: leader && !t.broken ? `Defeat ${ENEMIES[leader.kind].name}` : t.broken ? 'Rout the rest' : 'Rout the raiders',
    conditions: [night ? 'Night: shots fall short' : '', w === 'rain' || w === 'storm' || w === 'snow' || w === 'fog' ? `${w[0].toUpperCase()}${w.slice(1)}: archers' aim spoiled` : ''].filter(Boolean).join(' · '),
    night,
    speed: s.battleSpeed ?? 1,
  };
}

/** The raid is over (raids.ts `endRaid`): a battle still going is won (every raider down, fled or through), and the
 *  board is kept a few seconds for the word across the screen. */
export function tacticsOver(s: GameState, r: Raid): void {
  const t = r.tactics;
  if (!t) return;
  if (t.phase !== 'done') {
    const won = r.raiders.every((rd) => rd.ally || rd.down || rd.gone);
    t.phase = 'done';
    t.act = undefined;
    t.await = undefined;
    t.outcome = won ? 'won' : 'fled';
    t.banner = { text: won ? 'Victory!' : 'The raiders flee', tick: s.tick, kind: won ? 'win' : 'lose' };
  }
  s.tacticsEnded = { raid: r, until: s.tick + END_LINGER };
}
/** How long the board stays up after the end (ticks). */
const END_LINGER = 4 * TICK_HZ;

/** Whether someone is on the tactics board now (people.ts leaves them standing where the battle puts them). */
export const onBoard = (s: GameState, p: Person): boolean => !!s.raid?.tactics && s.raid.tactics.phase !== 'done' && s.raid.tactics.units.some((u) => u.key === `p${p.id}`);

/** Whether a tactics battle is under way (the battle speed applies). */
export const inTactics = (s: GameState) => !!s.raid?.tactics && s.raid.tactics.phase !== 'done';
