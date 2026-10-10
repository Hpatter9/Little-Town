// Every named home's sign by its door (the owner's ask: names for homes; data/homeNames.ts): the Village pack's little
// hanging signboard on its bracket, hung on the wall left of the door, with the home's name lettered over it. Shown
// only when the view is zoomed in (`SIGN_ZOOM`: at the town's usual distance the names would crowd the roofs), among
// the things just in front of the house.

import { Container, Sprite, Text, Texture } from 'pixi.js';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CELL } from '../../shared/sim/land';
import { footprint } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import signUrl from '../art/village/sign.png';

/** The view's zoom (the phone page's scale, screen px a world px) from which the signs show. */
export const SIGN_ZOOM = 0.95;
/** Where the sign hangs: left of the door and up the wall (px from the door at the footprint's foot). */
const SIGN_DX = -12;
const SIGN_DY = -7;

interface Drawn {
  key: string;
  sign: Sprite;
  label: Text;
}

export class HomeSigns {
  private tex: Texture | null = null;
  private readonly drawn = new Map<number, Drawn>();
  private shown = false;

  constructor(private readonly things: Container) {
    loadImage(signUrl).then(
      (im) => {
        this.tex = Texture.from(im);
        this.tex.source.scaleMode = 'nearest';
      },
      () => undefined,
    );
  }

  /** The named homes now (per snapshot), and the view's zoom. */
  sync(list: readonly Building[], zoom: number): void {
    if (!this.tex) return;
    const show = zoom >= SIGN_ZOOM;
    const seen = new Set<number>();
    for (const b of list) {
      if (!b.homeName || b.status !== 'done' || b.room || b.id < 0 || !BUILDING_BY_ID[b.def]?.housing) continue;
      seen.add(b.id);
      const f = footprint(b);
      const key = `${b.homeName}|${f.x},${f.y},${f.w},${f.h}`;
      let d = this.drawn.get(b.id);
      if (d && d.key !== key) {
        this.destroy(d);
        d = undefined;
      }
      if (!d) {
        d = this.draw(b, key);
        this.drawn.set(b.id, d);
      }
      d.sign.visible = d.label.visible = show;
    }
    for (const [id, d] of this.drawn)
      if (!seen.has(id)) {
        this.destroy(d);
        this.drawn.delete(id);
      }
    this.shown = show;
  }

  /** Whether the names are showing (previews). */
  get showing(): boolean {
    return this.shown;
  }

  private destroy(d: Drawn): void {
    d.sign.destroy();
    d.label.destroy();
  }

  private draw(b: Building, key: string): Drawn {
    const f = footprint(b);
    const doorX = (f.x + f.w / 2) * CELL;
    const foot = (f.y + f.h) * CELL - 2;
    const sign = this.things.addChild(new Sprite(this.tex!));
    sign.anchor.set(1, 1);
    sign.position.set(Math.round(doorX + SIGN_DX), Math.round(foot + SIGN_DY));
    sign.zIndex = foot + 0.3;
    const label = this.things.addChild(
      new Text({ text: b.homeName!, style: { fontFamily: 'sans-serif', fontSize: 8, fontWeight: 'bold', fill: 0xfff1cc, stroke: { color: 0x2a1a0e, width: 3 } }, resolution: 4 }),
    );
    label.anchor.set(0.5, 1);
    label.position.set(Math.round(doorX + SIGN_DX - sign.width / 2), Math.round(foot + SIGN_DY - sign.height - 1));
    label.zIndex = foot + 0.31;
    return { key, sign, label };
  }
}
