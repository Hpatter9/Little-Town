// The animals in the pens (sim/livestock.ts) on the top-down map: as many as each pen holds, ambling about inside
// its footprint and stopping to graze, drawn among the map's things (sorted by their feet) with the town's own
// painted farm animals (art/livestockArt.ts).

import { Container, Sprite } from 'pixi.js';
import { HERDS, type HerdDef } from '../../shared/data/livestock';
import { footprint } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { animalFrames } from '../art/livestockArt';
import { noTone } from '../art/pixelArt';

/** How far in from the fence the animals keep (px). */
const INSET = 6;

interface Beast {
  sprite: Sprite;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Standing still (grazing) until this time. */
  still: number;
  speed: number;
  n: number;
}

interface Pen {
  box: { x0: number; y0: number; x1: number; y1: number };
  look: HerdDef['look'];
  beasts: Beast[];
}

export class MapHerds {
  private readonly pens = new Map<number, Pen>();

  constructor(private readonly layer: Container) {}

  /** Match the animals to the pens and their head counts. */
  update(buildings: readonly Building[]): void {
    const seen = new Set<number>();
    for (const b of buildings) {
      const herd = HERDS[b.def];
      if (!herd || b.status !== 'done' || !b.herd) continue;
      seen.add(b.id);
      let pen = this.pens.get(b.id);
      if (!pen) {
        const f = footprint(b);
        pen = {
          box: { x0: f.x * CELL + INSET, y0: f.y * CELL + INSET + 8, x1: (f.x + f.w) * CELL - INSET, y1: (f.y + f.h) * CELL - INSET },
          look: herd.look,
          beasts: [],
        };
        this.pens.set(b.id, pen);
      }
      // (a pen widened for its herd: the animals roam the new ground too)
      const f = footprint(b);
      pen.box = { x0: f.x * CELL + INSET, y0: f.y * CELL + INSET + 8, x1: (f.x + f.w) * CELL - INSET, y1: (f.y + f.h) * CELL - INSET };
      while (pen.beasts.length < b.herd.head) pen.beasts.push(this.spawn(b.id * 31 + pen.beasts.length, pen));
      while (pen.beasts.length > b.herd.head) pen.beasts.pop()!.sprite.destroy();
    }
    for (const [id, pen] of this.pens) {
      if (seen.has(id)) continue;
      for (const a of pen.beasts) a.sprite.destroy();
      this.pens.delete(id);
    }
  }

  private spawn(n: number, pen: Pen): Beast {
    const frames = animalFrames(pen.look, n, noTone, 'map');
    const sprite = this.layer.addChild(new Sprite(frames.walk[0].texture));
    sprite.anchor.set(0.5, 1);
    const r = (k: number) => ((((Math.sin(n * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1);
    const { x0, y0, x1, y1 } = pen.box;
    return { sprite, x: x0 + r(1) * (x1 - x0), y: y0 + r(2) * (y1 - y0), dir: r(3) < 0.5 ? 1 : -1, still: 0, speed: 3 + r(4) * 4, n };
  }

  /** Move everyone a frame on. */
  render(now: number, dt: number): void {
    for (const pen of this.pens.values()) {
      const { x0, y0, x1, y1 } = pen.box;
      for (const a of pen.beasts) {
        const frames = animalFrames(pen.look, a.n, noTone, 'map');
        if (now < a.still) {
          a.sprite.texture = frames.graze.texture;
        } else {
          a.x += a.dir * a.speed * dt;
          // (a little drift up and down the pen as they go)
          a.y += Math.sin(now / 900 + a.n) * a.speed * 0.3 * dt;
          if (a.x < x0 || a.x > x1) {
            a.dir = a.x < x0 ? 1 : -1;
            a.x = Math.max(x0, Math.min(x1, a.x));
          }
          a.y = Math.max(y0, Math.min(y1, a.y));
          a.sprite.texture = frames.walk[Math.floor(now / 260 + a.n) % 2].texture;
          // now and then, stop to graze (or peck), or turn round
          if (Math.random() < dt * 0.35) a.still = now + 1500 + Math.random() * 4000;
          else if (Math.random() < dt * 0.1) a.dir = a.dir === 1 ? -1 : 1;
        }
        a.sprite.position.set(Math.round(a.x), Math.round(a.y));
        a.sprite.scale.x = a.dir;
        a.sprite.zIndex = a.y;
      }
    }
  }
}
