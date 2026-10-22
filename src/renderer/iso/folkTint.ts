// Colour variety for the isometric townsfolk, by baking. Each look is one set of frames in one palette; for variety
// each person gets a small stable "variant", and the look's frames are recoloured ONCE per (look, variant) on a
// canvas and cached as textures. So a person costs nothing extra per frame (no filter, no shader): a phone with
// dozens of townsfolk draws plain sprites. There are only VARIANTS recolours of each look, and people share them.
//
// The variety is meant to look natural, so it is gentle and each kind of pixel stays in its own colour family:
//  - skin keeps its hue and only gets a little lighter or darker (never retinted to another colour);
//  - warm browns and tans (hair, leather, wood-brown cloth, hue 0 to 56) turn a few degrees and stay brown, auburn
//    or blonde: never green or pink;
//  - cloth of any other colour (reds, greens, blues, purples) turns at most a few tens of degrees and loses a
//    little saturation, so it stays a muted, period dye;
//  - near-greys (metal plate, silver, bone, skeletons) and the darkest outline pixels are left alone;
//  - the peoples with a colour of their own (orcs, liches, vampires, the Moon Pack, machines, merfolk, the fae) are
//    not recoloured at all: their casts are drawn as the art has them (`variantOf` gives them variant 0).
// What it can't do: tell hair from a brown tunic (there are no masks, only hue ranges), so hair and brown leather
// shift together, a few degrees within brown. Pure pixel maths here (the tests run it); the canvas work is in
// folkLoader.ts.

import { idHash } from './folkRules';

export interface FolkVariant {
  /** Hue turn for warm browns (hair, leather), in degrees: small. */
  warm: number;
  /** Hue turn for other cloth, in degrees: at most about 25 either way. */
  cloth: number;
  /** Skin lightness multiplier (about 0.9 to 1.1). */
  skin: number;
  /** Lightness multiplier for browns and cloth (about 0.85 to 1.1). */
  light: number;
  /** Cloth saturation multiplier (muted: 0.8 to 1). */
  sat: number;
}

/** How many recolours of a look exist (variant 0 is the art as drawn). Raising it costs memory per look. */
export const VARIANTS = 6;

const TABLE: readonly FolkVariant[] = [
  { warm: 0, cloth: 0, skin: 1, light: 1, sat: 1 },
  { warm: -6, cloth: 18, skin: 0.95, light: 0.94, sat: 0.9 },
  { warm: 7, cloth: -16, skin: 1.06, light: 1.06, sat: 0.85 },
  { warm: 10, cloth: 25, skin: 0.95, light: 0.88, sat: 0.9 },
  { warm: -9, cloth: -10, skin: 1.06, light: 1.1, sat: 0.8 },
  { warm: 3, cloth: 10, skin: 1.03, light: 0.9, sat: 1 },
];

/** The peoples drawn as their art has them (their skin, hair and dress are their own colour). */
export const FIXED_CASTS: ReadonlySet<string> = new Set(['orcs', 'lich', 'vampire', 'werewolf', 'robot', 'merfolk', 'fae']);

/** A person's variant number: stable from their id. The fixed casts (FIXED_CASTS) always get 0. */
export const variantOf = (id: number, people = 'settlers'): number => (FIXED_CASTS.has(people) ? 0 : idHash(id, 7) % VARIANTS);
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

/** The warm band: browns, tans, blondes, auburns (hair, leather). */
export const isWarm = (h: number): boolean => h <= 56;

/** The colour one pixel turns into for a variant, or null to leave it. */
export function recolourOne(r: number, g: number, b: number, v: FolkVariant): [number, number, number] | null {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.2 || l < 0.12) return null; // (greys, metal, bone, outlines)
  if (isSkin(h, s, l)) return hslToRgb(h, s, Math.min(0.95, l * v.skin));
  if (isWarm(h)) return hslToRgb(Math.min(56, Math.max(0, h + v.warm)), s, Math.min(0.95, l * v.light));
  return hslToRgb((h + v.cloth + 360) % 360, Math.min(1, s * v.sat), Math.min(0.95, l * v.light));
}

/** Recolour RGBA bytes in place for a variant (variant 0 changes nothing). */
export function recolour(data: Uint8ClampedArray | Uint8Array, variant: number): void {
  const v = variantTable(variant);
  if (variant === 0 || (v.warm === 0 && v.cloth === 0 && v.skin === 1 && v.light === 1 && v.sat === 1)) return;
  // (pixel art has few colours and a sheet has tens of thousands of pixels: each colour is worked out once)
  const seen = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let packed = seen.get(key);
    if (packed === undefined) {
      const out = recolourOne(data[i], data[i + 1], data[i + 2], v);
      packed = out ? (out[0] << 16) | (out[1] << 8) | out[2] : -1;
      seen.set(key, packed);
    }
    if (packed < 0) continue;
    data[i] = packed >> 16; data[i + 1] = (packed >> 8) & 255; data[i + 2] = packed & 255;
  }
}
