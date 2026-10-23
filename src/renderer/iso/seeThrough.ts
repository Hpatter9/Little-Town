// Seeing people behind things (the owner's ask: a tree, a building, a wall or a big prop fades when someone stands
// behind it, so they show). The pure rules, no Pixi and no page, so the tests can check them: which pictures count as
// people (`markWalker`: townsfolk, the founder, the great creature, raiders, wildlife, pets and herds mark their own
// body sprites), when a person is behind a picture (drawn before it and overlapping it), how fast a picture fades and
// how far, and a grid of the pictures' boxes so each frame looks only at the pictures near someone.
// iso/isoView.ts `seeThrough` does the drawing.

/** How far a picture fades with someone behind it (its alpha), and how far a picture that is picked (its tap card
 *  open) fades, so it still reads plainly. */
export const SEE_ALPHA = 0.4;
export const PICKED_ALPHA = 0.7;
/** Seconds a fade takes, in or out. */
export const FADE_SECONDS = 0.2;

/** A box on the screen (iso px): left, top, right, bottom. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The part of a picture's box that hides what is behind it: its sides and foot trimmed, since a picture's corners are
 *  mostly empty (a tree's canopy is round; a building's foot is the diamond of ground it stands on). */
export function coverBox(b: Box): Box {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  return { x0: b.x0 + w * 0.14, y0: b.y0 + h * 0.06, x1: b.x1 - w * 0.14, y1: b.y1 - h * 0.14 };
}

/** The part of a person's box that must be hidden for them to count as behind: their body, not the frame's empty
 *  sides nor the shadow at their feet. */
export function bodyBox(b: Box): Box {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  return { x0: b.x0 + w * 0.2, y0: b.y0 + h * 0.1, x1: b.x1 - w * 0.2, y1: b.y1 - h * 0.15 };
}

export const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Is a person (their box and draw order) behind a picture (its cover box and draw order)? Drawn before it, and
 *  their body overlapping it. */
export const behind = (person: Box, pz: number, cover: Box, cz: number): boolean => pz < cz && overlaps(bodyBox(person), cover);

/** A fade's progress, 0 (clear) to 1 (faded), a step on: towards 1 while someone is behind, back to 0 after. */
export function fadeStep(fade: number, someone: boolean, dt: number): number {
  const d = dt / FADE_SECONDS;
  return someone ? Math.min(1, fade + d) : Math.max(0, fade - d);
}

/** The share of its alpha a picture keeps at a fade's progress, eased in and out. */
export function fadeAlpha(fade: number, picked: boolean): number {
  const s = fade * fade * (3 - 2 * fade);
  return 1 - (1 - (picked ? PICKED_ALPHA : SEE_ALPHA)) * s;
}

/** The pictures that are people (their body sprites, marked by whoever draws them). Weak: a picture gone is forgotten. */
const walkers = new WeakSet<object>();
export const markWalker = (o: object): void => void walkers.add(o);
export const isWalker = (o: object): boolean => walkers.has(o);

/** Boxes by the grid squares they touch (`GRID` px), so a person's box is checked against the pictures near it only. */
export const GRID = 96;
export class BoxGrid {
  private readonly cells = new Map<number, number[]>();
  private static key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }
  clear(): void {
    this.cells.clear();
  }
  /** Put box number `i` in. */
  add(i: number, b: Box): void {
    for (let cy = Math.floor(b.y0 / GRID); cy <= Math.floor(b.y1 / GRID); cy++)
      for (let cx = Math.floor(b.x0 / GRID); cx <= Math.floor(b.x1 / GRID); cx++) {
        const k = BoxGrid.key(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(i);
        else this.cells.set(k, [i]);
      }
  }
  /** The numbers of the boxes in the squares a box touches (a box in several squares comes up once). */
  near(b: Box, out: Set<number>): Set<number> {
    out.clear();
    for (let cy = Math.floor(b.y0 / GRID); cy <= Math.floor(b.y1 / GRID); cy++)
      for (let cx = Math.floor(b.x0 / GRID); cx <= Math.floor(b.x1 / GRID); cx++) {
        const list = this.cells.get(BoxGrid.key(cx, cy));
        if (list) for (const i of list) out.add(i);
      }
    return out;
  }
}
