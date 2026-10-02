// A castle town (the Blood Court: `castle` in data/origins.ts). Instead of a town of separate buildings, its
// buildings are rooms of one castle, one level, standing on the keep's ground over the camp: a rectangle of the
// land that grows with each era, and rooms are added inside it as the town grows. Yards, fields, mines, graveyards
// and walls stay outside. When the keep is full the town waits for the next era. The renderer draws the keep's
// walls round its rooms.

import { ERAS, type Era } from '../data/eras';
import type { BuildingDef } from '../data/buildings';
import { rulesOf } from '../data/origins';
import { overlaps, type Rect } from './land';
import { demolish, footprint } from './buildings';
import { campCell, type Building, type GameState } from './state';

/** The keep's ground: this many cells wide and deep at first, over the camp, and this much more each era; and a wing
 *  (`WING_W` wider, `WING_H` deeper) whenever its rooms need the room, up to `KEEP_MAX`. */
export const CASTLE_TILES = 12;
export const CASTLE_DEPTH = 8;
export const CASTLE_GROWS = 4;
export const WING_W = 2;
export const WING_H = 1;
export const KEEP_MAX = { w: 40, h: 26 };
/** How it's drawn (px): a room's height, the towers past each end, the roof and spires, the plinth under it all. */
export const ROOM_H = 56;
export const TOWER_W = 24;
export const ROOF_H = 96;
export const PLINTH = 4;
export const keepHeight = (floors: number) => floors * ROOM_H + PLINTH + ROOF_H + 26;
/** Built outside the keep, never as rooms. */
const OUTSIDE = new Set(['graveyard', 'mine', 'coal_mine', 'deep_mine', 'oil_derrick', 'launch_site']);

export const castleOn = (s: Pick<GameState, 'origin'>) => !!rulesOf(s).castle;

/** How many cells wide (and deep) the keep stands in an era. */
export const castleWidth = (era: Era) => CASTLE_TILES + CASTLE_GROWS * Math.max(0, ERAS.indexOf(era));
export const castleDepth = (era: Era) => CASTLE_DEPTH + (CASTLE_GROWS / 2) * Math.max(0, ERAS.indexOf(era));

/** The keep's ground, in cells, centred on the camp: its era's size plus the wings it has grown. */
export function keepRect(s: Pick<GameState, 'era' | 'land' | 'nomad' | 'keepGrown'>): Rect {
  const c = campCell(s);
  const grown = s.keepGrown ?? 0;
  const w = Math.min(KEEP_MAX.w, castleWidth(s.era) + grown * WING_W);
  const h = Math.min(KEEP_MAX.h, castleDepth(s.era) + grown * WING_H);
  return { x: c.x - Math.floor(w / 2), y: c.y - Math.floor(h / 2), w, h };
}

/** Whether the keep can grow another wing. */
export const keepCanGrow = (s: Pick<GameState, 'era' | 'land' | 'nomad' | 'keepGrown'>) => {
  const r = keepRect(s);
  return r.w < KEEP_MAX.w || r.h < KEEP_MAX.h;
};

/** The keep grows a wing (the planner, when a room finds no place inside). */
export function growKeep(s: GameState): boolean {
  if (!keepCanGrow(s)) return false;
  s.keepGrown = (s.keepGrown ?? 0) + 1;
  s.land.version++;
  return true;
}

/** The keep's columns, [lo, hi), for the renderer. */
export function castleSpan(s: Pick<GameState, 'era' | 'land' | 'nomad' | 'keepGrown'>): [number, number] {
  const r = keepRect(s);
  return [r.x, r.x + r.w];
}

/** Whether a footprint lies wholly inside the keep. */
export function inKeep(s: Pick<GameState, 'era' | 'land' | 'nomad' | 'keepGrown'>, r: Rect): boolean {
  const k = keepRect(s);
  return r.x >= k.x && r.y >= k.y && r.x + r.w <= k.x + k.w && r.y + r.h <= k.y + k.h;
}

/** Whether a kind of building goes inside, as a room. */
export const roomKind = (s: Pick<GameState, 'origin'>, def: BuildingDef) => castleOn(s) && def.layer === 'mid' && !OUTSIDE.has(def.id) && def.width <= CASTLE_TILES;

/** The castle's rooms (built or being built). */
export const rooms = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.room);

/** How many of the keep's cells its rooms stand on. */
export function keepFill(s: Pick<GameState, 'buildings'>, footprint: (b: Building) => Rect): number {
  return rooms(s).reduce((n, b) => {
    const f = footprint(b);
    return n + f.w * f.h;
  }, 0);
}

/** Whether anything but a room stands on the keep's ground (the land under it must be cleared of it). */
export const onKeepGround = (s: Pick<GameState, 'era' | 'land' | 'nomad' | 'buildings' | 'keepGrown'>, footprint: (b: Building) => Rect) => s.buildings.filter((b) => !b.room && overlaps(keepRect(s), footprint(b)));

/** The keep has grown (a new era, or a wing): whatever stood on its new ground that isn't a room is cleared away, its
 *  materials back in store (the fire and the first stores at the camp stay). */
export function clearKeepGround(s: GameState): void {
  if (!castleOn(s)) return;
  for (const b of onKeepGround(s, footprint)) if (b.def !== 'campfire' && b.def !== 'stockpile') demolish(s, b.id);
}
