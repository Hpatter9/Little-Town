// What a fight leaves lying about (state.ts `markDebris`): DawnLike's dropped blades, shields, arrows and bones on the
// ground where raiders and beasts fell, turned every which way, fading over the day as the town clears them away.
// Drawn under everything standing (MapView's `under`).

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { DEBRIS_LASTS, type DebrisKind } from '../../shared/sim/state';
import type { Snapshot } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import shortWep from '../art/items/ShortWep.png';
import shield from '../art/items/Shield.png';
import ammo from '../art/items/Ammo.png';
import flesh from '../art/items/Flesh.png';

/** Each kind's cells (16px) on its sheet. */
const CELLS: Record<DebrisKind, [string, [number, number][]]> = {
  blade: [shortWep, [[0, 0], [1, 0], [2, 0], [4, 0], [5, 0], [7, 0]]],
  shield: [shield, [[0, 0], [1, 0], [2, 0], [3, 0], [5, 0], [6, 0]]],
  arrows: [ammo, [[0, 2], [1, 2], [3, 2], [5, 2]]],
  bones: [flesh, [[1, 1], [2, 1], [2, 0]]],
};
const SIZE = 16;

export class BattleDebris {
  private readonly tex = new Map<DebrisKind, Texture[]>();
  private readonly drawn = new Map<string, Sprite>();

  constructor(private readonly layer: Container) {
    for (const [kind, [url, cells]] of Object.entries(CELLS) as [DebrisKind, [string, [number, number][]]][])
      loadImage(url)
        .then((im) => {
          const base = Texture.from(im);
          base.source.scaleMode = 'nearest';
          this.tex.set(kind, cells.map(([x, y]) => new Texture({ source: base.source, frame: new Rectangle(x * SIZE, y * SIZE, SIZE, SIZE) })));
        })
        .catch(() => undefined);
  }

  sync(marks: Snapshot['debris']): void {
    const seen = new Set<string>();
    for (const m of marks) {
      const list = this.tex.get(m.kind);
      if (!list) continue;
      seen.add(m.key);
      let sp = this.drawn.get(m.key);
      if (!sp) {
        const h = Math.abs(Math.sin(m.x * 12.9898 + m.y * 78.233) * 43758.5453) % 1;
        sp = this.layer.addChild(new Sprite(list[Math.floor(h * list.length)]));
        sp.anchor.set(0.5);
        // (lying flat, turned any way; a little flattened, as seen from above at an angle)
        sp.rotation = h * Math.PI * 2;
        sp.scale.set(0.9, 0.75);
        sp.position.set(m.x, m.y - 2);
        sp.tint = 0xd8d0c8;
        this.drawn.set(m.key, sp);
      }
      // (cleared away through the day: fading over its last half)
      sp.alpha = Math.min(1, ((DEBRIS_LASTS - m.age) / DEBRIS_LASTS) * 2);
    }
    for (const [k, sp] of this.drawn)
      if (!seen.has(k)) {
        sp.destroy();
        this.drawn.delete(k);
      }
  }
}
