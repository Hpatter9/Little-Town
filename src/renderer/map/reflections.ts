// Reflections in the water (the owner's ask): whatever stands at the water's edge (a tree, a bush, a rock, a
// townsperson) is mirrored in it below its foot: the same picture upside down, squashed, faint and blue, under
// everything standing; none on ice. Used by MapView (the props) and MapPeople (the townsfolk).

import type { Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import { freezes, iceAt } from './ice';

/** Whether open water lies just below a foot (world px). */
export function waterBelow(land: LandMap, fx: number, fy: number, season: string): boolean {
  const cx = Math.floor(fx / CELL);
  const cy = Math.floor((fy + 6) / CELL);
  const g = groundAt(land, cx, cy);
  if (g !== 'water' && g !== 'shallows') return false;
  const wet = (x: number, y: number) => groundAt(land, x, y) === 'water';
  return !(freezes(season) && iceAt(wet, cx, cy));
}

/** Set a sprite up as a reflection of a picture whose foot stands at (fx, fy). */
export function reflectOf(r: Sprite, tex: Texture, fx: number, fy: number, anchorY: number, scaleX = 1, scaleY = 1): void {
  r.texture = tex;
  r.anchor.set(0.5, anchorY);
  r.scale.set(scaleX, -0.75 * scaleY);
  r.position.set(Math.round(fx), Math.round(fy + 3));
  r.tint = 0x7090c8;
  r.alpha = 0.3;
  r.zIndex = fy - 30;
  r.visible = true;
}
