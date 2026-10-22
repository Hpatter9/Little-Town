// Paths drawn by hand (the owner's ask: "let me put blueprints for paths"). In the Draw a path mode the player lays a
// path's blueprint across the map a cell at a time; each cell is a planned street (`LandMap.plannedRoads`, as
// sim/streets.ts plans them), so it shows as the same ghost and the builders pave it the same way, out from the streets
// already down, a bridge over a river taking its wood. Only on land that has been seen, open buildable ground or a
// river (a bridge; the sea too in a shore town, a pier), never through a building, the castle or the ring wall but at
// its gates. A tap on a blueprint cell lifts it.

import { builtOnIndex } from './buildings';
import { castleCells, castleOn } from './castle';
import { isExplored } from './fog';
import { buildable, groundAt, inMap, isPlannedRoad, isRoad, planRoad, wet, type Pt } from './land';
import { isGate, ringWallCells, riverCell } from './ringWall';
import { seaTown } from './sea';
import type { GameState } from './state';

/** The most cells one `drawPath` (a drag across the map) may lay or lift. */
export const PATH_CAP = 150;

/** Why a path can't be laid on a cell (null: it can). A cell already a street needs nothing. */
export function pathRefusal(s: GameState, x: number, y: number, on = builtOnIndex(s)): string | null {
  const m = s.land;
  if (!inMap(m, x, y)) return 'Off the map';
  const i = y * m.w + x;
  if (!isExplored(s, i)) return 'Not explored yet';
  const b = on(x, y);
  const gate = !!b && isGate(b.def);
  if (b && !gate) return 'A building stands there';
  if (!gate && s.ring && ringWallCells(s).has(i)) return 'The ring wall: a path crosses it only at a gate';
  if (castleOn(s) && castleCells(s).has(i)) return 'Inside the castle';
  const g = groundAt(m, x, y);
  if (wet(g)) return seaTown(s) || riverCell(m, { x, y }) ? null : 'Too much water to bridge';
  if (!buildable(g)) return g === 'mountain' ? 'Solid rock' : 'Wild ground: clear it first';
  return null;
}

/** Lay (`on`) or lift a path's blueprint over a list of cells (indexes), capped at `PATH_CAP`. A cell refused is
 *  passed over; a street already down is left as it is. How many cells changed. */
export function drawPath(s: GameState, cells: readonly number[], on: boolean): number {
  const m = s.land;
  const index = builtOnIndex(s);
  let n = 0;
  for (const i of cells.slice(0, PATH_CAP)) {
    if (!Number.isInteger(i) || i < 0 || i >= m.w * m.h) continue;
    const x = i % m.w, y = Math.floor(i / m.w);
    if (!on) {
      if (!isPlannedRoad(m, x, y)) continue;
      planRoad(m, x, y, false);
      n++;
      continue;
    }
    if (isRoad(m, x, y) || isPlannedRoad(m, x, y) || pathRefusal(s, x, y, index)) continue;
    planRoad(m, x, y);
    n++;
  }
  if (n && !on && !m.plannedRoads?.includes('#')) delete s.streetSec; // (nothing left to pave: the work done goes)
  return n;
}

/** The cells from one to another along the grid, each joining the last by an edge (a street's cells join edge to
 *  edge): straight along the longer way, stepping across as it goes. Both ends included. */
export function pathLine(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = [{ x: a.x, y: a.y }];
  const dx = b.x - a.x, dy = b.y - a.y;
  const n = Math.abs(dx) + Math.abs(dy);
  let x = a.x, y = a.y;
  for (let k = 1; k <= n; k++) {
    // (the step that keeps the line nearest the straight way from a to b)
    const t = k / n;
    const ex = Math.abs(a.x + dx * t - (x + Math.sign(dx))) + Math.abs(a.y + dy * t - y);
    const ey = Math.abs(a.x + dx * t - x) + Math.abs(a.y + dy * t - (y + Math.sign(dy)));
    if (x !== b.x && (y === b.y || ex <= ey)) x += Math.sign(dx);
    else y += Math.sign(dy);
    out.push({ x, y });
  }
  return out;
}
