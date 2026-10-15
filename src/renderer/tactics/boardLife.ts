// Life on the raid board (the owner's ask: more life): birds that startle from the trees when a fighter passes, trees
// and thickets that sway, leaves in the autumn, snow or dust or embers by the land and the season, water that glints,
// the torches at the gate flickering at night, and the fallen logs lying on the field. Renderer only: it reads the board
// (the tiles and the units) and changes nothing of the game. The art is the packs': the birds (DawnLike's avian sheets,
// art/birds.png), the torch, the wild prop set's logs and trees.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { TacticsView } from '../../shared/sim/tactics';
import birdsUrl from '../art/birds.png';
import { loadImage } from '../art/loadImage';
import torchUrl from '../art/life/torch.png';
import { propFrames, propTextures } from '../art/props';
import propKinds from '../art/propKinds.json';
import { glowTexture } from '../town/layer';

type At = (u: number, v: number) => [number, number];

/* ------------------------------------------------------------ the pictures */

let birdFrames: Texture[][] | null = null;
let torchTex: Texture | null = null;
let logTex: Texture[] = [];
let started = false;
/** Load the board's own pictures once (the board draws without them until they come). */
export function loadBoardArt(): void {
  if (started) return;
  started = true;
  void loadImage(birdsUrl).then((im) => {
    const src = Texture.from(im).source;
    src.scaleMode = 'nearest';
    birdFrames = Array.from({ length: 5 }, (_, k) => [0, 1].map((f) => new Texture({ source: src, frame: new Rectangle(k * 16, f * 16, 16, 16) })));
  });
  void loadImage(torchUrl).then((im) => {
    torchTex = Texture.from(im);
    torchTex.source.scaleMode = 'nearest';
  });
  // (the wild set's fallen logs: its long 'other' pieces)
  void propTextures('wild').then((tex) => {
    const kinds = (propKinds as Record<string, string[]>).wild ?? [];
    const rects = propFrames('wild');
    logTex = tex.filter((_, i) => kinds[i] === 'other' && (rects[i]?.[2] ?? 0) >= 40 && (rects[i]?.[3] ?? 99) < 50);
  });
}
/** A fallen log's picture for a land cell (null until the set is loaded). */
export const logTexture = (lx: number, ly: number): Texture | null => (logTex.length ? logTex[(lx * 7 + ly * 3) % logTex.length] : null);

/* ------------------------------------------------------------ the life */

interface Bird {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  kind: number;
}
interface Mote {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  grow: number;
}
interface Sway {
  s: Sprite;
  phase: number;
  amount: number;
}

const MOST_BIRDS = 14;
/** Seconds before the same tree startles its birds again. */
const REST = 8;
const MOTE_CAP = 70;

/** What drifts through the air of a land in a season: its colour, speed, whether it falls or rises, and how often. */
function airOf(view: TacticsView): { colour: number; vx: number; vy: number; every: number; size: number } | null {
  const snow = view.weather === 'snow' || (view.season === 'winter' && view.biome !== 'desert' && view.biome !== 'ashlands' && view.biome !== 'jungle');
  if (snow) return { colour: 0xffffff, vx: 14, vy: 26, every: 0.07, size: 2.2 };
  if (view.biome === 'ashlands') return { colour: 0xff8a40, vx: 10, vy: -22, every: 0.14, size: 1.8 };
  if (view.biome === 'desert' || view.biome === 'steppe') return { colour: 0xe8d0a0, vx: 34, vy: -2, every: 0.12, size: 1.8 };
  if (view.season === 'autumn') return { colour: 0xd8802c, vx: 22, vy: 16, every: 0.22, size: 2.6 };
  if (view.season === 'spring' || view.season === 'summer') return view.biome === 'forest' || view.biome === 'jungle' || view.biome === 'taiga' ? { colour: 0x8fc860, vx: 16, vy: 10, every: 0.7, size: 2.4 } : null;
  return null;
}

export class BoardLife {
  readonly container = new Container();
  /** The torches and the logs lie with the board; the rest is above the units. */
  private birds: Bird[] = [];
  private motes: Mote[] = [];
  private sways: Sway[] = [];
  private torches: { s: Sprite; glow: Sprite; phase: number }[] = [];
  private trees: { u: number; v: number; x: number; y: number; rest: number }[] = [];
  private water: [number, number][] = [];
  private seen = new Map<string, [number, number]>();
  private view: TacticsView | null = null;
  private sinceMote = 0;
  private sinceGlint = 0;
  private last = 0;

  constructor() {
    loadBoardArt();
  }

  /** A tree or thicket sprite that sways in the wind (the board's). */
  sway(s: Sprite, amount = 0.03): void {
    this.sways.push({ s, phase: Math.random() * 6.28, amount });
  }

  /** A new board: where the trees, the water and the gate are. `at` gives a tile's top centre. */
  setBoard(t: TacticsView, at: At, parent: Container): void {
    this.view = t;
    for (const b of this.birds) b.s.destroy();
    for (const m of this.motes) m.s.destroy();
    for (const k of this.torches) {
      k.s.destroy();
      k.glow.destroy();
    }
    this.birds = [];
    this.motes = [];
    this.torches = [];
    this.trees = [];
    this.water = [];
    this.seen.clear();
    for (let v = 0; v < t.h; v++)
      for (let u = 0; u < t.w; u++) {
        const tile = t.tiles[v * t.w + u];
        const [x, y] = at(u, v);
        if (tile.tree) this.trees.push({ u, v, x, y, rest: 0 });
        if (tile.g === 'water' || tile.g === 'shallows') this.water.push([x, y]);
        // (a torch on each side of the gate, on the wall)
        if (tile.gate && !t.tiles[(v - 1) * t.w + u]?.gate) {
          for (const dv of [-1, 2]) {
            const w = t.tiles[(v + dv) * t.w + u];
            if (!w || w.block !== 'wall') continue;
            const [tx, ty] = at(u, v + dv);
            this.torches.push({ s: new Sprite(), glow: new Sprite(glowTexture()), phase: Math.random() * 6.28 });
            const k = this.torches[this.torches.length - 1];
            k.s.anchor.set(0.5, 1);
            k.s.position.set(tx, ty - 22);
            k.s.scale.set(1.6);
            k.glow.anchor.set(0.5);
            k.glow.position.set(tx, ty - 34);
            k.glow.tint = 0xffa840;
            k.glow.blendMode = 'add';
            k.s.zIndex = ty;
            k.glow.zIndex = ty + 1;
            parent.addChild(k.glow, k.s);
          }
        }
      }
  }

  /** A board is being built again: its sprites are new. */
  reset(): void {
    this.sways = [];
  }

  /** Who has walked: a fighter who steps up to a tree sets its birds off. */
  track(t: TacticsView): void {
    const now = new Map<string, [number, number]>();
    for (const u of t.units) {
      const was = this.seen.get(u.key);
      now.set(u.key, [u.u, u.v]);
      if (!was || (was[0] === u.u && was[1] === u.v)) continue;
      for (const tr of this.trees) if (Math.abs(tr.u - u.u) <= 1 && Math.abs(tr.v - u.v) <= 1 && tr.rest <= 0) this.startle(tr);
    }
    this.seen = now;
  }

  private startle(tree: { x: number; y: number; rest: number }): void {
    const t = this.view;
    if (!t || t.night || t.weather === 'storm' || !birdFrames || this.birds.length > MOST_BIRDS - 3) return;
    tree.rest = REST;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = new Sprite(birdFrames[Math.floor(Math.random() * 4)][0]);
      s.anchor.set(0.5);
      this.container.addChild(s);
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.birds.push({ s, x: tree.x + (Math.random() - 0.5) * 16, y: tree.y - 34 - Math.random() * 10, vx: dir * (40 + Math.random() * 40), vy: -(35 + Math.random() * 35), age: -i * 0.07, kind: 0 });
    }
  }

  private mote(x: number, y: number, a: NonNullable<ReturnType<typeof airOf>>, life: number): void {
    if (this.motes.length >= MOTE_CAP) return;
    const s = new Sprite(Texture.WHITE);
    s.anchor.set(0.5);
    s.tint = a.colour;
    s.width = s.height = a.size;
    this.container.addChild(s);
    this.motes.push({ s, x, y, vx: a.vx * (0.6 + Math.random() * 0.8), vy: a.vy * (0.6 + Math.random() * 0.8), age: 0, life, grow: 0 });
  }

  /** Move it all on to `now` (ms). `box` is the board's extent in world px: x0, y0, x1, y1. */
  render(now: number, box: [number, number, number, number]): void {
    const t = this.view;
    if (!t) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    // trees and thickets in the wind
    for (const w of this.sways) {
      if (w.s.destroyed) continue;
      w.s.rotation = Math.sin(now / 900 + w.phase) * w.amount + Math.sin(now / 330 + w.phase * 2) * w.amount * 0.3;
    }
    this.sways = this.sways.filter((w) => !w.s.destroyed);
    for (const tr of this.trees) tr.rest -= dt;
    // birds
    for (const b of this.birds) {
      b.age += dt;
      if (b.age < 0) {
        b.s.visible = false;
        continue;
      }
      b.s.visible = true;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 12 * dt;
      b.s.position.set(b.x, b.y);
      b.s.texture = birdFrames![Math.min(3, b.kind)]?.[Math.floor(now / 110 + b.age * 7) % 2] ?? b.s.texture;
      b.s.scale.set((b.vx < 0 ? -1 : 1) * Math.max(0.5, 1.5 - b.age * 0.3), Math.max(0.5, 1.5 - b.age * 0.3));
      b.s.alpha = Math.max(0, 1 - Math.max(0, b.age - 1.6) / 1.2);
    }
    this.birds = this.birds.filter((b) => {
      if (b.age < 2.8) return true;
      b.s.destroy();
      return false;
    });
    // leaves, snow, dust or embers, over the board
    const air = airOf(t);
    this.sinceMote += dt;
    if (air && this.sinceMote > air.every) {
      this.sinceMote = 0;
      const [x0, y0, x1, y1] = box;
      this.mote(x0 + Math.random() * (x1 - x0), air.vy < 0 ? y1 - Math.random() * (y1 - y0) * 0.4 : y0 + Math.random() * (y1 - y0) * 0.5, air, 3 + Math.random() * 2.5);
    }
    for (const m of this.motes) {
      m.age += dt;
      m.x += (m.vx + Math.sin(now / 400 + m.life * 3) * 8) * dt;
      m.y += m.vy * dt;
      m.s.position.set(m.x, m.y);
      m.s.alpha = Math.min(1, m.age * 3) * Math.max(0, 1 - m.age / m.life) * 0.85;
    }
    this.motes = this.motes.filter((m) => {
      if (m.age < m.life) return true;
      m.s.destroy();
      return false;
    });
    // water glints: a pale twinkle on a water tile now and then
    this.sinceGlint += dt;
    if (this.water.length && this.sinceGlint > 0.22 && this.motes.length < MOTE_CAP) {
      this.sinceGlint = 0;
      const [x, y] = this.water[Math.floor(Math.random() * this.water.length)];
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5);
      s.tint = 0xe8f6ff;
      s.width = 3;
      s.height = 2;
      s.blendMode = 'add';
      this.container.addChild(s);
      this.motes.push({ s, x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.3) * 12, vx: 0, vy: 0, age: 0, life: 0.7, grow: 0 });
    }
    // the torches at the gate, lit by night and at the edges of the day
    for (const k of this.torches) {
      if (torchTex && k.s.texture !== torchTex) k.s.texture = torchTex;
      const lit = t.night || t.conditions.includes('Night');
      k.s.visible = true;
      k.glow.visible = lit;
      const f = 0.75 + Math.sin(now / 90 + k.phase) * 0.12 + Math.sin(now / 37 + k.phase * 3) * 0.1;
      k.glow.alpha = f * 0.8;
      k.glow.scale.set(1.5 + (f - 0.75) * 1.2);
    }
  }
}
