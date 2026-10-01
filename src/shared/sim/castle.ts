// A castle town (the Blood Court: `castle` in data/origins.ts). Instead of spreading out, the town's buildings are
// rooms of one castle, stacked floor on floor over the camp: a room goes on the ground floor while there's space,
// then on the next floor up once the one below is mostly built. Yards, fields, mines, graveyards and walls stay
// outside. The keep grows wider with each era; when it's full the town waits for the next. The renderer draws the keep
// round its rooms (renderer/art/castle.ts). Its floors are real: a stair tower stands at each end, and people (and
// raiders who get in) walk to one and climb to reach another floor.

import { TILE } from '../constants';
import { ERAS, type Era } from '../data/eras';
import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { ITEM_BY_ID } from '../data/items';
import { rulesOf } from '../data/origins';
import { campX, type Building, type GameState, type Person } from './state';
import { TICK_HZ } from './time';

/** The keep: its ground floor this many tiles wide at first, over the camp (wider each era), and at most this many
 *  floors, each reaching CASTLE_FLARE tiles further out on each side than the one below (on corbels, over the stair
 *  towers, which stand just past the ground floor's ends and run up through the floors above). */
export const CASTLE_TILES = 12;
export const CASTLE_GROWS = 4;
export const CASTLE_FLOORS = 6;
export const CASTLE_FLARE = 1;
/** The keep in castles from before it flared (older saves): wider, straight up. */
const OLD_KEEP = { tiles: 16, flare: 0 };
const keepOf = (s: Pick<GameState, 'keep'>) => s.keep ?? OLD_KEEP;
/** Seconds to climb (or go down) one floor of the stair towers. */
export const CLIMB_SECONDS = 3;
/** How it's drawn (px): each floor's height (a person stands 48 high), the towers past each end, the roof and spires
 *  over the top floor, and the plinth under the ground floor. The whole keep stands keepHeight() tall. */
export const ROOM_H = 56;
export const TOWER_W = 24;
export const ROOF_H = 96;
export const PLINTH = 4;
export const keepHeight = (floors: number) => floors * ROOM_H + PLINTH + ROOF_H + 26;
/** A floor is open to build on once the one below is at least this full. */
const FLOOR_BELOW = 0.5;
/** Built outside the keep, never as rooms. */
const OUTSIDE = new Set(['graveyard', 'mine', 'coal_mine', 'deep_mine', 'oil_derrick', 'launch_site']);

export const castleOn = (s: Pick<GameState, 'origin'>) => !!rulesOf(s).castle;

/** How many tiles wide the keep's ground floor stands in an era. */
export const castleWidth = (era: Era, tiles = CASTLE_TILES) => tiles + CASTLE_GROWS * Math.max(0, ERAS.indexOf(era));

/** A floor's tiles: [lo, hi) (the ground floor's by default; each floor up reaches further out). */
export function castleSpan(s: GameState, floor = 0): [number, number] {
  const k = keepOf(s);
  const w = castleWidth(s.era, k.tiles);
  const lo = Math.floor(campX(s) / TILE) - w / 2;
  return [lo - floor * k.flare, lo + w + floor * k.flare];
}

/** How far each floor reaches out past the one below, in tiles (for the renderer). */
export const keepFlare = (s: Pick<GameState, 'keep'>) => keepOf(s).flare;

/** The keep's widest reach (its top floor): nothing else is built under it. */
export const castleReach = (s: GameState) => castleSpan(s, CASTLE_FLOORS - 1);

/** The tiles the stair towers stand on (just past each end of the ground floor). */
const stairTiles = (s: GameState): [number, number] => {
  const [lo, hi] = castleSpan(s);
  return [lo - 1, hi];
};

/** Whether a room of this width can stand at `tile` on a floor: inside the floor, and clear of the stair towers. */
export function inKeep(s: GameState, tile: number, width: number, floor: number): boolean {
  const [lo, hi] = castleSpan(s, floor);
  if (tile < lo || tile + width > hi) return false;
  return floor === 0 || !stairTiles(s).some((t) => tile <= t && t < tile + width);
}

/** How many tiles of rooms a floor holds. */
export const floorRoom = (s: GameState, floor: number) => {
  const [lo, hi] = castleSpan(s, floor);
  return hi - lo - (floor > 0 ? 2 : 0);
};

/** Whether a kind of building goes inside, as a room. */
export const roomKind = (s: Pick<GameState, 'origin'>, def: BuildingDef) => castleOn(s) && def.layer === 'mid' && !OUTSIDE.has(def.id) && def.width <= CASTLE_TILES;

/** The floor a building stands on (0 unless it's a room up in the keep). */
export const floorOf = (b: Pick<Building, 'room' | 'floor'>) => (b.room ? (b.floor ?? 0) : 0);

/** The two stair towers' x (px): one past each end of the keep. */
export function stairXs(s: GameState): [number, number] {
  const [lo, hi] = castleSpan(s);
  return [lo * TILE - TOWER_W / 2, hi * TILE + TOWER_W / 2];
}

/** Anyone who can be on a floor of the keep: a person or a raider. */
export interface Climber {
  x: number;
  dir: 1 | -1;
  /** The floor they're on (0, or unset, on the ground), and how far up (+) or down (-) the stairs to the next. */
  floor?: number;
  climb?: number;
}

/** One tick toward x on a floor: along to the nearer stair tower, up or down it a floor at a time, then along to x.
 *  Returns true once there. (Off a castle town everyone is on the ground, and this is a plain walk.) */
export function moveOnFloors(s: GameState, m: Climber, x: number, floor: number, step: number): boolean {
  const at = m.floor ?? 0;
  if (at !== floor && castleOn(s)) {
    const [a, b] = stairXs(s);
    const sx = Math.abs(m.x - a) <= Math.abs(m.x - b) ? a : b;
    if (Math.abs(sx - m.x) > step) {
      m.dir = sx > m.x ? 1 : -1;
      m.x += m.dir * step;
      return false;
    }
    m.x = sx;
    const up = Math.sign(floor - at);
    m.climb = (m.climb ?? 0) + up / (CLIMB_SECONDS * TICK_HZ);
    if (Math.abs(m.climb) >= 1) {
      m.floor = at + up;
      m.climb = 0;
    }
    return false;
  }
  if (m.climb) m.climb = 0;
  const d = x - m.x;
  if (Math.abs(d) <= step) {
    m.x = x;
    return true;
  }
  m.dir = d > 0 ? 1 : -1;
  m.x += m.dir * step;
  return false;
}

/** Where someone is seen, up the keep (their floor and how far up the stairs), or null on the ground outside. */
export const heightOf = (m: Climber) => (m.floor ?? 0) + (m.climb ?? 0);

/** The castle's rooms (built or being built). */
export const rooms = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.room);

/** How many of the keep's tiles a floor has rooms on. */
export function floorFill(s: Pick<GameState, 'buildings'>, floor: number): number {
  return rooms(s)
    .filter((b) => (b.floor ?? 0) === floor)
    .reduce((n, b) => n + BUILDING_BY_ID[b.def].width, 0);
}

/** The floors a new room may go on now: the ground floor, and each floor up while the one below is mostly built. */
export function openFloors(s: GameState): number[] {
  const out = [0];
  for (let f = 1; f < CASTLE_FLOORS && floorFill(s, f - 1) >= floorRoom(s, f - 1) * FLOOR_BELOW; f++) out.push(f);
  return out;
}

/** How tall the keep stands: its top floor with a room on it, plus one. */
export const castleFloors = (s: Pick<GameState, 'buildings'>) => (rooms(s).length ? Math.max(...rooms(s).map((b) => b.floor ?? 0)) + 1 : 0);

/** The castle room someone is in, working or sleeping (drawn inside it, up on its floor). */
export function roomOf(s: GameState, p: Person): Building | undefined {
  const t = p.task;
  if (!t) return undefined;
  const id =
    'building' in t && typeof t.building === 'number' ? t.building : t.type === 'research' ? t.station : t.type === 'shelter' ? p.bed : null;
  // (a crafter works at the order's station)
  const order = t.type === 'craft' ? s.crafting.find((o) => o.id === t.order) : undefined;
  const station = order ? ITEM_BY_ID[order.item]?.station : undefined;
  const b = id != null ? s.buildings.find((q) => q.id === id) : station ? s.buildings.find((q) => q.def === station && q.status === 'done') : undefined;
  if (!b?.room || floorOf(b) !== (p.floor ?? 0)) return undefined;
  const half = (BUILDING_BY_ID[b.def].width * TILE) / 2;
  return Math.abs(p.x - (b.tile * TILE + half)) <= half ? b : undefined;
}

/** A castle town's buildings in the keep from before it was a castle (older saves) become its ground floor. */
export function adoptRooms(s: GameState): void {
  if (!castleOn(s)) return;
  const [lo, hi] = castleSpan(s);
  for (const b of s.buildings) {
    const def = BUILDING_BY_ID[b.def];
    if (b.room || !roomKind(s, def) || b.tile < lo || b.tile + def.width > hi) continue;
    b.room = true;
    b.floor = 0;
  }
}
