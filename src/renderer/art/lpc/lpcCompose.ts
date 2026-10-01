// LPC character composer (ported from Little Wayfarers' lpc.js, trimmed to what this game needs). This part draws
// onto plain canvases, so the panels can show a character too; lpc.ts turns frames into Pixi textures.
// Layers of the Universal LPC spritesheet (CC-BY-SA 3.0 / GPL 3.0, see CREDITS.md) are recoloured and
// stacked into one 64x64 frame per (look, animation, frame). The data holds right-facing rows only;
// left-facing is a mirrored sprite.

import { loadImage } from '../loadImage';
import type { Look } from '../../../shared/data/people';
import data from './lpcData.json';

export type LpcAnim = 'spell' | 'thrust' | 'walk' | 'slash' | 'shoot' | 'hurt';
const ROW: Record<LpcAnim, number> = { spell: 0, thrust: 1, walk: 2, slash: 3, shoot: 4, hurt: 5 };
export const FRAME_COUNT: Record<LpcAnim, number> = { spell: 7, thrust: 8, walk: 9, slash: 6, shoot: 13, hurt: 6 };

export const FRAME_SIZE = 64;
/** Pixel row of the feet and column of the body centre within a frame. */
export const FEET_Y = 62;
export const CENTRE_X = 31;

const LAYERS = data.layers as Record<string, string>;
const HAS = data.has as Record<string, boolean[]>;
const ALIAS = data.alias as Record<string, string>;

const images = new Map<string, HTMLImageElement>();

/** Decode the layer images. Call once before asking for frames. */
export async function loadLpc(): Promise<void> {
  await Promise.all(
    Object.entries(LAYERS).map(async ([id, src]) => {
      const im = await loadImage(src);
      images.set(id, im);
    }),
  );
}

const resolve = (id: string): string | null => (LAYERS[id] ? id : ALIAS[id] && LAYERS[ALIAS[id]] ? ALIAS[id] : null);

/* ------------------------------------------------------------ recolouring */

type TintMode = 'mul' | 'skin';
const tinted = new Map<string, HTMLCanvasElement>();
const lightRef = new Map<string, number>();

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}

/** Recolour a layer by lightness so shading and outlines survive; 'skin' also leaves eyes alone. */
function atlas(id: string, hex: string | null, mode: TintMode): CanvasImageSource {
  const im = images.get(id)!;
  if (!hex) return im;
  const key = `${id}|${hex}|${mode}`;
  const hit = tinted.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const p = img.data;
  let ref = lightRef.get(id);
  if (ref === undefined) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] <= 200) continue;
      const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      if (l > 0.18) {
        sum += l;
        n++;
      }
    }
    ref = n ? sum / n : 0.7;
    lightRef.set(id, ref);
  }
  const T = rgb(hex);
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i];
    const gg = p[i + 1];
    const b = p[i + 2];
    if (mode === 'skin' && b > r + 12 && b > gg) continue; // eyes, whites
    const k = (r * 0.3 + gg * 0.59 + b * 0.11) / 255 / ref;
    p[i] = Math.min(255, T[0] * k);
    p[i + 1] = Math.min(255, T[1] * k);
    p[i + 2] = Math.min(255, T[2] * k);
  }
  g.putImageData(img, 0, 0);
  tinted.set(key, c);
  return c;
}

/* ------------------------------------------------------------ look -> layers */

interface LayerRef {
  id: string;
  tint: string | null;
  mode: TintMode;
}

/** Weapons drawn on top of the character (the LPC data has right-facing weapon rows). */
export type LpcWeapon = 'spear' | 'dagger' | 'bow' | 'mace' | 'axe' | 'sword' | null;

/** Garments that are someone's clothes (they replace the plain shirt, trousers, shoes or belt), as opposed to armour
 *  drawn over them. */
const CLOTHES = /^(torso_(longsleeve|tunic|dress|robe|sleeveless|pirate|jacket|underdress|overskirt)|legs_|feet_|belt_)/;

/**
 * The layers for a look. `wear` lists what's worn beyond the plain clothes, each as a layer base with an optional
 * tint after a colon ('torso_robe:#6a3a8a', 'torso_chain'): garments replace the plain shirt, trousers, shoes or belt;
 * armour and hats go over them; capes and quivers (back_) behind.
 */
function layersFor(look: Look, weapon: LpcWeapon, wear: readonly string[]): LayerRef[] {
  const out: LayerRef[] = [];
  const push = (base: string, tint: string | null, mode: TintMode = 'mul') => {
    const id = resolve(`${base}_${look.gender}`);
    if (id) out.push({ id, tint, mode });
  };
  // (a ready-made founder's own clothes come first, so they're what's worn)
  const items = [...(look.wear ?? []), ...wear].map((w) => {
    const [base, tint] = w.split(':');
    return { base, tint: tint || null };
  });
  const find = (re: RegExp) => items.find((w) => re.test(w.base));
  for (const w of items) if (w.base.startsWith('back_')) push(w.base, w.tint);
  push(`body_${look.body ?? 'light'}`, look.skin, 'skin');
  if (look.ears) push(`ears_${look.ears}`, look.skin, 'skin');
  if (look.eyes) push(`eyes_${look.eyes}`, null);
  const legs = find(/^legs_/);
  push(legs?.base ?? 'legs_pants', legs ? legs.tint : mix(look.outfit, '#20180f', 0.35));
  const feet = find(/^feet_/);
  push(feet?.base ?? 'feet_shoes', feet?.tint ?? null);
  // (the LPC data's tunic exists only cut for a woman, and a man given it showed her figure: men wear the
  // men's long-sleeved shirt instead)
  const shirt = find(/^torso_(longsleeve|tunic|dress|robe|sleeveless|pirate|jacket|underdress|overskirt)$/);
  push(shirt?.base ?? (look.gender === 'm' ? 'torso_longsleeve' : 'torso_tunic'), shirt?.tint ?? look.outfit);
  const belt = find(/^belt_/);
  push(belt?.base ?? 'belt_leather', belt?.tint ?? null);
  for (const w of items) if (w.base.startsWith('torso_') && !CLOTHES.test(w.base)) push(w.base, w.tint);
  for (const w of items) if (w.base.startsWith('hands_')) push(w.base, w.tint);
  const hat = items.find((w) => w.base.startsWith('head_'));
  // a helm or hood covers the hair (a beard still shows; a bandana, cap or crown doesn't hide it all)
  const covers = !!hat && /^head_(helm|hood|chain|chainhood)$/.test(hat.base);
  if (!covers) push(`hair_${look.hair}`, look.hairColor);
  if (look.beard) push('beard', look.hairColor);
  if (hat) push(hat.base, hat.tint);
  if (weapon) push(`w_${weapon}`, null);
  return out;
}

/* ------------------------------------------------------------ frames */

export function lookKey(look: Look): string {
  return [look.gender, look.skin, look.hair, look.hairColor, look.beard ? 1 : 0, look.outfit, look.body ?? '', look.ears ?? '', look.eyes ?? '', (look.wear ?? []).join(',')].join('|');
}

/** One composed 64x64 frame on a new canvas. `wear` adds armour layers (e.g. 'torso_chain', 'head_helm'). */
export function lpcCanvas(look: Look, anim: LpcAnim, frame: number, weapon: LpcWeapon = null, wear: readonly string[] = []): HTMLCanvasElement {
  const f = Math.max(0, Math.min(FRAME_COUNT[anim] - 1, frame));
  const c = document.createElement('canvas');
  c.width = c.height = FRAME_SIZE;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const row = ROW[anim];
  for (const l of layersFor(look, weapon, wear)) {
    if (!HAS[l.id]?.[row]) continue;
    g.drawImage(atlas(l.id, l.tint, l.mode), f * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
  }
  return c;
}