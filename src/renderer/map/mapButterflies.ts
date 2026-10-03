// Butterflies over the grass by day in spring and summer (DawnLike's Pest sheets, two kinds, two frames each): each
// flutters about a spot that drifts slowly across the land, and after a while fades away as another comes. Renderer
// only: nothing of this is in the sim. None at night, in bad weather, in the tundra or the desert, or on a slow phone.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, type Ground, type LandMap } from '../../shared/sim/land';
import url from '../art/butterflies.png';
import { loadImage } from '../art/loadImage';
import { visibility } from './groundArt';
import type { MapView } from './mapView';

const KINDS = 2;
const SIZE = 16;
const MOST = 7;
const OVER = new Set<Ground>(['grass', 'fertile', 'marsh', 'hill']);

interface Butterfly {
  s: Sprite;
  kind: number;
  home: { x: number; y: number };
  vx: number;
  vy: number;
  phase: number;
  t: number;
  life: number;
}

let frames: Texture[][] | null = null;
let loading = false;
function loadFrames(): void {
  if (loading) return;
  loading = true;
  loadImage(url).then(
    (im) => {
      const source = Texture.from(im).source;
      frames = [];
      for (let k = 0; k < KINDS; k++) frames.push([0, 1].map((f) => new Texture({ source, frame: new Rectangle(k * SIZE, f * SIZE, SIZE, SIZE) })));
    },
    () => {},
  );
}

export class MapButterflies {
  /** Daylight, the warm seasons and fair weather (main.ts, per snapshot). */
  on = false;
  land: LandMap | null = null;
  private readonly flock: Butterfly[] = [];
  private next = 1;

  constructor(
    private readonly layer: Container,
    private readonly map: MapView,
  ) {
    loadFrames();
  }

  render(dt: number, now: number): void {
    const want = this.on && !this.map.calm && this.land && frames ? MOST : 0;
    const { x, y, w, h } = this.map.view;
    this.next -= dt;
    if (this.flock.length < want && this.next <= 0) {
      this.next = 1.5 + Math.random() * 3;
      const land = this.land!;
      for (let tries = 0; tries < 10; tries++) {
        const px = x + Math.random() * w;
        const py = y + Math.random() * h;
        const cx = Math.floor(px / CELL);
        const cy = Math.floor(py / CELL);
        if (!OVER.has(groundAt(land, cx, cy)) || visibility(land, cx, cy) === 0 || this.map.standingAt(px, py)) continue;
        const kind = Math.floor(Math.random() * KINDS);
        const s = this.layer.addChild(new Sprite(frames![kind][0]));
        s.anchor.set(0.5, 1);
        s.alpha = 0;
        this.flock.push({ s, kind, home: { x: px, y: py }, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 5, phase: Math.random() * 6.3, t: 0, life: 12 + Math.random() * 16 });
        break;
      }
    }
    for (let i = this.flock.length - 1; i >= 0; i--) {
      const b = this.flock[i];
      b.t += dt;
      b.life -= dt;
      b.home.x += b.vx * dt;
      b.home.y += b.vy * dt;
      const bx = b.home.x + Math.sin(b.t * 0.9 + b.phase) * 22 + Math.sin(b.t * 2.6) * 5;
      const by = b.home.y + Math.sin(b.t * 1.7 + b.phase) * 10;
      const out = bx < x - 30 || bx > x + w + 30 || by < y - 30 || by > y + h + 30;
      if (b.life <= 0 || out || !want) {
        b.s.destroy();
        this.flock.splice(i, 1);
        continue;
      }
      // (fades in, and out over its last two seconds; the frames swap as the wings beat)
      b.s.alpha = Math.min(1, b.t, b.life / 2);
      b.s.texture = frames![b.kind][Math.floor(now / 110) % 2];
      const heading = Math.cos(b.t * 0.9 + b.phase) * 22 * 0.9 + b.vx;
      b.s.scale.set(heading < 0 ? -0.75 : 0.75, 0.75);
      b.s.position.set(Math.round(bx), Math.round(by - 10 - Math.sin(b.t * 3.1) * 2));
      b.s.zIndex = by;
    }
  }
}
