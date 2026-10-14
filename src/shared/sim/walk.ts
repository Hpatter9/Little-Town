// Walking on the land: townsfolk, visitors and strangers all move the same way, along a path found over the cells
// (`findPath` in land.ts: roads are quick, forest and marsh slow, water and other people's buildings are in the way).
// A walker keeps its path and the goal it was found for; a new goal, or a building put up across the way, finds a
// new one. With no way through (an island, a walled yard) it walks straight at the goal, so nobody is ever stuck.

import { castleLayout, castleStep, type CastleLayout } from './castle';
import { isGate } from './ringWall';
import { footprint } from './buildings';
import { addWear, CELL, cellOf, centreOf, findPath, mayReach, idx, inMap, inRect, SWIM_COST, type LandMap, type Pt, type Rect } from './land';
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
  const cells = solidCells(s);
  return through ? (x, y) => cells.has(y * 4096 + x) && !inRect(through, x, y) : (x, y) => cells.has(y * 4096 + x);
}
/** The cells inside buildings, as a set keyed by (x, y) packed into one number: a path search asks thousands of times,
 *  and a walled town has a hundred wall pieces; the ring wall's gates are walked through. Kept while the buildings
 *  stand as they were (asked for every walker's path, it was made afresh each time); never changed once made. */
let solidMade: { sig: unknown[]; cells: Set<number> } | null = null;
const SIG = 9;
function solidCells(s: Pick<GameState, 'buildings'>): Set<number> {
  const bs = s.buildings;
  const was = solidMade?.sig;
  if (was && was.length === bs.length * SIG) {
    let same = true;
    for (let k = 0, j = 0; k < bs.length; k++, j += SIG) {
      const b = bs[k];
      if (was[j] !== b.id || was[j + 1] !== b.tile || was[j + 2] !== b.row || was[j + 3] !== b.def || was[j + 4] !== b.wide || was[j + 5] !== b.turned || was[j + 6] !== b.room || was[j + 7] !== b.planned || was[j + 8] !== b.overgrown) {
        same = false;
        break;
      }
    }
    if (same) return solidMade!.cells;
  }
  const sig: unknown[] = [];
  const cells = new Set<number>();
  for (const b of bs) {
    sig.push(b.id, b.tile, b.row, b.def, b.wide, b.turned, b.room, b.planned, b.overgrown);
    if (b.room || isGate(b.def) || b.planned || b.overgrown) continue; // (a planned piece of the wall isn't there yet, nor a site still being cleared)
    const r = footprint(b);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.add(y * 4096 + x);
  }
  solidMade = { sig, cells };
  return cells;
}

/** Searches that found no way, kept with what they were made over (the land's cells and roads, the cells built on,
 *  the castle's layout): a walker who can't reach their goal asks again at every replanning, and a failed search
 *  looks at 12 000 cells twice over (with and without wading). Asked again over just the same, the answer is the same,
 *  so it's given at once. Nothing else is remembered: any change and the search is made afresh. */
interface Failed {
  cells: string;
  roads: string;
  blocked: Set<number>;
  layout: unknown;
}
const FAILS_MOST = 256;
const failures = new WeakMap<object, Map<string, Failed>>();
function failedBefore(m: LandMap, key: string, blocked: Set<number>, layout: unknown): boolean {
  const f = failures.get(m)?.get(key);
  if (!f || f.cells !== m.cells || f.roads !== m.roads || f.layout !== layout || f.blocked.size !== blocked.size) return false;
  if (f.blocked === blocked) return true;
  for (const c of blocked) if (!f.blocked.has(c)) return false;
  return true;
}
function noteFailed(m: LandMap, key: string, blocked: Set<number>, layout: unknown): void {
  let all = failures.get(m);
  if (!all) failures.set(m, (all = new Map()));
  if (all.size >= FAILS_MOST) all.clear();
  all.set(key, { cells: m.cells, roads: m.roads, blocked, layout });
}

/** Ways found, likewise: a search's answer rests only on the cells it looked at (their ground, roads and what stands
 *  on them) and the castle's walls, so the same search is given the same way again for as long as nothing changed
 *  within its reach (walkers go back and forth between the same doors, and every walker's path is found again every
 *  `REPLAN_TICKS`). When the land, the roads or the buildings change, only the ways whose searches looked at a cell
 *  that changed are forgotten; a change to the castle forgets them all. */
interface Way {
  way: readonly Pt[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Found {
  cells: string;
  roads: string;
  blocked: Set<number>;
  layout: unknown;
  ways: Map<string, Way>;
}
const FOUND_MOST = 4096;
/** More cells changed at once than this, and every way is forgotten (cheaper than looking). */
const CHANGED_MOST = 256;
const founds = new WeakMap<object, Found>();
/** The ways found, brought up to the land as it is now. */
function foundNow(m: LandMap, blocked: Set<number>, layout: unknown): Found {
  let f = founds.get(m);
  if (!f) {
    founds.set(m, (f = { cells: m.cells, roads: m.roads, blocked, layout, ways: new Map() }));
    return f;
  }
  if (f.cells === m.cells && f.roads === m.roads && f.blocked === blocked && f.layout === layout) return f;
  let changed: number[] | null = f.layout === layout ? [] : null;
  const differ = (a: string, b: string) => {
    if (!changed || a === b) return;
    if (a.length !== b.length) return void (changed = null);
    for (let i = 0; i < a.length; i++)
      if (a.charCodeAt(i) !== b.charCodeAt(i)) {
        changed.push(i);
        if (changed.length > CHANGED_MOST) return void (changed = null);
      }
  };
  differ(f.cells, m.cells);
  differ(f.roads, m.roads);
  if (changed && f.blocked !== blocked) {
    // (the cells built on are keyed y * 4096 + x: made the land's index here)
    const add = (k: number) => {
      if (!changed) return;
      const x = k % 4096;
      changed.push(((k - x) / 4096) * m.w + x);
      if (changed.length > CHANGED_MOST) changed = null;
    };
    for (const k of f.blocked) if (!blocked.has(k)) add(k);
    for (const k of blocked) if (!f.blocked.has(k)) add(k);
  }
  const gone: number[] | null = changed;
  if (!gone) f.ways.clear();
  else if (gone.length)
    for (const [key, w] of f.ways)
      for (const i of gone) {
        const x = i % m.w;
        const y = (i - x) / m.w;
        if (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) {
          f.ways.delete(key);
          break;
        }
      }
  f.cells = m.cells;
  f.roads = m.roads;
  f.blocked = blocked;
  f.layout = layout;
  return f;
}
function foundBefore(m: LandMap, key: string, blocked: Set<number>, layout: unknown): Pt[] | null {
  const way = foundNow(m, blocked, layout).ways.get(key);
  return way ? way.way.map((c) => ({ x: c.x, y: c.y })) : null;
}
function noteFound(m: LandMap, key: string, blocked: Set<number>, layout: unknown, way: Pt[], reach: { x0: number; y0: number; x1: number; y1: number }): void {
  const f = foundNow(m, blocked, layout);
  if (f.ways.size >= FOUND_MOST) f.ways.clear();
  f.ways.set(key, { way: way.map((c) => ({ x: c.x, y: c.y })), ...reach });
}

/** A path from a point to another, as px centres of the cells on the way, ending on `to` itself (null: no way). */
export function pathTo(s: Pick<GameState, 'buildings' | 'land' | 'nomad' | 'origin'>, from: Pt, to: Pt, through?: Rect, swim = false): Pt[] | null {
  const a = cellOf(from);
  const b = cellOf(to);
  const clamp = (c: Pt) => ({ x: Math.max(0, Math.min(s.land.w - 1, c.x)), y: Math.max(0, Math.min(s.land.h - 1, c.y)) });
  // (a castle's walls: from room to room through the doorways, in and out through the gate)
  const layout = castleLayout(s);
  const solid = solidCells(s);
  const blocked = through ? (x: number, y: number) => solid.has(y * 4096 + x) && !inRect(through, x, y) : (x: number, y: number) => solid.has(y * 4096 + x);
  const reach = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const opts = { maxNodes: 12000, reach, ...(swim ? { swim: SWIM_COST } : {}), ...(layout ? { edge: castleStep(s, layout) } : {}) };
  const ca = clamp(a);
  const cb = clamp(b);
  const key = `${ca.x},${ca.y}>${cb.x},${cb.y}|${swim ? 1 : 0}${through ? `|${through.x},${through.y},${through.w},${through.h}` : ''}`;
  if (failedBefore(s.land, key, solid, layout)) return null;
  const found = foundBefore(s.land, key, solid, layout);
  // (no way round: a river with no bridge yet is waded, slowly, rather than walked straight at, over the water and
  // through any castle wall in the way)
  // (a way that surely isn't there, the goal on other ground altogether, isn't looked for over every cell first)
  // (that answer rests on the whole land: a way remembered after it is forgotten at any change)
  const dry = () => {
    if (swim || layout || mayReach(s.land, solid, through, ca, cb)) return findPath(s.land, ca, cb, blocked, opts);
    Object.assign(reach, { x0: 0, y0: 0, x1: s.land.w - 1, y1: s.land.h - 1 });
    return null;
  };
  const cells = found ?? dry() ?? (swim ? null : findPath(s.land, ca, cb, blocked, { ...opts, ford: WADE }));
  if (!cells) {
    noteFailed(s.land, key, solid, layout);
    return null;
  }
  if (!found) noteFound(s.land, key, solid, layout, cells, reach);
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
