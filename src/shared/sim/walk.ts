// Walking on the land: townsfolk, visitors and strangers all move the same way, along a path found over the cells
// (`findPath` in land.ts: roads are quick, forest and marsh slow, water and other people's buildings are in the way).
// A walker keeps its path and the goal it was found for; a new goal, or a building put up across the way, finds a
// new one. With no way through (an island, a walled yard) it walks straight at the goal, so nobody is ever stuck.

import { castleLayout, castleStep, type CastleLayout } from './castle';
import { isGate } from './ringWall';
import { footprint } from './buildings';
import { addWear, CELL, cellOf, centreOf, findPath, idx, inMap, inRect, SWIM_COST, type Pt, type Rect } from './land';
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
/** Further than this from the next cell on the path (px) and the walker has left it (put somewhere by a building, a
 *  battle or a task): the path is found again, or they'd cut straight across to it, through a castle's walls. */
const OFF_PATH = CELL * 2.2;
/** The castle's layout each walker's path was found for: a room built, or a doorway moved, finds the path again
 *  (kept off the walker so it isn't saved). */
/** What a cell of river costs to wade, when there's no other way across. */
const WADE = 8;
const walls = new WeakMap<Walker, CastleLayout | null>();

/** Whether a cell is inside a building (one that isn't `through`: the walker's own goal). A castle's rooms are walked
 *  through: inside its walls, everyone goes from room to room. */
export function blockedBy(s: Pick<GameState, 'buildings'>, through?: Rect): (x: number, y: number) => boolean {
  // (the cells inside buildings, as a set keyed by (x, y) packed into one number: a path search asks thousands of
  // times, and a walled town has a hundred wall pieces; the ring wall's gates are walked through)
  const cells = new Set<number>();
  for (const b of s.buildings) {
    if (b.room || isGate(b.def) || b.planned || b.overgrown) continue; // (a planned piece of the wall isn't there yet, nor a site still being cleared)
    const r = footprint(b);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!(through && inRect(through, x, y))) cells.add(y * 4096 + x);
  }
  return (x, y) => cells.has(y * 4096 + x);
}

/** A path from a point to another, as px centres of the cells on the way, ending on `to` itself (null: no way). */
export function pathTo(s: Pick<GameState, 'buildings' | 'land' | 'nomad' | 'origin'>, from: Pt, to: Pt, through?: Rect, swim = false): Pt[] | null {
  const a = cellOf(from);
  const b = cellOf(to);
  const clamp = (c: Pt) => ({ x: Math.max(0, Math.min(s.land.w - 1, c.x)), y: Math.max(0, Math.min(s.land.h - 1, c.y)) });
  // (a castle's walls: from room to room through the doorways, in and out through the gate)
  const layout = castleLayout(s);
  const blocked = blockedBy(s, through);
  const opts = { maxNodes: 12000, ...(swim ? { swim: SWIM_COST } : {}), ...(layout ? { edge: castleStep(s, layout) } : {}) };
  // (no way round: a river with no bridge yet is waded, slowly, rather than walked straight at, over the water and
  // through any castle wall in the way)
  const cells = findPath(s.land, clamp(a), clamp(b), blocked, opts) ?? (swim ? null : findPath(s.land, clamp(a), clamp(b), blocked, { ...opts, ford: WADE }));
  if (!cells) return null;
  const pts = cells.map((c) => centreOf(c.x, c.y));
  // (the goal lies in the last cell: straight to it, not by way of the cell's middle)
  if (pts.length) pts.pop();
  pts.push({ x: to.x, y: to.y });
  return pts;
}

const same = (a: Pt | undefined, b: Pt) => !!a && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;

/** One tick's walk towards `to` at `step` px. True once there. `through` is a footprint the walker may enter (where
 *  it's going). `tick` lets the path be looked at again now and then. A swimmer (`swim`: the merfolk) goes through the
 *  sea as readily as over the land. */
export function walk(s: Pick<GameState, 'buildings' | 'land' | 'nomad' | 'origin'>, w: Walker, to: Pt, step: number, through?: Rect, tick = 0, swim = false): boolean {
  if (Math.hypot(to.x - w.x, to.y - w.y) <= Math.max(ARRIVE, step)) {
    w.x = to.x;
    w.y = to.y;
    delete w.path;
    delete w.goal;
    return true;
  }
  const layout = castleLayout(s);
  const offPath = !!w.path && w.path.length > 1 && Math.hypot(w.path[0].x - w.x, w.path[0].y - w.y) > OFF_PATH;
  const rebuilt = !!w.path && (walls.get(w) ?? null) !== layout;
  if (!w.path || !same(w.goal, to) || offPath || rebuilt || (tick && tick % REPLAN_TICKS === 0)) {
    w.path = pathTo(s, w, to, through, swim) ?? [{ x: to.x, y: to.y }];
    walls.set(w, layout);
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
