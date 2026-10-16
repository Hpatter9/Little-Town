// The menus' frame set, by people (the owner's ask: menus that look better and more thought out). Pure: the material
// each people's frames are made of and the colours they're tinted, and the sums that tint them. The frames themselves
// are pack sprites (ui/art: CREDITS.md), tinted on a canvas by ui/frame.ts and handed to the pages as CSS variables.
//
// A tint is a gradient map: each pixel's lightness picks a colour along a ramp of four (shadow, dark, face, light), so
// the sprite keeps its bevels and grain but takes the people's colours. The town's alignment warms the ramp (good)
// or cools it (evil), a little.

import type { ThemeId } from '../../shared/sim/snapshot';

/** Four colours, shadow to highlight. */
export type Ramp = readonly [string, string, string, string];

/** Where each colour of a ramp sits along the lightness (0 dark .. 1 light): placed so the stone slab's outline, inner
 *  line, face and bevel (ui/art/stone.png) land on the four. */
export const RAMP_STOPS = [0, 0.42, 0.78, 1] as const;

export interface UiLook {
  /** What the people's frames are made of, in words (the note and the tests). */
  material: string;
  /** The rim round menus, cards and the event box: the wooden window frame or the stone slab. */
  frame: 'wood' | 'stone';
  /** The rim's colours (null: the sprite's own, the settlers' carved wood). */
  rim: Ramp | null;
  /** Buttons' faces (the stone slab, filled). */
  face: Ramp;
  /** The chosen tab and the main button. */
  accent: Ramp;
  /** Behind a card's text, inside its rim. */
  surface: string;
  /** A soft glow round the chosen and the framed (fae light, alchemists' glass), or none. */
  glow: string | null;
  /** The town's mark in the top bar. */
  mark: string;
}

export const UI_LOOKS: Record<ThemeId, UiLook> = {
  town: {
    material: 'carved wood', frame: 'wood', rim: null,
    face: ['#1e140a', '#4a301a', '#7a5432', '#d0a060'], accent: ['#2a1a08', '#7a5420', '#b8862e', '#ffe08a'],
    surface: 'rgba(40, 28, 18, 0.94)', glow: null, mark: '⌂',
  },
  lich: {
    material: 'dark stone and bone', frame: 'stone', rim: ['#0c0a0e', '#3a3640', '#8a8478', '#ece4cc'],
    face: ['#0a0c0b', '#1c2420', '#2c3832', '#9ab890'], accent: ['#0a140c', '#2a5a30', '#3d7a3a', '#a8f090'],
    surface: 'rgba(16, 18, 20, 0.95)', glow: 'rgba(138, 208, 112, 0.35)', mark: '☠',
  },
  druid: {
    material: 'birch and moss', frame: 'wood', rim: ['#14180c', '#4a5a2a', '#cfccb4', '#f6f4ea'],
    face: ['#0c1408', '#1e3016', '#335024', '#a8d070'], accent: ['#0e1a06', '#3f6a2a', '#5a9a3a', '#d0f090'],
    surface: 'rgba(20, 30, 16, 0.95)', glow: 'rgba(170, 220, 100, 0.3)', mark: '❦',
  },
  vampire: {
    material: 'blood-red velvet', frame: 'stone', rim: ['#12040a', '#3a0a16', '#7a1a2a', '#e0506a'],
    face: ['#140408', '#30090f', '#4a0e1a', '#c84058'], accent: ['#1a0408', '#6a1424', '#a8243a', '#ff8a9a'],
    surface: 'rgba(30, 8, 14, 0.95)', glow: 'rgba(220, 40, 70, 0.35)', mark: '✠',
  },
  werewolf: {
    material: 'snow and fur', frame: 'stone', rim: ['#101418', '#5a6470', '#c8d4e0', '#ffffff'],
    face: ['#140f0a', '#33261a', '#4e3c2a', '#c8a878'], accent: ['#0e1626', '#2e4a78', '#5a7ab0', '#d8e8ff'],
    surface: 'rgba(20, 24, 34, 0.95)', glow: 'rgba(200, 220, 255, 0.3)', mark: '☾',
  },
  robot: {
    material: 'riveted brass', frame: 'stone', rim: ['#1a1206', '#6a4a1a', '#b8862e', '#ffe08a'],
    face: ['#0a0e0c', '#1e2824', '#33403a', '#9ac0ae'], accent: ['#04140a', '#125a36', '#1e8a50', '#7affb8'],
    surface: 'rgba(12, 20, 16, 0.95)', glow: 'rgba(80, 255, 160, 0.3)', mark: '▣',
  },
  dwarves: {
    material: 'granite', frame: 'stone', rim: ['#0e0e10', '#3a3a40', '#7a7880', '#c8c4c8'],
    face: ['#121010', '#2a2622', '#3e3832', '#c8a060'], accent: ['#1a1004', '#6a4a20', '#a87a2a', '#f0c060'],
    surface: 'rgba(30, 26, 22, 0.95)', glow: null, mark: '⚒',
  },
  merfolk: {
    material: 'coral', frame: 'stone', rim: ['#1a0808', '#8a3a30', '#e07a60', '#ffd0b8'],
    face: ['#04121a', '#0c2634', '#143a4c', '#5ac0d0'], accent: ['#041a20', '#146a7a', '#22a0b0', '#a0f4f8'],
    surface: 'rgba(8, 26, 38, 0.95)', glow: 'rgba(120, 230, 240, 0.3)', mark: '≈',
  },
  // (the one bright look: light faces, dark writing, as the tent's cream canvas)
  nomads: {
    material: 'sandstone', frame: 'stone', rim: ['#3a2410', '#a07040', '#e0b878', '#fff0c8'],
    face: ['#6a4a2a', '#c8a878', '#f2e2c0', '#ffffff'], accent: ['#5a1a0a', '#a0301f', '#c8462e', '#ffb070'],
    surface: '#fbf1dc', glow: null, mark: '✦',
  },
  fae: {
    material: 'thorn and glow', frame: 'wood', rim: ['#0a0610', '#3a1a2a', '#6a3a4a', '#f8b0ff'],
    face: ['#120a18', '#26142f', '#382046', '#e0a0ff'], accent: ['#1a0a24', '#6a3a86', '#a060c0', '#ffd0ff'],
    surface: 'rgba(30, 18, 40, 0.94)', glow: 'rgba(255, 160, 255, 0.4)', mark: '✧',
  },
  alchemists: {
    material: 'glass and copper', frame: 'stone', rim: ['#1a0c06', '#7a3a1a', '#c8743a', '#ffd0a0'],
    face: ['#081212', '#122424', '#1c3838', '#90e0d0'], accent: ['#1a1004', '#6a5a1a', '#a8902a', '#f0e070'],
    surface: 'rgba(18, 20, 28, 0.95)', glow: 'rgba(160, 255, 200, 0.25)', mark: '⚗',
  },
  knights: {
    material: 'gilt', frame: 'stone', rim: ['#2a1a04', '#8a6a1a', '#d8b860', '#fff4c0'],
    face: ['#0c0e14', '#1e222b', '#32384a', '#a8b0c8'], accent: ['#0a1020', '#2a3a6a', '#3a5a9a', '#d8e0ff'],
    surface: 'rgba(22, 24, 32, 0.95)', glow: 'rgba(216, 184, 96, 0.3)', mark: '⚜',
  },
  orcs: {
    material: 'iron and skulls', frame: 'stone', rim: ['#0a0a0a', '#2e2e30', '#5a5a5e', '#a8a8a0'],
    face: ['#120a06', '#26180e', '#3a2414', '#a86a3a'], accent: ['#1a0604', '#5a1a10', '#902a14', '#ff8040'],
    surface: 'rgba(30, 20, 12, 0.95)', glow: 'rgba(224, 96, 48, 0.3)', mark: '☠',
  },
};

export const lookOf = (theme: ThemeId | undefined): UiLook => UI_LOOKS[theme ?? 'town'] ?? UI_LOOKS.town;

/* ------------------------------------------------------------ colour sums */

export type Rgb = [number, number, number];

export function hexRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbHex = ([r, g, b]: Rgb): string => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Lightness as the eye sees it, 0..1. */
export const lightness = (r: number, g: number, b: number): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** The colour a lightness picks along a ramp (0..1, by RAMP_STOPS). */
export function rampAt(ramp: readonly Rgb[], t: number): Rgb {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    if (x <= RAMP_STOPS[i]) {
      const a = RAMP_STOPS[i - 1];
      return mixRgb(ramp[i - 1], ramp[i], (x - a) / (RAMP_STOPS[i] - a || 1));
    }
  }
  return ramp[ramp.length - 1];
}

/** Tint RGBA pixels in place by a ramp: each opaque pixel's lightness, stretched over the sprite's own darkest to
 *  lightest, picks its colour (alpha kept). */
export function gradientMap(px: Uint8ClampedArray, ramp: Ramp): void {
  const stops = ramp.map(hexRgb);
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const l = lightness(px[i], px[i + 1], px[i + 2]);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const c = rampAt(stops, (lightness(px[i], px[i + 1], px[i + 2]) - lo) / span);
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  }
}

/** A ramp warmed toward gold by a good town and cooled toward violet-blue by an evil one (`cast` -1..1, as the
 *  snapshot's `align.cast`), at most a fifth of the way. */
export function alignRamp(ramp: Ramp, cast: number): Ramp {
  const c = Math.max(-1, Math.min(1, cast));
  if (Math.abs(c) < 0.15) return ramp;
  const toward = hexRgb(c > 0 ? '#ffb050' : '#5060d0');
  const t = Math.abs(c) * 0.2;
  return ramp.map((h) => rgbHex(mixRgb(hexRgb(h), toward, t))) as unknown as Ramp;
}

/** A button held down: its face darker. */
export const pressedRamp = (ramp: Ramp): Ramp => ramp.map((h) => rgbHex(mixRgb(hexRgb(h), [0, 0, 0], 0.3))) as unknown as Ramp;

/** A button that can't be pressed: its face greyed. */
export function disabledRamp(ramp: Ramp): Ramp {
  return ramp.map((h) => {
    const [r, g, b] = hexRgb(h);
    const l = lightness(r, g, b) * 255;
    return rgbHex(mixRgb([r, g, b], [l, l, l], 0.75));
  }) as unknown as Ramp;
}

/** The alignment's tint bucketed (fifths), so a drifting score doesn't re-tint the frames every snapshot. */
export const alignStep = (cast: number): number => Math.round(Math.max(-1, Math.min(1, cast)) * 5) / 5;

/** How deep into night the menus are (0 day .. 1 deep night), from the daylight (0 night .. 1 day): dusk and dawn
 *  ease it in and out. */
export const nightDepth = (daylight: number): number => Math.round(Math.max(0, Math.min(1, (0.45 - daylight) / 0.35)) * 10) / 10;
