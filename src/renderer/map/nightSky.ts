// The night sky over the top-down map (the owner's ask: stars, the moon, shooting stars, the aurora): the land beyond
// what the town knows lies black, and at night stars twinkle in it; now and then a shooting star streaks across the
// view; in the cold lands green and violet curtains of the aurora ripple over the top of the view. All in the map's
// lights layer, which is dark by day and fades up after dusk. None on a slow phone (`calm`).

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CELL, type LandMap } from '../../shared/sim/land';
import { glowTexture } from '../town/layer';
import { visibility } from './groundArt';

/** How many stars at most, and how often a shooting star crosses (seconds, at random up to twice). */
const STARS_MOST = 70;
const SHOOT_EVERY = 14;
const AURORA_BANDS = 4;

interface Star {
  s: Sprite;
  x: number;
  y: number;
  phase: number;
  speed: number;
}

export class NightSky {
  private readonly layer = new Container();
  private readonly stars: Star[] = [];
  private shooting: { g: Graphics; x: number; y: number; vx: number; vy: number; age: number } | null = null;
  private shootIn = SHOOT_EVERY;
  private readonly aurora: Sprite[] = [];
  private t = 0;
  /** Per snapshot (main.ts): the cold lands' aurora, a clear enough sky. */
  cold = false;
  clear = true;

  constructor(lights: Container) {
    lights.addChild(this.layer);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, land: LandMap | null, night: number, calm: boolean): void {
    this.t += dt;
    const on = !calm && night > 0.15 && this.clear && !!land;
    this.layer.visible = on;
    if (!on || !land) return;
    // stars: in the black beyond the known land, in view; one gone out of view is placed again
    const inView = (x: number, y: number) => x > view.x - 20 && x < view.x + view.w + 20 && y > view.y - 20 && y < view.y + view.h + 20;
    for (let i = this.stars.length - 1; i >= 0; i--)
      if (!inView(this.stars[i].x, this.stars[i].y)) {
        this.stars[i].s.destroy();
        this.stars.splice(i, 1);
      }
    for (let tries = 0; this.stars.length < STARS_MOST && tries < 30; tries++) {
      const x = view.x + Math.random() * view.w;
      const y = view.y + Math.random() * view.h;
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      if (cx >= 0 && cy >= 0 && cx < land.w && cy < land.h && visibility(land, cx, cy) !== 0) continue;
      const s = this.layer.addChild(new Sprite(Texture.WHITE));
      const big = Math.random() < 0.15;
      s.width = s.height = big ? 2 : 1;
      s.anchor.set(0.5);
      s.tint = Math.random() < 0.2 ? 0xc8d8ff : Math.random() < 0.1 ? 0xffe8c0 : 0xffffff;
      s.position.set(Math.round(x), Math.round(y));
      this.stars.push({ s, x, y, phase: Math.random() * 6, speed: 0.8 + Math.random() * 2.5 });
    }
    for (const st of this.stars) st.s.alpha = 0.35 + 0.65 * Math.abs(Math.sin(this.t * st.speed * 0.5 + st.phase));
    // a shooting star now and then: a bright head and a fading tail, across the view
    this.shootIn -= dt;
    if (!this.shooting && this.shootIn <= 0) {
      this.shootIn = SHOOT_EVERY * (0.5 + Math.random() * 1.5);
      const g = this.layer.addChild(new Graphics());
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.shooting = { g, x: view.x + view.w * (0.2 + Math.random() * 0.6), y: view.y + view.h * (0.05 + Math.random() * 0.3), vx: dir * (260 + Math.random() * 160), vy: 90 + Math.random() * 80, age: 0 };
    }
    const sh = this.shooting;
    if (sh) {
      sh.age += dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      const k = Math.max(0, 1 - sh.age / 0.9);
      sh.g.clear();
      for (let i = 0; i < 8; i++) {
        const f = i / 8;
        sh.g.rect(sh.x - sh.vx * 0.06 * f - 1, sh.y - sh.vy * 0.06 * f - 1, 2 - f, 2 - f).fill({ color: 0xffffff, alpha: k * (1 - f) });
      }
      if (sh.age > 0.9) {
        sh.g.destroy();
        this.shooting = null;
      }
    }
    // the aurora: wide soft bands over the top of the view, swaying and shifting their colour
    const want = this.cold ? AURORA_BANDS : 0;
    while (this.aurora.length > want) this.aurora.pop()!.destroy();
    while (this.aurora.length < want) {
      const a = this.layer.addChild(new Sprite(glowTexture()));
      a.anchor.set(0.5);
      this.aurora.push(a);
    }
    this.aurora.forEach((a, i) => {
      const sway = Math.sin(this.t * 0.25 + i * 1.7);
      a.position.set(view.x + view.w * (0.15 + 0.23 * i) + sway * 30, view.y + view.h * 0.12 + Math.sin(this.t * 0.4 + i) * 12);
      a.width = view.w * 0.45;
      a.height = view.h * (0.12 + 0.05 * Math.sin(this.t * 0.3 + i * 2));
      a.rotation = sway * 0.15;
      a.tint = i % 2 ? 0x50ffa0 : 0x7a60ff;
      a.alpha = 0.18 + 0.1 * Math.sin(this.t * 0.6 + i);
    });
  }
}
