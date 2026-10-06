// A natural disaster on the map (sim/disasters.ts, snapshot `disaster`): the flood's water lying over the cells it has
// reached, its surface rippling; the wildfire's flames (the Fields pack's campfire frames, several to a cell) on the
// woods alight, with smoke-dark ground under them; and the ash it leaves, fading over two days. The tornado and the
// earthquake's dust are spell effects (mapSpells: `disaster:tornado`, `disaster:dust`), and the quake shakes the
// screen (the sim's `bossShake`).

import { AnimatedSprite, Container, Graphics, Texture } from 'pixi.js';
import { campfirePack } from '../art/fieldTiles';
import type { Snapshot } from '../../shared/sim/snapshot';

const CELL = 32;
/** Flames to a burning cell, and where in it. */
const FLAMES: [number, number][] = [[8, 22], [22, 14], [16, 30]];

export class MapDisaster {
  private readonly water = new Graphics();
  private readonly ash = new Graphics();
  private readonly flames = new Container();
  private key = '';
  private fireKey = '';
  private flood: number[] = [];
  private w = 96;
  private t = 0;

  /** `under` is below everything standing; the flames go `over` (a container at the origin among the things would be
   *  culled by the camera). */
  constructor(under: Container, over: Container) {
    under.addChild(this.ash, this.water);
    over.addChild(this.flames);
  }

  sync(d: Snapshot['disaster'], landW: number): void {
    this.w = landW;
    const flood = d?.flood ?? [];
    const ash = d?.ash ?? [];
    const fire = d?.fire ?? [];
    const fireKey = fire.join(',');
    const key = `${flood.length}|${ash.length}|${Math.floor((ash[0]?.[1] ?? 0) / 4)}|${fireKey}`;
    if (key !== this.key) {
      this.key = key;
      this.flood = flood;
      this.ash.clear();
      for (const [i, hours] of ash) {
        const x = (i % landW) * CELL;
        const y = Math.floor(i / landW) * CELL;
        const a = Math.max(0, 0.55 * (1 - hours / 48));
        this.ash.rect(x, y, CELL, CELL).fill({ color: 0x2a2420, alpha: a });
        this.ash.circle(x + 10, y + 12, 3).fill({ color: 0x8a8278, alpha: a });
        this.ash.circle(x + 23, y + 21, 2).fill({ color: 0x6a625a, alpha: a });
      }
      for (const i of fire) this.ash.rect((i % landW) * CELL, Math.floor(i / landW) * CELL, CELL, CELL).fill({ color: 0x3a1a08, alpha: 0.45 });
    }
    if (fireKey !== this.fireKey) {
      this.fireKey = fireKey;
      for (const c of this.flames.removeChildren()) c.destroy();
      const frames = campfirePack();
      for (const i of fire) {
        const x = (i % landW) * CELL;
        const y = Math.floor(i / landW) * CELL;
        if (!frames) continue;
        for (const [fx, fy] of FLAMES) {
          const s = new AnimatedSprite(frames.map((f) => f.texture as Texture));
          s.animationSpeed = 0.18 + ((i + fx) % 5) * 0.02;
          s.gotoAndPlay((i + fx) % frames.length);
          s.anchor.set(0.5, 1);
          s.scale.set(0.9);
          s.position.set(x + fx, y + fy);
          s.zIndex = y + fy;
          this.flames.addChild(s);
        }
      }
      this.flames.sortableChildren = true;
    }
  }

  /** Each frame: the flood's ripple. */
  render(dt: number): void {
    if (!this.flood.length) {
      if (this.water.visible) this.water.clear();
      this.water.visible = false;
      return;
    }
    this.water.visible = true;
    this.t += dt;
    this.water.clear();
    for (const i of this.flood) {
      const x = (i % this.w) * CELL;
      const y = Math.floor(i / this.w) * CELL;
      this.water.rect(x, y, CELL, CELL).fill({ color: 0x3a6ea8, alpha: 0.62 });
      const k = Math.sin(this.t * 2 + i * 0.7) * 0.5 + 0.5;
      this.water.rect(x + 4 + k * 10, y + 9 + (i % 3) * 7, 10, 2).fill({ color: 0xbfe0ff, alpha: 0.35 });
    }
  }
}
