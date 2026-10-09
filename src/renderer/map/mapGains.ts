// Floating gains and finished buildings (the owner's ask: work you can see). A load put into the stores lifts its
// material's picture over whoever stored it with how much ("+3"), a sale at a venue pops a coin at its door, and a
// piece finished at a workshop lifts the item's picture from it (map/workSeen.ts `gainsBetween`). A building finished
// (`finishedBetween`) throws up a ring of dust and runs the Fields pack's banner up over it for a moment, waving, while
// its builders cheer (MapPeople `cheer`). Pictures from the icon sheets (art/icons.ts, art/materialIcons.ts). In the
// map's `over`; none of it on a slow phone (`calm`).

import { Container, Sprite, Text, Texture } from 'pixi.js';
import { ITEM_BY_ID } from '../../shared/data/items';
import { MATERIALS, type Material } from '../../shared/data/materials';
import { iconSpot } from '../art/icons';
import { loadImage } from '../art/loadImage';
import { materialIconSpot } from '../art/materialIcons';
import { flagFrame } from '../art/choresArt';
import { glowTexture } from '../town/layer';
import type { Finished, Gain } from './workSeen';

/** Seconds a gain rises, and how far (px). */
const RISE_S = 1.7;
const RISE_PX = 26;
/** The banner: seconds going up, flying, coming down. */
const FLAG_UP = 0.5;
const FLAG_FLY = 3.2;
const FLAG_DOWN = 0.6;
const ICON = 12;
const MOST = 24;

interface Rising {
  box: Container;
  age: number;
  y: number;
}

interface Banner {
  s: Sprite;
  age: number;
  x: number;
  top: number;
}

interface Puff {
  s: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

const icons = new Map<string, Texture | 'loading'>();

/** A 16px icon from a sheet cell (or a whole picture), as a texture (null until it's loaded). */
function iconTexture(spot: { url: string; sx: number; sy: number; whole: boolean } | null): Texture | null {
  if (!spot || !spot.url) return null;
  const key = `${spot.url.slice(-40)}|${spot.sx}|${spot.sy}|${spot.whole}`;
  const t = icons.get(key);
  if (t && t !== 'loading') return t;
  if (!t) {
    icons.set(key, 'loading');
    loadImage(spot.url).then(
      (im) => {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        if (spot.whole) g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, 16, 16);
        else g.drawImage(im, spot.sx, spot.sy, 16, 16, 0, 0, 16, 16);
        const tex = Texture.from(c);
        tex.source.scaleMode = 'nearest';
        icons.set(key, tex);
      },
      () => icons.delete(key),
    );
  }
  return null;
}

/** The picture a gain lifts: the material's, the coin, or the item's. */
function gainIcon(g: Gain): Texture | null {
  if (g.kind === 'coins') return iconTexture(materialIconSpot('gold'));
  if (g.kind === 'made') {
    const def = ITEM_BY_ID[g.what];
    return def ? iconTexture(iconSpot(def)) : null;
  }
  return iconTexture(materialIconSpot(g.what as Material));
}

export class MapGains {
  private readonly layer = new Container();
  private readonly rising: Rising[] = [];
  private readonly banners: Banner[] = [];
  private readonly puffs: Puff[] = [];
  private t = 0;

  constructor(over: Container) {
    over.addChild(this.layer);
    // (the pictures asked for early, so the first load stored or sale has them)
    for (const m of MATERIALS) iconTexture(materialIconSpot(m));
  }

  /** What rose between two snapshots, and what was finished. */
  add(gains: Gain[], finished: Finished[], calm: boolean): void {
    if (calm) return;
    for (const g of gains) {
      if (this.rising.length >= MOST) break;
      const box = this.layer.addChild(new Container());
      const tex = gainIcon(g);
      const text = `+${g.n}`;
      const label = text ? new Text({ text, style: { fontFamily: 'sans-serif', fontSize: 9, fontWeight: 'bold', fill: g.kind === 'coins' ? 0xffe070 : 0xffffff, stroke: { color: 0x1a1410, width: 3 } }, resolution: 3 }) : null;
      const iw = tex ? ICON : 0;
      const w = iw + (label ? label.width + 1 : 0);
      if (tex) {
        const s = box.addChild(new Sprite(tex));
        s.width = s.height = ICON;
        s.position.set(-w / 2, -ICON / 2);
      }
      if (label) {
        label.anchor.set(0, 0.5);
        label.position.set(-w / 2 + iw + 1, 0);
        box.addChild(label);
      }
      const y = g.y - (g.kind === 'stored' ? 40 : g.kind === 'made' ? 30 : 22);
      box.position.set(Math.round(g.x), y);
      this.rising.push({ box, age: 0, y });
    }
    for (const f of finished) {
      const tex = flagFrame(0);
      if (tex) {
        const s = this.layer.addChild(new Sprite(tex));
        s.anchor.set(0.5, 1);
        s.position.set(f.x, f.top);
        this.banners.push({ s, age: 0, x: f.x, top: f.top });
      }
      // (dust thrown up along its front, as the last scaffold comes down)
      const r = Math.random;
      for (let j = 0; j < 14; j++) {
        const s = this.layer.addChild(new Sprite(glowTexture()));
        s.anchor.set(0.5);
        s.tint = 0xd8c8a8;
        s.width = s.height = 10 + r() * 8;
        s.position.set(f.x + (r() - 0.5) * f.w, f.y - r() * 8);
        this.puffs.push({ s, vx: (r() - 0.5) * 40, vy: -8 - r() * 14, age: 0, life: 1 + r() * 0.8 });
      }
    }
  }

  render(dt: number, calm: boolean): void {
    this.t += dt;
    for (let i = this.rising.length - 1; i >= 0; i--) {
      const r = this.rising[i];
      r.age += dt;
      const k = r.age / RISE_S;
      if (k >= 1 || calm) {
        r.box.destroy({ children: true });
        this.rising.splice(i, 1);
        continue;
      }
      // (up quickly, then slowing; a little pop as it appears)
      r.box.y = Math.round(r.y - RISE_PX * (1 - (1 - k) * (1 - k)));
      r.box.scale.set(k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1);
      r.box.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.age += dt;
      const end = FLAG_UP + FLAG_FLY + FLAG_DOWN;
      if (b.age >= end || calm) {
        b.s.destroy();
        this.banners.splice(i, 1);
        continue;
      }
      const tex = flagFrame(Math.floor(this.t * 10));
      if (tex) b.s.texture = tex;
      // (run up the pole from below the roof, flown a while, and lowered)
      const up = b.age < FLAG_UP ? b.age / FLAG_UP : b.age > FLAG_UP + FLAG_FLY ? 1 - (b.age - FLAG_UP - FLAG_FLY) / FLAG_DOWN : 1;
      b.s.y = b.top + (1 - up) * 20;
      b.s.alpha = Math.min(1, up * 2);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1 || calm) {
        p.s.destroy();
        this.puffs.splice(i, 1);
        continue;
      }
      p.vx *= 1 - dt * 2;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.scale.set(p.s.scale.x * (1 + dt * 0.8));
      p.s.alpha = 0.55 * (1 - k);
    }
  }
}
