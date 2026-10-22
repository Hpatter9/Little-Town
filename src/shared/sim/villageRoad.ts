// The road between a daughter village and the town (the owner's ask: "a sister village should build a road to the main
// town for easier travel"). `planVillageRoad` plans it when the village is founded (and, for a village from an older
// save, on load): a street from the village's fire to the town's streets (`layStreet`, which keeps off rock, water but for
// a bridge, buildings and fields), then the cells of the way from the village to the town's front are kept in
// `Village.road` to tell how far it is laid. It is built from both ends: the town's pavers lay out from the streets
// (sim/streets.ts `paveOrder`, the normal paving priority) while once a day a villager lays from the village's end
// (`villageRoadHourly`). Done when every cell is road. Walkers (people, carts, visitors) take it by the cost of a road
// cell in findPath, and walk it faster (walk.ts `ROAD_SPEED`). Raiders may walk it too: that is the price of a road.
// Autopilot only; no random draws.

import { ROAD_RETRY_DAYS, VILLAGE_ROAD_HOUR, VILLAGE_ROAD_SEC } from '../data/villages';
import { castleGate, castleOn } from './castle';
import { thinRock, TUNNEL_COST } from './tunnels';
import { layStreet, nearestStreet } from './buildings';
import { findPath, idx, isPlannedRoad, isRoad, type Pt } from './land';
import { notify, campCell, type GameState } from './state';
import { paveSeconds, pave } from './streets';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from './time';
import type { Village } from './villages';

/** The road's cells from the village (first) to the town (last), and how it stands. */
export interface VillageRoad {
  cells: number[];
  /** Paving work done at the village's end and not yet laid (seconds). */
  sec?: number;
  /** The tick the road was finished. */
  done?: number;
  /** The tick no way could be found. Tried again only when the land has changed (`landSig`), not on a clock. */
  failed?: number;
  /** The land when it failed: the buildings standing and the ring wall's make. */
  sig?: string;
  /** The news line told (once). */
  told?: boolean;
}

/** The town's front: the ground in front of the fire (or the castle's gate), where the village's road ends up. */
function townFront(s: GameState): Pt {
  const camp = campCell(s);
  return castleOn(s) ? castleGate(s) : { x: camp.x, y: camp.y + 1 };
}

const villageFrom = (v: Village): Pt => ({ x: v.x, y: v.y + 2 });

/** The cells of the way from the village over roads and planned streets to the town's front, or null if they don't join. */
function trace(s: GameState, v: Village): number[] | null {
  const m = s.land;
  const from = villageFrom(v);
  const to = townFront(s);
  const onRoad = (x: number, y: number) => isRoad(m, x, y) || isPlannedRoad(m, x, y);
  if (!onRoad(from.x, from.y)) return null;
  const thin = thinRock(s); // (a planned tunnel through a thin ridge: sim/tunnels.ts)
  const path = findPath(m, from, to, (x, y) => !onRoad(x, y), { maxNodes: 20000, four: true, swim: 1, ...(thin ? { bore: { cost: TUNNEL_COST, ok: thin } } : {}) });
  if (!path) return null;
  return [from, ...path].filter((c) => onRoad(c.x, c.y)).map((c) => idx(m, c.x, c.y));
}

/** The land as a road's way depends on it: the buildings (fewer means one pulled down) and the ring wall's make (its
 *  generation, and its gates). A failed road is planned again only when this changes for the better. */
const landSig = (s: GameState) => `${s.buildings.length}|${s.ring ? `${s.ring.gen}:${s.ring.gates.length}` : ''}`;

/** Where a village's road may end, nearest first: spread-out cells of the town's own streets (the road follows them
 *  on in; where the ring wall is in the way the search goes through a gate), then the ground in front of each gate and
 *  the town's front. */
function endings(s: GameState, from: Pt): Pt[] {
  const m = s.land;
  const near: { c: Pt; d: number }[] = [];
  for (let i = 0; i < m.roads.length; i++) {
    if (m.roads[i] !== '#') continue;
    const c = { x: i % m.w, y: Math.floor(i / m.w) };
    near.push({ c, d: Math.abs(c.x - from.x) + Math.abs(c.y - from.y) });
  }
  near.sort((a, b) => a.d - b.d || a.c.y - b.c.y || a.c.x - b.c.x);
  const out: Pt[] = [];
  for (const n of near) {
    if (out.length >= ENDINGS_STREET) break;
    if (out.every((o) => Math.abs(o.x - n.c.x) + Math.abs(o.y - n.c.y) >= ENDINGS_APART)) out.push(n.c);
  }
  for (const g of s.ring?.gates ?? []) out.push(g);
  out.push(townFront(s));
  return out;
}
const ENDINGS_STREET = 4;
const ENDINGS_APART = 8;
/** The search's reach for the fallback (nodes, and cells of road). */
const WILD_NODES = 30000;
const WILD_REACH = 400;

/** Plan the road (a street from the village to the town's streets), and note its cells. False if there's no way. */
export function planVillageRoad(s: GameState, v: Village): boolean {
  if (v.below) return false;
  const from = villageFrom(v);
  let cells = trace(s, v);
  if (!cells) {
    if (!layStreet(s, from, nearestStreet(s, from), 200)) layStreet(s, from, townFront(s), 200);
    cells = trace(s, v);
  }
  // (no way over cleared ground: a road cuts through wild ground and goes round what is built, to the nearest street
  // or gate it can reach)
  for (const to of cells ? [] : endings(s, from)) {
    if (!layStreet(s, from, to, WILD_REACH, { wild: true, maxNodes: WILD_NODES })) continue;
    if ((cells = trace(s, v))) break;
  }
  if (!cells) {
    const told = v.road?.told;
    v.road = { cells: [], failed: s.tick, sig: landSig(s), told: true };
    if (!told) {
      v.news.unshift(`No way could be found for a road to the town.`);
      notify(s, `No way could be found for a road to ${v.name}.`, true);
    }
    return false;
  }
  const started = !v.road || v.road.failed !== undefined;
  v.road = { cells };
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

/** Whether a failed road is worth planning again: the land has changed (a building pulled down, a gate opened), or it
 *  failed in a save from before the land was told (once more, to learn it). */
function retryable(s: GameState, r: VillageRoad): boolean {
  if (r.sig === undefined) return s.tick - r.failed! >= ROAD_RETRY_DAYS * TICKS_PER_DAY;
  const [nb, ring] = landSig(s).split('|');
  const [was, wasRing] = r.sig.split('|');
  return Number(nb) < Number(was) || ring !== wasRing;
}

/** Hourly: villages with no road get one planned; once a day the village lays its end, and a finished road is told. */
export function villageRoadHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false) return;
  const hour = calendarOf(s).hour;
  for (const v of s.villages ?? []) {
    if (v.below) continue;
    const r = v.road;
    if (!r || (r.failed !== undefined && retryable(s, r))) {
      if (hour === VILLAGE_ROAD_HOUR && planVillageRoad(s, v)) notify(s, `${v.name} sets about a road to the town.`, true);
      continue;
    }
    if (r.done !== undefined || !r.cells.length || hour !== VILLAGE_ROAD_HOUR) continue;
    const m = s.land;
    const roadAt = (i: number) => isRoad(m, i % m.w, Math.floor(i / m.w));
    // (a way since cut off by something put up on it is planned again)
    if (r.cells.some((i) => !roadAt(i) && !isPlannedRoad(m, i % m.w, Math.floor(i / m.w)))) {
      if (!planVillageRoad(s, v)) continue;
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
