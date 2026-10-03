// LPC character frames as Pixi textures (cached). The composing itself is in lpcCompose.ts.

import type { Texture } from 'pixi.js';
import { fineTexture } from '../pixelArt';
import type { Look } from '../../../shared/data/people';
import { FRAME_COUNT, lookKey, lpcCanvas, type Facing, type LpcAnim, type LpcWeapon } from './lpcCompose';

export * from './lpcCompose';

const textures = new Map<string, Texture>();

/** One composed frame as a texture (cached). `wear` adds armour layers (e.g. 'torso_chain', 'head_helm'). */
export function lpcFrame(look: Look, anim: LpcAnim, frame: number, weapon: LpcWeapon = null, wear: readonly string[] = [], facing?: Facing): Texture {
  const f = Math.max(0, Math.min(FRAME_COUNT[anim] - 1, frame));
  const key = `${lookKey(look)}|${anim}|${f}|${weapon ?? ''}|${wear.join(',')}|${facing ?? ''}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const tex = fineTexture(lpcCanvas(look, anim, f, weapon, wear, facing)); // (on the fine grid, like the painted art)
  textures.set(key, tex);
  return tex;
}