// The Deep under the town (data/deep.ts): the levels the shaft's miners carve out, one under another. A level is made
// from the seed the first time it's reached (`makeLevel`): solid rock holding stone and ore, with pockets in it (a
// lake, fungus, a ruin, crystal, bones), the way up in the middle of its top edge with a little chamber dug out round
// it. The shaft is a workplace (data/crops.ts WORKPLACES): its miners take the mine task as at any mine, and each
// load is a cell of the Deep carved out (`digDeep`, from farming.ts `workMine`): the cell they were given
// (`deepTarget`: a rock cell beside the tunnels, a pocket first, then ore the town wants, then the nearest), its ore
// into their hands, its pocket opened. Enough dug on a level and the way down is found (`OPEN_AFTER`), and the next
// level opens below. Every cell dug stirs up what lives down there (`s.deep.stir`, settling each hour); past
// `RISE_AT`, something climbs up the shaft into the town (a raid begun at the shaft: `deepHourly`). A cell can come
// down on its digger (a broken bone, or worse). The fungus farms and lakes reached give food each dawn.
// Only the shaft's work and the hourly turn touch it, so towns without a shaft run as before; the rolls are the
// seed's own.

import {
  BONES,
  CAVE_IN_HURT,
  CAVE_IN_KILLS,
  CRYSTAL_GEMS,
  DEEP_DAWN,
  DEEP_H,
  DEEP_LEVELS,
  DEEP_W,
  DEEPEST,
  DIG_SECONDS,
  FUNGUS_FOOD,
  LAKE_FISH,
  OPEN_AFTER,
  RISE_AT,
  RISE_GAP_HOURS,
  RISE_SHARE,
  RISE_SHARE_PER_DEPTH,
  RUIN_COINS,
  RUIN_STUDY,
  SHAFT,
  STIR_SETTLES,
  type DeepCell,
} from '../data/deep';
import type { Material, Stock } from '../data/materials';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, depositNear } from './buildings';
import { killPerson } from './health';
import { woundPerson } from './injuries';
import { raidBudget, startRaid } from './raids';
import { queueScene } from './cutscenes';
import { addStock, maxHp, notify, type Building, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

export interface DeepLevel {
  depth: number;
  /** One character a cell (data/deep.ts DeepCell), row by row, `DEEP_W` by `DEEP_H`. */
  cells: string;
  /** What each rock cell holds (by its index). */
  pools: Record<number, Stock>;
  /** Cells dug on this level, and whether its way down has been found. */
  dug: number;
  down: boolean;
}

export interface DeepState {
  levels: DeepLevel[];
  /** How roused what lives down there is (see data/deep.ts `RISE_AT`), and when it last came up. */
  stir: number;
  rose?: number;
  /** What's been found, newest last (for the view and the Journal): a few words each. */
  finds: string[];
}

const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:deep:${salt.join(':')}`));

/** The way up on every level: the middle of its top edge. */
export const ENTRY = Math.floor(DEEP_W / 2);
export const cellIndex = (x: number, y: number) => y * DEEP_W + x;
export const cellXYOf = (i: number) => ({ x: i % DEEP_W, y: Math.floor(i / DEEP_W) });
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < DEEP_W && y < DEEP_H;
const NEAR4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export const cellAt = (l: DeepLevel, i: number) => l.cells[i] as DeepCell;
const setCell = (l: DeepLevel, i: number, c: DeepCell) => (l.cells = l.cells.slice(0, i) + c + l.cells.slice(i + 1));
/** Open ground in a level: dug, the ways up and down, a fungus farm. */
export const isOpenCell = (c: DeepCell) => c === '.' || c === '^' || c === '>' || c === 'f';
/** What may be dug: rock and the pockets in it (never water). */
export const isDiggable = (c: DeepCell) => c === '#' || c === 'F' || c === 'R' || c === 'C' || c === 'B';

/** A level as it's first reached: rock with ore, its pockets, the way up and a chamber round it. */
export function makeLevel(seed: string | number, depth: number): DeepLevel {
  const def = DEEP_LEVELS[depth - 1];
  const g = new Rng(hashSeed(`${seed}:deep-level:${depth}`));
  const cells: DeepCell[] = new Array(DEEP_W * DEEP_H).fill('#');
  const pools: Record<number, Stock> = {};
  // the pockets: a blob each, kept away from the way in
  const blob = (kind: DeepCell, size: number) => {
    for (let tries = 0; tries < 30; tries++) {
      const cx = g.int(1, DEEP_W - 2);
      const cy = g.int(3, DEEP_H - 2);
      if (Math.abs(cx - ENTRY) + cy < 6) continue;
      if (cells[cellIndex(cx, cy)] !== '#') continue;
      const todo = [{ x: cx, y: cy }];
      let n = 0;
      while (todo.length && n < size) {
        const q = todo.splice(g.int(0, todo.length - 1), 1)[0];
        const i = cellIndex(q.x, q.y);
        if (!inside(q.x, q.y) || q.y < 2 || cells[i] !== '#') continue;
        cells[i] = kind;
        n++;
        for (const [dx, dy] of NEAR4) todo.push({ x: q.x + dx, y: q.y + dy });
      }
      return;
    }
  };
  const p = def.pockets;
  for (let k = 0; k < p.lake; k++) blob('~', g.int(6, 12));
  for (let k = 0; k < p.fungus; k++) blob('F', g.int(3, 6));
  for (let k = 0; k < p.ruin; k++) blob('R', g.int(2, 4));
  for (let k = 0; k < p.crystal; k++) blob('C', g.int(3, 5));
  for (let k = 0; k < p.bones; k++) blob('B', g.int(1, 2));
  // what the rock holds: stone, and now and then an ore (in veins: an ore cell makes its neighbours likelier the same)
  const ores = Object.entries(def.ores) as [Material, [number, number]][];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== '#') continue;
    const st: Stock = { stone: def.stone };
    const vein = i > 0 ? Object.keys(pools[i - 1] ?? {}).find((m) => m !== 'stone') : undefined;
    for (const [m, [chance, n]] of ores)
      if (g.chance(m === vein ? Math.min(0.7, chance * 2.5) : chance)) {
        st[m] = n + (g.chance(0.3) ? 1 : 0);
        break;
      }
    pools[i] = st;
  }
  // the way up, and a little chamber dug round it
  const level: DeepLevel = { depth, cells: cells.join(''), pools, dug: 0, down: false };
  for (let y = 0; y <= 1; y++)
    for (let x = ENTRY - 1; x <= ENTRY + 1; x++) {
      const i = cellIndex(x, y);
      setCell(level, i, '.');
      delete level.pools[i];
    }
  setCell(level, cellIndex(ENTRY, 0), '^');
  return level;
}

/** The Deep (begun the first time it's asked for once a shaft stands). */
export function deepOf(s: GameState): DeepState | null {
  if (s.deep) return s.deep;
  if (!shaftOf(s)) return null;
  s.deep = { levels: [makeLevel(s.seed, 1)], stir: 0, finds: [] };
  notify(s, DEEP_LEVELS[0].found, true);
  if (s.autopilot !== false) queueScene(s, 'deep_breakthrough');
  return s.deep;
}

/** The town's shaft, finished (the first one; a town needs only the one). */
export const shaftOf = (s: GameState): Building | undefined => s.buildings.find((b) => b.def === SHAFT && b.status === 'done');

/** The level the miners work: the deepest that still has rock to dig beside its tunnels. */
export function workingLevel(d: DeepState): DeepLevel {
  for (let k = d.levels.length - 1; k >= 0; k--) if (frontier(d.levels[k]).length) return d.levels[k];
  return d.levels[d.levels.length - 1];
}

/** Whether the shaft has anything left to dig (the deepest level dug out, there's nothing). */
export const shaftHasWork = (s: GameState): boolean => {
  const d = deepOf(s);
  return !!d && frontier(workingLevel(d)).length > 0;
};

/** The rock cells beside the tunnels: what may be dug next. */
export function frontier(l: DeepLevel): number[] {
  const out: number[] = [];
  for (let i = 0; i < l.cells.length; i++) {
    if (!isDiggable(cellAt(l, i))) continue;
    const { x, y } = cellXYOf(i);
    if (NEAR4.some(([dx, dy]) => inside(x + dx, y + dy) && isOpenCell(cellAt(l, cellIndex(x + dx, y + dy))))) out.push(i);
  }
  return out;
}

/** Where the tunnels are heading on a level: the nearest pocket not yet broken into (the miners follow the signs:
 *  damp, a draught, a glint), else the far corner from the way up. */
export function deepGoal(l: DeepLevel): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < l.cells.length; i++) {
    const c = cellAt(l, i);
    if (c !== 'F' && c !== 'R' && c !== 'C' && c !== 'B') continue;
    const { x, y } = cellXYOf(i);
    // (by the distance from the tunnels' nearest open cell would be dearer; from the way up is near enough)
    const d = Math.abs(x - ENTRY) + y;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best >= 0 ? best : cellIndex(l.depth % 2 ? DEEP_W - 2 : 1, DEEP_H - 2);
}

/** The cell a miner is given: a pocket beside the tunnels first, then a winding way on toward the level's goal
 *  (`deepGoal`), ore the town is short of drawing it aside; never a cell another miner has. */
export function deepTarget(s: GameState, p: Person, l: DeepLevel): number | null {
  const taken = new Set(s.people.filter((o) => o !== p && o.task?.type === 'mine' && o.task.cell !== undefined && o.task.depth === l.depth).map((o) => o.task!.type === 'mine' && o.task.cell));
  const have = (m: string) => s.buildings.reduce((n, b) => n + ((b.store as Stock | undefined)?.[m as Material] ?? 0), 0);
  let best: number | null = null;
  let bestScore = -Infinity;
  const goal = cellXYOf(deepGoal(l));
  for (const i of frontier(l)) {
    if (taken.has(i)) continue;
    const c = cellAt(l, i);
    const { x, y } = cellXYOf(i);
    // (toward the goal, keeping to a tunnel's width rather than hollowing out a hall, with a wobble by the cell)
    const open = NEAR4.filter(([dx, dy]) => inside(x + dx, y + dy) && isOpenCell(cellAt(l, cellIndex(x + dx, y + dy)))).length;
    const wobble = (hashSeed(`${l.depth}:${i}`) % 1000) / 1000;
    let score = -(Math.abs(x - goal.x) + Math.abs(y - goal.y)) * 0.7 - open * 1.5 + wobble * 2.5;
    if (c !== '#') score += 20;
    for (const m of Object.keys(l.pools[i] ?? {})) if (m !== 'stone') score += have(m) < 12 ? 3 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** How long a cell takes to dig (s), before the miner's speed. */
export const digSeconds = (depth: number) => DIG_SECONDS * DEEP_LEVELS[depth - 1].hard;

/** A cell carved out: what it held (into the miner's hands), its pocket opened, the stir, maybe a cave-in, and the way
 *  down once enough is dug. Returns what was dug (for the miner to carry). */
export function digDeep(s: GameState, p: Person, depth: number, i: number): Stock {
  const d = deepOf(s);
  const l = d?.levels[depth - 1];
  if (!d || !l || !isDiggable(cellAt(l, i))) return {};
  const def = DEEP_LEVELS[depth - 1];
  const c = cellAt(l, i);
  const got: Stock = { ...(l.pools[i] ?? {}) };
  delete l.pools[i];
  const g = roll(s, 'dig', depth, i);
  if (c === 'F') {
    setCell(l, i, 'f');
    find(s, `${p.name} breaks into a grotto of glowing fungus on ${def.name}: it can be farmed for food.`);
  } else {
    setCell(l, i, '.');
    if (c === 'R') {
      const coins = Math.round(g.range(RUIN_COINS[0], RUIN_COINS[1]) * depth);
      s.coins = (s.coins ?? 0) + coins;
      const topic = s.research.queue[0];
      if (topic) s.research.progress[topic] = (s.research.progress[topic] ?? 0) + RUIN_STUDY * depth;
      find(s, `${p.name} breaks into a ruin on ${def.name}: carvings to puzzle over, and ${coins} old coins.`);
    } else if (c === 'C') {
      addStock(got, 'gems', CRYSTAL_GEMS + Math.floor(depth / 2));
      find(s, `${p.name} cuts into a crystal geode on ${def.name}: gems.`);
    } else if (c === 'B') {
      addStock(got, 'bone', BONES);
      find(s, `${p.name} digs out old bones on ${def.name}. Big ones. Nobody wants to guess what from.`);
    }
  }
  // (a lake reached: told once)
  const { x, y } = cellXYOf(i);
  if (NEAR4.some(([dx, dy]) => inside(x + dx, y + dy) && cellAt(l, cellIndex(x + dx, y + dy)) === '~') && !lakeReachedBefore(l, i)) find(s, `${p.name} breaks through to an underground lake on ${def.name}: there are fish in it, pale and blind.`);
  l.dug++;
  d.stir += def.stir;
  // the roof may come down
  if (g.chance(def.caveIn)) caveIn(s, p, def.name, g);
  // the way down, once enough is dug
  if (!l.down && l.dug >= OPEN_AFTER && depth < DEEPEST) {
    l.down = true;
    // (where they broke through)
    setCell(l, i, '>');
    d.levels.push(makeLevel(s.seed, depth + 1));
    notify(s, DEEP_LEVELS[depth].found, true);
    if (depth + 1 === DEEPEST && s.autopilot !== false) queueScene(s, 'deep_abyss', { vars: { deepest: DEEP_LEVELS[depth].name } });
    d.finds.push(`The way down to ${DEEP_LEVELS[depth].name} is found.`);
  }
  return got;
}

/** Whether the lake beside a cell was already reached before it was dug (another open cell touches it). */
function lakeReachedBefore(l: DeepLevel, dugAt: number): boolean {
  for (let i = 0; i < l.cells.length; i++) {
    if (i === dugAt || !isOpenCell(cellAt(l, i))) continue;
    const { x, y } = cellXYOf(i);
    if (NEAR4.some(([dx, dy]) => inside(x + dx, y + dy) && cellAt(l, cellIndex(x + dx, y + dy)) === '~')) return true;
  }
  return false;
}

function find(s: GameState, text: string): void {
  const d = s.deep!;
  d.finds.push(text);
  if (d.finds.length > 12) d.finds.splice(0, d.finds.length - 12);
  notify(s, text, true);
}

/** The roof comes down on a miner: killed outright now and then, else a broken bone. */
function caveIn(s: GameState, p: Person, where: string, g: Rng): void {
  if (g.chance(CAVE_IN_KILLS)) {
    killPerson(s, p, `was buried in a cave-in on ${where}`);
    return;
  }
  const hurt = maxHp(p) * CAVE_IN_HURT;
  p.hp = Math.max(1, p.hp - hurt);
  woundPerson(s, p, hurt, 'fracture', g);
  notify(s, `The roof comes down on ${where}: ${p.name} is dragged out with broken bones.`, true);
}

/** Fungus farms and lakes reached on every level. */
export function deepFarms(d: DeepState): { farms: number; lakes: number } {
  let farms = 0;
  let lakes = 0;
  for (const l of d.levels) {
    for (let i = 0; i < l.cells.length; i++) if (cellAt(l, i) === 'f') farms++;
    // (a lake counts once it's touched by the tunnels: each lake cell beside an open one is a place to fish)
    const seen = new Set<number>();
    for (let i = 0; i < l.cells.length; i++) {
      if (cellAt(l, i) !== '~' || seen.has(i)) continue;
      // (flood the lake, and count it if any of it touches the tunnels)
      const todo = [i];
      let touched = false;
      while (todo.length) {
        const j = todo.pop()!;
        if (seen.has(j)) continue;
        seen.add(j);
        const { x, y } = cellXYOf(j);
        for (const [dx, dy] of NEAR4) {
          if (!inside(x + dx, y + dy)) continue;
          const k = cellIndex(x + dx, y + dy);
          if (cellAt(l, k) === '~') todo.push(k);
          else if (isOpenCell(cellAt(l, k))) touched = true;
        }
      }
      if (touched) lakes++;
    }
  }
  return { farms, lakes };
}

/** Each hour: the stir settles, and past `RISE_AT` something climbs up the shaft; at dawn the farms and lakes give. */
export function deepHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !s.deep) return;
  const d = s.deep;
  d.stir = Math.max(0, d.stir - STIR_SETTLES);
  const shaft = shaftOf(s);
  if (!shaft) return;
  if (calendar(s.tick).hour === DEEP_DAWN) {
    const { farms, lakes } = deepFarms(d);
    const food: Stock = {};
    if (farms) food.vegetables = farms * FUNGUS_FOOD;
    if (lakes) food.fish = lakes * LAKE_FISH;
    if (farms || lakes) depositNear(s, buildingCentre(shaft), food);
  }
  if (s.autopilot !== false && d.stir >= RISE_AT && !s.raid && (d.rose === undefined || s.tick - d.rose >= RISE_GAP_HOURS * TICKS_PER_HOUR)) rise(s, d, shaft);
}

/** Something climbs up the shaft into the town: a raid of the working level's creatures, begun at the shaft. */
export function rise(s: GameState, d: DeepState, shaft: Building): boolean {
  const l = workingLevel(d);
  const def = DEEP_LEVELS[l.depth - 1];
  const kind = RAID_KIND_BY_ID[def.raid];
  if (!kind || !Object.keys(kind.enemies).length) return false;
  const g = roll(s, 'rise', s.tick);
  startRaid(s, kind, Math.max(6, raidBudget(s) * (RISE_SHARE + RISE_SHARE_PER_DEPTH * l.depth)), g, buildingCentre(shaft));
  d.stir = Math.max(0, d.stir - RISE_AT);
  d.rose = s.tick;
  d.finds.push(`${kind.name} climbed up the shaft.`);
  notify(s, `Something climbs up out of the Deep: ${kind.name.toLowerCase()} pour out of the shaft!`, true);
  return true;
}
