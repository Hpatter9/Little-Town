// The animals in the pens behind the town (sim/livestock.ts): as many as each pen holds, ambling about inside it,
// stopping to graze. Drawn in the background layer's own coordinates (it's added to that layer by TownView).

import { Container, Sprite } from 'pixi.js';
import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { HERDS, type HerdDef } from '../../shared/data/livestock';
import type { Building } from '../../shared/sim/state';
import { animalFrames } from '../art/livestockArt';
import { haze } from '../art/pixelArt';

/** Where the pens' floors are in the background layer (buildings stand at y 6 there). */
const FLOOR_Y = 5;
const TONE = haze(0.2);

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

export class HerdsView {
  readonly root = new Container();
  private readonly pens = new Map<number, { lo: number; hi: number; look: HerdDef['look']; beasts: Beast[] }>();

  /** Match the animals to the pens and their head counts. */
  update(buildings: readonly Building[]): void {
    const seen = new Set<number>();
    for (const b of buildings) {
      const herd = HERDS[b.def];
      if (!herd || b.status !== 'done' || !b.herd) continue;
      seen.add(b.id);
      const w = BUILDING_BY_ID[b.def].width * TILE;
      let pen = this.pens.get(b.id);
      if (!pen) {
        pen = { lo: b.tile * TILE + 5, hi: b.tile * TILE + w - 5, look: herd.look, beasts: [] };
        this.pens.set(b.id, pen);
      }
      while (pen.beasts.length < b.herd.head) pen.beasts.push(this.spawn(b.id * 31 + pen.beasts.length, pen));
      while (pen.beasts.length > b.herd.head) pen.beasts.pop()!.sprite.destroy();
    }
    for (const [id, pen] of this.pens) {
      if (seen.has(id)) continue;
      for (const a of pen.beasts) a.sprite.destroy();
      this.pens.delete(id);
    }
  }

  private spawn(n: number, pen: { lo: number; hi: number; look: HerdDef['look'] }): Beast {
    const frames = animalFrames(pen.look, n, TONE, 'back');
    const sprite = this.root.addChild(new Sprite(frames.walk[0].texture));
    sprite.anchor.set(0.5, 1);
    const r = (k: number) => ((Math.sin(n * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { sprite, x: pen.lo + r(1) * (pen.hi - pen.lo), y: FLOOR_Y - Math.floor(r(2) * 3), dir: r(3) < 0.5 ? 1 : -1, still: 0, speed: 3 + r(4) * 4, n };
  }

  /** Move everyone a frame on. */
  render(now: number, dt: number): void {
    for (const pen of this.pens.values()) {
      for (const a of pen.beasts) {
        const frames = animalFrames(pen.look, a.n, TONE, 'back');
        if (now < a.still) {
          a.sprite.texture = frames.graze.texture;
        } else {
          a.x += a.dir * a.speed * dt;
          if (a.x < pen.lo || a.x > pen.hi) {
            a.dir = a.x < pen.lo ? 1 : -1;
            a.x = Math.max(pen.lo, Math.min(pen.hi, a.x));
          }
          a.sprite.texture = frames.walk[Math.floor(now / 260 + a.n) % 2].texture;
          // now and then, stop to graze (or peck), or turn round
          if (Math.random() < dt * 0.35) a.still = now + 1500 + Math.random() * 4000;
          else if (Math.random() < dt * 0.1) a.dir = a.dir === 1 ? -1 : 1;
        }
        a.sprite.position.set(Math.round(a.x), a.y);
        a.sprite.scale.x = a.dir;
      }
    }
  }
}
