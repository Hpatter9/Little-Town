// Paths drawn by hand (the owner's ask: "let me put blueprints for paths"). In the Draw a path mode the player lays a
// path's blueprint a drag at a time (renderer/main.ts, along `pathRoute`); each cell is a planned street
// (`LandMap.plannedRoads`, as sim/streets.ts paves them), so it shows as the same ghost and the builders pave it the
// same way, out from the streets already down, a bridge over a river taking its wood. Only on land that has been seen,
// open buildable ground or a river (a bridge; the sea too in a shore town, a pier) or a thin ridge of rock (a tunnel,
// sim/tunnels.ts), never through a building, the castle or the ring wall but at its gates. A drag from a blueprint
// cell lifts. The town lays no path of its own (the owner's ask: "I want to place them myself to help guide the town
// shape").

import { builtOnIndex } from './buildings';
import { castleCells, castleOn } from './castle';
import { isExplored } from './fog';
import { buildable, groundAt, inMap, isPlannedRoad, isRoad, planRoad, wet, type LandMap, type Pt } from './land';
import { isGate, ringWallCells, riverCell } from './ringWall';
import { seaTown } from './sea';
import { thinRock } from './tunnels';
import type { OriginId } from '../data/origins';
import type { Building, GameState } from './state';

/** The most cells one `drawPath` (a drag across the map) may lay or lift. */
export const PATH_CAP = 150;

/** What a path's rule reads of the town: from the state (`pathGround`), or from the snapshot, so the map's preview
 *  of a drag (renderer/main.ts) marks the same cells blocked as the sim will skip. */
export interface PathGround {
  land: LandMap;
  explored: string | undefined;
  origin: OriginId | undefined;
  /** What stands on a cell (`builtOnIndex`). */
  on: (x: number, y: number) => Building | undefined;
  /** The ring wall's line but its gates (`ringWallCells`), and the castle's cells; null when there's none. */
  wall: Set<number> | null;
  castle: Set<number> | null;
  /** The rock a path may tunnel (`thinRock`). */
  thin: ((x: number, y: number) => boolean) | null;
}
export function pathGround(s: GameState): PathGround {
  return { land: s.land, explored: s.explored, origin: s.origin, on: builtOnIndex(s), wall: s.ring ? ringWallCells(s) : null, castle: castleOn(s) ? castleCells(s) : null, thin: thinRock(s) };
}

/** Why a path can't be laid on a cell (null: it can). A cell already a street needs nothing. */
export function pathRefusal(s: GameState, x: number, y: number): string | null {
  return refusalOn(pathGround(s), x, y);
}
export function refusalOn(g: PathGround, x: number, y: number): string | null {
  const m = g.land;
  if (!inMap(m, x, y)) return 'Off the map';
  const i = y * m.w + x;
  if (!isExplored(g, i)) return 'Not explored yet';
  const b = g.on(x, y);
  const gate = !!b && isGate(b.def);
  if (b && !gate) return 'A building stands there';
  if (!gate && g.wall?.has(i)) return 'The ring wall: a path crosses it only at a gate';
  if (g.castle?.has(i)) return 'Inside the castle';
  const gr = groundAt(m, x, y);
  if (wet(gr)) return seaTown(g) || riverCell(m, { x, y }) ? null : 'Too much water to bridge';
  if (gr === 'mountain' && g.thin?.(x, y)) return null; // (a tunnel, cut slowly: sim/tunnels.ts)
  if (!buildable(gr)) return gr === 'mountain' ? 'Solid rock' : 'Wild ground: clear it first';
  return null;
}

/** Lay (`on`) or lift a path's blueprint over a list of cells (indexes), capped at `PATH_CAP`. A cell refused is
 *  passed over; a street already down is left as it is. How many cells changed. */
export function drawPath(s: GameState, cells: readonly number[], on: boolean): number {
  const m = s.land;
  const ground = pathGround(s);
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
    if (isRoad(m, x, y) || isPlannedRoad(m, x, y) || refusalOn(ground, x, y)) continue;
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

/** The way a drag lays a path from where the finger went down to where it is now: a straight run, or two at a corner
 *  (along one way, then the other), whichever of the two corners has more cells that can take a path (`ok`); on a tie,
 *  along the longer way first. Edge to edge, both ends included. */
export function pathRoute(a: Pt, b: Pt, ok: (x: number, y: number) => boolean): Pt[] {
  const run = (from: Pt, to: Pt, xFirst: boolean): Pt[] => {
    const out: Pt[] = [{ x: from.x, y: from.y }];
    let x = from.x, y = from.y;
    const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
    for (const step of xFirst ? ['x', 'y'] : ['y', 'x'])
      if (step === 'x') while (x !== to.x) out.push({ x: (x += sx), y });
      else while (y !== to.y) out.push({ x, y: (y += sy) });
    return out;
  };
  const wide = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const first = run(a, b, wide), second = run(a, b, !wide);
  const good = (r: Pt[]) => r.filter((p) => ok(p.x, p.y)).length;
  return good(second) > good(first) ? second : first;
}
