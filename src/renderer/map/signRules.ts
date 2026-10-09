// Where the crossroads' signposts stand and what their boards say (map/signposts.ts draws them), as pure rules: at the
// town's crossroads (a road cell with roads on three or four sides), a board for each way out naming the country it
// heads toward (the land's regions: sim/landRegions.ts) and any rival town that lies that way on the world map
// (the realm's powers, data/factions.ts).

import { STRONGHOLD_SPOTS } from '../../shared/data/factions';
import { MAP_HOME } from '../../shared/data/worldMap';
import { isRoad, type LandMap } from '../../shared/sim/land';

/** The most signposts, how far apart they stand (cells), and how near the fire none stands (cells). */
export const SIGNS_MOST = 5;
export const SIGN_APART = 7;
export const SIGN_NEAR_CAMP = 3;
/** How far off a road's way a place may lie and still be named on its board (radians). */
export const SIGN_SPREAD = Math.PI / 3.2;

/** A board: the way it points (a compass word and whether it points left or right on the post) and what it names. */
export interface Board {
  dx: number;
  dy: number;
  dir: string;
  names: string[];
}

export interface Signpost {
  /** The crossroads (cells), and the cell beside it the post stands on. */
  x: number;
  y: number;
  postX: number;
  postY: number;
  boards: Board[];
}

/** Somewhere a board may name: where it lies (cells on the land, or any frame: only the bearing counts) and its name. */
export interface Place {
  name: string;
  /** Its bearing from the town (radians, 0 east, growing clockwise as y runs down), or null to take it from x, y. */
  bearing: number | null;
  x: number;
  y: number;
  /** Rival towns get a board line of their own, after the country's name. */
  town: boolean;
}

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** The compass word for a way (dx, dy, y down). */
export function compass(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx);
  return COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** The smallest turn between two bearings (radians). */
const turn = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

/** The crossroads a signpost stands at: road cells with roads on three or four sides, inside the known land, not
 *  near the fire, `SIGN_APART` apart, the nearest the fire first; each with a free cell beside it for the post. */
export function crossroads(land: LandMap, free: (x: number, y: number) => boolean): { x: number; y: number; postX: number; postY: number; legs: [number, number][] }[] {
  const out: { x: number; y: number; postX: number; postY: number; legs: [number, number][] }[] = [];
  const c = land.camp;
  const r = land.open;
  const found: { x: number; y: number; d: number; legs: [number, number][] }[] = [];
  for (let y = Math.max(0, c.y - r); y <= Math.min(land.h - 1, c.y + r); y++)
    for (let x = Math.max(0, c.x - r); x <= Math.min(land.w - 1, c.x + r); x++) {
      if (!isRoad(land, x, y)) continue;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < SIGN_NEAR_CAMP) continue;
      const legs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([dx, dy]) => isRoad(land, x + dx, y + dy));
      if (legs.length >= 3) found.push({ x, y, d, legs });
    }
  found.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const f of found) {
    if (out.length >= SIGNS_MOST) break;
    if (out.some((o) => Math.hypot(o.x - f.x, o.y - f.y) < SIGN_APART)) continue;
    // (the post on a corner of the crossroads off the road, the south-west first so it stands before the way)
    const spot = ([[-1, 1], [1, 1], [-1, -1], [1, -1]] as [number, number][]).find(([dx, dy]) => !isRoad(land, f.x + dx, f.y + dy) && free(f.x + dx, f.y + dy));
    if (!spot) continue;
    out.push({ x: f.x, y: f.y, postX: f.x + spot[0], postY: f.y + spot[1], legs: f.legs });
  }
  return out;
}

/** The boards for a crossroads' ways out: each names the country lying most nearly its way (within `SIGN_SPREAD`;
 *  the nearer of two equally near), and the rival towns that way. A way with nothing to name has no board. */
export function boardsFor(at: { x: number; y: number }, legs: [number, number][], places: readonly Place[]): Board[] {
  const out: Board[] = [];
  for (const [dx, dy] of legs) {
    const way = Math.atan2(dy, dx);
    const names: string[] = [];
    let best: { p: Place; off: number; far: number } | null = null;
    for (const p of places) {
      if (p.town) continue;
      const off = turn(way, Math.atan2(p.y - at.y, p.x - at.x));
      const far = Math.hypot(p.x - at.x, p.y - at.y);
      if (off > SIGN_SPREAD) continue;
      if (!best || off + far / 400 < best.off + best.far / 400) best = { p, off, far };
    }
    if (best) names.push(best.p.name);
    for (const p of places) if (p.town && p.bearing !== null && turn(way, p.bearing) <= SIGN_SPREAD / 1.5) names.push(p.name);
    if (names.length) out.push({ dx, dy, dir: compass(dx, dy), names });
  }
  return out;
}

/** A rival town's bearing from home on the world map (radians, y down), or null for a power with no stronghold spot. */
export function townBearing(faction: string): number | null {
  const s = STRONGHOLD_SPOTS[faction];
  return s ? Math.atan2(s.y - MAP_HOME.y, s.x - MAP_HOME.x) : null;
}
