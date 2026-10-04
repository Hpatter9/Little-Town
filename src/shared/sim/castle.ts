// A castle town (the Blood Court: `castle` in data/origins.ts): one castle in the middle of the land, not a town of
// separate buildings. Its buildings (`roomKind`) are rooms of the castle: each new one is built on to it, sharing a
// wall with the hall at the camp (`coreRect`) or with a room already standing, so the castle grows outward room by
// room and is walled all round (the renderer: map/castleArt.ts). Fields, pens, mines, the graveyard, the shop and the
// tavern stay outside, a cell clear of its walls. Inside, people walk through the rooms (sim/walk.ts lets them), a
// room's door is its own middle, and roads run to the gate in the hall's south wall, never inside.

import type { BuildingDef } from '../data/buildings';
import { rulesOf } from '../data/origins';
import { carvable, groundAt, idx, inMap, MOUNTAIN_FOOT, setGround, type LandMap, type Pt, type Rect } from './land';
import { footprint } from './buildings';
import { campCell, type GameState } from './state';

/** The hall at the camp: the castle's first cells, which the rooms are built on to. */
export const CORE_W = 6;
export const CORE_H = 4;
/** The widest a room may be. */
export const ROOM_MAX_W = 12;
/** Built outside, never as rooms (the venues keep their own halls too: `floor` on the def). */
const OUTSIDE = new Set(['graveyard', 'mine', 'coal_mine', 'deep_mine', 'oil_derrick', 'launch_site']);

type CastleState = Pick<GameState, 'land' | 'nomad' | 'buildings' | 'origin'>;

/** What kind of hold the town is: a castle standing on the land (the vampires), a hold carved into the mountain (the
 *  dwarves), or none. */
export type Hold = 'castle' | 'mountain';
export const holdOf = (s: Pick<GameState, 'origin'>): Hold | null => (rulesOf(s).castle ? 'castle' : rulesOf(s).hold === 'mountain' ? 'mountain' : null);
export const castleOn = (s: Pick<GameState, 'origin'>) => holdOf(s) !== null;

/** Whether a kind of building goes into the castle, as a room. */
export const roomKind = (s: Pick<GameState, 'origin'>, def: BuildingDef) => castleOn(s) && def.layer === 'mid' && !OUTSIDE.has(def.id) && !def.floor && def.width <= ROOM_MAX_W;

/** The castle's rooms (built or being built). */
export const rooms = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.room);

/** The hall's ground, in cells: over the camp for a castle; cut into the mountain's foot above the camp for a mountain
 *  hold, its gate opening onto the terrain. */
export function coreRect(s: Pick<GameState, 'land' | 'nomad' | 'origin'>): Rect {
  const c = campCell(s);
  if (holdOf(s) === 'mountain') return { x: c.x - Math.floor(CORE_W / 2), y: c.y - MOUNTAIN_FOOT - CORE_H + 1, w: CORE_W, h: CORE_H };
  return { x: c.x - Math.floor(CORE_W / 2), y: c.y - Math.floor(CORE_H / 2), w: CORE_W, h: CORE_H };
}

/** Cut a room's ground out of the mountain (a mountain hold: its cells become hall, walked through). */
export function carve(s: Pick<GameState, 'land'>, r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(s.land, x, y) && groundAt(s.land, x, y) === 'mountain') setGround(s.land, x, y, 'hall');
}

/** Whether every cell of a footprint is the mountain's (or already cut), where a mountain hold's rooms go. */
export function inMountain(m: LandMap, r: Rect): boolean {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!inMap(m, x, y) || !carvable(groundAt(m, x, y))) return false;
  return true;
}

/** Every cell of the castle: the hall's and its rooms', as land indices; in a mountain hold every cell cut out of the
 *  rock besides (the galleries dug for ore), since a new hall may be carved off a gallery. */
export function castleCells(s: CastleState): Set<number> {
  const m = s.land;
  const out = new Set<number>();
  const add = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(m, x, y)) out.add(idx(m, x, y));
  };
  add(coreRect(s));
  for (const b of rooms(s)) add(footprint(b));
  if (holdOf(s) === 'mountain') for (let i = 0; i < m.cells.length; i++) if (m.cells[i] === 'H') out.add(i);
  return out;
}

/** The cell in front of the gate: outside the hall's south wall, in the middle (where the roads run to). */
export function castleGate(s: Pick<GameState, 'land' | 'nomad' | 'origin'>): Pt {
  const c = coreRect(s);
  return { x: c.x + Math.floor(c.w / 2), y: c.y + c.h };
}

/** The smallest rectangle round the whole castle. */
export function castleBounds(s: CastleState): Rect {
  let r = coreRect(s);
  for (const b of rooms(s)) {
    const f = footprint(b);
    const x = Math.min(r.x, f.x);
    const y = Math.min(r.y, f.y);
    r = { x, y, w: Math.max(r.x + r.w, f.x + f.w) - x, h: Math.max(r.y + r.h, f.y + f.h) - y };
  }
  return r;
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The castle's cells that nothing may be built over: the hall's and its rooms' (a mountain hold's galleries may be
 *  carved into a room). */
export function solidCells(s: CastleState): Set<number> {
  const m = s.land;
  const out = new Set<number>();
  const add = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(m, x, y)) out.add(idx(m, x, y));
  };
  add(coreRect(s));
  for (const b of rooms(s)) add(footprint(b));
  return out;
}

/** How many of a footprint's cell edges lie against the castle (its snugness), or -1 if it overlaps what may not be
 *  built over (`solid`: the castle's cells themselves, unless given). */
export function sharedEdges(cells: Set<number>, m: LandMap, r: Rect, solid: Set<number> = cells): number {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (inMap(m, x, y) && solid.has(idx(m, x, y))) return -1;
      for (const [dx, dy] of SIDES) if (inMap(m, x + dx, y + dy) && cells.has(idx(m, x + dx, y + dy))) n++;
    }
  return n;
}

/** Whether a footprint can be built on to the castle: clear of its cells, sharing at least one wall with it. */
export const joinsCastle = (cells: Set<number>, m: LandMap, r: Rect, solid?: Set<number>) => sharedEdges(cells, m, r, solid) > 0;

/** Whether a footprint comes within `gap` cells of the castle (where nothing but a room may stand). */
export function nearCastle(cells: Set<number>, m: LandMap, r: Rect, gap = 1): boolean {
  for (let y = r.y - gap; y < r.y + r.h + gap; y++) for (let x = r.x - gap; x < r.x + r.w + gap; x++) if (inMap(m, x, y) && cells.has(idx(m, x, y))) return true;
  return false;
}

/** Whether a cell is the castle's (its hall or a room). */
export const inCastle = (s: CastleState, x: number, y: number) => castleOn(s) && inMap(s.land, x, y) && castleCells(s).has(idx(s.land, x, y));

/** How many cells the castle's rooms stand on. */
export function roomCells(s: Pick<GameState, 'buildings'>): number {
  return rooms(s).reduce((n, b) => {
    const f = footprint(b);
    return n + f.w * f.h;
  }, 0);
}
