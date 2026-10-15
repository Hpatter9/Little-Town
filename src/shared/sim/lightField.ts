// Where light reaches (the owner's ask: each light casts its light all round it as far as its kind reaches, and is
// stopped by buildings and walls, by trees and by rocks). Pure and shared: the sim reckons who works in the dark by it
// (sim/lighting.ts `litGrid`), and the map draws the night's light by it (renderer/map/lightMap.ts), so the two agree.
//
// The land is read into a grid of what stops light (`occluders`): a finished building that stands up (not a field, a
// pen, a trap or a yard lying flat: `flat`) and a castle's or hold's walls and the mountain stop it over their whole
// cells; a tree (a wood) or a rock stops it round its middle only (`ROUND_BLOCK`), so their shadows come out round.
// A light's reach (`lightSources`) is by its kind: the age's street light, the camp's fire and each fire or furnace
// (`FIRE_LIGHTS`). A point is lit by a light when it lies within the reach and the ray from the light to it meets
// nothing that stops it (`clearLine`): the light's own building and the point's own cell don't count, so a wall or a
// tree is lit on the side facing the light and throws its shadow behind.

import { BUILDING_BY_ID } from '../data/buildings';
import { CROPS } from '../data/crops';
import { FIRE_LIGHTS, LIGHT_KIND, LOW_BUILDINGS, ROUND_BLOCK } from '../data/lighting';
import { HERDS } from '../data/livestock';
import type { Era } from '../data/eras';
import { footprint } from './buildings';
import { groundAt, type LandMap, type Rect } from './land';
import type { Building } from './state';

/** How deep into a thing the light lights its face (cells). */
const FACE = 0.5;

/** What a cell does to light. */
export const OPEN = 0;
export const SOLID = 1;
export const ROUND = 2;

/** Does a finished building lie flat on the ground, so light passes over it? */
export function flat(b: Pick<Building, 'def'>): boolean {
  if (LOW_BUILDINGS.has(b.def) || CROPS[b.def] || HERDS[b.def]) return true;
  const def = BUILDING_BY_ID[b.def];
  // (a trap lies in the ground: its bite reaches no further than the cell it's on)
  return !!def?.defense && def.defense.range <= 16 && !def.defense.splash;
}

/** The land's grid of what stops light. `castle` is the cells of a castle or hold (its walls stop outdoor light). */
export function occluders(land: LandMap, buildings: readonly Building[], castle?: Iterable<number>): Uint8Array {
  const { w, h } = land;
  const grid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const g = groundAt(land, x, y);
      if (g === 'mountain') grid[y * w + x] = SOLID;
      else if (g === 'forest' || g === 'rock') grid[y * w + x] = ROUND;
    }
  for (const b of buildings) {
    if (b.status !== 'done' || b.room || flat(b)) continue;
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) grid[y * w + x] = SOLID;
  }
  if (castle) for (const i of castle) grid[i] = SOLID;
  return grid;
}

/** Does light pass from a to b (in cells)? The cells of `own` (the light's own building) and the light's own cell are
 *  seen through, and so is the last `FACE` of the way: a wall or a trunk is lit on the side facing the light, and dark
 *  on the far side and behind it. The ray is walked cell by cell (only the cells it crosses): a building, a wall or the
 *  mountain stops it anywhere in its cell, a tree or a rock only if it passes within `ROUND_BLOCK` of the middle. */
export function clearLine(occ: Uint8Array, w: number, h: number, ax: number, ay: number, bx: number, by: number, own?: Rect | null): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= FACE) return true;
  // (the part of the way that can be stopped: up to FACE short of b)
  const tEnd = 1 - FACE / d;
  let cx = Math.floor(ax);
  let cy = Math.floor(ay);
  const sx = cx;
  const sy = cy;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tmx = dx !== 0 ? (dx > 0 ? cx + 1 - ax : ax - cx) * tdx : Infinity;
  let tmy = dy !== 0 ? (dy > 0 ? cy + 1 - ay : ay - cy) * tdy : Infinity;
  let t0 = 0;
  while (t0 < tEnd) {
    const t1 = Math.min(tmx, tmy, 1);
    if (!(cx === sx && cy === sy) && cx >= 0 && cy >= 0 && cx < w && cy < h && !(own && cx >= own.x && cx < own.x + own.w && cy >= own.y && cy < own.y + own.h)) {
      const o = occ[cy * w + cx];
      if (o === SOLID) return false;
      if (o === ROUND) {
        // the nearest the way within this cell comes to its middle
        const lo = t0;
        const hi = Math.min(t1, tEnd);
        const mx = cx + 0.5 - ax;
        const my = cy + 0.5 - ay;
        const tc = Math.max(lo, Math.min(hi, (mx * dx + my * dy) / (d * d)));
        const ex = ax + dx * tc - cx - 0.5;
        const ey = ay + dy * tc - cy - 0.5;
        if (ex * ex + ey * ey < ROUND_BLOCK * ROUND_BLOCK) return false;
      }
    }
    if (t1 >= 1) break;
    if (tmx < tmy) {
      cx += stepX;
      tmx += tdx;
    } else {
      cy += stepY;
      tmy += tdy;
    }
    t0 = t1;
  }
  return true;
}

/** A light on the land: where (cells), how far it reaches (cells), its building (seen through), its colour and
 *  strength, and what it is. */
export interface LightSource {
  x: number;
  y: number;
  r: number;
  own: Rect | null;
  color: number;
  power: number;
  kind: string;
}

/** Flame and electric light. */
export const FLAME = 0xffc888;
export const ELECTRIC = 0xf0f4ff;

/** Every light burning out of doors: the street lights (cells; burning only), the camp's fire and the fires and
 *  furnaces at the town's finished buildings. Castle sconces are not here: they light their own rooms. */
export function lightSources(era: Era, streets: { x: number; y: number }[], buildings: readonly Building[], camp: { x: number; y: number }): LightSource[] {
  const kind = LIGHT_KIND[era] ?? LIGHT_KIND.neolithic;
  const out: LightSource[] = streets.map((l) => ({ x: l.x + 0.5, y: l.y + 0.5, r: kind.radius, own: null, color: kind.fuel ? FLAME : ELECTRIC, power: 1, kind: kind.name }));
  let fire = false;
  for (const b of buildings) {
    const f = FIRE_LIGHTS[b.def];
    if (!f || b.status !== 'done') continue;
    if (b.def === 'campfire') fire = true;
    const r = footprint(b);
    out.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: f.radius, own: r, color: f.color, power: f.power, kind: b.def });
  }
  if (!fire) {
    const f = FIRE_LIGHTS.campfire;
    out.push({ x: camp.x + 0.5, y: camp.y + 0.5, r: f.radius, own: null, color: f.color, power: f.power, kind: 'campfire' });
  }
  return out;
}

/** The share of a light that falls at a distance (cells): full by it, easing to nothing at its reach. */
export const falloff = (d: number, r: number) => (d >= r ? 0 : Math.pow(1 - d / r, 1.6));
