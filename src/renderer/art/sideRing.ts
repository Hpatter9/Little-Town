// The ring under a fighter (the owner's ask): blue for the town's own people, red for the raiders and anyone attacking
// the town, green for a third party who isn't an enemy (allied hosts, hired, summoned or tamed help, a visiting band
// fighting beside the town). One flat ellipse on the ground, drawn beneath the sprite with a soft dark edge so it reads on
// grass, snow and night. The tactics board, the map raid and the side-view party fight all use these three colours.
// Renderer only: it reads the snapshot and changes nothing of the game.

import { Graphics } from 'pixi.js';

/** The three sides' colours. */
export const SIDE_RING = { town: 0x4c8dff, foe: 0xff4a4a, friend: 0x4cd964 } as const;
export type RingSide = keyof typeof SIDE_RING;
/** How strong the ring is (a downed fighter's fades to a third of it). */
export const SIDE_RING_ALPHA = 0.55;
/** The ring's height as a share of its width (the tile's own 2:1 on the board). */
export const SIDE_RING_SQUASH = 0.46;

export interface RingState {
  side: RingSide;
  /** The ring's width (px). */
  w: number;
  /** Struck down: the ring fades. */
  down?: boolean;
  /** The one whose turn it is: a brighter ring with a thin white line. */
  active?: boolean;
}

/** A fighter's ring: add `g` to the scene, then `set` it each frame (it redraws only when something changed). */
export class SideRing {
  readonly g = new Graphics();
  private drawnKey = '';

  set(s: RingState | null, x: number, y: number, z: number): void {
    const g = this.g;
    if (!s) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(Math.round(x), Math.round(y));
    g.zIndex = z;
    const w = Math.max(8, Math.round(s.w));
    const key = `${s.side}:${w}:${s.down ? 1 : 0}:${s.active ? 1 : 0}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    const rx = w / 2;
    const ry = (w * SIDE_RING_SQUASH) / 2;
    const fade = s.down ? 0.33 : 1;
    const a = Math.min(1, SIDE_RING_ALPHA * fade * (s.active ? 1.5 : 1));
    g.clear();
    // (a soft dark edge outside, a faint fill, then the colour)
    g.ellipse(0, 0, rx + 1, ry + 0.5).stroke({ color: 0x000000, width: 3, alpha: 0.5 * fade });
    g.ellipse(0, 0, rx, ry).fill({ color: SIDE_RING[s.side], alpha: 0.12 * fade });
    g.ellipse(0, 0, rx, ry).stroke({ color: SIDE_RING[s.side], width: s.active ? 2 : 1.5, alpha: a });
    if (s.active) g.ellipse(0, 0, rx + 2.5, ry + 1.2).stroke({ color: 0xffffff, width: 1, alpha: 0.8 });
  }
}
