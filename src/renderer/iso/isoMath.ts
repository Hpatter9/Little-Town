// The isometric view's geometry (iso/isoView.ts): the land's cells laid as a 2:1 diamond grid. Pure functions only (no
// Pixi, no page), so the tests can check them.
//
// A cell (tx, ty) is a diamond ISO_TW wide and ISO_TH tall. Its top corner is at (ox + (tx - ty) * ISO_TW / 2,
// (tx + ty) * ISO_TH / 2): a step along the land's x goes down and right on the screen, a step along y down and left.
// `ox` is the land's top corner, pushed right so the whole land sits at x >= 0 (`isoOrigin`). The sim's world px
// (CELL to a cell, sim/land.ts) are turned into cells first, so anything placed in world px can be placed here too.

import { CELL } from '../../shared/sim/land';

/** One cell's diamond on the screen (px, before any zoom): 2:1. Half the kits' own art size (iso/isoKits.ts
 *  `ISO_ART`), so a 3x2 cottage comes out 120 px wide and the townsfolk keep their size from the top-down view. */
export const ISO_TW = 48;
export const ISO_TH = ISO_TW / 2;

export interface Pt {
  x: number;
  y: number;
}

/** The x of the land's top corner (cell 0, 0), so the land's left corner (0, h) lands at x = 0. */
export const isoOrigin = (landH: number): number => (landH * ISO_TW) / 2;

/** The whole land's bounding box on the screen (px). */
export const isoBounds = (landW: number, landH: number): { w: number; h: number } => ({ w: ((landW + landH) * ISO_TW) / 2, h: ((landW + landH) * ISO_TH) / 2 });

/** A point on the land, in cells (fractions allowed: (tx + 0.5, ty + 0.5) is a cell's middle), to the screen. */
export const tileToIso = (tx: number, ty: number, ox: number): Pt => ({ x: ox + ((tx - ty) * ISO_TW) / 2, y: ((tx + ty) * ISO_TH) / 2 });

/** The screen to the land, in cells (fractions kept): the ground point under (sx, sy). */
export function isoToTile(sx: number, sy: number, ox: number): Pt {
  const a = (sx - ox) / (ISO_TW / 2);
  const b = sy / (ISO_TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The sim's world px (top-down) to the screen, and back. */
export const worldToIso = (wx: number, wy: number, ox: number): Pt => tileToIso(wx / CELL, wy / CELL, ox);
export function isoToWorld(sx: number, sy: number, ox: number): Pt {
  const t = isoToTile(sx, sy, ox);
  return { x: t.x * CELL, y: t.y * CELL };
}

/** The draw order of something standing at a point of the land (in cells): further back (smaller) first. */
export const pointDepth = (tx: number, ty: number): number => tx + ty;

/** A footprint (cells), as the sim gives it (sim/buildings.ts `footprint`). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The draw order of a building on its footprint: by its front corner, so whatever stands behind it (smaller x or
 *  smaller y, within it) is drawn first. Something in front of it is lifted over it by `standingDepth`. */
export const footDepth = (f: Rect): number => f.x + f.w + f.y + f.h;

/** The draw order of something standing at (tx, ty) among the buildings: its own point's, lifted just over any
 *  building near it that it stands in front of (past its far x or far y edge), which a point's depth alone can put
 *  it behind (in front of the middle of a long building's face). */
export function standingDepth(tx: number, ty: number, near: readonly Rect[]): number {
  let d = pointDepth(tx, ty);
  for (const f of near) {
    if (tx < f.x - 1 || ty < f.y - 1 || tx > f.x + f.w + 1 || ty > f.y + f.h + 1) continue;
    if (tx >= f.x + f.w || ty >= f.y + f.h) d = Math.max(d, footDepth(f) + 0.01);
  }
  return d;
}

/** The screen point a building's picture stands on: the middle of its footprint across, its front corner down. */
export function footBase(f: Rect, ox: number): Pt {
  const mid = tileToIso(f.x + f.w / 2, f.y + f.h / 2, ox);
  const front = tileToIso(f.x + f.w, f.y + f.h, ox);
  return { x: mid.x, y: front.y };
}

/** The diamond a footprint covers is this wide on the screen. */
export const footWidth = (f: Rect): number => ((f.w + f.h) * ISO_TW) / 2;

/** The cells to draw for a view (screen px: its top-left and size), padded by `pad` cells, clamped to the land:
 *  the range of cells whose diamonds can touch the view. */
export function cellsInView(view: { x: number; y: number; w: number; h: number }, ox: number, landW: number, landH: number, pad = 2): { x0: number; y0: number; x1: number; y1: number } {
  const corners = [isoToTile(view.x, view.y, ox), isoToTile(view.x + view.w, view.y, ox), isoToTile(view.x, view.y + view.h, ox), isoToTile(view.x + view.w, view.y + view.h, ox)];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs)) - pad),
    y0: Math.max(0, Math.floor(Math.min(...ys)) - pad),
    x1: Math.min(landW - 1, Math.ceil(Math.max(...xs)) + pad),
    y1: Math.min(landH - 1, Math.ceil(Math.max(...ys)) + pad),
  };
}

/** How many cells across one of a kit's ground tiles covers: its `scale_tile` drawn at the kit's scale (and the
 *  view's art size), in cells, at least one. */
export const kitTileCells = (scaleTileW: number, kitScale: number, art: number): number => Math.max(1, Math.round((scaleTileW * kitScale * art) / ISO_TW));

/** A picture's ground (its plinth's top face) by three of its corners in the picture's px: the left, the front (bottom)
 *  and the right one, as drawn (unmirrored). */
export type GroundCorners = readonly [readonly [number, number], readonly [number, number], readonly [number, number]];

/** The transform that lays a picture's plinth exactly over a footprint's diamond, for a picture drawn a little off the
 *  grid's angle (the archery range: its long side drawn steeper than the diamonds'). Upright things stay upright: only
 *  the across scale, a squash of the heights and a slant of the ground are used (x' = a x, y' = b x + d y), so the
 *  pixel art's posts and targets don't lean. From the picture's px to the screen, relative to the footprint's front
 *  corner; `flip` mirrors the picture first (a piece lying along y on a footprint longer along x). */
export function groundFit(g: GroundCorners, texW: number, foot: { w: number; h: number }, flip: boolean): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  const [l, f, r] = flip ? [[texW - g[2][0], g[2][1]], [texW - g[1][0], g[1][1]], [texW - g[0][0], g[0][1]]] : g;
  // (left to front runs along x, `w` cells; front to right up along y, `h` cells)
  const u1 = [f[0] - l[0], f[1] - l[1]];
  const u2 = [r[0] - f[0], r[1] - f[1]];
  const ys = [(foot.w * ISO_TH) / 2, (-foot.h * ISO_TH) / 2];
  const a = ((foot.w + foot.h) * ISO_TW) / 2 / (r[0] - l[0]);
  const det = u1[0] * u2[1] - u1[1] * u2[0];
  const b = (ys[0] * u2[1] - u1[1] * ys[1]) / det;
  const d = (u1[0] * ys[1] - u2[0] * ys[0]) / det;
  // (the front corner on the footprint's front corner)
  const x = flip ? -a : a;
  const bx = flip ? -b : b;
  const tx = flip ? a * (texW - f[0]) : -a * f[0];
  const ty = flip ? b * (texW - f[0]) - d * f[1] : -b * f[0] - d * f[1];
  return { a: x, b: bx, c: 0, d, tx, ty };
}
