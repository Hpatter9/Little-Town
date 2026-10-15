// The ring wall going up, drawn as one work (the owner: "treat it like one large building, with its own look for a wall
// under construction"), not a construction site boxed round every one-cell piece. Each piece draws its own cell of one
// continuous line of works, from the wall's one progress (sim/ringWall.ts `syncRing`), and the cells follow on from one
// another because everything is set by the cell's own place on the line:
//   a surveyed line first (a shallow trench with a taut cord, a peg and a red flag every few cells),
//   then the footing along the whole ring, scaffolding poles every other cell with boards and a deck at the lift the
//   courses have reached, braces between the poles, a ladder here and there,
//   and the finished wall's courses rising behind it (the mask in map/mapView.ts), till the poles come down.
// A gate under construction is a frame: two posts and a lintel going up round the gap. The piles of timber and stone
// where the haulers drop their loads are the pack sprites (map/mapView.ts `stagingPile`); the rest is drawn here, as
// no pack in the project has scaffolding that joins end to end. Drawn in world px into the piece's own Graphics.

import type { Graphics } from 'pixi.js';
import type { Era } from '../../shared/data/eras';
import type { Tone } from './pixelArt';

export interface WallWorks {
  /** The piece's picture box (local px: the origin its top-left). */
  w: number;
  h: number;
  /** The wall's one progress (0..1). */
  progress: number;
  /** The piece's cell on the line, so the poles, braces and ladders fall in step from one piece to the next. */
  tile: number;
  row: number;
  era: Era;
  gate: boolean;
  /** A stone, brick or concrete wall (a footing of stone and steel poles in the later ages), not a palisade. */
  masonry: boolean;
}

/** Whether a cell of the line has a pole at each end of its stretch of scaffold (every other cell, so they run on). */
const POLE_EVERY = 2;
/** A ladder stands against every this-many cells of the line (by their place on it). */
export const LADDER_EVERY = 9;
/** A staging pile of materials (the haulers' drop) stands at every this-many cells (`stagingAt`). */
export const STAGING_EVERY = 8;

const cellKey = (tile: number, row: number) => tile * 7 + row * 13;
export const hasLadder = (tile: number, row: number) => ((cellKey(tile, row) % LADDER_EVERY) + LADDER_EVERY) % LADDER_EVERY === 0;
/** Whether a pile of materials stands at this cell of the line. */
export const stagingAt = (tile: number, row: number) => ((tile * 5 + row * 11) % STAGING_EVERY + STAGING_EVERY) % STAGING_EVERY === 3;

export function drawWallWorks(g: Graphics, a: WallWorks, tone: Tone): void {
  const c = (hex: string) => parseInt(tone(hex).slice(1, 7), 16);
  const rect = (x: number, y: number, w: number, h: number, hex: string, alpha = 1) => g.rect(x, y, w, h).fill({ color: c(hex), alpha });
  const line = (x0: number, y0: number, x1: number, y1: number, hex: string, width = 1) => g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: c(hex), width });
  const steel = a.era !== 'neolithic' && a.era !== 'medieval';
  const pole = steel ? '#8a94a0' : '#9a7448';
  const poleDark = steel ? '#4e565f' : '#634526';
  const board = '#c09058';
  const boardDark = '#7a5632';
  const { w, h, progress: p } = a;
  const ground = h;

  if (a.gate) {
    // the gate: a frame of two posts and a lintel, a gap between them, going up with the wall
    const top = Math.max(6, Math.round(h * Math.min(1, p + 0.2)));
    rect(0, ground - 2, w, 2, '#5a4630', 0.6);
    for (const x of [0, w - 3]) {
      rect(x, ground - top, 3, top, pole);
      rect(x + 2, ground - top, 1, top, poleDark);
    }
    if (p > 0.45) {
      rect(0, ground - top, w, 3, board);
      rect(0, ground - top + 3, w, 1, boardDark);
    }
    // (a pair of braces holding the frame while it's raised)
    line(3, ground - 3, 3 + Math.min(10, w / 4), ground - Math.max(8, top * 0.6), poleDark, 1);
    line(w - 3, ground - 3, w - 3 - Math.min(10, w / 4), ground - Math.max(8, top * 0.6), poleDark, 1);
    return;
  }

  // the line: a shallow trench along the ground, the same across every piece
  rect(0, ground - 3, w, 3, '#5a4630', p > 0 ? 0.5 : 0.7);

  if (p <= 0.02) {
    // surveyed: a taut cord on pegs, a red-tipped peg every few cells
    line(0, ground - 6, w, ground - 6, '#e8e0c8', 0.8);
    if (((a.tile + a.row) % 3 + 3) % 3 === 0) {
      rect(w / 2 - 0.5, ground - 8, 1.5, 8, '#a07a4a');
      rect(w / 2 - 0.5, ground - 8, 1.5, 2, '#d8402a');
    }
    return;
  }

  // the footing along the whole line: laid stone, or the driven butts of the posts
  if (a.masonry) {
    rect(0, ground - 4, w, 4, '#8a8478');
    rect(0, ground - 4, w, 1, '#b0a898');
    for (let x = 3 + (((a.tile + a.row) % 2) * 3); x < w; x += 6) rect(x, ground - 4, 1, 4, '#5e5a52');
  } else {
    rect(0, ground - 3, w, 3, '#6a5030');
    for (let x = 2; x < w; x += 5) rect(x, ground - 3, 2, 3, '#4a3820');
  }

  // the scaffold, climbing just ahead of the courses: poles every other cell at the cell's two edges, a ledger at each
  // lift, braces between the poles, a deck of boards at the lift the work has reached
  const built = Math.round(h * Math.min(1, p));
  const topY = ground - Math.min(h + 4, built + 8);
  const lifts: number[] = [];
  for (let y = ground - 8; y > topY - 1; y -= 8) lifts.push(y);
  const poled = (((a.tile + a.row) % POLE_EVERY) + POLE_EVERY) % POLE_EVERY === 0;
  if (poled) for (const x of [0, w - 1.5]) {
    rect(x, topY - 2, 1.5, ground - topY + 2, pole);
    rect(x + 1, topY - 2, 0.5, ground - topY + 2, poleDark);
  }
  for (const y of lifts) line(0, y, w, y, pole, 1);
  if (poled && lifts.length > 1) line(0, lifts[0], w, lifts[1] ?? lifts[0], poleDark, 0.8);
  // (the deck: boards along the top lift, with their ends and the shadow they throw on the wall)
  const deck = lifts[lifts.length - 1] ?? ground - 8;
  rect(0, deck, w, 2, board);
  rect(0, deck + 2, w, 1, boardDark);
  rect(0, deck - 1, w, 1, '#e0b878', 0.7);
  for (let x = 4 + (a.tile % 3); x < w; x += 8) rect(x, deck, 0.7, 2, boardDark);

  // a ladder here and there, to the deck
  if (hasLadder(a.tile, a.row)) {
    const lx = w / 2 - 3;
    rect(lx, deck, 1, ground - deck, '#7a5632');
    rect(lx + 5, deck, 1, ground - deck, '#7a5632');
    for (let y = ground - 3; y > deck; y -= 3) rect(lx + 1, y, 4, 0.8, '#b08650');
  }
}
