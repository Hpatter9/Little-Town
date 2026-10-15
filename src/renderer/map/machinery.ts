// Moving machinery on the map (the owner's ask): the windmill's sails turn with the wind's strength, a water wheel
// turns on a mill standing by a river, and the venues' banners stir on their poles, faster as the wind rises. The
// rules are pure here, so they are tested; MapView turns the sprites (`renderAir`). The wheel is the Seabed pack's
// ship's wheel, its top half mirrored (a round, spoked wheel with paddles at its rim).

import { Texture } from 'pixi.js';
import { groundAt, wet, type LandMap } from '../../shared/sim/land';
import { loadImage } from '../art/loadImage';
import wheelUrl from '../art/packs/sb_wheel.png';

/** The sails' turn at a wind of 1 (radians a second): a breeze turns them slowly, a storm fast; none in a still fog. */
export const SAIL_TURN = 1.1;
/** The water wheel's turn (radians a second): the river runs whatever the weather. */
export const WHEEL_TURN = 0.9;
/** The banners' frames a second at a wind of 1 (and at the least, while there's a breath of wind). */
export const FLAG_RATE = 7;
export const FLAG_RATE_LEAST = 2.5;
/** The mills that may have a water wheel by the river. */
export const MILLS = new Set(['sawmill', 'windmill', 'textile_mill']);
/** The wheel's size on the map (px across) and how far it sits out from the wall. */
export const WHEEL_PX = 26;

/** How fast the sails turn in a wind (radians a second). */
export function sailSpeed(wind: number): number {
  return SAIL_TURN * Math.max(0, wind);
}

/** How fast a banner plays its frames in a wind (frames a second): it hangs still in a dead calm. */
export function flagRate(wind: number): number {
  return wind <= 0.05 ? 0 : Math.max(FLAG_RATE_LEAST, FLAG_RATE * wind);
}

/** The side of a mill's footprint the river runs along (water within a cell of its west or east wall, beside its
 *  lower half), for its water wheel; null when it isn't by water. */
export function millSide(land: LandMap, f: { x: number; y: number; w: number; h: number }): 'w' | 'e' | null {
  const by = (x: number) => {
    for (let y = f.y + Math.floor(f.h / 2); y < f.y + f.h; y++) if (x >= 0 && x < land.w && y >= 0 && y < land.h && wet(groundAt(land, x, y))) return true;
    return false;
  };
  if (by(f.x + f.w)) return 'e';
  if (by(f.x - 1)) return 'w';
  return null;
}

let wheel: Texture | null = null;
let asked = false;
/** The water wheel's picture, once loaded (null until then). */
export function wheelTexture(onLoad: () => void): Texture | null {
  if (!wheel && !asked) {
    asked = true;
    loadImage(wheelUrl)
      .then((im) => {
        wheel = Texture.from(im);
        wheel.source.scaleMode = 'nearest';
        onLoad();
      })
      .catch(() => undefined);
  }
  return wheel;
}
