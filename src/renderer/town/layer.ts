// One depth layer of the town. Content is split into horizontal chunks so off-screen chunks are skipped,
// and every placed shape records its top edge in a skyline so hover hit-testing knows where the art is opaque.
// Content is added in keyed groups (e.g. one per tile) so a group can be torn down and rebuilt on its own.

import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Light, PixelArt } from '../art/pixelArt';

export const CHUNK_WIDTH = 512;

/** Per-column top edge of a layer's opaque content, in layer-local y (negative is up). */
export class Skyline {
  readonly top: Float32Array;

  constructor(
    readonly x0: number,
    width: number,
    readonly ground: number,
  ) {
    this.top = new Float32Array(width).fill(ground);
  }

  reset(): void {
    this.top.fill(this.ground);
  }

  mark(x: number, yTop: number): void {
    const i = Math.floor(x - this.x0);
    if (i >= 0 && i < this.top.length && yTop < this.top[i]) this.top[i] = yTop;
  }

  at(x: number): number {
    const i = Math.floor(x - this.x0);
    return i >= 0 && i < this.top.length ? this.top[i] : Infinity;
  }

  /** Highest point over [x, x + w). */
  minOver(x: number, w: number): number {
    let m = Infinity;
    for (let i = 0; i < w; i++) m = Math.min(m, this.at(x + i));
    return m;
  }
}

/** Sub-containers drawn back to front. Each holds one child per chunk. */
export type Depth = 'far' | 'hills' | 'ground' | 'objects';
const DEPTHS: Depth[] = ['far', 'hills', 'ground', 'objects'];

interface Chunk {
  x0: number;
  parts: Container[];
}

interface Group {
  objects: Container[];
  graphics: Map<string, Graphics>;
  /** Everything that shapes the skyline, so it can be recomputed after groups change. */
  arts: { art: PixelArt; left: number; top: number; flip: boolean }[];
  spans: { x: number; w: number; top: number }[];
}

export type GroupKey = string | number;

/** A soft round glow (white, drawn tinted and added to what's under it). */
let glowTex: Texture | null = null;
export function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (glowTex = Texture.from(c));
}

export class Layer {
  readonly root = new Container();
  /** Glows at night: kept out of the town's day-and-night tint (TownView mounts it over the town), so they shine. */
  readonly glow = new Container();
  readonly skyline: Skyline;
  private readonly chunks: Chunk[] = [];
  private readonly groups = new Map<GroupKey, Group>();
  private current!: Group;

  constructor(
    readonly x0: number,
    readonly width: number,
    groundTop: number,
  ) {
    this.skyline = new Skyline(x0, width, groundTop);
    const depthRoots = DEPTHS.map(() => this.root.addChild(new Container()));
    for (let cx = x0; cx < x0 + width; cx += CHUNK_WIDTH) {
      this.chunks.push({ x0: cx, parts: depthRoots.map((d) => d.addChild(new Container())) });
    }
    this.group('static');
  }

  /** Make `key` the group that subsequent gfx()/place() calls add to. */
  group(key: GroupKey): this {
    let g = this.groups.get(key);
    if (!g) {
      g = { objects: [], graphics: new Map(), arts: [], spans: [] };
      this.groups.set(key, g);
    }
    this.current = g;
    return this;
  }

  /** Destroy everything in a group. Call rebuildSkyline() afterwards. */
  /** Tint every sprite in a group (e.g. a building charring as it burns). */
  tintGroup(key: GroupKey, tint: number): void {
    for (const o of this.groups.get(key)?.objects ?? []) if (o instanceof Sprite && o.tint !== tint && !o.mask) o.tint = tint;
  }

  removeGroup(key: GroupKey): void {
    const g = this.groups.get(key);
    if (!g) return;
    for (const o of g.objects) o.destroy();
    this.groups.delete(key);
  }

  private chunkIndex(x: number): number {
    return Math.max(0, Math.min(this.chunks.length - 1, Math.floor((x - this.x0) / CHUNK_WIDTH)));
  }

  private part(x: number, depth: Depth): Container {
    return this.chunks[this.chunkIndex(x)].parts[DEPTHS.indexOf(depth)];
  }

  /** The current group's Graphics for the chunk at x and a depth (created on first use). */
  gfx(x: number, depth: Depth): Graphics {
    const key = `${this.chunkIndex(x)}:${depth}`;
    let gr = this.current.graphics.get(key);
    if (!gr) {
      gr = this.part(x, depth).addChild(new Graphics());
      this.current.graphics.set(key, gr);
      this.current.objects.push(gr);
    }
    return gr;
  }

  /** Add any display object to the current group (it is destroyed with the group). */
  add<T extends Container>(obj: T, x: number, depth: Depth = 'objects'): T {
    this.part(x, depth).addChild(obj);
    this.current.objects.push(obj);
    return obj;
  }

  /** Record an opaque span drawn with gfx() (for the skyline). */
  markSpan(x: number, w: number, top: number): void {
    this.current.spans.push({ x, w, top });
    for (let i = 0; i < w; i++) this.skyline.mark(x + i, top);
  }

  /** Place art with its bottom-centre at (x, bottom). */
  place(art: PixelArt, x: number, bottom: number, flip = false, depth: Depth = 'objects'): Sprite {
    const left = Math.round(x - art.width / 2);
    const top = Math.round(bottom) - art.height;
    const sprite = new Sprite(art.texture);
    sprite.position.set(flip ? left + art.width : left, top);
    if (flip) sprite.scale.x = -1;
    this.part(x, depth).addChild(sprite);
    this.current.objects.push(sprite);
    this.current.arts.push({ art, left, top, flip });
    this.markArt(art, left, top, flip);
    this.dress(art, left, top, flip, x, depth);
    return sprite;
  }

  /** What goes with a placed picture: its lights' glows, and glints playing over its water. */
  private dress(art: PixelArt, left: number, top: number, flip: boolean, x: number, depth: Depth): void {
    for (const l of art.lights ?? []) this.addGlow(l, flip ? left + art.width - l.x : left + l.x, top + l.y);
    if (art.shimmer) {
      const s = new AnimatedSprite(art.shimmer);
      s.position.set(flip ? left + art.width : left, top);
      if (flip) s.scale.x = -1;
      s.animationSpeed = 0.04 + ((left * 7) % 5) * 0.004;
      s.gotoAndPlay((left >> 3) % 3);
      this.part(x, depth).addChild(s);
      this.current.objects.push(s);
    }
  }

  /** A glow at (x, y), in the light's colour. */
  addGlow(l: Pick<Light, 'r' | 'color'>, x: number, y: number): Sprite {
    const g = new Sprite(glowTexture());
    g.anchor.set(0.5);
    g.position.set(x, y);
    g.width = g.height = l.r * 2;
    g.tint = l.color;
    g.blendMode = 'add';
    this.glow.addChild(g);
    this.current.objects.push(g);
    return g;
  }

  placeAnimated(frames: PixelArt[], x: number, bottom: number, fps: number): AnimatedSprite {
    const art = frames[0];
    const left = Math.round(x - art.width / 2);
    const top = Math.round(bottom) - art.height;
    const anim = new AnimatedSprite(frames.map((f) => f.texture));
    anim.position.set(left, top);
    anim.animationSpeed = fps / 60;
    anim.play();
    this.part(x, 'objects').addChild(anim);
    this.current.objects.push(anim);
    for (const f of frames) {
      this.current.arts.push({ art: f, left, top, flip: false });
      this.markArt(f, left, top, false);
    }
    this.dress(art, left, top, false, x, 'objects');
    return anim;
  }

  private markArt(art: PixelArt, left: number, top: number, flip: boolean): void {
    for (let c = 0; c < art.width; c++) {
      const t = art.tops[flip ? art.width - 1 - c : c];
      if (t < art.height) this.skyline.mark(left + c, top + t);
    }
  }

  /** Recompute the skyline from every group (after removing or rebuilding groups). */
  rebuildSkyline(): void {
    this.skyline.reset();
    for (const g of this.groups.values()) {
      for (const s of g.spans) for (let i = 0; i < s.w; i++) this.skyline.mark(s.x + i, s.top);
      for (const a of g.arts) this.markArt(a.art, a.left, a.top, a.flip);
    }
  }

  /** Sort each chunk's objects so lower (nearer) bases draw on top. */
  sortObjects(): void {
    const oi = DEPTHS.indexOf('objects');
    for (const ch of this.chunks) ch.parts[oi].children.sort((a, b) => a.y + a.height - (b.y + b.height));
  }

  /** Show only the chunks overlapping the local x range [from, to). */
  cull(from: number, to: number): void {
    for (const ch of this.chunks) {
      // objects overhang chunk edges, so keep a margin
      const visible = ch.x0 + CHUNK_WIDTH + 64 > from && ch.x0 - 64 < to;
      for (const p of ch.parts) p.visible = visible;
    }
  }
}
