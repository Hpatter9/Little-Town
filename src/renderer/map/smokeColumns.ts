// Smoke over a fire (the owner's ask: where raiders set fires, a column of smoke seen across the map): from every
// building alight a column of dark puffs climbs `SMOKE_HIGH` px, leaning with the wind and spreading as it goes, so
// its top shows over the roofs from far off. The puffs are the 5000 Pixel Effects pack's smoke, darkened (a soft
// glow until the atlas loads). Drawn in the map's `over`, never culled; thinner on a slow phone.

import { Container, Sprite } from 'pixi.js';
import type { Building } from '../../shared/sim/state';
import { footprint } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';
import { pixelFxFrame, pixelFxFrames } from '../art/effects';
import { glowTexture } from '../town/layer';
import { burning, SMOKE_HIGH, smokeRate } from './moodRules';

interface Puff {
  s: Sprite;
  x: number;
  y: number;
  age: number;
  life: number;
  vx: number;
  grow: number;
  frame: number;
}

/** The most puffs at once, how fast they climb (px a second), their tint and how big they start and end (px). */
const PUFFS_MOST = 260;
const CLIMB = SMOKE_HIGH / 7;
const DARK = [0x3a3634, 0x4a4542, 0x2c2a2a];
const START = 18;
const END = 80;
/** In the iso view, how far over the ground (px) a fire's smoke starts: about a roof's height. */
const ISO_LIFT = 26;

export class SmokeColumns {
  readonly root = new Container();
  private readonly puffs: Puff[] = [];
  private readonly spare: Sprite[] = [];
  private fires: { x: number; y: number; due: number }[] = [];

  /** The iso view: a ground point (world px) to the screen. The puffs then climb straight up in iso px, from the building's
   *  middle lifted a little, not squashed along the ground with the map's `over`. */
  private at: ((x: number, y: number) => { x: number; y: number }) | null = null;

  constructor(layer: Container) {
    layer.addChild(this.root);
  }

  useIso(fx: Container, at: (x: number, y: number) => { x: number; y: number }): void {
    fx.addChild(this.root);
    this.at = at;
  }

  /** The buildings alight now (each snapshot). */
  sync(list: Building[]): void {
    const now = burning(list).map((b) => {
      const f = footprint(b);
      return { x: (f.x + f.w / 2) * CELL, y: (f.y + f.h / 2) * CELL - 10 };
    });
    // (keep each fire's timing where it still burns)
    this.fires = now.map((p) => this.fires.find((q) => q.x === p.x && q.y === p.y) ?? { ...p, due: Math.random() * 0.2 });
  }

  /** A frame: each fire puffs, and the puffs climb, drift and fade. `wind` leans the column. */
  render(dt: number, wind: number, calm: boolean): void {
    const every = 1 / smokeRate(calm);
    for (const f of this.fires) {
      f.due -= dt;
      if (f.due > 0 || this.puffs.length >= PUFFS_MOST) continue;
      f.due += every;
      const p = this.at ? this.at(f.x, f.y + 10) : f;
      this.emit(p.x, this.at ? p.y - ISO_LIFT : p.y, wind);
    }
    const frames = pixelFxFrames('white-smoke');
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.s.visible = false;
        this.spare.push(p.s);
        this.puffs.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      p.x += (p.vx + wind * 12 * k) * dt;
      p.y -= CLIMB * (1 - k * 0.4) * dt;
      const tex = frames ? pixelFxFrame('white-smoke', Math.min(frames - 1, p.frame + Math.floor(k * 3))) : null;
      if (tex && p.s.texture !== tex) p.s.texture = tex;
      const size = START + (END - START) * k * p.grow;
      p.s.width = p.s.height = size;
      p.s.position.set(p.x, p.y);
      // (thick low down, thinning as it spreads at the top)
      p.s.alpha = 0.85 * Math.min(1, k * 6) * (1 - k * k);
    }
  }

  private emit(x: number, y: number, wind: number): void {
    const s = this.spare.pop() ?? this.root.addChild(new Sprite(glowTexture()));
    s.anchor.set(0.5);
    s.visible = true;
    s.tint = DARK[Math.floor(Math.random() * DARK.length)];
    s.texture = pixelFxFrame('white-smoke', 0) ?? glowTexture();
    const px = x + (Math.random() - 0.5) * 14;
    this.puffs.push({ s, x: px, y, age: 0, life: 6 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 4 + wind * 2, grow: 0.8 + Math.random() * 0.4, frame: Math.floor(Math.random() * 2) });
  }
}
