// The frame set on a canvas-drawn screen (the raid's tactics board, tactics/tacticsView.ts): a box or a button as the
// same tinted slab the menus' buttons are (ui/frame.ts), nine-sliced, so the board's HUD matches the menus. Null until
// the frames are tinted (the caller draws its own box meanwhile).

import { NineSliceSprite, Texture } from 'pixi.js';
import { frameCanvas, frameVersion } from './frame';

/** The slab's rim (px), as cut (ui/frame.ts PIECES.stone). */
const RIM = 6;

const textures = new Map<string, { v: number; tex: Texture }>();

/** A plate `w` x `h`: 'btn' a button's face, 'btn-on' the chosen, 'btn-off' one that can't be pressed. `tint` colours
 *  it (a foe's box red). */
export function uiPlate(kind: 'btn' | 'btn-on' | 'btn-off', w: number, h: number, tint = 0xffffff): NineSliceSprite | null {
  const c = frameCanvas(kind);
  if (!c) return null;
  const v = frameVersion();
  let t = textures.get(kind);
  if (!t || t.v !== v) {
    // (the last look's texture is left for the boxes still showing it, until the board redraws)
    const tex = Texture.from(c);
    tex.source.scaleMode = 'nearest';
    t = { v, tex };
    textures.set(kind, t);
  }
  const plate = new NineSliceSprite({ texture: t.tex, leftWidth: RIM, rightWidth: RIM, topHeight: RIM, bottomHeight: RIM });
  plate.width = w;
  plate.height = h;
  plate.tint = tint;
  return plate;
}
