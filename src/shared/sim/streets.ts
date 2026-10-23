// Streets that are built (the owner's ask: "the town streets shouldn't just show up, they should be built, like the
// palisade, where a stretch gets put up as a blueprint and built when they have time; a bridge where a street crosses
// a river"). A street is planned first (`LandMap.plannedRoads`: only ever by the player, who draws every path,
// sim/pathPlans.ts; the town lays none of its own), shown as a ghost on the map, and laid a cell at a
// time by whoever has building to do (the `pave` task in people.ts), out from the streets already laid, so it goes down
// in stretches: all the hands on the street add to one pool of work, and the cells go down in order as it covers them.
// A cell over a river is a bridge: slower, and it takes wood.

import { builtOn, depositNear, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { CELL, cellAt, groundAt, idx, inMap, isPlannedRoad, isRoad, planRoad, setGround, setRoad, wet } from './land';
import { isGate, liftRoadsOffWall, wallOnly } from './ringWall';
import { campCell, type GameState, type Person } from './state';
import { isChild } from './social';
import { TICKS_PER_HOUR } from './time';
import { isTunnelCell, TUNNEL_SECONDS, TUNNEL_STONE } from './tunnels';

/** Seconds of work to lay a cell of street, and of bridge; the wood a cell of bridge takes. */
export const PAVE_SECONDS = 15;
export const BRIDGE_SECONDS = 60;
export const BRIDGE_WOOD = 2;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Every planned cell, by index. */
export function plannedCells(s: GameState): number[] {
  const p = s.land.plannedRoads;
  if (!p) return [];
  const out: number[] = [];
  for (let i = p.indexOf('#'); i >= 0; i = p.indexOf('#', i + 1)) out.push(i);
  return out;
}

/** Whether a planned cell is a bridge (over water). */
export const isBridge = (s: GameState, i: number) => {
  const c = cellAt(s.land, i);
  return wet(groundAt(s.land, c.x, c.y));
};

/** A planned cell ready to be laid: beside a street already down (or the camp, or a gate), so a street goes down in
 *  stretches; a bridge only with its wood in store. */
function ready(s: GameState, i: number, wood: number): boolean {
  const m = s.land;
  const c = cellAt(m, i);
  if (builtOn(s, c.x, c.y) && !isGate(builtOn(s, c.x, c.y)!.def)) return false;
  if (wallOnly(s, c.x, c.y)) return false;
  if (isBridge(s, i) && wood < BRIDGE_WOOD) return false;
  const camp = campCell(s);
  if (Math.abs(c.x - camp.x) + Math.abs(c.y - camp.y) <= 2) return true;
  return N4.some(([dx, dy]) => isRoad(m, c.x + dx, c.y + dy));
}

/** Whether any planned cell can be laid now (a small town's study waits for it: people.ts `researchCanWait`). */
export function paveReady(s: GameState): boolean {
  const cells = plannedCells(s);
  if (!cells.length) return false;
  const wood = totalStock(s).wood ?? 0;
  return cells.some((i) => ready(s, i, wood));
}

/** The planned cells in the order they go down: out from the streets already laid (a ready cell, then the planned cells
 *  that join it, and so on), so the street grows as one line from where it starts. A plan cut off from every street
 *  (say by a building since put up) is still laid, from its lowest cell; a bridge waits for its wood, and a cell built
 *  on is passed over. Kept while the plan and the roads are the same. */
let orderMade: { planned: string; roads: string; wood: boolean; built: number; order: number[] } | null = null;
export function paveOrder(s: GameState): number[] {
  const m = s.land;
  const planned = m.plannedRoads;
  if (!planned) return [];
  const wood = (totalStock(s).wood ?? 0) >= BRIDGE_WOOD;
  if (orderMade && orderMade.planned === planned && orderMade.roads === m.roads && orderMade.wood === wood && orderMade.built === s.buildings.length) return orderMade.order;
  const cells = plannedCells(s);
  const left = new Set(cells.filter((i) => {
    const c = cellAt(m, i);
    const b = builtOn(s, c.x, c.y);
    return !(b && !isGate(b.def)) && !(isBridge(s, i) && !wood);
  }));
  const order: number[] = [];
  const grow = (seeds: number[]) => {
    const queue = seeds;
    for (const i of seeds) left.delete(i);
    for (let k = 0; k < queue.length; k++) {
      order.push(queue[k]);
      const c = cellAt(m, queue[k]);
      for (const [dx, dy] of N4) {
        if (!inMap(m, c.x + dx, c.y + dy)) continue;
        const n = idx(m, c.x + dx, c.y + dy);
        if (left.delete(n)) queue.push(n);
      }
    }
  };
  const wd = wood ? BRIDGE_WOOD : 0;
  grow([...left].filter((i) => ready(s, i, wd)));
  while (left.size) grow([Math.min(...left)]);
  orderMade = { planned, roads: m.roads, wood, built: s.buildings.length, order };
  return order;
}

/** The planned cell someone should work at: the first in the order nobody else is on; null when there's none. */
export function nextPave(s: GameState, p: Person): number | null {
  const order = paveOrder(s);
  if (!order.length) return null;
  const taken = new Set(s.people.filter((q) => q !== p && q.task?.type === 'pave').map((q) => (q.task as { cell: number }).cell));
  return order.find((i) => !taken.has(i)) ?? order[0];
}

/** At most this share of the town's grown-ups (and at least one) are out paving at once, so the streets never keep
 *  the rest from their work. */
export const PAVERS_SHARE = 0.25;

/** A paving task for someone with no building to raise: the street needs hands and the town can spare them. */
export function paveTask(s: GameState, p: Person, spare = false): { type: 'pave'; cell: number; progress: number } | null {
  if (s.raid || !s.land.plannedRoads || isChild(p)) return null;
  // (the cell they're at, still waiting its turn, stays theirs)
  if (p.task?.type === 'pave' && isPlannedRoad(s.land, p.task.cell % s.land.w, Math.floor(p.task.cell / s.land.w)) && paveOrder(s).includes(p.task.cell)) return p.task;
  const grown = s.people.filter((q) => q.away === null && q.bornTick == null && !q.downed).length;
  const out = s.people.filter((q) => q !== p && q.task?.type === 'pave').length;
  if (!spare && out >= Math.max(1, Math.floor(grown * PAVERS_SHARE))) return null;
  const cell = nextPave(s, p);
  return cell === null ? null : { type: 'pave', cell, progress: 0 };
}

/** Work done on the street (`sec` seconds' worth, from whoever is paving): the cells go down one after another, in
 *  order, as the one shared pool of work covers each. */
export function streetWork(s: GameState, sec: number): void {
  let pool = (s.streetSec ?? 0) + sec;
  for (let guard = 0; guard < 64; guard++) {
    const order = paveOrder(s);
    if (!order.length) {
      pool = 0;
      break;
    }
    const need = paveSeconds(s, order[0]);
    if (pool < need) break;
    if (!pave(s, order[0])) {
      pool = Math.min(pool, need); // (a bridge short of its wood: the work waits)
      break;
    }
    pool -= need;
  }
  if (pool > 0) s.streetSec = pool;
  else delete s.streetSec;
}

/** How far the next cell of street is along (0 to 1), for the work bar. */
export function streetShare(s: GameState): number {
  const order = paveOrder(s);
  return order.length ? Math.min(1, (s.streetSec ?? 0) / paveSeconds(s, order[0])) : 0;
}

/** A cell laid: the street goes down (a bridge takes its wood). False if it can't be (the bridge's wood is gone). */
export function pave(s: GameState, i: number): boolean {
  const c = cellAt(s.land, i);
  if (!isPlannedRoad(s.land, c.x, c.y)) return true;
  if (wallOnly(s, c.x, c.y)) {
    planRoad(s.land, c.x, c.y, false); // (the wall's line: no street there but at a gate)
    return true;
  }
  if (isBridge(s, i)) {
    if ((totalStock(s).wood ?? 0) < BRIDGE_WOOD) return false;
    takeFromStorage(s, 'wood', BRIDGE_WOOD);
  }
  // (a cell of tunnel: the rock dug out, its stone to the stores, sim/tunnels.ts)
  if (groundAt(s.land, c.x, c.y) === 'mountain' && isTunnelCell(s, c.x, c.y)) {
    setGround(s.land, c.x, c.y, 'hall');
    depositNear(s, (c.x + 0.5) * CELL, { stone: TUNNEL_STONE });
  }
  planRoad(s.land, c.x, c.y, false);
  setRoad(s.land, c.x, c.y);
  return true;
}

/** Whether a planned cell is a tunnel still to be cut. */
export const isTunnelling = (s: GameState, i: number) => {
  const c = cellAt(s.land, i);
  return groundAt(s.land, c.x, c.y) === 'mountain' && isTunnelCell(s, c.x, c.y);
};

/** How long a cell takes to lay (seconds of work). */
export const paveSeconds = (s: GameState, i: number) => (isBridge(s, i) ? BRIDGE_SECONDS : isTunnelling(s, i) ? TUNNEL_SECONDS : PAVE_SECONDS);

/** Hourly: roads an older town laid over the ring wall's line are lifted, so the wall can be raised there. The town
 *  plans no street of its own (the owner's ask, "I want to place them myself to help guide the town shape"): every
 *  street is drawn by the player (sim/pathPlans.ts); the worn footpaths stay footpaths. */
export function streetsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  liftRoadsOffWall(s);
}

/** For the snapshot and the tap card: how many cells are planned and how many of them are bridges. */
export function streetPlan(s: GameState): { cells: number; bridges: number } {
  const cells = plannedCells(s);
  return { cells: cells.length, bridges: cells.filter((i) => isBridge(s, i)).length };
}

