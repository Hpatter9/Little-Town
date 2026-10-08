// Life on the rivers (the owner's ask: barges and skiffs moving along the water): now and then a boat of the age (a
// dugout in the Stone Age, a longboat, a steamer, a launch, a hydrofoil) comes along the river or across the lake in
// view, a wake spreading behind her, and is gone off the water's end. By day in fair enough weather, never on ice, at
// most `MOST`. The painted boats of art/boatArt.ts (no pack has a working boat). None on a slow phone.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Era } from '../../shared/data/eras';
import type { BoatKind } from '../../shared/data/boats';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import { boatArt, MAP_LENGTH } from '../art/boatArt';
import { visibility } from './groundArt';
import { freezes, iceAt } from './ice';

const MOST = 2;
/** Seconds between boats coming along (on average), and their pace (px a second). */
const EVERY = 30;
const PACE = 16;
export const SKIFF_OF: Record<Era, BoatKind> = { neolithic: 'dugout', medieval: 'longboat', industrial: 'steamer', modern: 'motor_launch', space: 'hydrofoil' };

interface Skiff {
  s: Sprite;
  wake: Graphics;
  x: number;
  y: number;
  dx: number;
  dy: number;
  alpha: number;
  leaving: boolean;
}

export class MapSkiffs {
  private readonly skiffs: Skiff[] = [];
  due = EVERY * 0.3;
  /** Per snapshot (main.ts). */
  on = false;
  era: Era = 'neolithic';
  season = 'summer';
  land: LandMap | null = null;

  constructor(private readonly layer: Container) {}

  render(dt: number, view: { x: number; y: number; w: number; h: number }, calm: boolean): void {
    const land = this.land;
    if (calm || !land) {
      while (this.skiffs.length) this.drop(0);
      return;
    }
    const open = (cx: number, cy: number) => groundAt(land, cx, cy) === 'water' && !(freezes(this.season) && iceAt((x, y) => groundAt(land, x, y) === 'water', cx, cy));
    this.due -= dt;
    if (this.on && this.due <= 0 && this.skiffs.length < MOST) {
      this.due = EVERY * (0.5 + Math.random());
      // a water cell in view, and the way along it the water runs longest
      for (let tries = 0; tries < 20; tries++) {
        const cx = Math.floor((view.x + Math.random() * view.w) / CELL);
        const cy = Math.floor((view.y + Math.random() * view.h) / CELL);
        if (!open(cx, cy) || visibility(land, cx, cy) !== 2) continue;
        const run = (dx: number, dy: number) => {
          let n = 0;
          while (n < 12 && open(cx + dx * (n + 1), cy + dy * (n + 1))) n++;
          return n;
        };
        const [e, w, sth, n] = [run(1, 0), run(-1, 0), run(0, 1), run(0, -1)];
        const across = e + w;
        const down = sth + n;
        if (Math.max(across, down) < 4) continue;
        const sideways = across >= down;
        // (setting off the way the water runs longest)
        const dir = sideways ? (e >= w ? 1 : -1) : sth >= n ? 1 : -1;
        const kind = SKIFF_OF[this.era];
        const s = this.layer.addChild(new Sprite(boatArt(kind, MAP_LENGTH[kind] * 0.8).texture));
        s.anchor.set(0.5, 0.92);
        s.alpha = 0;
        const wake = this.layer.addChild(new Graphics());
        this.skiffs.push({ s, wake, x: (cx + 0.5) * CELL, y: (cy + 0.7) * CELL, dx: sideways ? dir : 0, dy: sideways ? 0 : dir, alpha: 0, leaving: false });
        break;
      }
    }
    for (let i = this.skiffs.length - 1; i >= 0; i--) {
      const k = this.skiffs[i];
      k.x += k.dx * PACE * dt;
      k.y += k.dy * PACE * dt * 0.7;
      const ahead = { x: Math.floor((k.x + k.dx * 26) / CELL), y: Math.floor((k.y + k.dy * 18) / CELL) };
      if (!open(ahead.x, ahead.y) || !this.on) k.leaving = true;
      k.alpha = Math.max(0, Math.min(1, k.alpha + (k.leaving ? -dt : dt)));
      if (k.leaving && k.alpha <= 0) {
        this.drop(i);
        continue;
      }
      // (she faces the way she goes; going up or down the water she's seen side-on all the same)
      k.s.scale.x = k.dx < 0 ? -1 : 1;
      k.s.alpha = k.alpha;
      const bob = Math.sin(performance.now() / 650 + i) * 1;
      k.s.position.set(Math.round(k.x), Math.round(k.y + bob));
      k.s.zIndex = k.y;
      // a V of ripples spreading behind
      const back = k.dx ? -k.dx : 0;
      k.wake.clear();
      for (let j = 1; j <= 3; j++) {
        const bx = back * (14 + j * 7);
        const spread = 2 + j * 2.5;
        k.wake.moveTo(back * 12, 0).lineTo(bx, -spread).stroke({ width: 1, color: 0xe8f6f4, alpha: (0.5 - j * 0.12) * k.alpha });
        k.wake.moveTo(back * 12, 0).lineTo(bx, spread).stroke({ width: 1, color: 0xe8f6f4, alpha: (0.5 - j * 0.12) * k.alpha });
      }
      k.wake.position.set(Math.round(k.x), Math.round(k.y - 2));
      k.wake.zIndex = k.y - 1;
    }
  }

  private drop(i: number): void {
    const k = this.skiffs[i];
    k.s.destroy();
    k.wake.destroy();
    this.skiffs.splice(i, 1);
  }
}
