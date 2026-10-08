// The caravans' wagons (sim/bands.ts): the Village pack's cart rolling along behind the lead merchant, drawn among
// the map's things (sorted by its foot), turned the way it goes.

import { Container, Sprite, Texture } from 'pixi.js';
import type { Snapshot } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import cartUrl from '../art/village/cart.png';

const SCALE = 1.4;

export class MapWagons {
  private tex: Texture | null = null;
  private readonly sprites = new Map<number, Sprite>();

  constructor(private readonly layer: Container) {
    loadImage(cartUrl)
      .then((im) => {
        this.tex = Texture.from(im);
      })
      .catch(() => undefined);
  }

  update(wagons: Snapshot['wagons']): void {
    const seen = new Set<number>();
    if (this.tex)
      for (const w of wagons) {
        seen.add(w.id);
        let sp = this.sprites.get(w.id);
        if (!sp) {
          sp = this.layer.addChild(new Sprite(this.tex));
          sp.anchor.set(0.5, 0.95);
          this.sprites.set(w.id, sp);
        }
        sp.position.set(w.x, w.y);
        sp.scale.set(w.dir < 0 ? -SCALE : SCALE, SCALE);
        sp.zIndex = w.y;
      }
    for (const [id, sp] of this.sprites) {
      if (seen.has(id)) continue;
      sp.destroy();
      this.sprites.delete(id);
    }
  }
}
