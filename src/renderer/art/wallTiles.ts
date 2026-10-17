// The ring wall's pieces and its water grates laid by the piece each cell's neighbours make (art/autotile.ts): the
// owner's ask, that the walls and grates meet seamlessly round their many corners. Each set draws all sixteen pieces
// from its pack's own tiles (the Village pack's palisade, the Dungeon pack's stonework, DawnLike's fence set for the
// grates), as parts for map/packBuildings.ts to lay together. Pure: no Pixi, no DOM (the tests import it).

import palisade02 from './village/palisade02.png';
import palisade03 from './village/palisade03.png';
import palisade04 from './village/palisade04.png';
import palisade07 from './village/palisade07.png';
import palisade08 from './village/palisade08.png';
import palisade10 from './village/palisade10.png';
import palisade11 from './village/palisade11.png';
import palisade12 from './village/palisade12.png';
import palisade15 from './village/palisade15.png';
import palisade16 from './village/palisade16.png';
import palisade17 from './village/palisade17.png';
import palisade42 from './village/palisade42.png';
import dwalls from './village/dwalls.png';
import dlGrates from './packs/dl_grates.png';
import { E, N, S, W, pieceOf, readWallJoin, type Piece } from './autotile';

/** A part: an image at x, y (source px), the whole of it or a crop of it (sx, sy, sw, sh). */
export type Part = [string, number, number] | [string, number, number, number, number, number, number];
/** A piece's picture: its parts on a canvas `size` (source px), hanging `overhang` px over its cell each side. */
export interface TilePick {
  parts: Part[];
  size: [number, number];
  overhang: number;
}

/** The water grates where the ring wall crosses a river (`dl_grates.png`: DawnLike's fence set, cut by
 *  tools/compose-walls.cjs: a 16px cell per piece, a row per material, wooden, iron and pale): each grate by the
 *  pieces its neighbours of the ring make (art/autotile.ts), the set's own corners, T-joins and crossing; an end or
 *  a grate alone takes the straight run it lies in. */
export const GRATE_COL: Record<Piece, number> = { post: 1, n: 4, e: 1, s: 4, w: 1, ns: 4, ew: 1, es: 0, sw: 2, ne: 9, nw: 10, esw: 3, nes: 5, nesw: 6, nsw: 7, new: 8 };
export function grateTile(join: string, row: number): TilePick | null {
  const j = readWallJoin(join);
  if (!j) return null;
  return { parts: [[dlGrates, 0, 0, GRATE_COL[pieceOf(j.arms)] * 16, row * 16, 16, 16]], size: [16, 16], overhang: 0 };
}

/** The palisade by the pieces its neighbours make (art/autotile.ts), all laid from the Village pack's own tiles so
 *  that every two cells meet at their shared edge: a run along a row is the pack's run, two tiles tall (its pointed
 *  tops over the cell above); a half of it where the wall turns or a way joins; the pack's run ends where the wall
 *  stops; and wherever the wall goes on north or south, the pack's side-wall column of stakes (`palCol`, cut from its
 *  west wall) down the middle of the cell, standing before the runs it meets (as the pack's own corners have it),
 *  with a stake's point on top where nothing goes on north. All down the middle, so the corners of a stepped wall
 *  (a star fort's bastions, a round ring) meet the next step's, and the line reads as one. A side capped against a
 *  water grate ends at the cell's edge in a column of stakes, so the grate meets a proper end of the wall. */
const PAL_TOPS = [palisade02, palisade03, palisade04];
const PAL_FEET = [palisade10, palisade11, palisade12];
/** Where the column of stakes stands in its cell (x), and its crop of the pack's west wall (Tile2_17: x 5, 13 wide). */
const PAL_COL_X = 9;
const palCol = (x: number, y: number): Part => [palisade17, x, y, 5, 0, 13, 32];
export function palisadeTile(join: string, id = 0): TilePick | null {
  const j = readWallJoin(join);
  if (!j) return null;
  const m = j.arms;
  const top = PAL_TOPS[id % 3];
  const foot = PAL_FEET[id % 3];
  const parts: Part[] = [];
  const h = m & (E | W);
  const v = m & (N | S);
  if (h === (E | W)) parts.push([top, 0, 0], [foot, 0, 32]);
  else if (h === E && !v) parts.push([palisade07, 0, 0], [palisade15, 0, 32]); // (the run's west end)
  else if (h === W && !v) parts.push([palisade08, 0, 0], [palisade16, 0, 32]); // (its east end)
  else {
    if (m & W) parts.push([top, 0, 0, 0, 0, 16, 32], [foot, 0, 32, 0, 0, 16, 32]);
    if (m & E) parts.push([top, 16, 0, 16, 0, 16, 32], [foot, 16, 32, 16, 0, 16, 32]);
  }
  if (v || !m) {
    parts.push(palCol(PAL_COL_X, 32));
    // (going on north: the column over the cell above too, before this cell's run tops, which would hide it)
    if (m & N) parts.push(palCol(PAL_COL_X, 0));
    else parts.push([palisade42, PAL_COL_X - 1, 20, 3, 0, 14, 14]); // (a stake's point on the column's top)
  }
  if (j.capped & W) parts.push(palCol(0, 32), [palisade42, 0, 20, 3, 0, 13, 14]);
  if (j.capped & E) parts.push(palCol(32 - 13, 32), [palisade42, 32 - 14, 20, 3, 0, 14, 14]);
  return { parts, size: [32, 64], overhang: 0 };
}

/** The stone wall by the pieces its neighbours make, laid from the Dungeon pack's own walls (`dwalls`): a wall along
 *  a row is the face of the pack's free-standing block (its cap, courses of stone and foot, the courses repeated to
 *  stand it taller than a person), cut clear of the column the pack draws over it, its rounded end where the wall
 *  stops; a wall down a column is the pack's narrow wall top (`STONE_STRIP`), seen from above, raised to the face's
 *  height, with the block's end face under its south end; where the two meet, the column passes over the face, as the
 *  pack's own crossing has it. All down the middle of the cell, so stepped corners meet. */
const STONE_H = 80;
/** The face's rows: [source y, canvas y, height] (the cap, courses, more courses, the foot with its shadow). */
const STONE_ROWS: [number, number, number][] = [
  [240, 1, 16],
  [250, 17, 24],
  [250, 41, 12],
  [256, 53, 27],
];
/** The face's bricks repeat every 16 px from here (source x), and its outline either end. */
const STONE_FACE_X = 17;
const STONE_LEFT_X = 10; // (halo and outline, 3 px)
const STONE_RIGHT_X = 68;
/** The narrow wall top: source x, width, a 12-row stretch that repeats (every 4), and its rounded end. */
const STONE_STRIP: { x: number; w: number; y: number; h: number; capY: number; capH: number } = { x: 34, w: 13, y: 284, h: 12, capY: 203, capH: 5 };
/** Where the strip stands in its cell (x), and the face's top (the cap's outline) on the canvas. */
const STONE_COL_X = 9;
const STONE_TOP = 4;
export function stoneTile(join: string): TilePick | null {
  const j = readWallJoin(join);
  if (!j) return null;
  const m = j.arms;
  const parts: Part[] = [];
  /** The face from x0 to x1 (canvas), its rows from canvas y `from` down, with its ends' outlines where asked. */
  const face = (x0: number, x1: number, left: boolean, right: boolean, from = 0) => {
    for (const [sy, cy, h] of STONE_ROWS) {
      const skip = Math.max(0, from - cy);
      if (skip >= h) continue;
      const y = cy + skip;
      const yy = sy + skip;
      const hh = h - skip;
      for (let x = x0; x < x1; ) {
        const k = x % 16;
        const w = Math.min(x1 - x, 16 - k);
        parts.push([dwalls, x, y, STONE_FACE_X + k, yy, w, hh]);
        x += w;
      }
      if (left) parts.push([dwalls, x0 - 3, y, STONE_LEFT_X, yy, 3, hh]);
      if (right) parts.push([dwalls, x1, y, STONE_RIGHT_X, yy, 3, hh]);
    }
  };
  /** The narrow wall top from canvas y0 to y1, its rounded end on top if `cap`. */
  const strip = (y0: number, y1: number, cap: boolean) => {
    const t = STONE_STRIP;
    if (cap) {
      parts.push([dwalls, STONE_COL_X, y0, t.x, t.capY, t.w, t.capH]);
      y0 += t.capH;
    }
    for (let y = y0; y < y1; ) {
      const h = Math.min(y1 - y, t.h);
      parts.push([dwalls, STONE_COL_X, y, t.x, t.y, t.w, h]);
      y += h;
    }
  };
  const mid0 = STONE_COL_X + 3;
  const mid1 = STONE_COL_X + 10;
  const capW = !!(j.capped & W);
  const capE = !!(j.capped & E);
  const x0 = m & W ? (capW ? 3 : 0) : mid0;
  const x1 = m & E ? (capE ? 29 : 32) : mid1;
  const v = m & (N | S);
  if (m & (E | W)) {
    face(x0, x1, !(m & W) || capW, !(m & E) || capE);
    if (m & N) strip(0, m & S ? 32 : STONE_TOP + 4, false);
    else if (m & S) strip(STONE_TOP - 2, 32, true);
  } else if (v) {
    // (a wall down a column: its top, and its end face under it where it stops going south)
    strip(0, 32, !(m & N));
    if (!(m & S)) face(mid0, mid1, true, true, 32);
  } else face(mid0, mid1, true, true); // (a piece alone: a pillar of the block)
  return { parts, size: [32, STONE_H], overhang: 0 };
}
