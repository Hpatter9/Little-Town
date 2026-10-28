// Which building a tap means on the isometric map (the owner's ask: "I click on a building and it thinks I'm clicking on
// the building next door"). A building's picture is mostly empty round its drawn shape (the corners beside the diamond,
// the sky over a low roof), and the front-most picture used to win wherever the finger fell in its box: a tap on the
// house behind, through the empty corner of the one in front, opened the front one's card. Now the art itself is tested:
// the front-most building whose art is solid under the finger wins; if none is, the front-most solid within a finger's
// width. The pure rule, no Pixi and no page, so the tests can check it: iso/isoView.ts `buildingAt` gives each picture's
// box and a way to read its art's opacity.

import type { Box } from './seeThrough';

/** A building's picture, as the tap sees it. */
export interface ArtBox extends Box {
  id: number;
  /** Its depth: the larger is drawn in front. */
  z: number;
  /** Drawn mirrored left to right. */
  flip: boolean;
  /** The art's opacity (0 to 255) at a point of it, `u` and `v` from 0 to 1 across and down the picture as it is
   *  unmirrored; null where the art can't be read (then the whole box counts). */
  alphaAt(u: number, v: number): number | null;
}

/** How opaque the art must be to count as hit (0 to 255): a faint shadow or glow round a building doesn't. */
export const SOLID_ALPHA = 40;
/** How far round the finger a tap still finds a building, when none is under it exactly (view px). */
export const TAP_SLOP = 8;

/** Whether the picture's art is solid at a point (view px). */
export function solidAt(b: ArtBox, x: number, y: number): boolean {
  if (x < b.x0 || x >= b.x1 || y < b.y0 || y >= b.y1) return false;
  const u = (x - b.x0) / (b.x1 - b.x0);
  const a = b.alphaAt(b.flip ? 1 - u : u, (y - b.y0) / (b.y1 - b.y0));
  return a === null || a >= SOLID_ALPHA;
}

/** The points tried round the finger, nearest first: the point itself, then rings at half and all of the slop. */
const ring = (f: number): [number, number][] => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos((i * Math.PI) / 4) * f, Math.sin((i * Math.PI) / 4) * f]);
const RINGS: [number, number][][] = [[[0, 0]], ring(0.5), ring(1)];

/** The building a tap at (x, y) picks: the front-most whose art is solid under the finger, else the front-most solid
 *  nearest round it; null if no art is there. */
export function pickArt(pics: readonly ArtBox[], x: number, y: number, slop = TAP_SLOP): number | null {
  for (const pts of RINGS) {
    let best: ArtBox | null = null;
    for (const b of pics) {
      if (best && b.z <= best.z) continue;
      if (pts.some(([dx, dy]) => solidAt(b, x + dx * slop, y + dy * slop))) best = b;
    }
    if (best) return best.id;
  }
  return null;
}
