// The road between a daughter village and the town (the owner's ask: "a sister village should build a road to the main
// town for easier travel"). The town lays no path of its own (the owner's later ask: "I want to place them myself"), so
// the road is the path the player draws from the village to the town (sim/pathPlans.ts): once a day `villageRoadHourly`
// looks for a way over streets and planned streets from beside the village to beside the town's front (`trace`), and
// takes its cells as `Village.road`. It is built from both ends: the town's pavers lay out from the streets
// (sim/streets.ts `paveOrder`, the normal paving priority) while once a day a villager lays from the village's end.
// Done when every cell is road. Walkers (people, carts, visitors) take it by the cost of a road cell in findPath, and
// walk it faster (walk.ts `ROAD_SPEED`). Raiders may walk it too: that is the price of a road. A village with no path
// to it says so once, when it is founded. Autopilot only; no random draws.

import { VILLAGE_R, VILLAGE_ROAD_HOUR, VILLAGE_ROAD_SEC } from '../data/villages';
import { castleGate, castleOn } from './castle';
import { idx, inMap, isPlannedRoad, isRoad, type Pt } from './land';
import { notify, campCell, type GameState } from './state';
import { paveSeconds, pave } from './streets';
import { TICKS_PER_HOUR, calendarOf } from './time';
import type { Village } from './villages';

/** The road's cells from the village (first) to the town (last), and how it stands. */
export interface VillageRoad {
  cells: number[];
  /** Paving work done at the village's end and not yet laid (seconds). */
  sec?: number;
  /** The tick the road was finished. */
  done?: number;
  /** (older saves: the tick the town found no way of its own, and the land then; no longer used) */
  failed?: number;
  sig?: string;
  /** The hint to draw a path told (once). */
  told?: boolean;
}

/** The town's front: the ground in front of the fire (or the castle's gate), where the village's road ends up. */
function townFront(s: GameState): Pt {
  const camp = campCell(s);
  return castleOn(s) ? castleGate(s) : { x: camp.x, y: camp.y + 1 };
}

/** A road starts this near the village's fire (chessboard cells), and ends this near the town's front. */
export const ROAD_NEAR_VILLAGE = VILLAGE_R + 3;
export const ROAD_NEAR_TOWN = 3;

/** The cells of the way from beside the village over streets and planned streets to beside the town's front (the
 *  fewest cells, out from the lowest-numbered cell by the village where two are as short), or null if none joins. */
export function trace(s: GameState, v: Village): number[] | null {
  const m = s.land;
  const onRoad = (x: number, y: number) => isRoad(m, x, y) || isPlannedRoad(m, x, y);
  const to = townFront(s);
  const near = (x: number, y: number, c: Pt, r: number) => Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) <= r;
  const from = new Int32Array(m.w * m.h).fill(-2);
  const queue: number[] = [];
  for (let y = v.y - ROAD_NEAR_VILLAGE; y <= v.y + ROAD_NEAR_VILLAGE; y++)
    for (let x = v.x - ROAD_NEAR_VILLAGE; x <= v.x + ROAD_NEAR_VILLAGE; x++) {
      if (!inMap(m, x, y) || !onRoad(x, y)) continue;
      const i = idx(m, x, y);
      from[i] = -1;
      queue.push(i);
    }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % m.w, y = Math.floor(i / m.w);
    if (near(x, y, to, ROAD_NEAR_TOWN)) {
      const out: number[] = [];
      for (let j = i; j >= 0; j = from[j]) out.push(j);
      return out.reverse();
    }
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(m, nx, ny) || !onRoad(nx, ny)) continue;
      const n = idx(m, nx, ny);
      if (from[n] !== -2) continue;
      from[n] = i;
      queue.push(n);
    }
  }
  return null;
}
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Take the path drawn to the village as its road, if one joins it to the town. False if none does: a village not yet
 *  told is told once to draw one. */
export function planVillageRoad(s: GameState, v: Village): boolean {
  if (v.below) return false;
  const cells = trace(s, v);
  if (!cells) {
    if (!v.road?.told) {
      v.road = { cells: [], told: true };
      v.news.unshift(`No road to the town yet.`);
      notify(s, `Draw a path from ${v.name} to the town, and both ends will build the road.`, true);
    }
    return false;
  }
  const started = !v.road?.cells.length;
  v.road = { cells, ...(v.road?.told ? { told: true } : {}) };
  if (started) v.news.unshift(`Planned a road to the town.`);
  return true;
}

const cellSets = new WeakMap<VillageRoad, Set<number>>();

/** Whether a cell is on a finished road to a village (walk.ts: walkers go quicker on it). */
export function onVillageRoad(s: Pick<GameState, 'land' | 'villages'>, c: Pt): boolean {
  if (!s.villages?.length) return false;
  const i = c.y * s.land.w + c.x;
  for (const v of s.villages) {
    const r = v.road;
    if (!r || r.done === undefined) continue;
    let set = cellSets.get(r);
    if (!set) cellSets.set(r, (set = new Set(r.cells)));
    if (set.has(i)) return true;
  }
  return false;
}

/** How much of the road is laid (0 to 1); null for a village with no road planned. */
export function roadShare(s: GameState, v: Village): number | null {
  const r = v.road;
  if (!r || !r.cells.length) return null;
  if (r.done !== undefined) return 1;
  const m = s.land;
  return r.cells.filter((i) => isRoad(m, i % m.w, Math.floor(i / m.w))).length / r.cells.length;
}

/** Hourly: once a day a village takes the path drawn to it as its road (or a new one, if its way was cut), lays its
 *  end, and a finished road is told. */
export function villageRoadHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false) return;
  if (calendarOf(s).hour !== VILLAGE_ROAD_HOUR) return;
  const m = s.land;
  const roadAt = (i: number) => isRoad(m, i % m.w, Math.floor(i / m.w));
  for (const v of s.villages ?? []) {
    if (v.below) continue;
    const r = v.road;
    if (r?.done !== undefined && r.cells.length) continue;
    // (no road yet, or a way since cut off by something put up on it: the path drawn now is looked for)
    if (!r?.cells.length || r.cells.some((i) => !roadAt(i) && !isPlannedRoad(m, i % m.w, Math.floor(i / m.w)))) {
      const had = !!r?.cells.length;
      if (!planVillageRoad(s, v)) continue;
      if (!had) notify(s, `${v.name} sets about a road to the town.`, true);
    }
    const road = v.road!;
    if (!v.rebel && v.pop > 0) layFromVillage(s, road);
    if (road.cells.every(roadAt)) {
      road.done = s.tick;
      delete road.sec;
      v.news.unshift(`The road to the town is open.`);
      notify(s, `The road to ${v.name} is open.`, true);
    }
  }
}

/** The village's day on the road: from its end, cell by cell, as far as the hour's work goes. */
function layFromVillage(s: GameState, road: VillageRoad): void {
  const m = s.land;
  let pool = (road.sec ?? 0) + VILLAGE_ROAD_SEC;
  for (const i of road.cells) {
    if (isRoad(m, i % m.w, Math.floor(i / m.w))) continue;
    const need = paveSeconds(s, i);
    if (pool < need || !pave(s, i)) break;
    pool -= need;
  }
  road.sec = Math.min(pool, VILLAGE_ROAD_SEC);
}
