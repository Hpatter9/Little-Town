// Traffic on the roads (the owner's ask): now and then a carter comes along the town's roads, a horse drawing the
// Village pack's cart (the horse from the creature sheets), turning where the road turns, and goes on out of view or
// fades away at a road's end. By day, in fair enough weather, never in a raid; at most `MOST`. None on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, isRoad, type LandMap } from '../../shared/sim/land';
import { creatureFrame } from '../art/creatures';
import { loadImage } from '../art/loadImage';
import cartUrl from '../art/village/cart.png';
import { visibility } from './groundArt';
import { nextRoadCell } from './trafficRules';

const MOST = 2;
/** Seconds between carts (on average), their pace (px a second) and the most road cells one goes before leaving. */
const EVERY = 22;
const PACE = 22;
const LONGEST = 40;
const HORSE_K = 0.75;

interface Cart {
  horse: Sprite;
  cart: Sprite;
  from: { x: number; y: number };
  to: { x: number; y: number };
  prev: { x: number; y: number } | null;
  t: number;
  steps: number;
  facing: 'left' | 'right';
  alpha: number;
  leaving: boolean;
  coat: number;
  walked: number;
}

export class RoadTraffic {
  private cartTex: Texture | null = null;
  private readonly carts: Cart[] = [];
  due = EVERY * 0.4;
  on = false;
  land: LandMap | null = null;

  constructor(private readonly layer: Container) {
    loadImage(cartUrl)
      .then((im) => {
        this.cartTex = Texture.from(im);
        this.cartTex.source.scaleMode = 'nearest';
      })
      .catch(() => undefined);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, calm: boolean): void {
    const land = this.land;
    if (calm || !land || !this.cartTex) {
      while (this.carts.length) this.drop(0);
      return;
    }
    const road = (x: number, y: number) => isRoad(land, x, y);
    this.due -= dt;
    if (this.on && this.due <= 0 && this.carts.length < MOST) {
      this.due = EVERY * (0.5 + Math.random());
      for (let tries = 0; tries < 25; tries++) {
        const cx = Math.floor((view.x + Math.random() * view.w) / CELL);
        const cy = Math.floor((view.y + Math.random() * view.h) / CELL);
        if (!road(cx, cy) || visibility(land, cx, cy) !== 2) continue;
        const next = nextRoadCell(road, { x: cx, y: cy }, null, Math.random());
        if (!next) continue;
        const horse = this.layer.addChild(new Sprite());
        horse.anchor.set(0.5, 0.95);
        const cart = this.layer.addChild(new Sprite(this.cartTex));
        cart.anchor.set(0.5, 0.95);
        this.carts.push({ horse, cart, from: { x: cx, y: cy }, to: next, prev: null, t: 0, steps: 0, facing: next.x < cx ? 'left' : 'right', alpha: 0, leaving: false, coat: Math.floor(Math.random() * 4), walked: 0 });
        break;
      }
    }
    for (let i = this.carts.length - 1; i >= 0; i--) {
      const c = this.carts[i];
      c.t += (PACE * dt) / CELL;
      c.walked += PACE * dt;
      while (c.t >= 1) {
        c.t -= 1;
        c.steps++;
        const n = nextRoadCell(road, c.to, c.from, Math.random());
        c.prev = c.from;
        c.from = c.to;
        if (!n || c.steps > LONGEST || !this.on) {
          c.leaving = true;
          c.to = { x: c.from.x + (c.from.x - c.prev.x), y: c.from.y + (c.from.y - c.prev.y) };
        } else c.to = n;
        if (c.to.x !== c.from.x) c.facing = c.to.x < c.from.x ? 'left' : 'right';
      }
      c.alpha = Math.max(0, Math.min(1, c.alpha + (c.leaving ? -dt : dt) * 1.5));
      if (c.leaving && c.alpha <= 0) {
        this.drop(i);
        continue;
      }
      const x = (c.from.x + (c.to.x - c.from.x) * c.t + 0.5) * CELL;
      const y = (c.from.y + (c.to.y - c.from.y) * c.t + 0.62) * CELL;
      const dir = c.facing === 'right' ? 1 : -1;
      c.horse.texture = creatureFrame('horse', c.coat, c.facing, Math.floor(c.walked / 8) % 3);
      c.horse.scale.set(HORSE_K);
      c.horse.position.set(Math.round(x + dir * 14), Math.round(y));
      c.cart.scale.set(dir, 1);
      c.cart.position.set(Math.round(x - dir * 12), Math.round(y + 1));
      c.horse.alpha = c.cart.alpha = c.alpha;
      c.horse.zIndex = y + 0.1;
      c.cart.zIndex = y;
    }
  }

  private drop(i: number): void {
    const c = this.carts[i];
    c.horse.destroy();
    c.cart.destroy();
    this.carts.splice(i, 1);
  }
}
