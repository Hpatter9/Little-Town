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
/** By day in fair weather the grazing beasts are let out to the pasture before their pen (the owner's ask: herds led
 *  out to graze and brought back at dusk): this many cells below it and a cell either side. Hens stay in. */
const PASTURE_CELLS = 3;
const GRAZERS = new Set(['goat', 'sheep', 'cow']);

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
  /** The pasture they're let out to. */
  field: { x0: number; y0: number; x1: number; y1: number };
  box: { x0: number; y0: number; x1: number; y1: number };
  look: HerdDef['look'];
  beasts: Beast[];
}

export class MapHerds {
  private readonly pens = new Map<number, Pen>();
  /** Out to pasture now (main.ts: by day, fair weather, not winter, no raid). */
  grazing = false;

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
          field: { x0: 0, y0: 0, x1: 0, y1: 0 },
          box: { x0: f.x * CELL + INSET, y0: f.y * CELL + INSET + 8, x1: (f.x + f.w) * CELL - INSET, y1: (f.y + f.h) * CELL - INSET },
          look: herd.look,
          beasts: [],
        };
        this.pens.set(b.id, pen);
      }
      // (a pen widened for its herd: the animals roam the new ground too)
      const f = footprint(b);
      pen.box = { x0: f.x * CELL + INSET, y0: f.y * CELL + INSET + 8, x1: (f.x + f.w) * CELL - INSET, y1: (f.y + f.h) * CELL - INSET };
      // (a pasture with something built on it is no pasture: they stay in)
      const fx0 = f.x - 1, fy0 = f.y + f.h, fx1 = f.x + f.w + 1, fy1 = f.y + f.h + PASTURE_CELLS;
      const blocked = buildings.some((o) => {
        if (o === b) return false;
        const g = footprint(o);
        return g.x < fx1 && g.x + g.w > fx0 && g.y < fy1 && g.y + g.h > fy0;
      });
      pen.field = blocked ? pen.box : { x0: fx0 * CELL + INSET, y0: fy0 * CELL + INSET, x1: fx1 * CELL - INSET, y1: fy1 * CELL - INSET };
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
      const out = this.grazing && GRAZERS.has(pen.look);
      const { x0, y0, x1, y1 } = out ? pen.field : pen.box;
      for (const a of pen.beasts) {
        const frames = animalFrames(pen.look, a.n, noTone, 'map');
        // (outside where they belong now: walking out to the pasture, or home to the pen at dusk, in a file)
        const away = a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 1;
        if (away) {
          const tx = Math.max(x0, Math.min(x1, a.x));
          const ty = Math.max(y0, Math.min(y1, a.y)) + (out ? 4 : -4);
          const dx = tx - a.x, dy = ty - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const step = Math.min(d, a.speed * 3 * dt);
          a.x += (dx / d) * step;
          a.y += (dy / d) * step;
          if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
          a.sprite.texture = frames.walk[Math.floor(now / 200 + a.n) % 2].texture;
        } else if (now < a.still) {
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
