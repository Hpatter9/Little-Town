// Life on the water and in the sky (the owner's ask, after the living land): ducks paddling the rivers and lakes in view
// with a wake behind them (a swan pair now and then), fish leaping from the water with a splash at each end, rain
// rings on the water in the wet, lightning striking in a storm (a bolt to the ground and the whole screen lit), and a
// rainbow when the rain clears by day. The birds and fish are DawnLike's (the end columns of art/wildlife.png).
// Renderer only; none of it on a slow phone.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import wildUrl from '../art/wildlife.png';
import { loadImage } from '../art/loadImage';
import { visibility } from './groundArt';
import type { MapView } from './mapView';

/** The atlas's columns for the water (after the land's beasts: tools/compose-wildlife.cjs). */
const MALLARD = 9;
const GREY_DUCK = 10;
const SWAN = 11;
const FISH = [12, 13];
const SIZE = 16;
/** The most ducks about, and how near someone may come before they paddle off. */
const DUCKS_MOST = 7;
const DUCK_SHY = 70;
/** Seconds between leaping fish (on average), and the most rain rings at once. */
const FISH_EVERY = 3.5;
const RINGS_MOST = 60;
/** A storm's lightning: seconds between strikes (from, to). */
const STRIKE_EVERY: [number, number] = [5, 14];
/** How long a rainbow stands after the rain clears (seconds). */
const RAINBOW_SECONDS = 75;

const WET = new Set(['water', 'shallows']);

let frames: Texture[][] | null = null;
let loading = false;
function loadFrames(): void {
  if (loading) return;
  loading = true;
  loadImage(wildUrl).then(
    (im) => {
      const source = Texture.from(im).source;
      source.scaleMode = 'nearest';
      frames = [];
      for (let k = 0; k * SIZE < im.width; k++) frames.push([0, 1].map((f) => new Texture({ source, frame: new Rectangle(k * SIZE, f * SIZE, SIZE, SIZE) })));
    },
    () => {},
  );
}

interface Duck {
  s: Sprite;
  wake: Graphics;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  bob: number;
  fade: number;
  life: number;
  scale: number;
}
interface Ring {
  g: Graphics;
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}
interface Leap {
  s: Sprite;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  splashed: boolean;
}

export class MapWater {
  land: LandMap | null = null;
  weather = 'clear';
  daylight = 1;
  winter = false;
  folk: { x: number; y: number }[] = [];
  /** Told where lightning struck (world px), for the thunder (ambience.ts). */
  onStrike: ((x: number, y: number) => void) | null = null;
  private readonly ducks: Duck[] = [];
  private readonly rings: Ring[] = [];
  private readonly leaps: Leap[] = [];
  private nextDucks = 2;
  private nextFish = 2;
  private nextStrike = 4;
  private lastWeather = 'clear';
  private rainbowLeft = 0;
  /** The whole screen lit by a strike, the bolt itself, and the rainbow (screen space, over everything). */
  private readonly flash = new Graphics();
  private readonly bolt = new Graphics();
  private readonly rainbow = new Graphics();
  private flashLeft = 0;
  private boltLeft = 0;
  private rainbowDrawn = '';

  constructor(
    private readonly things: Container,
    private readonly under: Container,
    private readonly over: Container,
    private readonly screen: Container,
    private readonly map: MapView,
  ) {
    loadFrames();
    this.over.addChild(this.bolt);
    this.screen.addChild(this.rainbow, this.flash);
    this.flash.alpha = 0;
    this.rainbow.alpha = 0;
  }

  /** How many ducks are about (previews). */
  get count(): number {
    return this.ducks.length;
  }
  /** Strike now, or raise the rainbow (previews). */
  strike(): void {
    this.nextStrike = 0;
  }
  showRainbow(): void {
    this.rainbowLeft = RAINBOW_SECONDS;
  }

  render(dt: number): void {
    const calm = this.map.calm;
    const { x, y, w, h } = this.map.view;
    const wet = this.weather === 'rain' || this.weather === 'storm';
    // the rain clears by day: a rainbow
    if ((this.lastWeather === 'rain' || this.lastWeather === 'storm') && !wet && this.weather !== 'snow' && this.daylight > 0.5) this.rainbowLeft = RAINBOW_SECONDS;
    this.lastWeather = this.weather;
    this.ducksFrame(dt, calm, x, y, w, h);
    this.fishFrame(dt, calm, x, y, w, h);
    this.rainRings(dt, wet, x, y, w, h);
    this.lightning(dt, calm, x, y, w, h);
    this.rainbowFrame(dt, calm, w, h);
  }

  /** A random point on open water in view, or null. */
  private waterSpot(x: number, y: number, w: number, h: number, tries = 12): { x: number; y: number } | null {
    const land = this.land;
    if (!land) return null;
    for (let i = 0; i < tries; i++) {
      const px = x + 20 + Math.random() * Math.max(1, w - 40);
      const py = y + 30 + Math.random() * Math.max(1, h - 50);
      if (this.isWater(px, py) && visibility(land, Math.floor(px / CELL), Math.floor(py / CELL)) > 0) return { x: px, y: py };
    }
    return null;
  }
  private isWater(px: number, py: number): boolean {
    const land = this.land;
    if (!land) return false;
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    return cx >= 0 && cy >= 0 && cx < land.w && cy < land.h && WET.has(groundAt(land, cx, cy));
  }

  private ducksFrame(dt: number, calm: boolean, x: number, y: number, w: number, h: number): void {
    const want = !calm && frames && this.daylight > 0.3 && !this.winter && this.weather !== 'storm' ? DUCKS_MOST : 0;
    this.nextDucks -= dt;
    if (this.ducks.length < want && this.nextDucks <= 0) {
      this.nextDucks = 6 + Math.random() * 8;
      const spot = this.waterSpot(x, y, w, h);
      if (spot) {
        const swans = Math.random() < 0.18;
        const n = swans ? 2 : 2 + Math.floor(Math.random() * 3);
        const head = Math.random() * Math.PI * 2;
        for (let i = 0; i < n && this.ducks.length < want; i++) {
          const kind = swans ? SWAN : Math.random() < 0.7 ? MALLARD : GREY_DUCK;
          // (in a line astern, the first leading)
          const dx = spot.x - Math.cos(head) * i * 16;
          const dy = spot.y - Math.sin(head) * i * 8;
          if (this.isWater(dx, dy)) this.addDuck(kind, dx, dy, head);
        }
      }
    }
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i];
      d.life -= dt;
      d.bob += dt;
      const near = this.folk.find((f) => (f.x - d.x) ** 2 + (f.y - d.y) ** 2 < DUCK_SHY * DUCK_SHY);
      let speed = 7;
      if (near) {
        const a = Math.atan2(d.y - near.y, d.x - near.x);
        d.vx = Math.cos(a);
        d.vy = Math.sin(a) * 0.6;
        speed = 22;
      } else {
        d.turn -= dt;
        if (d.turn <= 0) {
          d.turn = 2 + Math.random() * 5;
          const a = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * 1.6;
          d.vx = Math.cos(a);
          d.vy = Math.sin(a) * 0.6;
        }
      }
      const nx = d.x + d.vx * speed * dt;
      const ny = d.y + d.vy * speed * dt;
      // (the bank turns them back)
      if (this.isWater(nx, ny + 2)) {
        d.x = nx;
        d.y = ny;
      } else {
        d.vx = -d.vx;
        d.vy = -d.vy;
        d.turn = 1.5;
      }
      d.fade = d.life > 0 && want ? Math.min(1, d.fade + dt) : d.fade - dt * 0.6;
      const out = d.x < x - 60 || d.x > x + w + 60 || d.y < y - 60 || d.y > y + h + 60;
      if (d.fade <= 0 && (d.life <= 0 || !want) || out) {
        d.s.destroy();
        d.wake.destroy();
        this.ducks.splice(i, 1);
        continue;
      }
      // (DawnLike's birds face left; they ride low in the water and bob)
      if (Math.abs(d.vx) > 0.1) d.s.scale.x = (d.vx > 0 ? -1 : 1) * d.scale;
      d.s.texture = frames![d.kind][Math.floor(d.bob * (speed > 10 ? 4 : 0.7)) % 2];
      const bob = Math.sin(d.bob * 2.4) * 0.8;
      d.s.position.set(Math.round(d.x), Math.round(d.y + bob));
      d.s.zIndex = d.y;
      d.s.alpha = d.fade;
      // the wake: a V of pale lines spreading behind
      const back = Math.atan2(-d.vy, -d.vx);
      const len = 10 + speed * 0.6;
      d.wake.clear();
      for (const side of [-0.45, 0.45])
        d.wake.moveTo(0, 0).lineTo(Math.cos(back + side) * len, Math.sin(back + side) * len * 0.6);
      d.wake.stroke({ width: 1, color: 0xe8f4ff, alpha: 0.45 * d.fade });
      d.wake.ellipse(0, 0, 7 * d.scale * 0.5, 2.2).stroke({ width: 1, color: 0xe8f4ff, alpha: 0.35 * d.fade });
      d.wake.position.set(Math.round(d.x), Math.round(d.y - 1));
    }
  }

  private addDuck(kind: number, x: number, y: number, head: number): void {
    const scale = kind === SWAN ? 1.9 : 1.4;
    const s = this.things.addChild(new Sprite(frames![kind][0]));
    s.anchor.set(0.5, 0.82);
    s.scale.set(scale);
    s.alpha = 0;
    const wake = this.under.addChild(new Graphics());
    this.ducks.push({ s, wake, kind, x, y, vx: Math.cos(head), vy: Math.sin(head) * 0.6, turn: 2 + Math.random() * 4, bob: Math.random() * 5, fade: 0, life: 50 + Math.random() * 60, scale });
  }

  private fishFrame(dt: number, calm: boolean, x: number, y: number, w: number, h: number): void {
    this.nextFish -= dt;
    if (!calm && frames && this.nextFish <= 0) {
      this.nextFish = FISH_EVERY * (0.4 + Math.random() * 1.2);
      const spot = this.waterSpot(x, y, w, h, 8);
      if (spot) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const x1 = spot.x + dir * (14 + Math.random() * 12);
        if (this.isWater(x1, spot.y)) {
          const s = this.things.addChild(new Sprite(frames[FISH[Math.floor(Math.random() * FISH.length)]][0]));
          s.anchor.set(0.5);
          s.scale.set(dir > 0 ? -1.1 : 1.1, 1.1);
          this.leaps.push({ s, x0: spot.x, y0: spot.y, x1, y1: spot.y + (Math.random() - 0.5) * 6, t: 0, dur: 0.7 + Math.random() * 0.3, splashed: false });
          this.ring(spot.x, spot.y, 9, 1.1);
        }
      }
    }
    for (let i = this.leaps.length - 1; i >= 0; i--) {
      const l = this.leaps[i];
      l.t += dt / l.dur;
      if (l.t >= 1) {
        if (!l.splashed) this.ring(l.x1, l.y1, 11, 1.3);
        l.s.destroy();
        this.leaps.splice(i, 1);
        continue;
      }
      const px = l.x0 + (l.x1 - l.x0) * l.t;
      const py = l.y0 + (l.y1 - l.y0) * l.t - Math.sin(l.t * Math.PI) * 18;
      l.s.position.set(px, py);
      l.s.rotation = (l.t - 0.5) * 1.6 * Math.sign(l.x1 - l.x0);
      l.s.zIndex = l.y0 + 1;
    }
  }

  /** A ring spreading on the water. */
  private ring(x: number, y: number, size: number, life: number): void {
    if (this.rings.length >= RINGS_MOST) return;
    const g = this.under.addChild(new Graphics());
    this.rings.push({ g, x, y, age: 0, life, size });
  }

  private rainRings(dt: number, wet: boolean, x: number, y: number, w: number, h: number): void {
    if (wet && !this.map.calm) {
      const per = (this.weather === 'storm' ? 40 : 22) * dt;
      const n = Math.min(6, Math.floor(per) + (Math.random() < per % 1 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const s = this.waterSpot(x, y, w, h, 3);
        if (s) this.ring(s.x, s.y, 4 + Math.random() * 3, 0.6 + Math.random() * 0.3);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.g.destroy();
        this.rings.splice(i, 1);
        continue;
      }
      r.g.clear();
      r.g.ellipse(0, 0, r.size * (0.3 + t), r.size * (0.3 + t) * 0.45).stroke({ width: 1, color: 0xf0f8ff, alpha: 0.6 * (1 - t) });
      r.g.position.set(r.x, r.y);
    }
  }

  private lightning(dt: number, calm: boolean, x: number, y: number, w: number, h: number): void {
    const vw = this.map.view.w;
    const vh = this.map.view.h;
    if (this.weather === 'storm' || this.nextStrike === 0) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = STRIKE_EVERY[0] + Math.random() * (STRIKE_EVERY[1] - STRIKE_EVERY[0]);
        this.flashLeft = 0.45;
        this.onStrike?.(x + w / 2, y + h / 2);
        if (!calm) {
          // a jagged bolt from above the view to a point on the land
          const gx = x + w * (0.15 + Math.random() * 0.7);
          const gy = y + h * (0.35 + Math.random() * 0.5);
          this.bolt.clear();
          let bx = gx + (Math.random() - 0.5) * 80;
          let by = y - 40;
          const pts: [number, number][] = [[bx, by]];
          const steps = 9;
          for (let i = 1; i <= steps; i++) {
            bx += (gx - bx) / (steps - i + 1) + (Math.random() - 0.5) * 26;
            by += (gy - by) / (steps - i + 1);
            pts.push([i === steps ? gx : bx, i === steps ? gy : by]);
          }
          for (const [width, colour, alpha] of [[7, 0x9fc4ff, 0.35], [2.5, 0xffffff, 1]] as const) {
            this.bolt.moveTo(pts[0][0], pts[0][1]);
            for (const p of pts.slice(1)) this.bolt.lineTo(p[0], p[1]);
            this.bolt.stroke({ width, color: colour, alpha });
          }
          // (a fork off it)
          const k = 3 + Math.floor(Math.random() * 4);
          this.bolt.moveTo(pts[k][0], pts[k][1]).lineTo(pts[k][0] + (Math.random() - 0.5) * 70, pts[k][1] + 40 + Math.random() * 30).stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
          this.bolt.circle(gx, gy, 10).fill({ color: 0xfff6c8, alpha: 0.5 });
          this.boltLeft = 0.3;
          this.ring(gx, gy, 26, 0.5);
        }
      }
    }
    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      // (a double flicker, as lightning does)
      const t = 0.45 - this.flashLeft;
      const a = t < 0.06 ? 0.55 : t < 0.12 ? 0.12 : t < 0.18 ? 0.4 : Math.max(0, this.flashLeft / 0.27) * 0.3;
      this.flash.clear().rect(0, 0, vw, vh).fill({ color: 0xe8f0ff });
      this.flash.alpha = a;
    } else this.flash.alpha = 0;
    if (this.boltLeft > 0) {
      this.boltLeft -= dt;
      this.bolt.alpha = Math.max(0, this.boltLeft / 0.3);
      if (this.boltLeft <= 0) this.bolt.clear();
    }
  }

  private rainbowFrame(dt: number, calm: boolean, w: number, h: number): void {
    if (this.rainbowLeft <= 0 || calm || this.weather === 'rain' || this.weather === 'storm') {
      this.rainbowLeft = Math.max(0, this.rainbowLeft - dt);
      this.rainbow.alpha = Math.max(0, this.rainbow.alpha - dt * 0.5);
      return;
    }
    this.rainbowLeft -= dt;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (key !== this.rainbowDrawn) {
      this.rainbowDrawn = key;
      this.rainbow.clear();
      // a great arc rising off the screen's top, seen faint over the land
      // (an arch across the view, its crown a third of the way down, its feet off the bottom corners)
      const cx = w * 0.5;
      const r = Math.max(w * 0.7, h * 0.6);
      const cy = h * 0.2 + r;
      const band = Math.max(6, r * 0.022);
      const bands = [0xff4a3a, 0xff9a2e, 0xffe14a, 0x5ad45a, 0x4aa8ff, 0x5a5aff, 0xa45aff];
      bands.forEach((c, i) => {
        this.rainbow.arc(cx, cy, r - i * band, Math.PI, Math.PI * 2).stroke({ width: band + 0.5, color: c, alpha: 0.6 });
      });
    }
    // (in over a few seconds, out over the last ten)
    const want = Math.min(1, (RAINBOW_SECONDS - this.rainbowLeft) / 4, this.rainbowLeft / 10) * 0.24 * Math.min(1, this.daylight * 1.5);
    this.rainbow.alpha = want;
  }
}
