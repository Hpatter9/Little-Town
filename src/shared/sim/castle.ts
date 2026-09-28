// A castle town (the Blood Court: `castle` in data/origins.ts). Instead of spreading out, the town's buildings are
// rooms of one castle, stacked floor on floor over the camp: a room goes on the ground floor while there's space,
// then on the next floor up once the one below is mostly built. Yards, fields, mines, graveyards and walls stay
// outside, and when the keep is full the town builds on outside too. The renderer draws the keep round its rooms
// (renderer/art/castle.ts), and people climb to the room they're working in.

import { TILE } from '../constants';
import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { ITEM_BY_ID } from '../data/items';
import { rulesOf } from '../data/origins';
import { campX, type Building, type GameState, type Person } from './state';

/** The keep: this many tiles wide, over the camp, and at most this many floors. */
export const CASTLE_TILES = 16;
export const CASTLE_FLOORS = 5;
/** How it's drawn (px): each floor's height (a person stands 48 high), the towers past each end, the roof and spires
 *  over the top floor, and the plinth under the ground floor. The whole keep stands keepHeight() tall. */
export const ROOM_H = 56;
export const TOWER_W = 24;
export const ROOF_H = 58;
export const PLINTH = 4;
export const keepHeight = (floors: number) => floors * ROOM_H + PLINTH + ROOF_H + 26;
/** A floor is open to build on once the one below is at least this full. */
const FLOOR_BELOW = 0.5;
/** Built outside the keep, never as rooms. */
const OUTSIDE = new Set(['graveyard', 'well', 'mine', 'coal_mine', 'deep_mine', 'oil_derrick', 'stable', 'launch_site', 'drying_rack', 'tanning_rack']);

export const castleOn = (s: Pick<GameState, 'origin'>) => !!rulesOf(s).castle;

/** The keep's tiles: [lo, hi). */
export function castleSpan(s: GameState): [number, number] {
  const lo = Math.floor(campX(s) / TILE) - CASTLE_TILES / 2;
  return [lo, lo + CASTLE_TILES];
}

/** Whether a kind of building goes inside, as a room. */
export const roomKind = (s: Pick<GameState, 'origin'>, def: BuildingDef) => castleOn(s) && def.layer === 'mid' && !OUTSIDE.has(def.id) && def.width <= CASTLE_TILES;

/** The castle's rooms (built or being built). */
export const rooms = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.room);

/** How many of the keep's tiles a floor has rooms on. */
export function floorFill(s: Pick<GameState, 'buildings'>, floor: number): number {
  return rooms(s)
    .filter((b) => (b.floor ?? 0) === floor)
    .reduce((n, b) => n + BUILDING_BY_ID[b.def].width, 0);
}

/** The floors a new room may go on now: the ground floor, and each floor up while the one below is mostly built. */
export function openFloors(s: Pick<GameState, 'buildings'>): number[] {
  const out = [0];
  for (let f = 1; f < CASTLE_FLOORS && floorFill(s, f - 1) >= CASTLE_TILES * FLOOR_BELOW; f++) out.push(f);
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
  if (!b?.room) return undefined;
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
