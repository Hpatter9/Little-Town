// The dry lands' wind (the owner's ask): on the desert, the steppe and the ashlands by day, tumbleweeds come bowling in
// from the west with the wind, bouncing and turning over as they roll, and dust devils wander across the open ground
// whirling up sand (map/airRules.ts `dustWanted`: more tumbleweeds as the wind rises, the devils on hot still
// afternoons). The tumbleweeds are the Undead pack's dry thorn tangles (its props atlas, browned), the devils the 5000
// Pixel Effects pack's sand vortex with its sand puffs kicked up at the foot. A tumbleweed stands among the things (so
// people pass before and behind it); the devils whirl in the map's `over`. None on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, wet, type LandMap } from '../../shared/sim/land';
import { pixelFxFrame, pixelFxFrames } from '../art/effects';
import { propTextures } from '../art/props';
import { glowTexture } from '../town/layer';
import { dustWanted, type Sky } from './airRules';

/** The Undead set's thorn tangles that roll as tumbleweeds (its frames' places in the set). */
const TANGLES = [15, 16, 17];
/** A tumbleweed's pace (px a second) at no wind and per unit of wind, and its colour (browned dry). */
const ROLL_STILL = 26;
const ROLL_PER_WIND = 42;
const DRY = 0xe0c090;
/** A dust devil's size (the 32px strip scaled up), and how fast it wanders. */
const DEVIL_K = 2.4;
const DEVIL_PACE = 22;

let tangles: Texture[] | null = null;
let asked = false;

interface Weed {
  s: Sprite;
  sh: Sprite;
  x: number;
  y: number;
  spin: number;
  hop: number;
  size: number;
  going: boolean;
}
interface Devil {
  s: Sprite;
  base: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  puffs: { s: Sprite; x: number; y: number; age: number; vx: number; vy: number }[];
  due: number;
}

export class MapDust {
  private readonly weeds: Weed[] = [];
  private readonly devils: Devil[] = [];
  private readonly devilLayer = new Container();
  private t = 0;
  private nextWeed = 1;
  private nextDevil = 2;
  land: LandMap | null = null;
  sky: Sky = { season: 'summer', weather: 'clear', daylight: 1, hour: 12 };
  /** The land is dry, and is it cold (main.ts, from the biome's flags). */
  dry = false;
  cold = false;
  /** For previews (`window.__dust`): the dry land's wind whatever the land. */
  force = false;

  constructor(
    private readonly things: Container,
    over: Container,
  ) {
    over.addChild(this.devilLayer);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, wind: number, calm: boolean): void {
    this.t += dt;
    const want = calm ? { weeds: 0, devils: 0 } : dustWanted(this.dry || this.force, this.cold && !this.force, this.sky, wind);
    if ((want.weeds || want.devils) && !tangles && !asked) {
      asked = true;
      propTextures('undead').then((t) => (tangles = TANGLES.map((i) => t[i]).filter(Boolean)), () => undefined);
    }
    this.renderWeeds(dt, view, wind, want.weeds);
    this.renderDevils(dt, view, wind, want.devils);
  }

  private open(x: number, y: number): boolean {
    const land = this.land;
    if (!land) return false;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    return cx >= 0 && cy >= 0 && cx < land.w && cy < land.h && !wet(groundAt(land, cx, cy)) && groundAt(land, cx, cy) !== 'mountain';
  }

  private renderWeeds(dt: number, view: { x: number; y: number; w: number; h: number }, wind: number, want: number): void {
    this.nextWeed -= dt;
    if (tangles?.length && this.weeds.filter((w) => !w.going).length < want && this.nextWeed <= 0) {
      this.nextWeed = 1.5 + Math.random() * 3;
      // (in from the west edge of the view, with the wind)
      const x = view.x - 20;
      const y = view.y + view.h * (0.1 + Math.random() * 0.85);
      if (this.open(x + 40, y)) {
        const sh = this.things.addChild(new Sprite(glowTexture()));
        sh.anchor.set(0.5);
        sh.tint = 0x000000;
        sh.alpha = 0.25;
        const s = this.things.addChild(new Sprite(tangles[Math.floor(Math.random() * tangles.length)]));
        s.anchor.set(0.5);
        s.tint = DRY;
        const size = 0.55 + Math.random() * 0.45;
        this.weeds.push({ s, sh, x, y, spin: 0, hop: Math.random() * 6, size, going: false });
      }
    }
    for (let i = this.weeds.length - 1; i >= 0; i--) {
      const w = this.weeds[i];
      const pace = (ROLL_STILL + ROLL_PER_WIND * wind) * (0.8 + 0.2 * Math.sin(this.t * 0.7 + w.hop));
      w.x += pace * dt;
      w.y += Math.sin(this.t * 0.9 + w.hop) * 6 * dt;
      w.spin += (pace / (12 * w.size)) * dt;
      // (a bounce now and then as it catches the ground)
      const lift = Math.abs(Math.sin(this.t * 3.2 + w.hop)) * 7 * w.size;
      if (!w.going && (!want || w.x > view.x + view.w + 30 || !this.open(w.x, w.y))) w.going = true;
      const a = w.going ? w.s.alpha - dt * 2.5 : Math.min(1, w.s.alpha + dt * 3);
      if (w.going && a <= 0) {
        w.s.destroy();
        w.sh.destroy();
        this.weeds.splice(i, 1);
        continue;
      }
      w.s.alpha = a;
      w.s.rotation = w.spin;
      w.s.scale.set(w.size);
      w.s.position.set(Math.round(w.x), Math.round(w.y - 8 * w.size - lift));
      w.s.zIndex = w.y;
      w.sh.position.set(Math.round(w.x), Math.round(w.y));
      w.sh.width = 22 * w.size * (1 - lift / 20);
      w.sh.height = 7 * w.size;
      w.sh.alpha = 0.25 * a;
      w.sh.zIndex = w.y - 0.5;
    }
  }

  private renderDevils(dt: number, view: { x: number; y: number; w: number; h: number }, wind: number, want: number): void {
    const frames = pixelFxFrames('sand-vortex');
    this.nextDevil -= dt;
    if (frames && this.devils.length < want && this.nextDevil <= 0) {
      this.nextDevil = 6 + Math.random() * 10;
      const x = view.x + view.w * (0.15 + Math.random() * 0.7);
      const y = view.y + view.h * (0.25 + Math.random() * 0.65);
      if (this.open(x, y)) {
        const base = this.devilLayer.addChild(new Sprite(glowTexture()));
        base.anchor.set(0.5);
        base.tint = 0x8a6a40;
        const s = this.devilLayer.addChild(new Sprite());
        s.anchor.set(0.5, 0.9);
        const a = Math.random() * Math.PI * 2;
        this.devils.push({ s, base, x, y, vx: Math.cos(a) * DEVIL_PACE + wind * 10, vy: Math.sin(a) * DEVIL_PACE * 0.6, age: 0, life: 9 + Math.random() * 8, puffs: [], due: 0 });
      }
    }
    for (let i = this.devils.length - 1; i >= 0; i--) {
      const d = this.devils[i];
      d.age += dt;
      // (it wanders, veering now and then)
      if (Math.random() < dt * 0.6) {
        const a = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * 1.6;
        d.vx = Math.cos(a) * DEVIL_PACE + wind * 10;
        d.vy = Math.sin(a) * DEVIL_PACE * 0.6;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const k = Math.min(1, d.age / 1.5, (d.life - d.age) / 1.5);
      if (k <= 0 || (!this.open(d.x, d.y) && d.age > 2)) {
        d.s.destroy();
        d.base.destroy();
        for (const p of d.puffs) p.s.destroy();
        this.devils.splice(i, 1);
        continue;
      }
      const tex = frames ? pixelFxFrame('sand-vortex', Math.floor((d.age * 12) % frames)) : null;
      if (tex) d.s.texture = tex;
      d.s.scale.set(DEVIL_K * (0.7 + 0.3 * k), DEVIL_K * 1.3 * (0.6 + 0.4 * k));
      d.s.alpha = 0.85 * k;
      d.s.position.set(Math.round(d.x + Math.sin(d.age * 5) * 2), Math.round(d.y));
      d.base.position.set(Math.round(d.x), Math.round(d.y));
      d.base.width = 46;
      d.base.height = 14;
      d.base.alpha = 0.35 * k;
      // sand kicked up at its foot, flung out and settling
      d.due -= dt;
      if (d.due <= 0 && pixelFxFrames('sand-puff')) {
        d.due = 0.18;
        const p = this.devilLayer.addChild(new Sprite(pixelFxFrame('sand-puff', 0) ?? glowTexture()));
        p.anchor.set(0.5);
        const a = Math.random() * Math.PI * 2;
        d.puffs.push({ s: p, x: d.x, y: d.y - 4, age: 0, vx: Math.cos(a) * 30, vy: Math.sin(a) * 10 - 8 });
      }
      for (let j = d.puffs.length - 1; j >= 0; j--) {
        const p = d.puffs[j];
        p.age += dt;
        if (p.age > 0.9) {
          p.s.destroy();
          d.puffs.splice(j, 1);
          continue;
        }
        const f = pixelFxFrame('sand-puff', Math.min(5, Math.floor(p.age * 6.5)));
        if (f) p.s.texture = f;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.s.position.set(Math.round(p.x), Math.round(p.y));
        p.s.scale.set(0.8);
        p.s.alpha = 0.8 * k * (1 - p.age / 0.9);
      }
    }
  }
}
