// Colour variety for the isometric townsfolk, by baking. Each look is one set of frames in one palette; for variety
// each person gets a small stable "variant" (a hue turn for clothes, a lightness for skin and hair), and the
// look's frames are recoloured ONCE per (look, variant) on a canvas and cached as textures. So a person costs
// nothing extra per frame (no filter, no shader): a phone with dozens of townsfolk draws plain sprites.
// There are only VARIANTS recolours of each look, and people share them.
//
// What it can do: turn the hue of every pixel that isn't skin-toned (clothes, belts, bags: leather tones turn
// through reds and greys to greens and blues) and brighten or darken skin and hair a little.
// What it can't: tell hair from a brown tunic (there are no masks, only hue ranges), so a hair colour change
// isn't separate from the clothes; skin keeps its hue (the sim's skin tone isn't matched, only lightened or darkened
// a little, so it is a gentle shade, not the person's exact tone). Near-greys and the dark outlines are left alone.
// Pure pixel maths here (the tests run it); the canvas work is in folkLoader.ts.

import { idHash } from './folkRules';

export interface FolkVariant {
  /** Hue turn for non-skin pixels, in degrees. */
  hue: number;
  /** Skin and hair lightness multiplier (about 0.85 to 1.15). */
  light: number;
  /** Clothing saturation multiplier. */
  sat: number;
}

/** How many recolours of a look exist (variant 0 is the art as drawn). Raising it costs memory per look. */
export const VARIANTS = 8;

const TABLE: readonly FolkVariant[] = [
  { hue: 0, light: 1, sat: 1 },
  { hue: 150, light: 0.92, sat: 1 },
  { hue: 215, light: 1.08, sat: 0.9 },
  { hue: 300, light: 0.88, sat: 1 },
  { hue: 60, light: 1.12, sat: 0.9 },
  { hue: 190, light: 0.96, sat: 1.1 },
  { hue: 330, light: 1.05, sat: 0.85 },
  { hue: 100, light: 0.85, sat: 1 },
];

/** A person's variant number: stable from their id. */
export const variantOf = (id: number): number => idHash(id, 7) % VARIANTS;
export const variantTable = (v: number): FolkVariant => TABLE[((v % VARIANTS) + VARIANTS) % VARIANTS];

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Skin: warm hues, middling saturation, not dark. */
export const isSkin = (h: number, s: number, l: number): boolean => (h <= 40 || h >= 350) && s >= 0.2 && s <= 0.65 && l >= 0.3 && l <= 0.9;

/** Recolour RGBA bytes in place for a variant (variant 0 changes nothing). Transparent pixels, near-greys and the
 *  darkest outline pixels are left alone. */
export function recolour(data: Uint8ClampedArray | Uint8Array, variant: number): void {
  const v = variantTable(variant);
  if (v.hue === 0 && v.light === 1 && v.sat === 1) return;
  // (pixel art has few colours and a sheet has tens of thousands of pixels: each colour is worked out once)
  const seen = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let packed = seen.get(key);
    if (packed === undefined) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (s < 0.12 || l < 0.12) packed = -1;
      else {
        const out = isSkin(h, s, l) ? hslToRgb(h, s, Math.min(0.95, l * v.light)) : hslToRgb((h + v.hue) % 360, Math.min(1, s * v.sat), l);
        packed = (out[0] << 16) | (out[1] << 8) | out[2];
      }
      seen.set(key, packed);
    }
    if (packed < 0) continue;
    data[i] = packed >> 16; data[i + 1] = (packed >> 8) & 255; data[i + 2] = packed & 255;
  }
}
