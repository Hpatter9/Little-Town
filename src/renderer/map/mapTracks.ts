// Tracks in the land and breath in the cold (the owner's ask: a gigantic, immersive overhaul): everyone who walks the
// snow leaves a trail of footprints, left and right in turn, that lingers a minute and a half before the drift fills it
// (less while more snow falls); the dunes and the strand keep a print a few seconds before the wind smooths it; the
// rain's mud a while. The wild beasts leave paw prints. And in the cold everyone's breath shows: a little white puff
// from the head now and then, drifting up and fading. Renderer only (the rules in ice.ts); none on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, groundAt, isRoad, type LandMap } from '../../shared/sim/land';
import { breathShows, trackGround, trackLife, type TrackGround } from './ice';
import type { MapView } from './mapView';

export interface Walker {
  id: string;
  x: number;
  y: number;
  /** A beast's paws rather than boots. */
  paw?: boolean;
  /** How high the head is over the feet (px), for the breath. */
  head?: number;
  /** No breath to show (the dead, machines). */
  cold?: boolean;
}

/** A step every this many px, and the prints set this far either side of the line walked. */
const STRIDE = 11;
const SIDE = 3.2;
/** The most prints and puffs at once. */
const PRINTS_MOST = 500;
const PUFFS_MOST = 60;
/** Seconds between one walker's breaths (on average). */
const BREATH_EVERY = 2.6;
const TINT: Record<Exclude<TrackGround, 'none'>, [number, number]> = { snow: [0x8ea6c0, 0.75], sand: [0x9c7f52, 0.55], mud: [0x3c2a1c, 0.6] };

let footTex: Texture | null = null;
let pawTex: Texture | null = null;
let puffTex: Texture | null = null;
function textures(): void {
  if (footTex) return;
  const make = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    draw(g);
    const t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    return t;
  };
  // a boot: a sole and a heel, pointing up the texture (rotated along the way walked)
  footTex = make(5, 9, (g) => {
    g.fillRect(1, 0, 3, 1);
    g.fillRect(0, 1, 5, 4);
    g.fillRect(1, 5, 3, 1);
    g.fillRect(1, 6, 3, 3);
  });
  // a paw: a pad and three toes
  pawTex = make(5, 5, (g) => {
    g.fillRect(1, 2, 3, 3);
    g.fillRect(0, 0, 1, 1);
    g.fillRect(2, 0, 1, 1);
    g.fillRect(4, 0, 1, 1);
  });
  // a breath: a soft round cloud
  puffTex = make(16, 16, (g) => {
    const r = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    r.addColorStop(0, 'rgba(255,255,255,0.95)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 16, 16);
  });
}

interface Print {
  s: Sprite;
  life: number;
  left: number;
  alpha: number;
}
interface Puff {
  s: Sprite;
  t: number;
  dur: number;
  vx: number;
}
interface Trail {
  x: number;
  y: number;
  /** Distance walked since the last print, and which foot is next. */
  walked: number;
  left: boolean;
  breath: number;
  seen: number;
}

export class MapTracks {
  land: LandMap | null = null;
  season = 'summer';
  biome = 'forest';
  weather = 'clear';
  daylight = 1;
  /** Steps laid in snow and in mud since the last `takeSteps`, with where across the view (for the crunch). */
  private steps: { ground: TrackGround; x: number }[] = [];
  private readonly prints: Print[] = [];
  private readonly puffs: Puff[] = [];
  private readonly trails = new Map<string, Trail>();
  private walkers: Walker[] = [];
  private frame = 0;

  constructor(
    private readonly under: Container,
    private readonly over: Container,
    private readonly map: MapView,
  ) {}

  get printCount(): number {
    return this.prints.length;
  }

  /** The steps laid since the last call (ambience). */
  takeSteps(): { ground: TrackGround; x: number }[] {
    const s = this.steps;
    this.steps = [];
    return s;
  }

  /** Where everyone stands now (each snapshot): a print for every stride walked on ground that keeps one. */
  sync(walkers: Walker[]): void {
    this.walkers = walkers;
    this.frame++;
    const land = this.land;
    if (!land || this.map.calm) return;
    textures();
    for (const w of walkers) {
      let tr = this.trails.get(w.id);
      if (!tr) {
        this.trails.set(w.id, { x: w.x, y: w.y, walked: 0, left: false, breath: Math.random() * BREATH_EVERY, seen: this.frame });
        continue;
      }
      tr.seen = this.frame;
      const dx = w.x - tr.x;
      const dy = w.y - tr.y;
      const d = Math.hypot(dx, dy);
      // (a jump, not a walk: a new trail from here)
      if (d > CELL * 3) {
        tr.x = w.x;
        tr.y = w.y;
        continue;
      }
      if (d < 0.5) continue;
      const ux = dx / d;
      const uy = dy / d;
      let along = STRIDE - tr.walked;
      while (along <= d) {
        const px = tr.x + ux * along;
        const py = tr.y + uy * along;
        tr.left = !tr.left;
        const side = (tr.left ? -1 : 1) * (w.paw ? SIDE * 0.6 : SIDE);
        this.lay(land, px - uy * side, py + ux * side, Math.atan2(uy, ux) + Math.PI / 2, !!w.paw);
        along += STRIDE * (w.paw ? 0.8 : 1);
      }
      tr.walked = STRIDE - (along - d);
      tr.x = w.x;
      tr.y = w.y;
    }
    // (forget the trails of those gone)
    if (this.frame % 50 === 0) for (const [id, tr] of this.trails) if (this.frame - tr.seen > 20) this.trails.delete(id);
  }

  private lay(land: LandMap, x: number, y: number, rot: number, paw: boolean): void {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h) return;
    const ground = trackGround(groundAt(land, cx, cy), this.season, this.biome, this.weather, isRoad(land, cx, cy));
    if (ground === 'none') return;
    const v = this.map.view;
    this.steps.push({ ground, x: (x - v.x) / Math.max(1, v.w) });
    if (this.steps.length > 40) this.steps.shift();
    const life = trackLife(ground, this.weather);
    const [tint, alpha] = TINT[ground];
    let p: Print;
    if (this.prints.length >= PRINTS_MOST) {
      p = this.prints.shift()!;
    } else {
      const s = this.under.addChild(new Sprite(footTex!));
      s.anchor.set(0.5);
      p = { s, life, left: life, alpha };
    }
    p.s.texture = paw ? pawTex! : footTex!;
    p.s.position.set(Math.round(x), Math.round(y));
    p.s.rotation = rot;
    p.s.tint = tint;
    p.s.scale.set(paw ? 1.1 : 1);
    p.life = p.left = life;
    p.alpha = alpha;
    p.s.alpha = alpha;
    p.s.visible = true;
    this.prints.push(p);
  }

  /** Each frame: the prints fade as they fill in, the breaths drift up. */
  render(dt: number): void {
    const calm = this.map.calm;
    for (let i = this.prints.length - 1; i >= 0; i--) {
      const p = this.prints[i];
      p.left -= dt;
      if (p.left <= 0 || calm) {
        p.s.destroy();
        this.prints.splice(i, 1);
        continue;
      }
      // (full for the first half of its life, then filling in)
      p.s.alpha = p.alpha * Math.min(1, (p.left / p.life) * 2);
    }
    // breath in the cold
    const cold = !calm && puffTex && breathShows(this.season, this.biome, this.daylight);
    if (cold) {
      const v = this.map.view;
      for (const w of this.walkers) {
        const tr = this.trails.get(w.id);
        if (!tr || w.cold || w.x < v.x - 20 || w.x > v.x + v.w + 20 || w.y < v.y - 20 || w.y > v.y + v.h + 60) continue;
        tr.breath -= dt;
        if (tr.breath > 0) continue;
        tr.breath = BREATH_EVERY * (0.6 + Math.random() * 0.8);
        if (this.puffs.length >= PUFFS_MOST) continue;
        const s = this.over.addChild(new Sprite(puffTex!));
        s.anchor.set(0.5);
        const side = Math.random() < 0.5 ? -1 : 1;
        s.position.set(w.x + side * 5, w.y - (w.head ?? 42));
        s.scale.set(0.3);
        s.alpha = 0;
        this.puffs.push({ s, t: 0, dur: 1.3 + Math.random() * 0.6, vx: side * (5 + Math.random() * 6) });
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      f.t += dt / f.dur;
      if (f.t >= 1 || calm) {
        f.s.destroy();
        this.puffs.splice(i, 1);
        continue;
      }
      f.s.x += f.vx * dt;
      f.s.y -= 9 * dt;
      f.s.scale.set(0.3 + f.t * 0.75);
      f.s.alpha = (f.t < 0.2 ? f.t / 0.2 : 1 - (f.t - 0.2) / 0.8) * 0.7;
    }
  }
}
