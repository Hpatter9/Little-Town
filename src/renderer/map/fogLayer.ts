// The fog of war over the land (iso and top-down alike): one sprite, the size of the land, painted from a canvas of
// a pixel a cell (map/fogRules.ts) and stretched smooth. The canvas is painted again only while the fog moves.

import { Sprite, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import { ease, inSight, paint, targetAlpha } from './fogRules';

/** At most this often (ms) the veil is painted again and sent up to the graphics card. */
const PAINT_MS = 110;

export class FogLayer {
  readonly sprite = new Sprite();
  /** The veil, a pixel a cell: the sprite's picture, and the minimap's. */
  readonly canvas = document.createElement('canvas');
  private tex: Texture | null = null;
  private w = 0;
  private h = 0;
  private cur = new Float32Array(0);
  private want = new Float32Array(0);
  private px: ImageData | null = null;
  private explored: string | undefined;
  private sight: string | undefined;
  private dirty = true;
  private moving = true;
  private last = 0;
  /** Bumped each time the veil is painted (the minimap draws it again then). */
  rev = 0;
  /** Whether there is any fog (a town without a record has none). */
  on = false;

  constructor() {
    this.sprite.eventMode = 'none';
    this.sprite.visible = false;
  }

  /** Each snapshot: the land's size, and what has been seen and what is in sight. */
  sync(w: number, h: number, explored: string | undefined, sight: string | undefined): void {
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.cur = new Float32Array(w * h);
      this.want = new Float32Array(w * h);
      this.px = new ImageData(w, h);
      this.tex?.destroy(true);
      this.tex = Texture.from(this.canvas);
      this.tex.source.scaleMode = 'linear';
      this.sprite.texture = this.tex;
      this.sprite.width = w * CELL;
      this.sprite.height = h * CELL;
      this.explored = undefined;
      this.sight = undefined;
      this.dirty = true;
      this.on = false;
    }
    if (explored === this.explored && sight === this.sight) return;
    const first = this.explored === undefined && explored !== undefined;
    this.explored = explored;
    this.sight = sight;
    targetAlpha(explored, sight, this.want);
    if (first || !this.on) this.cur.set(this.want); // (a first sight of the fog is not faded in)
    this.on = explored !== undefined;
    this.sprite.visible = this.on;
    this.moving = true;
    this.dirty = true;
  }

  /** Each frame: ease the veil and paint it again, but not every frame. */
  render(now: number): void {
    if (!this.on || !this.px || !this.dirty || now - this.last < PAINT_MS) return;
    this.last = now;
    this.moving = ease(this.cur, this.want);
    paint(this.cur, this.w, this.h, this.px.data);
    this.canvas.getContext('2d')!.putImageData(this.px, 0, 0);
    this.tex?.source.update();
    this.rev++;
    this.dirty = this.moving;
  }

  /** Whether a point (px) is in sight now. */
  seen(x: number, y: number): boolean {
    return !this.on || inSight(this.sight, this.w, CELL, x, y, this.h);
  }
}
