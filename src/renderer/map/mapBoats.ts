// The town's boats at home (sim/boats.ts), moored in the water by the boatyard: side by side along the mooring,
// bobbing on the swell, drawn among the map's things (sorted by their feet) with the painted boats of art/boatArt.ts.
// A boat away with a party isn't there.

import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import type { Snapshot } from '../../shared/sim/snapshot';
import { boatArt, MAP_LENGTH } from '../art/boatArt';

interface Moored {
  sprite: Sprite;
  wake: Graphics;
  x: number;
  y: number;
  n: number;
}

export class MapBoats {
  private readonly boats = new Map<number, Moored>();

  constructor(private readonly layer: Container) {}

  /** Match the moored boats to the fleet at home. */
  update(fleet: Snapshot['fleet'], mooring: Snapshot['mooring']): void {
    const home = mooring ? fleet.filter((b) => b.away === null) : [];
    const seen = new Set<number>();
    home.forEach((b, i) => {
      seen.add(b.id);
      let m = this.boats.get(b.id);
      const art = boatArt(b.kind, MAP_LENGTH[b.kind]);
      if (!m) {
        const wake = this.layer.addChild(new Graphics());
        const sprite = this.layer.addChild(new Sprite(art.texture));
        sprite.anchor.set(0.5, 0.92);
        m = { sprite, wake, x: 0, y: 0, n: b.id };
        this.boats.set(b.id, m);
      }
      m.sprite.texture = art.texture;
      // (side by side down the mooring, a little apart)
      m.x = (mooring!.x + 0.5) * CELL + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14;
      m.y = (mooring!.y + 0.75) * CELL + i * 6;
      // (the ring of ripples round her waterline)
      const half = MAP_LENGTH[b.kind] / 2;
      m.wake.clear().ellipse(0, 0, half + 3, 4).stroke({ width: 1, color: 0xe8f6f4, alpha: 0.55 });
    });
    for (const [id, m] of this.boats) {
      if (seen.has(id)) continue;
      m.sprite.destroy();
      m.wake.destroy();
      this.boats.delete(id);
    }
  }

  /** Bob them on the swell. */
  render(now: number): void {
    for (const m of this.boats.values()) {
      const bob = Math.sin(now / 700 + m.n) * 1.2;
      m.sprite.position.set(Math.round(m.x), Math.round(m.y + bob));
      m.sprite.rotation = Math.sin(now / 1100 + m.n * 2) * 0.03;
      m.wake.position.set(Math.round(m.x), Math.round(m.y));
      m.wake.alpha = 0.6 + Math.sin(now / 500 + m.n) * 0.3;
      m.sprite.zIndex = m.y;
      m.wake.zIndex = m.y - 1;
    }
  }
}
