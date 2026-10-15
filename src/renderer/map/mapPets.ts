// The town's own animals (the owner's ask: something massive): a dog or a cat for some homes and a few hens scratching
// about others (pets.ts says whose, by the home's id), drawn from DawnLike's Dog, Cat and Avian sheets (the columns of
// art/wildlife.png from PET_COL). A dog lazes by its door, noses about, trots at the heels of its people when they pass,
// sleeps by the door at night, and runs out barking at raiders. A cat washes on the doorstep, strolls, prowls further by
// night and bolts from any dog that comes near. Hens peck about the yard, scatter from feet, and go to roost at dusk.
// Tap one for its name; give it a scratch. Renderer only: none of this is in the sim. Kept on a slow phone (a few
// sprites), without the words.

import { Container, Sprite, Text, Texture, Rectangle } from 'pixi.js';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import wildUrl from '../art/wildlife.png';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import type { MapView } from './mapView';
import { petLine, petsOf, type PetDef, type PetKind } from './pets';

/** The atlas's first pet column (tools/compose-wildlife.cjs): four dogs, four cats, the rooster, the hen. */
const PET_COL = 14;
const SIZE = 16;
const SCALE: Record<PetKind, number> = { dog: 1.8, cat: 1.5, hen: 1.45 };
const WALK: Record<PetKind, number> = { dog: 34, cat: 26, hen: 16 };
const RUN: Record<PetKind, number> = { dog: 110, cat: 130, hen: 60 };
/** How far a dog sees raiders, a cat feels a dog, and hens are scattered by feet (px). */
const RAID_SEE = 260;
const DOG_NEAR = 55;
const HEN_SHY = 30;
/** How far a cat sees a rat about the stores (map/mapCritters.ts), how fast it gives chase, and how near is caught (px). */
const CAT_SEE = 150;
const CAT_CHASE = 105;
const CAT_CATCH = 7;

export interface PetHome {
  id: number;
  door: { x: number; y: number };
  /** Whose it is, for the card ("Elka"). */
  name: string;
  residents: number[];
}
type State = 'idle' | 'wander' | 'follow' | 'bark' | 'flee' | 'sleep' | 'happy' | 'hunt';
interface Pet {
  key: string;
  def: PetDef;
  home: PetHome;
  s: Sprite;
  sh: Sprite;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: State;
  wait: number;
  step: number;
  vx: number;
  /** Whom it follows (a person's id), and for how long. */
  follow: number | null;
  /** The next bark, and a hop (happy, a hen's scatter). */
  bark: number;
  hop: number;
  alpha: number;
  /** The rat a cat is after (map/mapCritters.ts's id). */
  prey?: number | null;
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
      frames = Array.from({ length: 10 }, (_, k) => [0, 1].map((f) => new Texture({ source, frame: new Rectangle((PET_COL + k) * SIZE, f * SIZE, SIZE, SIZE) })));
    },
    () => {},
  );
}
const column = (d: PetDef) => (d.kind === 'dog' ? d.coat : d.kind === 'cat' ? 4 + d.coat : 8 + d.coat);

export class MapPets {
  land: LandMap | null = null;
  people = 'settlers';
  night = false;
  raid = false;
  /** A bark, a meow or a cluck (ambience.ts), with where (world x). */
  onSound: ((kind: 'bark' | 'meow' | 'cluck', x: number) => void) | null = null;
  /** The rats about the stores (map/mapCritters.ts, each frame), and a rat caught. */
  prey: { id: number; x: number; y: number }[] = [];
  onCatch: ((id: number) => void) | null = null;
  private readonly pets = new Map<string, Pet>();
  private folk: { id: number; x: number; y: number }[] = [];
  private raiders: { x: number; y: number }[] = [];
  private readonly words: { t: Text; life: number }[] = [];

  constructor(
    private readonly layer: Container,
    private readonly over: Container,
    private readonly map: MapView,
  ) {
    loadFrames();
  }

  get count(): number {
    return this.pets.size;
  }

  /** Each snapshot: the homes standing, who's about and the raiders in town. */
  sync(homes: PetHome[], folk: { id: number; x: number; y: number }[], raiders: { x: number; y: number }[]): void {
    this.folk = folk;
    this.raiders = raiders;
    if (!frames) return;
    const seen = new Set<string>();
    for (const h of homes)
      petsOf(h.id, this.people).forEach((def, i) => {
        const key = `${h.id}:${i}`;
        seen.add(key);
        const had = this.pets.get(key);
        if (had) {
          had.home = h;
          return;
        }
        const x = h.door.x + (i % 2 ? -1 : 1) * (14 + i * 6);
        const y = h.door.y + 6 + i * 3;
        const s = this.layer.addChild(new Sprite(frames![column(def)][0]));
        s.anchor.set(0.5, 0.95);
        const sh = this.layer.addChild(new Sprite(glowTexture()));
        sh.anchor.set(0.5);
        sh.tint = 0x000000;
        sh.width = 9 * SCALE[def.kind];
        sh.height = 3 * SCALE[def.kind];
        this.pets.set(key, { key, def, home: h, s, sh, x, y, tx: x, ty: y, state: 'idle', wait: Math.random() * 5, step: Math.random() * 2, vx: 0, follow: null, bark: 0, hop: 0, alpha: 1 });
      });
    for (const [key, p] of this.pets)
      if (!seen.has(key)) {
        p.s.destroy();
        p.sh.destroy();
        this.pets.delete(key);
      }
  }

  /** Where the cats are (the rats run from them). */
  cats(): { x: number; y: number }[] {
    return [...this.pets.values()].filter((p) => p.def.kind === 'cat').map((p) => ({ x: p.x, y: p.y }));
  }

  /** The pet under a world point (for its card). */
  petAt(wx: number, wy: number): string | null {
    let best: { key: string; d: number } | null = null;
    for (const p of this.pets.values()) {
      if (!p.s.visible || p.alpha < 0.3) continue;
      const half = (SIZE * SCALE[p.def.kind]) / 2 + 8;
      const dx = wx - p.x;
      const dy = wy - (p.y - half);
      if (Math.abs(dx) < half && Math.abs(dy) < half + 2) {
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { key: p.key, d };
      }
    }
    return best?.key ?? null;
  }

  /** Its card: name, and what it's doing. */
  describe(key: string): { title: string; line: string; x: number; y: number } | null {
    const p = this.pets.get(key);
    if (!p) return null;
    return { title: p.def.name, line: petLine(p.def.kind, p.state, p.home.name), x: p.x, y: p.y };
  }

  /** A scratch behind the ears: a happy hop and a heart. */
  scratch(key: string): void {
    const p = this.pets.get(key);
    if (!p) return;
    p.state = 'happy';
    p.wait = 2.5;
    p.hop = 1;
    this.say(p, p.def.kind === 'dog' ? '♥ woof!' : p.def.kind === 'cat' ? '♥ prrr' : '♥ bok!', 0xff8aa8);
    this.onSound?.(p.def.kind === 'dog' ? 'bark' : p.def.kind === 'cat' ? 'meow' : 'cluck', p.x);
  }

  render(dt: number): void {
    const v = this.map.view;
    for (const p of this.pets.values()) {
      const shown = !!frames && p.x > v.x - 60 && p.x < v.x + v.w + 60 && p.y > v.y - 40 && p.y < v.y + v.h + 60;
      this.think(p, dt);
      p.s.visible = p.sh.visible = shown;
      if (!shown) continue;
      const k = SCALE[p.def.kind];
      const moving = p.state === 'wander' || p.state === 'follow' || p.state === 'flee' || p.state === 'hunt' || (p.state === 'bark' && Math.hypot(p.tx - p.x, p.ty - p.y) > 3);
      p.step += dt * (p.state === 'flee' || p.state === 'hunt' ? 11 : moving ? 5 : p.def.kind === 'hen' ? 1.4 : p.state === 'bark' ? 6 : 0.25);
      p.s.texture = frames![column(p.def)][p.state === 'sleep' ? 0 : Math.floor(p.step) % 2];
      p.hop = Math.max(0, p.hop - dt * 1.6);
      const lift = p.hop > 0 ? Math.abs(Math.sin(p.hop * Math.PI * 3)) * 6 : p.state === 'bark' ? Math.abs(Math.sin(p.step * Math.PI)) * 2 : 0;
      if (Math.abs(p.vx) > 0.3) p.s.scale.x = (p.vx > 0 ? -1 : 1) * k;
      // (asleep it lies low and still, a little squashed)
      p.s.scale.y = p.state === 'sleep' ? k * 0.82 : k;
      p.s.alpha = p.alpha;
      p.s.position.set(Math.round(p.x), Math.round(p.y - lift));
      p.s.zIndex = p.y;
      p.sh.alpha = 0.28 * p.alpha;
      p.sh.position.set(Math.round(p.x), Math.round(p.y));
      p.sh.zIndex = p.y - 0.5;
    }
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.life -= dt;
      w.t.y -= 14 * dt;
      w.t.alpha = Math.min(1, w.life * 2);
      if (w.life <= 0) {
        w.t.destroy();
        this.words.splice(i, 1);
      }
    }
  }

  private think(p: Pet, dt: number): void {
    const kind = p.def.kind;
    const door = p.home.door;
    p.wait -= dt;
    // the hens go to roost at dusk and come down at dawn
    if (kind === 'hen') p.alpha += ((this.night ? 0 : 1) - p.alpha) * Math.min(1, dt * 1.5);
    // a dog sees raiders off; a cat and the hens make for the door
    const raider = this.raid ? this.nearest(this.raiders, p, RAID_SEE) : null;
    if (raider && kind === 'dog') {
      p.state = 'bark';
      const d = Math.hypot(raider.x - p.x, raider.y - p.y);
      const stand = 48;
      p.tx = raider.x + ((p.x - raider.x) / Math.max(1, d)) * stand;
      p.ty = raider.y + ((p.y - raider.y) / Math.max(1, d)) * stand;
      p.vx = raider.x - p.x;
      this.go(p, RUN.dog * 0.8, dt);
      p.vx = raider.x - p.x;
      p.bark -= dt;
      if (p.bark <= 0) {
        p.bark = 0.8 + Math.random() * 0.9;
        this.say(p, Math.random() < 0.5 ? 'Woof!' : 'Grrr!', 0xffe0a0);
        this.onSound?.('bark', p.x);
      }
      return;
    }
    if (p.state === 'bark') this.home(p);
    if (p.state === 'happy') {
      if (p.wait <= 0) p.state = 'idle';
      return;
    }
    if (p.state === 'flee') {
      if (this.go(p, RUN[kind], dt) || p.wait <= 0) {
        p.state = 'idle';
        p.wait = 2 + Math.random() * 4;
      }
      return;
    }
    // a cat bolts from a dog; hens from feet
    if (kind === 'cat') {
      const dog = [...this.pets.values()].find((q) => q.def.kind === 'dog' && q.state !== 'sleep' && Math.hypot(q.x - p.x, q.y - p.y) < DOG_NEAR);
      if (dog) {
        p.prey = null;
        return this.bolt(p, dog, 90, 'Hsss!');
      }
      // (and gives chase to a rat about the stores, pouncing if it's quick enough)
      const after = p.prey != null ? this.prey.find((r) => r.id === p.prey) : undefined;
      const rat = after ?? (p.state === 'idle' || p.state === 'wander' ? this.nearest(this.prey, p, CAT_SEE) : null);
      if (rat && Math.hypot(rat.x - p.x, rat.y - p.y) < CAT_SEE * 1.4) {
        p.state = 'hunt';
        p.prey = rat.id;
        p.tx = rat.x;
        p.ty = rat.y;
        this.go(p, CAT_CHASE, dt);
        if (Math.hypot(rat.x - p.x, rat.y - p.y) < CAT_CATCH) {
          this.onCatch?.(p.prey);
          p.prey = null;
          p.state = 'happy';
          p.wait = 1.8;
          p.hop = 0.6;
          this.say(p, 'Mrrp!', 0xf0f0ff);
          this.onSound?.('meow', p.x);
        }
        return;
      }
      if (p.state === 'hunt') {
        p.prey = null;
        p.state = 'idle';
        p.wait = 1 + Math.random() * 3;
      }
    }
    if (kind === 'hen' && p.alpha > 0.5) {
      const near = this.nearest(this.folk, p, HEN_SHY);
      if (near) {
        p.hop = 0.6;
        if (Math.random() < 0.3) this.onSound?.('cluck', p.x);
        return this.bolt(p, near, 34, null);
      }
    }
    // night: the dog sleeps by the door, the cat prowls
    if (this.night && kind === 'dog') {
      if (p.state !== 'sleep') {
        p.tx = door.x + 16;
        p.ty = door.y + 8;
        p.state = this.go(p, WALK.dog, dt) ? 'sleep' : 'wander';
      }
      return;
    }
    if (!this.night && p.state === 'sleep') p.state = 'idle';
    // a dog trots after its people when they pass
    if (kind === 'dog') {
      if (p.state === 'follow') {
        const who = this.folk.find((f) => f.id === p.follow);
        if (!who || p.wait <= 0 || Math.hypot(who.x - door.x, who.y - door.y) > 420) {
          p.follow = null;
          this.home(p);
        } else {
          const dx = who.x - p.x;
          const dy = who.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > 24) {
            p.tx = who.x - (dx / d) * 20;
            p.ty = who.y - (dy / d) * 10;
            this.go(p, Math.min(RUN.dog, WALK.dog * (d > 80 ? 3 : 1.6)), dt);
          } else p.vx = dx;
        }
        return;
      }
      if (p.state === 'idle' && p.wait <= 0 && Math.random() < 0.5) {
        const mine = this.folk.find((f) => p.home.residents.includes(f.id) && Math.hypot(f.x - p.x, f.y - p.y) < 140);
        if (mine) {
          p.state = 'follow';
          p.follow = mine.id;
          p.wait = 15 + Math.random() * 20;
          if (Math.random() < 0.4) {
            this.say(p, 'Woof!', 0xffe0a0);
            this.onSound?.('bark', p.x);
          }
          return;
        }
      }
    }
    if (p.state === 'wander') {
      if (this.go(p, WALK[kind], dt)) {
        p.state = 'idle';
        p.wait = kind === 'cat' ? 4 + Math.random() * 10 : 2 + Math.random() * 6;
      }
      return;
    }
    if (p.wait <= 0) {
      const reach = kind === 'hen' ? 50 : kind === 'cat' ? (this.night ? 160 : 60) : 80;
      for (let tries = 0; tries < 5; tries++) {
        const tx = door.x + (Math.random() - 0.5) * 2 * reach;
        const ty = door.y + 10 + (Math.random() - 0.3) * reach;
        if (this.open(tx, ty)) {
          p.tx = tx;
          p.ty = ty;
          p.state = 'wander';
          break;
        }
      }
      p.wait = 2 + Math.random() * 4;
      // (a cat says something now and then)
      if (kind === 'cat' && Math.random() < 0.12 && !this.night) {
        this.say(p, 'Mrrow', 0xf0f0ff);
        this.onSound?.('meow', p.x);
      }
      if (kind === 'hen' && Math.random() < 0.15) this.onSound?.('cluck', p.x);
    }
  }

  /** Off away from something, fast. */
  private bolt(p: Pet, from: { x: number; y: number }, far: number, word: string | null): void {
    const ang = Math.atan2(p.y - from.y, p.x - from.x) + (Math.random() - 0.5) * 0.8;
    const tx = p.x + Math.cos(ang) * far;
    const ty = p.y + Math.sin(ang) * far * 0.7;
    p.tx = this.open(tx, ty) ? tx : p.home.door.x;
    p.ty = this.open(tx, ty) ? ty : p.home.door.y + 8;
    p.state = 'flee';
    p.wait = 2.5;
    if (word) {
      this.say(p, word, 0xffc0c0);
      this.onSound?.('meow', p.x);
    }
  }

  private home(p: Pet): void {
    p.tx = p.home.door.x + (Math.random() - 0.5) * 30;
    p.ty = p.home.door.y + 8;
    p.state = 'wander';
  }

  /** A step toward the target; true once there. */
  private go(p: Pet, speed: number, dt: number): boolean {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.vx = dx;
    return false;
  }

  private open(x: number, y: number): boolean {
    const land = this.land;
    if (!land) return false;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= land.w || cy >= land.h) return false;
    const g = groundAt(land, cx, cy);
    if (g === 'water' || g === 'mountain' || g === 'rock') return false;
    return !this.map.standingAt(x, y);
  }

  private nearest<T extends { x: number; y: number }>(list: T[], p: Pet, within: number): T | null {
    let best: T | null = null;
    let bd = within * within;
    for (const q of list) {
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  private say(p: Pet, word: string, colour: number): void {
    if (this.map.calm || this.words.length > 12) return;
    const t = this.over.addChild(new Text({ text: word, style: { fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: colour, stroke: { color: 0x1a1410, width: 3 } } }));
    t.anchor.set(0.5, 1);
    t.resolution = 3;
    t.position.set(p.x, p.y - SIZE * SCALE[p.def.kind] - 2);
    this.words.push({ t, life: 1.2 });
  }
}
