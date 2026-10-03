// Small birds about the town by day: sparrows, a robin, a grey bird and a crow (DawnLike's Avian sheets, two frames
// each) that come down in little flocks on the open ground, the roads and the fields, hop about pecking, and take wing
// (climbing and shrinking, their shadows left behind) when someone comes near or when they've had enough, to settle
// again elsewhere in view. Renderer only: nothing of this is in the sim. None at night, in a storm or snow, or on a slow
// phone; fewer in winter.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, isRoad, type Ground, type LandMap } from '../../shared/sim/land';
import birdsUrl from '../art/birds.png';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import { visibility } from './groundArt';
import type { MapView } from './mapView';

/** The atlas: a column per kind (sparrow, brown sparrow, grey bird, robin, crow), its two frames down. */
const KINDS = 5;
const CROW = 4;
const SIZE = 16;
/** How near someone may come (px) before a bird is off. */
const SCARE = 46;
/** The most birds about at once, and in winter. */
const MOST = 9;
const MOST_WINTER = 4;
/** The ground birds land on (besides roads and the fields). */
const LANDS = new Set<Ground>(['grass', 'fertile', 'sand', 'hill']);
const HOP_SECONDS = 0.22;

interface Bird {
  s: Sprite;
  sh: Sprite;
  kind: number;
  x: number;
  y: number;
  /** Height off the ground (px): a landing comes down from above, a flight climbs away. */
  h: number;
  state: 'landing' | 'ground' | 'flying';
  vx: number;
  vy: number;
  /** Till the next hop, and till it has had enough and takes wing. */
  hop: number;
  stay: number;
  /** A hop under way: from where to where, and how far through (-1: none). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  hopping: number;
  wing: number;
}

let frames: Texture[][] | null = null;
let loading = false;
function loadFrames(): void {
  if (loading) return;
  loading = true;
  loadImage(birdsUrl).then(
    (im) => {
      const source = Texture.from(im).source;
      frames = [];
      for (let k = 0; k < KINDS; k++) frames.push([0, 1].map((f) => new Texture({ source, frame: new Rectangle(k * SIZE, f * SIZE, SIZE, SIZE) })));
    },
    () => {},
  );
}

export class MapBirds {
  /** Daylight and fair enough weather (main.ts, per snapshot). */
  on = false;
  winter = false;
  land: LandMap | null = null;
  /** Everyone about (world px), who scares them off. */
  folk: { x: number; y: number }[] = [];
  private readonly birds: Bird[] = [];
  private nextFlock = 2;

  constructor(
    private readonly layer: Container,
    private readonly map: MapView,
  ) {
    loadFrames();
  }

  /** A frame: new flocks come down, the birds hop, and whoever's scared or done flies off. */
  render(dt: number, now: number): void {
    const want = this.on && !this.map.calm && this.land && frames ? (this.winter ? MOST_WINTER : MOST) : 0;
    const { x, y, w, h } = this.map.view;
    this.nextFlock -= dt;
    if (this.birds.length < want && this.nextFlock <= 0) {
      this.nextFlock = 3 + Math.random() * 5;
      const spot = this.landingSpot(x, y, w, h);
      if (spot) {
        const crow = Math.random() < 0.18;
        const n = crow ? 1 : Math.min(2 + Math.floor(Math.random() * 3), want - this.birds.length);
        const kind = crow ? CROW : Math.floor(Math.random() * CROW);
        for (let i = 0; i < n; i++) this.hatch(kind, spot.x + (Math.random() - 0.5) * 28, spot.y + (Math.random() - 0.5) * 16);
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      if (b.state === 'landing') {
        b.h = Math.max(0, b.h - 120 * dt);
        b.x += b.vx * dt;
        if (b.h === 0) b.state = 'ground';
      } else if (b.state === 'ground') {
        b.stay -= dt;
        b.hop -= dt;
        if (b.hopping >= 0) {
          b.hopping = Math.min(1, b.hopping + dt / HOP_SECONDS);
          b.x = b.from.x + (b.to.x - b.from.x) * b.hopping;
          b.y = b.from.y + (b.to.y - b.from.y) * b.hopping;
          b.h = Math.sin(b.hopping * Math.PI) * 4;
          if (b.hopping >= 1) b.hopping = -1;
        } else if (b.hop <= 0) {
          b.hop = 0.5 + Math.random() * 1.6;
          b.from = { x: b.x, y: b.y };
          b.to = { x: b.x + (Math.random() - 0.5) * 18, y: b.y + (Math.random() - 0.5) * 8 };
          b.hopping = 0;
          b.s.scale.x = (b.to.x < b.x ? -1 : 1) * Math.abs(b.s.scale.x);
        }
        const near = this.folk.find((f) => (f.x - b.x) ** 2 + (f.y - b.y) ** 2 < SCARE * SCARE);
        if (near || b.stay <= 0) {
          b.state = 'flying';
          const ang = near ? Math.atan2(b.y - near.y, b.x - near.x) : Math.random() * Math.PI * 2;
          b.vx = Math.cos(ang) * 75;
          b.vy = Math.sin(ang) * 40 - 25;
          b.hopping = -1;
          b.s.scale.x = (b.vx < 0 ? -1 : 1) * Math.abs(b.s.scale.x);
        }
      } else {
        b.h += 95 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      const gone = b.h > 120 || b.x < x - 40 || b.x > x + w + 40 || b.y < y - 40 || b.y > y + h + 60 || !want;
      if (gone) {
        b.s.destroy();
        b.sh.destroy();
        this.birds.splice(i, 1);
        continue;
      }
      // wings beat in the air; on the ground the frames swap with each hop
      const beat = b.state !== 'ground' ? Math.floor(now / 90) % 2 : b.hopping >= 0 ? 1 : 0;
      b.s.texture = frames![b.kind][beat];
      const k = (b.kind === CROW ? 1.2 : 1) * (1 - Math.min(0.5, b.h / 240));
      b.s.scale.set(Math.sign(b.s.scale.x) * k, k);
      b.s.position.set(Math.round(b.x), Math.round(b.y - b.h));
      b.s.zIndex = b.y;
      b.sh.alpha = 0.32 * Math.max(0, 1 - b.h / 110);
      b.sh.position.set(Math.round(b.x), Math.round(b.y));
      b.sh.zIndex = b.y - 0.5;
    }
  }

  /** Somewhere in view a flock may come down: lit open ground, a road or a field, with nothing standing on it. */
  private landingSpot(x: number, y: number, w: number, h: number): { x: number; y: number } | null {
    const land = this.land!;
    for (let tries = 0; tries < 14; tries++) {
      const px = x + 30 + Math.random() * Math.max(1, w - 60);
      const py = y + 30 + Math.random() * Math.max(1, h - 60);
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      if (!LANDS.has(groundAt(land, cx, cy)) && !isRoad(land, cx, cy)) continue;
      if (visibility(land, cx, cy) === 0 || this.map.standingAt(px, py)) continue;
      if (this.folk.some((f) => (f.x - px) ** 2 + (f.y - py) ** 2 < (SCARE * 2) ** 2)) continue;
      return { x: px, y: py };
    }
    return null;
  }

  private hatch(kind: number, x: number, y: number): void {
    const s = this.layer.addChild(new Sprite(frames![kind][0]));
    s.anchor.set(0.5, 1);
    const sh = this.layer.addChild(new Sprite(glowTexture()));
    sh.anchor.set(0.5);
    sh.tint = 0x000000;
    sh.width = 10;
    sh.height = 4;
    const vx = (Math.random() - 0.5) * 30;
    s.scale.x = vx < 0 ? -1 : 1;
    this.birds.push({ s, sh, kind, x: x - vx * 0.6, y, h: 70, state: 'landing', vx, vy: 0, hop: 0.6, stay: 7 + Math.random() * 14, from: { x, y }, to: { x, y }, hopping: -1, wing: 0 });
  }
}
