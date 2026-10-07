// Shared test setup.

import { JOBS, type Job, type Priority } from '../src/shared/data/people';
import { maxHp, newGame, type GameState } from '../src/shared/sim/state';

/** Priorities with every job Low (Defend off), except the ones given. */
export function priorities(set: Partial<Record<Job, Priority>>): Record<Job, Priority> {
  return { ...(Object.fromEntries(JOBS.map((j) => [j, j === 'defend' ? 0 : 3])) as Record<Job, Priority>), ...set };
}

/**
 * A new game with the variables that muddy timing and stock checks removed: the founder has no traits
 * and full needs, and the camp has no starting food (so nothing gets eaten out of storage).
 */
export function plainGame(seed: string): GameState {
  const s = newGame(seed);
  const main = s.people[0];
  main.traits = [];
  main.hp = maxHp(main);
  main.needs = { food: 1, rest: 1 };
  s.buildings.find((b) => b.def === 'campfire')!.store = {};
  s.autopilot = false; // (the town's own planner stays out of tests of single mechanics)
  s.nextEventTick = Number.MAX_SAFE_INTEGER; // (and so do the choice events)
  s.battleStyle = 'trail'; // (the trail, when a test turns battles on)
  s.battles = false; // (and raids are fought in the town, not on the battle map: battle.test.ts tests that)
  return s;
}

/* ------------------------------------------------------------ the land */

import { depthOf, canPlace, footprints } from '../src/shared/sim/buildings';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import type { Stock } from '../src/shared/data/materials';
import { CELL, cellAt, groundAt, idx, isOpen, setGround, spiralSpot, WILD, type Ground, type Pt } from '../src/shared/sim/land';
import { campCell, campXY, type Building } from '../src/shared/sim/state';

/** The camp's cell. */
export const camp = (s: GameState): Pt => campCell(s);
/** A row two below the camp: free ground for the tests to build on (the starting buildings stand on the row above
 *  the camp and the camp's own row). */
export const row = (s: GameState) => campCell(s).y + 2;
/** A cell's index. */
export const cellIndex = (s: GameState, x: number, y: number) => idx(s.land, x, y);
/** A cell's middle, in px. */
export const cellPx = (s: GameState, i: number): Pt => {
  const c = cellAt(s.land, i);
  return { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL };
};
/** Whether a cell is still wild (something to gather on it). */
export const isWild = (s: GameState, i: number) => WILD.includes(groundAt(s.land, cellAt(s.land, i).x, cellAt(s.land, i).y));
/** What's left on a cell. */
export const poolOf = (s: GameState, i: number): Stock => s.land.pools[i] ?? {};

/** The open wild cells of a kind (any wild kind when left out) with something on them, nearest the camp first;
 *  `side` keeps to one side of the camp. */
export function wildsNear(s: GameState, kind?: Ground, side?: -1 | 1): number[] {
  const c = campCell(s);
  const out: { i: number; d: number }[] = [];
  for (const k of Object.keys(s.land.pools)) {
    const i = Number(k);
    const at = cellAt(s.land, i);
    if (!isOpen(s.land, at.x, at.y)) continue;
    const g = groundAt(s.land, at.x, at.y);
    if (kind ? g !== kind : !WILD.includes(g)) continue;
    if (side && Math.sign(at.x - c.x) !== side) continue;
    out.push({ i, d: Math.hypot(at.x - c.x, at.y - c.y) });
  }
  return out.sort((a, b) => a.d - b.d || a.i - b.i).map((o) => o.i);
}
/** The nearest such cell (-1 when there's none). */
export const nearestWild = (s: GameState, kind?: Ground, side?: -1 | 1): number => wildsNear(s, kind, side)[0] ?? -1;
/** The middle of the camp, in px. */
export const campPx = (s: GameState): Pt => campXY(s);

/** A cell made wild, with a pool on it. Returns its index. */
export function makeWild(s: GameState, x: number, y: number, g: Ground, pool: Stock): number {
  setGround(s.land, x, y, g);
  const i = idx(s.land, x, y);
  s.land.pools[i] = { ...pool };
  return i;
}

/** A building the tests stand up with its top-left cell at (x, y), finished unless said otherwise. */
export function put(s: GameState, def: string, x: number, y = row(s), extra: Partial<Building> = {}): Building {
  const b: Building = { id: s.nextId++, def, tile: x, row: y, status: 'done', delivered: {}, progress: 1, store: {}, ...extra };
  s.buildings.push(b);
  return b;
}

/** The nearest free spot for a kind of building, out from the camp (where the planner would put it). */
export function freeSpot(s: GameState, def: string): Pt {
  const d = BUILDING_BY_ID[def];
  const r = spiralSpot(s.land, d.width, depthOf(d), footprints(s), campCell(s));
  if (!r || !canPlace(s, d, r.x, r.y).ok) throw new Error(`no room for a ${def}`);
  return { x: r.x, y: r.y };
}

/** The land round the camp cleared `r` cells each way (the wild made grass; water stays), for tests that stand
 *  buildings further out than the camp's own clearing. */
export function clearAround(s: GameState, r: number): void {
  const c = campCell(s);
  for (let y = c.y - r; y <= c.y + r; y++)
    for (let x = c.x - r; x <= c.x + r; x++) if (x >= 0 && y >= 0 && x < s.land.w && y < s.land.h && WILD.includes(groundAt(s.land, x, y))) setGround(s.land, x, y, 'grass');
  s.land.open = Math.max(s.land.open, r + 2);
}
