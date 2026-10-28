// The grid audit (docs/notes/grid-audit.md): how a picture's own drawn ground sits against the cells it is given. Pure
// (no Pixi, no page): the tool `tools/grid-audit.mjs` runs it over the PNGs, and the view's debug overlay
// (iso/isoView.ts `setGridDebug`) over the textures it has loaded.
//
// Every kit piece stands on its own little plinth: a grass diamond with a slab of soil under it, drawn 2:1 like the
// view's cells. `measureBase` finds that plinth from the picture's alpha: its front (lowest) corner, its left and right
// corners and the slab's thickness. From those, how many cells along x and along y the picture was drawn for.

import { ISO_TH, ISO_TW } from './isoMath';

export interface Pt {
  x: number;
  y: number;
}

/** What a picture's alpha says about its ground (px of the picture, y down; `y1` is the last opaque row). */
export interface ArtBase {
  /** The opaque box. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The plinth's front corner (the bottom of its slab), its left and right corners (the bottom of the slab there). */
  front: Pt;
  left: Pt;
  right: Pt;
  /** The slab's thickness (px): the ground's top face stands this far above `front`. */
  slab: number;
}

/** A pixel counts as drawn from this alpha (0..255). */
const SOLID = 24;

/**
 * The picture's plinth, from its alpha (`alpha(x, y)` 0..255). The front corner is the middle of the lowest row; the
 * side corners are where the lower edges, walked up from the front, stop reaching out (the slab's upright side) before
 * the top face's edges turn back in. A picture with no plinth (a tree, a lamp) gives its trunk's foot for all three.
 */
export function measureBase(alpha: (x: number, y: number) => number, w: number, h: number): ArtBase | null {
  const L = new Array<number>(h).fill(-1);
  const R = new Array<number>(h).fill(-1);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) < SOLID) continue;
      if (L[y] < 0) L[y] = x;
      R[y] = x;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (y1 < 0) return null;
  const front = { x: (L[y1] + R[y1]) / 2, y: y1 };
  // (walk up a side: the edge reaches out two px a row on the plinth's lower edge, then stands still for the slab, then
  // turns back in on the top face; a barrel or a tuft on the edge is a bump of a few rows, let through)
  const side = (edge: number[], out: -1 | 1): { at: Pt; slab: number } => {
    let best = edge[y1];
    let at = y1;
    let still = 0;
    for (let y = y1 - 1; y >= y0 && y1 - y < w; y--) {
      if (edge[y] < 0) break;
      const reach = (edge[y] - best) * out;
      if (reach > 0) {
        best = edge[y];
        at = y;
        still = 0;
      } else if (reach < -6 || ++still > 40) break;
    }
    let slab = 0;
    for (let y = at - 1; y >= y0 && Math.abs(edge[y] - best) <= 1; y--) slab++;
    return { at: { x: best, y: at }, slab };
  };
  const l = side(L, -1);
  const r = side(R, 1);
  return { x0, y0, x1, y1, front, left: l.at, right: r.at, slab: Math.round((l.slab + r.slab) / 2) };
}

/** A building's picture is drawn at most this much wider than its footprint (iso/isoView.ts). */
export const OVERHANG = 1.25;

/** The scale a building's picture is drawn at (iso/isoView.ts `syncBuildings`): a fitted piece (walls, gates, the shared
 *  pieces) to its footprint's width; any other at its kit's size, shrunk only when it would overhang by more than
 *  `OVERHANG`. */
export const pictureScale = (fit: boolean, kitScale: number, span: number, texW: number): number => (fit ? span / texW : Math.min(kitScale, (span * OVERHANG) / texW));

/** How a picture of a building sits on its footprint, in the view's px and cells (all from `measureBase`). */
export interface Fit {
  /** Cells along x and along y the picture's plinth covers, as drawn (after the scale and any mirroring). */
  artW: number;
  artH: number;
  /** The footprint's cells. */
  footW: number;
  footH: number;
  /** Px the picture's ground (its plinth's top face) stands above the footprint's ground: + floats, - sinks. */
  lift: number;
  /** Px the picture's front corner stands right of the footprint's (- left). */
  shiftX: number;
  /** The picture's width on the screen over the footprint's diamond's (1: the same). */
  spread: number;
  /** How far the picture rises above its footprint's back corner, in cell heights (ISO_TH px each): how many rows of
   *  cells behind it it covers. */
  rows: number;
}

/**
 * The fit of a picture (`tex` px, its plinth `base`) drawn at scale `k` (mirrored when `flip`) with its bottom middle on
 * the footprint's `footBase` (the footprint's middle across, its front corner down): as iso/isoView.ts draws it.
 */
export function fitOf(base: ArtBase, texW: number, texH: number, k: number, flip: boolean, foot: { w: number; h: number }): Fit {
  const half = ISO_TW / 2;
  const sx = flip ? -1 : 1;
  // (the picture's points relative to its anchor, the bottom middle, in view px)
  const px = (x: number) => (x + 0.5 - texW / 2) * k * sx;
  const py = (y: number) => (y + 1 - texH) * k;
  const fx = px(base.front.x);
  const lx = px(flip ? base.right.x : base.left.x);
  const rx = px(flip ? base.left.x : base.right.x);
  // (the footprint: its middle across is the anchor's x; its front corner is (w - h) / 2 half-cells right of that)
  const footFront = ((foot.w - foot.h) / 2) * half;
  const ground = py(base.front.y) - base.slab * k;
  return {
    artW: (fx - lx) / half,
    artH: (rx - fx) / half,
    footW: foot.w,
    footH: foot.h,
    lift: -ground,
    shiftX: fx - footFront,
    spread: ((base.x1 - base.x0 + 1) * k) / ((foot.w + foot.h) * half),
    rows: (ground - py(base.y0) - (foot.w + foot.h) * (ISO_TW / 4)) / ISO_TH,
  };
}

/** The footprint's own diamond on the screen relative to its `footBase` (px): its back, right, front and left corners. */
export function footDiamond(foot: { w: number; h: number }): Pt[] {
  const half = ISO_TW / 2;
  const q = ISO_TW / 4;
  return [
    { x: (-(foot.w - foot.h) / 2) * half, y: -(foot.w + foot.h) * q },
    { x: ((foot.w + foot.h) / 2) * half, y: -foot.h * q },
    { x: ((foot.w - foot.h) / 2) * half, y: 0 },
    { x: (-(foot.w + foot.h) / 2) * half, y: -foot.w * q },
  ];
}
