// Leaves drifting down over the town in autumn: a few at a time, tumbling (a leaf is two pixels, turned edge-on and
// flat as it spins), in the season's reds and golds. Drawn in screen space over the town, like the snow.

import { Graphics } from 'pixi.js';
import { STRIP_HEIGHT } from '../../shared/constants';

const LEAVES = 40;
const GROUND = STRIP_HEIGHT - 8;
const COLORS = [0xc8642a, 0xd89a32, 0xa84a26, 0xe0b848, 0x8a5a2a];

interface Leaf {
  x: number;
  y: number;
  speed: number;
  sway: number;
  spin: number;
  color: number;
}

export class LeavesView {
  readonly root = new Graphics();
  private leaves: Leaf[] = [];
  /** Autumn, and not raining or snowing. */
  on = false;

  constructor() {
    for (let i = 0; i < LEAVES; i++) this.leaves.push(this.fresh(Math.random() * GROUND));
  }

  private fresh(y: number): Leaf {
    return { x: Math.random(), y, speed: 8 + Math.random() * 10, sway: Math.random() * 6.3, spin: 2 + Math.random() * 4, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  }

  render(now: number, dt: number, width: number): void {
    this.root.visible = this.on;
    if (!this.on) return;
    const g = this.root.clear();
    const t = now / 1000;
    for (let i = 0; i < this.leaves.length; i++) {
      const f = this.leaves[i];
      f.y += f.speed * dt;
      // (they swing from side to side as they fall, and drift with the breeze)
      f.x += (5 + Math.sin(t * 1.3 + f.sway) * 14) * dt / Math.max(1, width);
      if (f.y > GROUND) this.leaves[i] = this.fresh(-2);
      const x = Math.round((((f.x % 1) + 1) % 1) * width);
      const y = Math.round(f.y);
      const flat = Math.sin(t * f.spin + f.sway) > 0;
      // (a leaf is three pixels long and two wide: drawn flat, then edge-on, as it spins)
      if (flat) g.rect(x, y, 3, 2).fill(f.color).rect(x + 2, y, 1, 1).fill(0x5a3a1a);
      else g.rect(x, y, 2, 3).fill(f.color);
    }
  }
}
