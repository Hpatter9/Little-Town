// Streets that are built (the owner's ask: "the town streets shouldn't just show up, they should be built, like the
// palisade, where a stretch gets put up as a blueprint and built when they have time; streets added where they walk a
// lot; a bridge where a street crosses a river; a path to every gate"). A street is planned first (`LandMap.plannedRoads`:
// a building's way to the nearest street, `connectRoad`; a worn footpath that joins the streets, `planStreets`; the way
// to each of the ring wall's gates and a little beyond, `gatePaths`), shown as a ghost on the map, and laid a cell at a
// time by whoever has building to do (the `pave` task in people.ts), out from the streets already laid, so it goes down
// in stretches. A cell over a river is a bridge: slower, and it takes wood.

import { builtOn, layStreet, nearestStreet, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { cellAt, groundAt, idx, inMap, isPlannedRoad, isRoad, planRoad, setRoad, wearAt, wet, type Pt } from './land';
import { isGate, lineOf, sideOn } from './ringWall';
import { campCell, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

/** Seconds of work to lay a cell of street, and of bridge; the wood a cell of bridge takes. */
export const PAVE_SECONDS = 40;
export const BRIDGE_SECONDS = 160;
export const BRIDGE_WOOD = 2;
/** A footpath this worn (land.ts `wear`, 0 to 24) that joins the streets is planned as one; at most this many cells a
 *  day, within this far of the camp. */
export const STREET_WEAR = 14;
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
  if (isBridge(s, i) && wood < BRIDGE_WOOD) return false;
  const camp = campCell(s);
  if (Math.abs(c.x - camp.x) + Math.abs(c.y - camp.y) <= 2) return true;
  return N4.some(([dx, dy]) => isRoad(m, c.x + dx, c.y + dy));
}

/** The planned cell someone should lay next: the nearest ready one nobody else is on; null when there's none. */
export function nextPave(s: GameState, p: Person): number | null {
  const cells = plannedCells(s);
  if (!cells.length) return null;
  const taken = new Set(s.people.filter((q) => q !== p && q.task?.type === 'pave').map((q) => (q.task as { cell: number }).cell));
  const wood = totalStock(s).wood ?? 0;
  let best: number | null = null;
  let bestD = Infinity;
  let any: number | null = null;
  let anyD = Infinity;
  for (const i of cells) {
    if (taken.has(i)) continue;
    const c = cellAt(s.land, i);
    const d = Math.abs(c.x * 32 + 16 - p.x) + Math.abs(c.y * 32 + 16 - (p.y ?? 0));
    if (ready(s, i, wood)) {
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    } else if (d < anyD && !isBridge(s, i) && !builtOn(s, c.x, c.y)) {
      anyD = d;
      any = i;
    }
  }
  // (a plan cut off from every street, say by a building since put up, is still laid from where it is)
  return best ?? any;
}

/** A cell laid: the street goes down (a bridge takes its wood). False if it can't be (the bridge's wood is gone). */
export function pave(s: GameState, i: number): boolean {
  const c = cellAt(s.land, i);
  if (!isPlannedRoad(s.land, c.x, c.y)) return true;
  if (isBridge(s, i)) {
    if ((totalStock(s).wood ?? 0) < BRIDGE_WOOD) return false;
    takeFromStorage(s, 'wood', BRIDGE_WOOD);
  }
  planRoad(s.land, c.x, c.y, false);
  setRoad(s.land, c.x, c.y);
  return true;
}

/** How long a cell takes to lay (seconds of work). */
export const paveSeconds = (s: GameState, i: number) => (isBridge(s, i) ? BRIDGE_SECONDS : PAVE_SECONDS);

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
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  gatePaths(s);
  if (Math.floor(s.tick / TICKS_PER_HOUR) % 24 !== 6) return;
  planStreets(s);
}

/** The worn footpaths that join the streets become streets (`STREETS_A_DAY` cells at most, the most worn first). */
export function planStreets(s: GameState): number {
  const m = s.land;
  if (!m.wear) return 0;
  const camp = campCell(s);
  const want: { i: number; w: number }[] = [];
  for (let y = Math.max(0, camp.y - STREET_REACH); y <= Math.min(m.h - 1, camp.y + STREET_REACH); y++)
    for (let x = Math.max(0, camp.x - STREET_REACH); x <= Math.min(m.w - 1, camp.x + STREET_REACH); x++) {
      const i = idx(m, x, y);
      const w = wearAt(m, i);
      if (w < STREET_WEAR || isRoad(m, x, y) || isPlannedRoad(m, x, y) || builtOn(s, x, y)) continue;
      const g = groundAt(m, x, y);
      if (g !== 'grass' && g !== 'fertile' && g !== 'sand') continue;
      if (!N4.some(([dx, dy]) => isRoad(m, x + dx, y + dy) || isPlannedRoad(m, x + dx, y + dy))) continue;
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
    if (!layStreet(s, inside, nearestStreet(s, inside), 60)) continue;
    planRoad(m, g.x, g.y);
    // (and out beyond the gate a few cells, where nothing stands in the way)
    for (let k = 1; k <= GATE_PATH_OUT; k++) {
      const x = g.x - ix * k, y = g.y - iy * k;
      if (!inMap(m, x, y) || builtOn(s, x, y) || isRoad(m, x, y)) break;
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

