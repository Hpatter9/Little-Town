// Walking on the land: townsfolk, visitors and strangers all move the same way, along a path found over the cells
// (`findPath` in land.ts: roads are quick, forest and marsh slow, water and other people's buildings are in the way).
// A walker keeps its path and the goal it was found for; a new goal, or a building put up across the way, finds a
// new one. With no way through (an island, a walled yard) it walks straight at the goal, so nobody is ever stuck.

import { footprint } from './buildings';
import { addWear, CELL, cellOf, centreOf, findPath, idx, inMap, inRect, type Pt, type Rect } from './land';
import type { GameState } from './state';

export interface Walker {
  x: number;
  y: number;
  dir: 1 | -1;
  /** The cells still to walk (px centres), and the goal they lead to. */
  path?: Pt[];
  goal?: Pt;
  /** The cell last stepped into (its index): each new one wears a footpath a little (land.ts `addWear`). */
  cell?: number;
}

/** Close enough to a goal to count as there (px). */
export const ARRIVE = 2;
/** A path is thrown away and found again after this many ticks (something may have been built across it). */
const REPLAN_TICKS = 200;

/** Whether a cell is inside a building (one that isn't `through`: the walker's own goal). */
export function blockedBy(s: Pick<GameState, 'buildings'>, through?: Rect): (x: number, y: number) => boolean {
  const prints = s.buildings.map(footprint);
  return (x, y) => prints.some((r) => inRect(r, x, y) && !(through && inRect(through, x, y)));
}

/** A path from a point to another, as px centres of the cells on the way, ending on `to` itself (null: no way). */
export function pathTo(s: Pick<GameState, 'buildings' | 'land'>, from: Pt, to: Pt, through?: Rect): Pt[] | null {
  const a = cellOf(from);
  const b = cellOf(to);
  const clamp = (c: Pt) => ({ x: Math.max(0, Math.min(s.land.w - 1, c.x)), y: Math.max(0, Math.min(s.land.h - 1, c.y)) });
  const cells = findPath(s.land, clamp(a), clamp(b), blockedBy(s, through));
  if (!cells) return null;
  const pts = cells.map((c) => centreOf(c.x, c.y));
  // (the goal lies in the last cell: straight to it, not by way of the cell's middle)
  if (pts.length) pts.pop();
  pts.push({ x: to.x, y: to.y });
  return pts;
}

const same = (a: Pt | undefined, b: Pt) => !!a && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;

/** One tick's walk towards `to` at `step` px. True once there. `through` is a footprint the walker may enter (where
 *  it's going). `tick` lets the path be looked at again now and then. */
export function walk(s: Pick<GameState, 'buildings' | 'land'>, w: Walker, to: Pt, step: number, through?: Rect, tick = 0): boolean {
  if (Math.hypot(to.x - w.x, to.y - w.y) <= Math.max(ARRIVE, step)) {
    w.x = to.x;
    w.y = to.y;
    delete w.path;
    delete w.goal;
    return true;
  }
  if (!w.path || !same(w.goal, to) || (tick && tick % REPLAN_TICKS === 0)) {
    w.path = pathTo(s, w, to, through) ?? [{ x: to.x, y: to.y }];
    w.goal = { x: to.x, y: to.y };
    // (the first cell is the one we stand in: skip it when we're past its centre already)
    if (w.path.length > 1 && Math.hypot(w.path[0].x - w.x, w.path[0].y - w.y) < CELL * 0.5) w.path.shift();
  }
  let left = step;
  while (left > 0 && w.path.length) {
    const n = w.path[0];
    const dx = n.x - w.x;
    const dy = n.y - w.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) w.dir = dx > 0 ? 1 : -1;
    if (d <= left) {
      w.x = n.x;
      w.y = n.y;
      left -= d;
      w.path.shift();
    } else {
      w.x += (dx / d) * left;
      w.y += (dy / d) * left;
      left = 0;
    }
  }
  tread(s.land, w);
  if (!w.path.length) {
    delete w.path;
    delete w.goal;
    return Math.hypot(to.x - w.x, to.y - w.y) <= ARRIVE;
  }
  return false;
}

/** Stepping into a new cell wears it (a worn footpath, where people walk often). */
function tread(m: Pick<GameState, 'land'>['land'], w: Walker): void {
  const c = cellOf(w);
  if (!inMap(m, c.x, c.y)) return;
  const i = idx(m, c.x, c.y);
  if (w.cell === i) return;
  const first = w.cell === undefined; // (the cell stood in to begin with isn't stepped into)
  w.cell = i;
  if (!first) addWear(m, i);
}

/** Straight at a point, no path (raiders in the open, things that fly). True once there. */
export function stepStraight(w: Walker, to: Pt, step: number): boolean {
  const dx = to.x - w.x;
  const dy = to.y - w.y;
  const d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.5) w.dir = dx > 0 ? 1 : -1;
  if (d <= step) {
    w.x = to.x;
    w.y = to.y;
    return true;
  }
  w.x += (dx / d) * step;
  w.y += (dy / d) * step;
  return false;
}
