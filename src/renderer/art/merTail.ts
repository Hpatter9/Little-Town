// A merfolk's tail (code-drawn: no pack has one): in the sea a merrow is drawn to the waist over the water with a
// scaled tail curling away below, in one of a few sea colours by who they are. Side-on, pointing right (flipped to
// point left).
import { Texture } from 'pixi.js';
import { noTone, paint } from './pixelArt';

export const TAIL_W = 26;
export const TAIL_H = 20;
/** How much of a person's frame (from its top) shows over the water: down to the waist. */
export const WAIST = 0.6;

const COLOURS: [string, string, string][] = [
  ['#2a8a8a', '#3fb0a8', '#9ae6dc'], // teal
  ['#2f5fa8', '#4a86cc', '#a8d0f0'], // sea blue
  ['#6a4a9a', '#8a6ac0', '#d0b8f0'], // violet
  ['#b08a30', '#d4b050', '#f4e4a0'], // gold
];
export const TAIL_KINDS = COLOURS.length;
/** A merrow's sea colours (dark, mid, light) by kind: the tail's, and their fins' on land. */
export const merColours = (kind: number) => COLOURS[((kind % TAIL_KINDS) + TAIL_KINDS) % TAIL_KINDS];

const cache: Texture[] = [];

/** The tail texture of a kind (cached). */
export function tailTexture(kind: number): Texture {
  const k = ((kind % TAIL_KINDS) + TAIL_KINDS) % TAIL_KINDS;
  if (!cache[k]) {
    const [dark, mid, light] = COLOURS[k];
    cache[k] = paint(TAIL_W, TAIL_H, noTone, (p) => {
      // the tail: thick under the waist, bending right and tapering, then the fluke
      const spine: [number, number, number][] = [[6, 1, 5], [8, 4, 4], [11, 7, 4], [14, 9, 3], [17, 11, 2], [19, 12, 2]];
      for (const [x, y, r] of spine) p.ellipse(x, y, r + 1, r, mid);
      for (const [x, y, r] of spine) p.ellipse(x - 1, y - 1, Math.max(1, r - 1), Math.max(1, r - 1), light);
      for (const [x, y, r] of spine) p.ellipse(x + 1, y + 2, r, Math.max(1, r - 1), dark);
      // scales
      for (let i = 0; i < 14; i++) p.px(5 + ((i * 7) % 13), 1 + ((i * 5) % 11), i % 3 ? dark : light);
      // the fluke: two lobes
      p.ellipse(22, 9, 3, 3, mid);
      p.ellipse(23, 15, 3, 3, mid);
      p.ellipse(21, 10, 2, 2, light);
      p.ellipse(24, 13, 2, 2, dark);
      p.rect(20, 11, 3, 2, dark);
    }, 0.5).texture;
  }
  return cache[k];
}
