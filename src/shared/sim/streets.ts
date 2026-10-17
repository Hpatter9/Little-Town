// Streets that are built (the owner's ask: "the town streets shouldn't just show up, they should be built, like the
// palisade, where a stretch gets put up as a blueprint and built when they have time; streets added where they walk a
// lot; a bridge where a street crosses a river; a path to every gate"). A street is planned first (`LandMap.plannedRoads`:
// a building's way to the nearest street, `connectRoad`; a worn footpath that joins the streets, `planStreets`; the way
// to each of the ring wall's gates and a little beyond, `gatePaths`), shown as a ghost on the map, and laid a cell at a
// time by whoever has building to do (the `pave` task in people.ts), out from the streets already laid, so it goes down
// in stretches: all the hands on the street add to one pool of work, and the cells go down in order as it covers them.
// A cell over a river is a bridge: slower, and it takes wood.

import { builtOn, depositNear, layStreet, nearestStreet, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { CELL, cellAt, groundAt, idx, inMap, isPlannedRoad, isRoad, planRoad, setGround, setRoad, wearAt, wet, type Pt } from './land';
import { isGate, liftRoadsOffWall, lineOf, sideOn, wallOnly } from './ringWall';
import { campCell, type GameState, type Person } from './state';
import { layoutHourly, onPlanLine } from './layout';
import { isChild } from './social';
import { TICKS_PER_HOUR } from './time';
import { isTunnelCell, TUNNEL_SECONDS, TUNNEL_STONE } from './tunnels';

/** Seconds of work to lay a cell of street, and of bridge; the wood a cell of bridge takes. */
export const PAVE_SECONDS = 15;
export const BRIDGE_SECONDS = 60;
export const BRIDGE_WOOD = 2;
/** A footpath this worn (land.ts `wear`, 0 to 24) that joins the streets is planned as one; at most this many cells a
 *  day, within this far of the camp. */
export const STREET_WEAR = 20;
export const STREETS_A_DAY = 8;
export const STREET_REACH = 30;
/** A gate's path runs this many cells out beyond it. */
export const GATE_PATH_OUT = 3;

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

/** Every street planned laid at once (the founding: the first streets are there when the town begins). */
export function layAll(s: GameState): void {
  for (const i of plannedCells(s)) {
    const c = cellAt(s.land, i);
    planRoad(s.land, c.x, c.y, false);
    setRoad(s.land, c.x, c.y);
  }
}

/** Hourly: where the townsfolk wear a path, the town plans a street (a worn cell that joins a street or a planned one,
 *  near the town, on open ground with nothing on it), a few a day; and a path to each gate of the ring wall. */
export function streetsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  liftRoadsOffWall(s); // (roads an older town laid over the wall's line are lifted, so the wall can be raised there)
  if (s.autopilot === false) return;
  layoutHourly(s); // (the town plan's main streets kept ahead of the town: sim/layout.ts)
  gatePaths(s);
  if (Math.floor(s.tick / TICKS_PER_HOUR) % 24 !== 6) return;
  planStreets(s);
}

/** The worn footpaths that join the streets become streets (`STREETS_A_DAY` cells at most, the most worn first). */
export function planStreets(s: GameState): number {
  const m = s.land;
  if (!m.wear) return 0;
  const camp = campCell(s);
  const blocks = s.layout?.style === 'grid';
  const want: { i: number; w: number }[] = [];
  for (let y = Math.max(0, camp.y - STREET_REACH); y <= Math.min(m.h - 1, camp.y + STREET_REACH); y++)
    for (let x = Math.max(0, camp.x - STREET_REACH); x <= Math.min(m.w - 1, camp.x + STREET_REACH); x++) {
      const i = idx(m, x, y);
      const w = wearAt(m, i);
      if (w < STREET_WEAR || isRoad(m, x, y) || isPlannedRoad(m, x, y) || builtOn(s, x, y) || wallOnly(s, x, y)) continue;
      const g = groundAt(m, x, y);
      if (g !== 'grass' && g !== 'fertile' && g !== 'sand') continue;
      if (!N4.some(([dx, dy]) => isRoad(m, x + dx, y + dy) || isPlannedRoad(m, x + dx, y + dy))) continue;
      // (a town laid out in blocks paves the paths that keep to its plan's lines; the rest stay footpaths)
      if (blocks && !onPlanLine(s, x, y)) continue;
      want.push({ i, w });
    }
  want.sort((a, b) => b.w - a.w || a.i - b.i);
  let n = 0;
  for (const { i } of want.slice(0, STREETS_A_DAY)) {
    const c = cellAt(m, i);
    planRoad(m, c.x, c.y);
    n++;
  }
  return n;
}

/** A street to each gate of the ring wall (planned with the wall, so the gates sit where the streets go), through
 *  the gate and `GATE_PATH_OUT` cells beyond, the way travellers come in (the owner's ask). */
/** How long before a gate the town found no way to is tried again (game hours). */
export const GATE_RETRY_HOURS = 12;

export function gatePaths(s: GameState): void {
  const ring = s.ring;
  if (!ring) return;
  const m = s.land;
  const line = lineOf(ring);
  for (const g of ring.gates) {
    const b = builtOn(s, g.x, g.y);
    if (!b || !isGate(b.def) || b.ring !== ring.gen) continue;
    if (isRoad(m, g.x, g.y) || isPlannedRoad(m, g.x, g.y)) continue;
    const side = sideOn(ring, g);
    const [ix, iy] = side === 'w' ? [1, 0] : side === 'e' ? [-1, 0] : side === 'n' ? [0, 1] : [0, -1];
    const inside: Pt = { x: g.x + ix, y: g.y + iy };
    if (!inMap(m, inside.x, inside.y) || line.some((l) => l.x === inside.x && l.y === inside.y)) continue;
    // (a gate with no way to it is tried again only every `GATE_RETRY_HOURS`: the search is dear when it fails)
    const key = `${ring.gen}:${g.x},${g.y}`;
    const tried = (s.gateTried ??= {});
    if (tried[key] !== undefined && s.tick - tried[key] < GATE_RETRY_HOURS * TICKS_PER_HOUR) continue;
    if (!layStreet(s, inside, nearestStreet(s, inside), 60)) {
      tried[key] = s.tick;
      continue;
    }
    delete tried[key];
    planRoad(m, g.x, g.y);
    // (and out beyond the gate a few cells, where nothing stands in the way)
    for (let k = 1; k <= GATE_PATH_OUT; k++) {
      const x = g.x - ix * k, y = g.y - iy * k;
      if (!inMap(m, x, y) || builtOn(s, x, y) || isRoad(m, x, y) || wallOnly(s, x, y)) break;
      const gr = groundAt(m, x, y);
      if (gr !== 'grass' && gr !== 'fertile' && gr !== 'sand') break;
      planRoad(m, x, y);
    }
  }
}

/** For the snapshot and the tap card: how many cells are planned and how many of them are bridges. */
export function streetPlan(s: GameState): { cells: number; bridges: number } {
  const cells = plannedCells(s);
  return { cells: cells.length, bridges: cells.filter((i) => isBridge(s, i)).length };
}

