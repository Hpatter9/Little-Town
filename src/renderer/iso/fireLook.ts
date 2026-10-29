// The fires on the isometric map crackle and flicker (the owner: "the fires need to look like a crackling fire with a
// flickering light"). A hearth's picture (a campfire, a bonfire, the storyteller's circle) has its flame painted on it;
// iso/isoView.ts cuts that flame out (`FLAME_BOX`) and draws it again over the picture, stretched, swayed and brightened
// on the flicker's smooth noise (map/flicker.ts), with a warm glow that wavers about it and embers rising off it. Pure
// (no Pixi, no page), so the tests can check it.

import { flicker, GENTLE_AMOUNT } from '../map/flicker';
import made from '../art/iso/made.json';

/** Where the flame is painted in a hearth piece, [x0, y0, x1, y1] in the piece's own px (the flame's foot is y1, on
 *  the logs). A piece with no entry has its flame guessed: the middle of its upper part (`flameBox`). */
export const FLAME_BOX: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'settlers/campfire': [28, 0, 86, 60],
};

/** The flame's box in a piece `w` by `h` px: its own, or the middle of its upper part. */
export function flameBox(key: string, w: number, h: number): readonly [number, number, number, number] {
  return FLAME_BOX[key] ?? [Math.round(w * 0.25), 0, Math.round(w * 0.75), Math.round(h * 0.6)];
}

/** How the flame is drawn at time `t` (seconds), on its own `phase`: stretched up (`sy`) and narrowed (`sx`) as it
 *  flares, leaning (`skew`, radians) as it sways, and brighter (`bright`, 0..1, the tint's share of white) at its
 *  height. With "Reduce motion" (`gentle`) a third as lively. */
export function tongueAt(t: number, phase: number, gentle = false): { sx: number; sy: number; skew: number; bright: number } {
  const f = flicker('campfire', t * 1.7, phase, gentle);
  const a = 0.22 * (gentle ? GENTLE_AMOUNT : 1);
  // (0 at its lowest, 1 at its brightest)
  const up = a > 0 ? (f - (1 - a)) / a : 1;
  const lean = flicker('campfire', t * 0.9, phase + 2.3, gentle);
  const live = gentle ? GENTLE_AMOUNT : 1;
  return {
    sy: 1 + (up - 0.5) * 0.26 * live,
    sx: 1 - (up - 0.5) * 0.08 * live,
    skew: ((lean - (1 - a / 2)) / Math.max(0.01, a)) * 0.14 * live,
    bright: 0.55 + 0.45 * up,
  };
}

/** How many embers rise off a hearth at once. */
export const EMBERS = 4;
/** How long an ember takes to rise and go out (seconds), and how high it goes (px of the piece). */
export const EMBER_LIFE = 1.6;
export const EMBER_RISE = 46;

/** Ember `i` at time `t`: where it is from the flame's top (px of the piece; up is negative) and how bright (0 out).
 *  Each rises on its own beat, drifting aside, and fades as it goes. */
export function emberAt(i: number, t: number, phase: number): { dx: number; dy: number; alpha: number } {
  const life = EMBER_LIFE * (0.8 + 0.1 * (i % 3));
  const u = (((t + phase * 0.37 + (i * life) / EMBERS) % life) + life) % life / life;
  const side = Math.sin(phase * 5.1 + i * 2.7);
  return { dx: side * 6 + Math.sin(u * 6.3 + i) * 3, dy: -u * EMBER_RISE * (0.7 + 0.15 * (i % 3)), alpha: u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85) };
}

/** A hearth's glow, 0..1 of its full: always a little by day (a fire glows in the shade), full after dark, wavering. */
export function hearthGlow(t: number, phase: number, night: boolean, gentle = false): number {
  return (night ? 1 : 0.35) * flicker('campfire', t * 1.3, phase, gentle);
}

/** The small flame for the torches on stakes (PixelLab, docs/notes/pixellab-plan.md): a strip of square frames side by
 *  side, its foot at the bottom middle of each, served beside the settlers' kit. Asked for only once it is in
 *  (art/iso/made.json `flame`, set by tools/pixellab/assemble_nov.py); until then a torch's flame is drawn as before. */
export const FLAME_URL: string | null = made.flame ? 'iso/kits/settlers/flame.png' : null;
/** Its frames a second. */
export const FLAME_FPS = 9;
/** How many square frames a strip `w` by `h` holds. */
export const stripFrames = (w: number, h: number): number => Math.max(1, Math.round(w / Math.max(1, h)));
/** The frame shown at time `t` (seconds) by a flame on its own `phase` (so the torches don't flicker as one); held on
 *  one frame when motion is to be gentle. */
export function flameFrame(t: number, phase: number, count: number, gentle = false): number {
  if (count <= 1 || gentle) return 0;
  return Math.floor(t * FLAME_FPS + phase * count) % count;
}
