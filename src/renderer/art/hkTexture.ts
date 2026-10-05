// The Himeko townsfolk's cells (art/hkFolk.ts) as Pixi textures, for the map, the fight screen and the mine: one
// texture a composed cell, freed when the cell cache lets the cell go.

import { Texture, type Sprite } from 'pixi.js';
import { HK_CELL, HK_FEET, HK_FIGURE, hkCell, onHkEvict } from './hkFolk';

const textures = new WeakMap<HTMLCanvasElement, Texture>();
onHkEvict((c) => {
  textures.get(c)?.destroy();
  textures.delete(c);
});

/** A cell of a person's layers as a texture (128 square, feet at HK_FEET); null while the layers load. */
export function hkTexture(keys: string[], col: number, row: number): Texture | null {
  const c = hkCell(keys, col, row);
  if (!c) return null;
  let t = textures.get(c);
  if (!t) textures.set(c, (t = Texture.from(c)));
  return t;
}

/** Set a sprite to a person's cell, feet at (x, feetY), the figure `height` tall. False while the layers load (the
 *  caller draws the old look meanwhile). */
export function hkSprite(s: Sprite, keys: string[], col: number, row: number, x: number, feetY: number, height: number): boolean {
  const t = hkTexture(keys, col, row);
  if (!t) return false;
  s.texture = t;
  s.anchor.set(0.5, HK_FEET / HK_CELL);
  const k = height / HK_FIGURE;
  s.scale.set(k, k);
  s.position.set(Math.round(x), Math.round(feetY));
  return true;
}
