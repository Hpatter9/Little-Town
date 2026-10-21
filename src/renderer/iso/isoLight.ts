// The isometric view's night, doors and gates: the pure rules (no Pixi, no page), so the tests can check them.
// The top-down light map (map/lightMap.ts) is worked out on the land in world px; the iso view lays that same picture
// over the diamonds through one affine map (`worldMatrix`), so the light field is reused as it is.

import { CELL } from '../../shared/sim/land';
import { ISO_TH, ISO_TW, isoToWorld, type Pt, type Rect } from './isoMath';

/** The matrix (Pixi's a, b, c, d, tx, ty) taking world px to the iso view's px: x' = a x + c y + tx, y' = b x + d y + ty. */
export function worldMatrix(ox: number): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  const kx = ISO_TW / 2 / CELL;
  const ky = ISO_TH / 2 / CELL;
  return { a: kx, b: ky, c: -kx, d: ky, tx: ox, ty: 0 };
}

/** The square of world px that covers a screen view (iso px) whatever the diamonds' slant: the light map is laid over
 *  all of it, so no corner of the screen is left lit like day. */
export function lightBox(view: Rect, ox: number): Rect {
  const mid = isoToWorld(view.x + view.w / 2, view.y + view.h / 2, ox);
  // (a screen offset (dx, dy) is world (dx / 24 + dy / 12) / 2 * CELL px in x: at most w / 3 + h * 2 / 3 px from the middle)
  const half = Math.ceil(view.w / 3 + (view.h * 2) / 3 + CELL);
  return { x: mid.x - half, y: mid.y - half, w: half * 2, h: half * 2 };
}

/** Roles that have lit windows after dark. */
const WINDOWED = new Set(['cottage', 'longhouse', 'tavern', 'chapel', 'workshop', 'granary', 'market']);
export const hasWindows = (role: string): boolean => WINDOWED.has(role);

/** Where a building's windows glow, as cells (fractions): along its front faces (+y and +x), at the wall's height
 *  above them (`lift`, px). Beside the door (the middle of the +y face) rather than on it. */
export function windowSpots(f: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const along = (n: number) => (n >= 2 ? [0.2, 0.8] : [0.5]);
  for (const t of along(f.w)) out.push({ x: f.x + f.w * t, y: f.y + f.h });
  for (const t of along(f.h)) out.push({ x: f.x + f.w, y: f.y + f.h * t });
  return out;
}

/** A building's door, in cells: the middle of its front (+y) edge, as the townsfolk reckon it (map/workSeen.ts). */
export const doorSpot = (f: Rect): Pt => ({ x: f.x + f.w / 2, y: f.y + f.h });

/** A gate's opening: the run's direction (true: along x) and its middle, in cells. */
export function gateSpan(f: Rect): { alongX: boolean; mid: Pt } {
  return { alongX: f.w >= f.h, mid: { x: f.x + f.w / 2, y: f.y + f.h / 2 } };
}

/** Is anyone (world px) within `reach` cells of a point (cells)? */
export function anyoneNear(who: readonly Pt[], at: Pt, reach: number): boolean {
  const r2 = reach * reach * CELL * CELL;
  const ax = at.x * CELL;
  const ay = at.y * CELL;
  for (const p of who) if ((p.x - ax) * (p.x - ax) + (p.y - ay) * (p.y - ay) <= r2) return true;
  return false;
}

/** How far open a door or gate is, 0 to 1: it swings open quickly when someone is near, and closes behind them
 *  after `HOLD` seconds without anyone, more slowly. */
export const OPEN_RATE = 6;
export const CLOSE_RATE = 2.5;
export const HOLD = 0.9;
export function swing(open: number, held: number, near: boolean, dt: number): { open: number; held: number } {
  if (near) return { open: Math.min(1, open + OPEN_RATE * dt), held: HOLD };
  if (held > 0) return { open, held: Math.max(0, held - dt) };
  return { open: Math.max(0, open - CLOSE_RATE * dt), held: 0 };
}
