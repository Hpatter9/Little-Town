// The leylines on the map (sim/magic.ts `leyOf`): once the town has learned Leyline Lore, the lines of power across the
// land glow faintly after dark, brighter where they cross (the wells) and round a Mage Tower drinking from one, and they
// pulse slowly. Drawn in MapView's `lights` layer (additive, faded in after dusk), so by day they don't show at all.
// Redrawn only when the lines or the towers change.

import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import type { MagicView } from '../../shared/sim/magic';
import { glowTexture } from '../town/layer';

const LINE = 0x7a6cff;
const CORE = 0xc8b8ff;
const WELL = 0xa080ff;

export class MapLeylines {
  private readonly root = new Container();
  private readonly lines = new Graphics();
  private readonly glows: Sprite[] = [];
  private key = '';
  private t = 0;

  constructor(lights: Container) {
    this.root.addChild(this.lines);
    lights.addChild(this.root);
  }

  sync(m: MagicView | null): void {
    const key = m ? JSON.stringify([m.ley.lines.length, m.ley.lines[0], m.towers]) : '';
    if (key === this.key) return;
    this.key = key;
    this.lines.clear();
    for (const g of this.glows) g.destroy();
    this.glows.length = 0;
    if (!m) return;
    for (const [x1, y1, x2, y2] of m.ley.lines) {
      this.lines.moveTo(x1 * CELL, y1 * CELL).lineTo(x2 * CELL, y2 * CELL).stroke({ width: CELL * 1.6, color: LINE, alpha: 0.12 });
      this.lines.moveTo(x1 * CELL, y1 * CELL).lineTo(x2 * CELL, y2 * CELL).stroke({ width: 3, color: CORE, alpha: 0.35 });
    }
    const glow = (x: number, y: number, r: number, color: number) => {
      const g = this.root.addChild(new Sprite(glowTexture()));
      g.anchor.set(0.5);
      g.position.set(x, y);
      g.width = g.height = r;
      g.tint = color;
      this.glows.push(g);
    };
    for (const w of m.ley.wells) glow((w.x + 0.5) * CELL, (w.y + 0.5) * CELL, CELL * 7, WELL);
    for (const t of m.towers) glow((t.x + 1) * CELL, (t.y + 1) * CELL, CELL * (3 + t.ley * 2), CORE);
  }

  /** A slow pulse (held still when the motion is calmed). */
  render(dt: number, calm: boolean): void {
    if (!this.key) return;
    this.t += calm ? 0 : dt;
    this.root.alpha = 0.75 + 0.25 * Math.sin(this.t * 1.3);
  }
}
