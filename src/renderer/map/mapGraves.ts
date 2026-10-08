// A grave for everyone the town has lost (the owner's ask: graves with names): one of the Village pack's headstones a
// person, in rows in a burial ground beside the graveyard (or, before there is one, on the ground south-west of the
// camp), the newest under a heap of fresh earth with flowers on it for a few days. Tap one for who lies there. The
// fallen come from the annals (snapshot `annals.fallen`, newest first).

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Fallen } from '../../shared/sim/annals';
import { footprint } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import g1 from '../art/village/grave1.png';
import g2 from '../art/village/grave2.png';
import g3 from '../art/village/grave3.png';
import g4 from '../art/village/grave4.png';
import g5 from '../art/village/grave5.png';

/** The most graves shown (the newest), their spacing (px), how many to a row, and how long a grave stays fresh (days). */
export const GRAVES_SHOWN = 30;
const STEP_X = 22;
const STEP_Y = 24;
const PER_ROW = 5;
const FRESH_DAYS = 3;
const SCALE = 0.8;

interface Grave {
  sprite: Sprite;
  mound: Graphics;
  who: Fallen;
  x: number;
  y: number;
}

/** Where the n-th grave lies, from the burial ground's top-left corner (rows of `PER_ROW`). */
export function graveSlot(n: number): { x: number; y: number } {
  return { x: (n % PER_ROW) * STEP_X, y: Math.floor(n / PER_ROW) * STEP_Y };
}

export class MapGraves {
  private tex: Texture[] = [];
  private readonly graves = new Map<number, Grave>();
  private key = '';

  constructor(private readonly layer: Container) {
    Promise.all([g1, g2, g3, g4, g5].map((u) => loadImage(u)))
      .then((ims) => {
        this.tex = ims.map((im) => {
          const t = Texture.from(im);
          t.source.scaleMode = 'nearest';
          return t;
        });
        this.key = '';
      })
      .catch(() => undefined);
  }

  /** The burial ground's corner: to the right of the graveyard, else south-west of the camp. */
  private corner(buildings: Building[], camp: { x: number; y: number }): { x: number; y: number } {
    const yard = buildings.find((b) => b.def === 'graveyard' && b.status === 'done');
    if (yard) {
      const f = footprint(yard);
      return { x: (f.x + f.w) * CELL + 10, y: f.y * CELL + 14 };
    }
    return { x: camp.x - 7 * CELL, y: camp.y + 3 * CELL };
  }

  sync(fallen: Fallen[], buildings: Building[], camp: { x: number; y: number }, day: number, blocked: (x: number, y: number) => boolean): void {
    if (!this.tex.length) return;
    const shown = fallen.slice(0, GRAVES_SHOWN).reverse(); // (oldest first, so a grave keeps its place)
    const at = this.corner(buildings, camp);
    const key = `${shown.map((f) => `${f.id}${day - f.day < FRESH_DAYS ? 'f' : ''}`).join(',')}|${at.x},${at.y}`;
    if (key === this.key) return;
    this.key = key;
    for (const g of this.graves.values()) {
      g.sprite.destroy();
      g.mound.destroy();
    }
    this.graves.clear();
    let slot = 0;
    for (const who of shown) {
      // (the next free place in the rows, past anything built on the ground)
      let p = graveSlot(slot);
      for (let tries = 0; tries < 40 && blocked(at.x + p.x, at.y + p.y); tries++) p = graveSlot(++slot);
      slot++;
      const x = Math.round(at.x + p.x);
      const y = Math.round(at.y + p.y);
      const mound = this.layer.addChild(new Graphics());
      const fresh = day - who.day < FRESH_DAYS;
      // a heap of earth before the stone; fresh, darker and heaped with flowers
      mound.ellipse(0, 3, 9, 4).fill({ color: fresh ? 0x5a3e28 : 0x6a7a40, alpha: fresh ? 0.95 : 0.5 });
      if (fresh) for (let i = 0; i < 4; i++) mound.circle(-6 + i * 4, 3 + (i % 2), 1.4).fill([0xf0e060, 0xe05868, 0xffffff, 0xc070e0][(who.id + i) % 4]);
      mound.position.set(x, y);
      mound.zIndex = y - 0.1;
      const sprite = this.layer.addChild(new Sprite(this.tex[who.id % this.tex.length]));
      sprite.anchor.set(0.5, 0.92);
      sprite.scale.set(SCALE);
      sprite.position.set(x, y);
      sprite.zIndex = y;
      this.graves.set(who.id, { sprite, mound, who, x, y });
    }
  }

  /** Who lies under the grave at a world point. */
  graveAt(wx: number, wy: number): Fallen | null {
    for (const g of this.graves.values()) if (Math.abs(wx - g.x) < 11 && wy > g.y - 26 && wy < g.y + 5) return g.who;
    return null;
  }

  posOf(id: number): { x: number; y: number } | null {
    const g = this.graves.get(id);
    return g ? { x: g.x, y: g.y } : null;
  }
}
