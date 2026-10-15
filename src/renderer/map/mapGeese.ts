// Geese passing through (the owner's ask): in spring and autumn by day a skein of geese flies over high in a V, north in
// spring and south in autumn (map/airRules.ts `geeseFly`, `geeseHeading`, `vFormation`), beating their wings out of
// step, crossing the view and gone; their shadows sweep over the ground below, and now and then they honk (`onHonk`:
// the `honk` cue in ambience.ts). The birds are whtdragon's flying grey and white geese (art/geese.png, by
// tools/compose-geese.cjs: three wing-beat frames across, a facing a row). Drawn in the map's `over`, above the roofs
// and the clouds' shadows. None on a slow phone.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import geeseUrl from '../art/geese.png';
import { loadImage } from '../art/loadImage';
import { facingRow, GEESE_EVERY, GEESE_LEAST, GEESE_MOST, geeseFly, geeseHeading, vFormation, type Sky } from './airRules';

const CELL = 48;
/** How big a goose is drawn this high up, how fast a skein flies (px a second), and how far below its shadow falls. */
const SCALE = 0.62;
const SPEED = 72;
const SHADOW_DROP = 120;
/** Seconds between honks while a skein is in view (at random up to twice). */
const HONK_EVERY = 3.5;

/** The atlas: [bird][row][frame], the grey goose then the snow goose. */
let frames: Texture[][][] | null = null;
let asked = false;
function loadFrames(): void {
  if (asked) return;
  asked = true;
  loadImage(geeseUrl).then(
    (im) => {
      const source = Texture.from(im).source;
      source.scaleMode = 'nearest';
      frames = [0, 1].map((bird) => [0, 1, 2, 3].map((row) => [0, 1, 2].map((f) => new Texture({ source, frame: new Rectangle(f * CELL, (bird * 4 + row) * CELL, CELL, CELL) }))));
    },
    () => {},
  );
}

interface Goose {
  s: Sprite;
  sh: Sprite;
  ahead: number;
  aside: number;
  phase: number;
}
interface Skein {
  x: number;
  y: number;
  heading: number;
  bird: number;
  geese: Goose[];
  honk: number;
  age: number;
}

export class MapGeese {
  private readonly shadows = new Container();
  private readonly birds = new Container();
  private skein: Skein | null = null;
  private next = GEESE_EVERY * 0.3;
  private t = 0;
  sky: Sky = { season: 'summer', weather: 'clear', daylight: 1, hour: 12 };
  /** The cold lands: snow geese more often than grey. */
  cold = false;
  /** Heard as a skein passes (where across the screen, -1 left to 1 right). */
  onHonk?: (pan: number) => void;

  constructor(over: Container) {
    over.addChild(this.shadows, this.birds);
    this.shadows.alpha = 0.22;
    loadFrames();
  }

  /** For previews (`window.__wide.sendGeese`): a skein sent across now, whatever the season, coming in at the view's
   *  edge. */
  send(view: { x: number; y: number; w: number; h: number }, season = 'autumn'): void {
    if (frames) this.start(view, season, Math.min(view.w, view.h) * 0.45);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, sunSkew: number, calm: boolean): void {
    this.t += dt;
    if (!frames) return;
    if (!this.skein) {
      this.next -= dt;
      if (this.next <= 0) {
        this.next = GEESE_EVERY * (0.6 + Math.random() * 1.4);
        if (!calm && geeseFly(this.sky)) this.start(view, this.sky.season);
      }
      return;
    }
    const k = this.skein;
    k.age += dt;
    k.x += Math.cos(k.heading) * SPEED * dt;
    k.y += Math.sin(k.heading) * SPEED * dt;
    const row = facingRow(k.heading);
    const fx = Math.cos(k.heading);
    const fy = Math.sin(k.heading);
    let inView = false;
    for (const g of k.geese) {
      // (the place in the V turned to the way it flies: ahead along the heading, aside across it)
      const x = k.x + fx * g.ahead - fy * g.aside;
      const y = k.y + fy * g.ahead + fx * g.aside;
      const f = frames[k.bird][row][Math.floor(this.t * 6 + g.phase) % 3];
      g.s.texture = f;
      g.sh.texture = f;
      g.s.position.set(Math.round(x), Math.round(y));
      // (the shadow falls well below, leaning away from the sun)
      g.sh.position.set(Math.round(x + sunSkew * 40), Math.round(y + SHADOW_DROP));
      if (x > view.x - 60 && x < view.x + view.w + 60 && y > view.y - 60 && y < view.y + view.h + 60) inView = true;
    }
    k.honk -= dt;
    if (inView && k.honk <= 0) {
      k.honk = HONK_EVERY * (0.5 + Math.random());
      this.onHonk?.(Math.max(-0.8, Math.min(0.8, ((k.x - view.x) / Math.max(1, view.w)) * 1.6 - 0.8)));
    }
    // gone past the view (with its shadows): done
    const past = Math.hypot(k.x - (view.x + view.w / 2), k.y - (view.y + view.h / 2)) > Math.hypot(view.w, view.h) * 0.75 + 400;
    if (past && !inView && k.age > 4) {
      for (const g of k.geese) {
        g.s.destroy();
        g.sh.destroy();
      }
      this.skein = null;
    }
  }

  private start(view: { x: number; y: number; w: number; h: number }, season: string, from?: number): void {
    for (const g of this.skein?.geese ?? []) {
      g.s.destroy();
      g.sh.destroy();
    }
    const key = Math.floor(Math.random() * 1000);
    const heading = geeseHeading(season, key);
    const n = GEESE_LEAST + Math.floor(Math.random() * (GEESE_MOST - GEESE_LEAST + 1));
    // (it comes in from beyond the view's edge behind it, somewhere across the middle)
    const cx = view.x + view.w * (0.3 + Math.random() * 0.4);
    const cy = view.y + view.h * (0.3 + Math.random() * 0.4);
    const back = from ?? Math.hypot(view.w, view.h) * 0.5 + 60;
    const bird = (this.cold ? Math.random() < 0.7 : Math.random() < 0.25) ? 1 : 0;
    const geese = vFormation(n).map((p) => {
      const sh = this.shadows.addChild(new Sprite());
      sh.anchor.set(0.5);
      sh.tint = 0x000000;
      sh.scale.set(SCALE * 0.85);
      const s = this.birds.addChild(new Sprite());
      s.anchor.set(0.5);
      s.scale.set(SCALE);
      return { s, sh, ahead: p.ahead, aside: p.aside, phase: Math.random() * 3 };
    });
    this.skein = { x: cx - Math.cos(heading) * back, y: cy - Math.sin(heading) * back, heading, bird, geese, honk: 0.5, age: 0 };
  }
}
