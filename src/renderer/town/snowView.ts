// Snow falling over the strip during a Deep Freeze: small flakes drifting down across the screen, thicker when
// the town has nothing left to burn. Drawn in screen space over the whole town.

import { Graphics } from 'pixi.js';
import { STRIP_HEIGHT } from '../../shared/constants';

const FLAKES = 140;
/** The ground line in the strip (flakes melt away there). */
const GROUND = STRIP_HEIGHT - 8;

interface Flake {
  x: number;
  y: number;
  speed: number;
  size: number;
  sway: number;
}

export class SnowView {
  readonly root = new Graphics();
  private flakes: Flake[] = [];
  /** Snowing (a Deep Freeze), and how hard (a blizzard once the fires are out). */
  on = false;
  heavy = false;

  constructor() {
    for (let i = 0; i < FLAKES; i++) this.flakes.push({ x: Math.random(), y: Math.random() * GROUND, speed: 14 + Math.random() * 22, size: Math.random() < 0.25 ? 2 : 1, sway: Math.random() * 6.3 });
  }

  render(now: number, dt: number, width: number): void {
    this.root.visible = this.on;
    if (!this.on) return;
    const g = this.root.clear();
    const shown = this.heavy ? FLAKES : FLAKES / 2;
    const wind = this.heavy ? 18 : 6;
    for (let i = 0; i < shown; i++) {
      const f = this.flakes[i];
      f.y += f.speed * (this.heavy ? 1.6 : 1) * dt;
      f.x += (wind + Math.sin(now / 900 + f.sway) * 8) * dt / Math.max(1, width);
      if (f.y > GROUND) {
        f.y = -2;
        f.x = Math.random();
      }
      const x = Math.round((((f.x % 1) + 1) % 1) * width);
      g.rect(x, Math.round(f.y), f.size, f.size);
    }
    g.fill({ color: 0xf4f8ff, alpha: 0.85 });
  }
}
