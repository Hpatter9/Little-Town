// Wild animals about the land beyond the town (the owner's ask: a huge, immersive upgrade): deer and a stag grazing at
// the woods' edge, boars rooting, a fox trotting through, a squirrel, now and then a bear; wolves by night; camels in the
// desert and snow foxes in the tundra and winter (DawnLike's Quadraped, Dog and Rodent sheets, two frames each, cut into
// art/wildlife.png by tools/compose-wildlife.cjs). They come out of the wild ground in view, graze, wander a little,
// and bolt when someone comes near (a deer bounding, the rest at a run), fading as they go. Renderer only: nothing of
// this is in the sim. None on a slow phone; the blighted land has only its wolves.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, isRoad, type Ground, type LandMap } from '../../shared/sim/land';
import wildUrl from '../art/wildlife.png';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import { visibility } from './groundArt';
import type { MapView } from './mapView';

/** The atlas's columns (tools/compose-wildlife.cjs keeps this order). */
export const WILD_KINDS = ['deer', 'stag', 'boar', 'fox', 'wolf', 'squirrel', 'bear', 'camel', 'snowfox'] as const;
export type WildKind = (typeof WILD_KINDS)[number];
const SIZE = 16;

interface KindDef {
  /** Drawn this many times the sheet's 16px. */
  scale: number;
  walk: number;
  run: number;
  /** How near someone may come (px) before it's off. */
  shy: number;
  /** Where it goes about. */
  on: Ground[];
  /** Bounds as it runs (a deer leaps). */
  bound: number;
}
const WOOD: Ground[] = ['forest', 'grass', 'hill', 'marsh'];
const DEFS: Record<WildKind, KindDef> = {
  deer: { scale: 2.3, walk: 14, run: 120, shy: 120, on: WOOD, bound: 9 },
  stag: { scale: 2.6, walk: 13, run: 115, shy: 110, on: WOOD, bound: 10 },
  boar: { scale: 2.1, walk: 11, run: 95, shy: 80, on: ['forest', 'grass', 'marsh', 'hill'], bound: 1.5 },
  fox: { scale: 1.8, walk: 22, run: 130, shy: 95, on: WOOD, bound: 3 },
  wolf: { scale: 2.2, walk: 24, run: 120, shy: 90, on: ['forest', 'grass', 'hill', 'rock', 'sand'], bound: 2.5 },
  squirrel: { scale: 1.3, walk: 30, run: 140, shy: 70, on: ['forest', 'grass'], bound: 4 },
  bear: { scale: 3, walk: 9, run: 80, shy: 70, on: ['forest', 'hill', 'rock'], bound: 1 },
  camel: { scale: 2.7, walk: 10, run: 70, shy: 90, on: ['sand', 'rock', 'grass', 'hill'], bound: 1 },
  snowfox: { scale: 1.8, walk: 22, run: 130, shy: 95, on: ['forest', 'grass', 'hill', 'rock', 'marsh'], bound: 3 },
};
/** How far (px) the wild beasts keep from the town's buildings, fields and pens. */
const KEEP_OFF = 3 * CELL;
/** The most animals about at once. */
const MOST = 9;

/** What the land offers, by its biome, the season, the hour and the look: kinds with their odds, and how many come
 *  together. */
export function wildChoices(biome: string, season: string, night: boolean, blighted: boolean): [WildKind, number, [number, number]][] {
  if (blighted) return [['wolf', 1, night ? [2, 4] : [1, 2]]];
  const snow = biome === 'tundra' || season === 'winter';
  if (night) return [['wolf', 0.55, [2, 4]], [snow ? 'snowfox' : 'fox', 0.35, [1, 1]], ['boar', 0.1, [1, 2]]];
  if (biome === 'desert') return [['camel', 0.6, [2, 3]], ['fox', 0.3, [1, 1]], ['wolf', 0.1, [1, 2]]];
  if (snow)
    return [['deer', 0.4, [2, 3]], ['snowfox', 0.3, [1, 1]], ['wolf', 0.2, [2, 3]], ['stag', 0.1, [1, 1]]];
  return [
    ['deer', 0.34, [2, 4]],
    ['boar', 0.18, [1, 3]],
    ['fox', 0.16, [1, 1]],
    ['squirrel', 0.16, [1, 2]],
    ['stag', 0.1, [1, 1]],
    ['bear', 0.06, [1, 1]],
  ];
}

interface Beast {
  s: Sprite;
  sh: Sprite;
  kind: WildKind;
  x: number;
  y: number;
  state: 'graze' | 'walk' | 'flee';
  tx: number;
  ty: number;
  /** Till it next moves on, and till it leaves. */
  wait: number;
  life: number;
  vx: number;
  vy: number;
  fade: number;
  step: number;
  /** A deer's group is led by the first; the others keep near. */
  lead: Beast | null;
}

let frames: Texture[][] | null = null;
let loading = false;
function loadFrames(): void {
  if (loading) return;
  loading = true;
  loadImage(wildUrl).then(
    (im) => {
      const source = Texture.from(im).source;
      source.scaleMode = 'nearest';
      frames = WILD_KINDS.map((_, k) => [0, 1].map((f) => new Texture({ source, frame: new Rectangle(k * SIZE, f * SIZE, SIZE, SIZE) })));
    },
    () => {},
  );
}

export class MapWildlife {
  on = true;
  night = false;
  season = 'summer';
  biome = 'forest';
  blighted = false;
  land: LandMap | null = null;
  /** Everyone about (world px), who scares them off. */
  folk: { x: number; y: number }[] = [];
  private readonly beasts: Beast[] = [];
  private nextGroup = 1.5;

  constructor(
    private readonly layer: Container,
    private readonly map: MapView,
  ) {
    loadFrames();
  }

  /** How many are about (previews). */
  get count(): number {
    return this.beasts.length;
  }

  render(dt: number, now: number): void {
    const want = this.on && !this.map.calm && this.land && frames ? MOST : 0;
    const { x, y, w, h } = this.map.view;
    this.nextGroup -= dt;
    if (this.beasts.length < want && this.nextGroup <= 0) {
      this.nextGroup = 4 + Math.random() * 7;
      this.comeOut(x, y, w, h, want - this.beasts.length);
    }
    for (let i = this.beasts.length - 1; i >= 0; i--) {
      const b = this.beasts[i];
      const d = DEFS[b.kind];
      b.life -= dt;
      const near = this.folk.find((f) => (f.x - b.x) ** 2 + (f.y - b.y) ** 2 < d.shy * d.shy);
      if (b.state !== 'flee' && (near || (b.lead && b.lead.state === 'flee'))) {
        const from = near ?? b.lead!;
        const ang = Math.atan2(b.y - from.y, b.x - from.x) + (Math.random() - 0.5) * 0.6;
        b.state = 'flee';
        b.vx = Math.cos(ang) * d.run;
        b.vy = Math.sin(ang) * d.run * 0.7;
      }
      let moving = false;
      if (b.state === 'flee') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.fade = Math.max(0, b.fade - dt * 0.7);
        moving = true;
      } else if (b.state === 'walk') {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const dd = Math.hypot(dx, dy);
        if (dd < 2) {
          b.state = 'graze';
          b.wait = 3 + Math.random() * 8;
        } else {
          const sp = Math.min(dd, d.walk * dt);
          b.x += (dx / dd) * sp;
          b.y += (dy / dd) * sp;
          b.vx = dx;
          moving = true;
        }
      } else {
        b.wait -= dt;
        if (b.wait <= 0) {
          const t = this.wanderTo(b);
          if (t) {
            b.tx = t.x;
            b.ty = t.y;
            b.state = 'walk';
          } else b.wait = 2 + Math.random() * 4;
        }
        // (time up: it slips away into the wild)
        if (b.life <= 0) b.fade = Math.max(0, b.fade - dt * 0.5);
        else b.fade = Math.min(1, b.fade + dt * 0.8);
      }
      if (b.state === 'walk') b.fade = Math.min(1, b.fade + dt * 0.8);
      const out = b.x < x - 80 || b.x > x + w + 80 || b.y < y - 80 || b.y > y + h + 80;
      if (!want || b.fade <= 0.01 && (b.state === 'flee' || b.life <= 0) || out) {
        b.s.destroy();
        b.sh.destroy();
        this.beasts.splice(i, 1);
        continue;
      }
      // the step's frames swap as it goes (quick at a run); grazing, the head dips now and then
      b.step += dt * (b.state === 'flee' ? 10 : moving ? 3.5 : 0.35);
      const frame = Math.floor(b.step) % 2;
      b.s.texture = frames![WILD_KINDS.indexOf(b.kind)][frame];
      const lift = b.state === 'flee' ? Math.abs(Math.sin(b.step * Math.PI * 0.5)) * d.bound : 0;
      // (DawnLike's beasts face left)
      if (Math.abs(b.vx) > 0.5) b.s.scale.x = (b.vx > 0 ? -1 : 1) * d.scale;
      b.s.scale.y = d.scale;
      b.s.alpha = b.fade;
      b.s.position.set(Math.round(b.x), Math.round(b.y - lift));
      b.s.zIndex = b.y;
      b.sh.alpha = 0.3 * b.fade * (1 - Math.min(0.6, lift / 20));
      b.sh.position.set(Math.round(b.x), Math.round(b.y));
      b.sh.zIndex = b.y - 0.5;
      void now;
    }
  }

  /** A group comes out on the wild ground in view, away from everyone. */
  private comeOut(x: number, y: number, w: number, h: number, room: number): void {
    const choices = wildChoices(this.biome, this.season, this.night, this.blighted);
    let r = Math.random();
    let pick = choices[0];
    for (const c of choices) {
      if (r < c[1]) {
        pick = c;
        break;
      }
      r -= c[1];
    }
    const [kind, , [lo, hi]] = pick;
    const spot = this.spotFor(kind, x, y, w, h);
    if (!spot) return;
    const n = Math.min(room, lo + Math.floor(Math.random() * (hi - lo + 1)));
    let lead: Beast | null = null;
    for (let i = 0; i < n; i++) {
      // (a deer herd may have its stag)
      const k: WildKind = kind === 'deer' && i === 0 && Math.random() < 0.4 ? 'stag' : kind;
      let bx = spot.x + (Math.random() - 0.5) * 90 * (i ? 1 : 0);
      let by = spot.y + (Math.random() - 0.5) * 40 * (i ? 1 : 0);
      if (!this.ok(k, bx, by)) [bx, by] = [spot.x + (Math.random() - 0.5) * 8, spot.y];
      const b = this.spawn(k, bx, by, lead);
      lead ??= b;
    }
  }

  private ok(kind: WildKind, px: number, py: number): boolean {
    const land = this.land!;
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h) return false;
    if (!DEFS[kind].on.includes(groundAt(land, cx, cy)) || isRoad(land, cx, cy)) return false;
    if (visibility(land, cx, cy) === 0 || this.map.nearBuilding(px, py, KEEP_OFF)) return false;
    // (nor along the roads)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isRoad(land, cx + dx, cy + dy)) return false;
    return true;
  }

  private spotFor(kind: WildKind, x: number, y: number, w: number, h: number): { x: number; y: number } | null {
    const shy = DEFS[kind].shy * 1.6;
    for (let tries = 0; tries < 20; tries++) {
      const px = x + 30 + Math.random() * Math.max(1, w - 60);
      const py = y + 40 + Math.random() * Math.max(1, h - 70);
      if (!this.ok(kind, px, py)) continue;
      // (wild things keep to the wild: not among the buildings)
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      const g = groundAt(this.land!, cx, cy);
      if (g === 'grass' && Math.random() < 0.6) continue;
      if (this.folk.some((f) => (f.x - px) ** 2 + (f.y - py) ** 2 < shy * shy)) continue;
      return { x: px, y: py };
    }
    return null;
  }

  private wanderTo(b: Beast): { x: number; y: number } | null {
    for (let tries = 0; tries < 6; tries++) {
      const ox = b.lead && b.lead !== b ? b.lead.x + (Math.random() - 0.5) * 60 : b.x + (Math.random() - 0.5) * 120;
      const oy = b.lead && b.lead !== b ? b.lead.y + (Math.random() - 0.5) * 30 : b.y + (Math.random() - 0.5) * 60;
      if (this.ok(b.kind, ox, oy)) return { x: ox, y: oy };
    }
    return null;
  }

  private spawn(kind: WildKind, x: number, y: number, lead: Beast | null): Beast {
    const s = this.layer.addChild(new Sprite(frames![WILD_KINDS.indexOf(kind)][0]));
    s.anchor.set(0.5, 0.95);
    const d = DEFS[kind];
    s.scale.set((Math.random() < 0.5 ? -1 : 1) * d.scale, d.scale);
    s.alpha = 0;
    const sh = this.layer.addChild(new Sprite(glowTexture()));
    sh.anchor.set(0.5);
    sh.tint = 0x000000;
    sh.width = 10 * d.scale;
    sh.height = 3.5 * d.scale;
    sh.alpha = 0;
    const b: Beast = { s, sh, kind, x, y, state: 'graze', tx: x, ty: y, wait: 1 + Math.random() * 5, life: 40 + Math.random() * 50, vx: 0, vy: 0, fade: 0, step: Math.random() * 2, lead: null };
    b.lead = lead ?? b;
    this.beasts.push(b);
    return b;
  }
}
