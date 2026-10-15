// The town gathered (sim/ceremonies.ts, `snapshot.gathering`): the map dresses the spot. At a feast or a wedding:
// poles round the dancers with strings of pennants fluttering between them and paper lanterns that glow after dark, a
// long table laid with jars and pots behind the ring and a barrel beside it (the dungeon packs' clutter), confetti
// drifting down, and after dark fireworks bursting overhead (in the map's lights layer, so they shine through the
// night). At a funeral: candles in a ring round the mourners (the clutter's candle sheet), glowing after dark.
// A seasonal festival (sim/festivals.ts) is dressed in its own colours and lanterns, with its people's things laid out
// round the ring (`KITS`: the packs' flowers, fruit, skulls, corals, crystals, flasks, banners...), and from the first
// day of making ready the poles, pennants and things go up round the fire before anyone gathers.

import { AnimatedSprite, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { campfirePack } from '../art/fieldTiles';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import type { Snapshot } from '../../shared/sim/snapshot';
import { FESTIVAL_BY_ID, type DecorKit } from '../../shared/data/festivals';
import candelabraUrl from '../art/seats/dl_candelabra.png';
import skullsUrl from '../art/seats/ud_skulls.png';
import bonesUrl from '../art/deep/bones1.png';
import groveFruitUrl from '../art/seats/grove_fruit.png';
import groveLitUrl from '../art/seats/grove_lit1.png';
import mushroomUrl from '../art/deep/mushroom1.png';
import coral1Url from '../art/seats/coral1.png';
import coral2Url from '../art/seats/coral2.png';
import coral3Url from '../art/seats/coral3.png';
import shellUrl from '../art/seats/shell.png';
import crystal1Url from '../art/deep/crystal1.png';
import crystal2Url from '../art/deep/crystal2.png';
import crystal3Url from '../art/deep/crystal3.png';
import gold1Url from '../art/clutter/gold1.png';
import gold2Url from '../art/clutter/gold2.png';
import chestGoldUrl from '../art/clutter/chest_gold.png';
import shieldsUrl from '../art/clutter/shields.png';
import totemUrl from '../art/deep/totem.png';
import flagUrl from '../art/seats/flag.png';
import flaskRedUrl from '../art/clutter/flask_red.png';
import flaskBlueUrl from '../art/clutter/flask_blue.png';
import potionsUrl from '../art/clutter/potions.png';
import jarBlueUrl from '../art/clutter/jar_blue.png';
import ashUrl from '../art/deep/bonfire.png';
import appleUrl from '../art/life/apple.png';
import pearUrl from '../art/life/pear.png';
import orangeUrl from '../art/life/orange.png';
import pots3Url from '../art/clutter/pots3.png';
import plantsUrl from '../art/clutter/plants.png';
import plantUrl from '../art/shops/ap_plant.png';
import tableUrl from '../art/clutter/table_long.png';
import pots1Url from '../art/clutter/pots1.png';
import pots2Url from '../art/clutter/pots2.png';
import jarUrl from '../art/clutter/jar.png';
import barrelUrl from '../art/clutter/crate_barrel.png';
import stoolUrl from '../art/clutter/stool.png';
import candlesUrl from '../art/clutter/candles.png';

type Gathering = NonNullable<Snapshot['gathering']>;
/** A festival being made ready: dressed round the fire before anyone gathers. */
export interface FestivalPrep {
  id: string;
  x: number;
  y: number;
}

/** A thing laid out: the picture, its scale, and where its feet are (a share of its height). */
type Prop = [string, number, number];
/** Each festival kit's things (the packs' sprites), laid round the ring in turn. */
const KITS: Record<DecorKit, Prop[]> = {
  blossom: [[plantUrl, 1, 1], [appleUrl, 1, 1], [plantsUrl, 0.8, 1], [mushroomUrl, 0.4, 0.82], [pearUrl, 1, 1], [pots1Url, 1, 1]],
  harvest: [crate(), [pots3Url, 1, 1], [pearUrl, 1, 1], [orangeUrl, 1, 1], [plantsUrl, 0.8, 1], [appleUrl, 1, 1]],
  candles: [[candelabraUrl, 1.2, 1], [pots1Url, 1, 1], [candelabraUrl, 1.2, 1], [jarUrl, 1, 1]],
  bones: [[skullsUrl, 0.55, 0.9], [candelabraUrl, 1.2, 1], [bonesUrl, 0.32, 0.78], [candelabraUrl, 1.2, 1]],
  grove: [[groveFruitUrl, 0.6, 0.95], [mushroomUrl, 0.4, 0.82], [groveLitUrl, 0.6, 0.95], [plantUrl, 1, 1]],
  sea: [[coral1Url, 0.8, 1], [shellUrl, 0.8, 1], [coral2Url, 0.8, 1], [coral3Url, 0.8, 1]],
  crystal: [[crystal1Url, 0.45, 0.85], [crystal2Url, 0.45, 0.85], [crystal3Url, 0.45, 0.85]],
  forge: [[shieldsUrl, 1, 1], [gold1Url, 1, 1], [chestGoldUrl, 1, 1], crate()],
  war: [[totemUrl, 0.32, 0.9], [flagUrl, 0.7, 1], [shieldsUrl, 1, 1], [flagUrl, 0.7, 1]],
  flasks: [[flaskRedUrl, 1.2, 1], [potionsUrl, 1, 1], [flaskBlueUrl, 1.2, 1], [jarBlueUrl, 1.2, 1]],
  banners: [[flagUrl, 0.7, 1], [shieldsUrl, 1, 1], [flagUrl, 0.7, 1], crate()],
  fire: [[ashUrl, 0.5, 0.7], [totemUrl, 0.3, 0.9], [bonesUrl, 0.3, 0.78]],
  gold: [[gold1Url, 1, 1], [candelabraUrl, 1.2, 1], [chestGoldUrl, 1, 1], [gold2Url, 1, 1]],
};
function crate(): Prop {
  return [barrelUrl, 1, 1];
}
/** Things round a festival's ring, and the ring's size while it is being made ready. */
const KIT_PROPS = 8;
const PREP_RING = 64;

/** Poles round the ring, how far out past the dancers, and how tall. */
const POLES = 10;
const POLE_OUT = 24;
const POLE_H = 34;
/** The pennants' colours, in turn. */
const PENNANTS = [0xe04040, 0xf0c030, 0x3a78d8, 0x48b048, 0xf0f0f0, 0xd060c0];
const LANTERN = [0xff9a40, 0xffd060, 0xff6a50];
const CONFETTI_MOST = 46;
const FIREWORK_EVERY = 1.3;
const SPARKS = 22;
const CANDLES = 8;

const textures = new Map<string, Texture | null>();
let loaded: (() => void) | null = null;
function tex(url: string): Texture | null {
  if (textures.has(url)) return textures.get(url)!;
  textures.set(url, null);
  loadImage(url).then(
    (im) => {
      const t = Texture.from(im);
      t.source.scaleMode = 'nearest';
      textures.set(url, t);
      loaded?.();
    },
    () => undefined,
  );
  return null;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  life: number;
  spin: number;
}
interface Burst {
  x: number;
  y: number;
  age: number;
  color: number;
  sparks: { a: number; v: number }[];
  glow: Sprite;
}

export class MapFestival {
  private key = '';
  private g: Gathering | null = null;
  /** The poles (each with its string to the next) and the table's things, standing among the things. */
  private standing: Container[] = [];
  private strings: { gfx: Graphics; from: { x: number; y: number }; to: { x: number; y: number }; front: boolean; i: number }[] = [];
  private lanternGlows: { s: Sprite; i: number }[] = [];
  private candles: { s: Sprite; glow: Sprite; seed: number }[] = [];
  private confettiGfx: Graphics;
  private confetti: Bit[] = [];
  private fireGfx: Graphics;
  private bursts: Burst[] = [];
  private nextBurst = 0;
  private t = 0;
  private flutterAt = -1;
  /** The festival's colours and lantern (the plain ones at a feast), and whether one is dressed. */
  private colours: number[] = PENNANTS;
  private lantern: number[] = LANTERN;
  private festival = false;

  constructor(
    private things: Container,
    over: Container,
    private lights: Container,
  ) {
    this.confettiGfx = over.addChild(new Graphics());
    this.fireGfx = lights.addChild(new Graphics());
    loaded = () => {
      this.key = '';
      if (this.g) this.sync(this.g);
    };
  }

  /** The gathering now (null: none), and a festival being made ready (null: none): the dressing is laid out again
   *  when either changes. A gathering takes the place of the making ready. */
  sync(g: Gathering | null, prep: FestivalPrep | null = null): void {
    const p = g ? null : prep;
    const n = [...textures.values()].filter(Boolean).length;
    const key = g ? `${g.kind}|${g.x}|${g.y}|${g.ring}|${g.key}|${g.fire}|${g.festival}|${n}|${campfirePack() ? 1 : 0}` : p ? `prep|${p.id}|${p.x}|${p.y}|${n}` : '';
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const fest = FESTIVAL_BY_ID[(g ? g.festival : p?.id) ?? ''];
    this.festival = !!fest;
    this.colours = fest ? fest.colours : PENNANTS;
    this.lantern = fest ? [fest.lantern] : LANTERN;
    if (p && fest) {
      // (made ready: the ring of poles and the things go up round the fire, nobody dancing yet)
      this.g = { kind: 'festival', x: p.x, y: p.y, ring: PREP_RING, key: 0, fire: false, festival: fest.id };
      this.dressPoles(this.g);
      this.dressKit(this.g, fest.kit);
      return;
    }
    this.g = g;
    if (!g) return;
    if (g.kind === 'feast' || g.kind === 'wedding' || g.kind === 'festival') this.dressFeast(g);
    else this.dressFuneral(g);
    if (fest) this.dressKit(g, fest.kit);
  }

  /** The festival's things round the ring, just outside the poles. */
  private dressKit(g: Gathering, kit: DecorKit): void {
    const props = KITS[kit];
    for (let i = 0; i < KIT_PROPS; i++) {
      const [url, scale, foot] = props[i % props.length];
      const t = tex(url);
      if (!t) continue;
      const p = this.ring(g, POLE_OUT + 16, i + 0.5, KIT_PROPS);
      const s = this.things.addChild(new Sprite(t));
      s.anchor.set(0.5, foot);
      s.scale.set(scale);
      s.position.set(p.x, p.y);
      s.zIndex = p.y;
      this.standing.push(s);
    }
  }

  private clear(): void {
    for (const c of this.standing) c.destroy({ children: true });
    for (const l of this.lanternGlows) l.s.destroy();
    for (const c of this.candles) c.glow.destroy();
    for (const b of this.bursts) b.glow.destroy();
    this.standing = [];
    this.strings = [];
    this.lanternGlows = [];
    this.candles = [];
    this.bursts = [];
    this.confetti = [];
    this.confettiGfx.clear();
    this.fireGfx.clear();
  }

  private ring(g: Gathering, out: number, i: number, n: number): { x: number; y: number } {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const r = g.ring + out;
    return { x: Math.round(g.x + Math.cos(a) * r), y: Math.round(g.y + Math.sin(a) * r * 0.7) };
  }

  private dressFeast(g: Gathering): void {
    // (a bonfire in the middle of the ring, unless they dance round the camp's own fire: the Fields pack's campfire)
    const fire = g.fire ? campfirePack() : null;
    if (fire) {
      const a = this.things.addChild(new AnimatedSprite(fire.map((f) => f.texture)));
      a.animationSpeed = 7 / 60;
      a.play();
      a.anchor.set(0.5, 0.85);
      a.scale.set(1.3);
      a.position.set(Math.round(g.x), Math.round(g.y));
      a.zIndex = g.y;
      this.standing.push(a);
      const glow = this.lights.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.width = glow.height = 90;
      glow.tint = 0xffa040;
      glow.position.set(g.x, g.y - 8);
      this.lanternGlows.push({ s: glow, i: 99 });
    }
    this.dressPoles(g);
    this.dressTable(g);
  }

  /** The poles round the ring, with their strings of pennants and a lantern on each. */
  private dressPoles(g: Gathering): void {
    const poles = Array.from({ length: POLES }, (_, i) => this.ring(g, POLE_OUT, i, POLES));
    poles.forEach((p, i) => {
      // (a pole: a post of dark wood with a gilt knob, standing with its foot on the ground)
      const pole = this.things.addChild(new Graphics());
      pole.position.set(p.x, p.y);
      pole.ellipse(0, 0, 4, 1.6).fill({ color: 0x000000, alpha: 0.25 });
      pole.rect(-1, -POLE_H, 2, POLE_H).fill(0x5a3a20);
      pole.rect(-1, -POLE_H, 1, POLE_H).fill(0x7a5434);
      pole.circle(0, -POLE_H - 1, 1.8).fill(0xe8c050);
      pole.zIndex = p.y;
      this.standing.push(pole);
      // (its string to the next pole, sorted with the nearer of the two)
      const q = poles[(i + 1) % POLES];
      const gfx = this.things.addChild(new Graphics());
      gfx.position.set(Math.min(p.x, q.x), Math.min(p.y, q.y) - POLE_H);
      gfx.zIndex = Math.max(p.y, q.y) - 0.5;
      this.standing.push(gfx);
      this.strings.push({ gfx, from: p, to: q, front: Math.max(p.y, q.y) > g.y, i });
      // (a paper lantern hangs at the middle of each string, and glows after dark)
      const glow = this.lights.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.width = glow.height = 26;
      glow.tint = this.lantern[i % this.lantern.length];
      glow.position.set((p.x + q.x) / 2, (p.y + q.y) / 2 - POLE_H + 9);
      this.lanternGlows.push({ s: glow, i });
    });
  }

  /** The feast table behind the ring, laid, with a barrel and stools. */
  private dressTable(g: Gathering): void {
    const back = { x: g.x, y: Math.round(g.y - (g.ring + POLE_OUT) * 0.7 - 16) };
    const put = (url: string, dx: number, dy: number, z = 0) => {
      const t = tex(url);
      if (!t) return;
      const s = this.things.addChild(new Sprite(t));
      s.anchor.set(0.5, 1);
      s.position.set(back.x + dx, back.y + dy);
      s.zIndex = back.y + dy + z;
      this.standing.push(s);
    };
    put(tableUrl, 0, 0);
    put(pots1Url, -18, -12, 0.2);
    put(jarUrl, -2, -13, 0.2);
    put(pots2Url, 14, -11, 0.2);
    put(barrelUrl, 46, 2);
    put(stoolUrl, -24, 8);
    put(stoolUrl, 22, 8);
  }

  private dressFuneral(g: Gathering): void {
    const sheet = tex(candlesUrl);
    if (!sheet) return;
    for (let i = 0; i < CANDLES; i++) {
      const p = this.ring(g, 18, i, CANDLES);
      const v = i % 3;
      const s = this.things.addChild(new Sprite(new Texture({ source: sheet.source, frame: new Rectangle(v * 32, 0, 32, 32) })));
      s.anchor.set(0.5, 26 / 32);
      s.scale.set(0.75);
      s.position.set(p.x, p.y);
      s.zIndex = p.y;
      this.standing.push(s);
      const glow = this.lights.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.width = glow.height = 30;
      glow.tint = 0xffd890;
      glow.position.set(p.x, p.y - 6);
      this.candles.push({ s, glow, seed: i * 1.7 });
    }
  }

  /** A frame: the pennants flutter, the lanterns and candles flicker, confetti falls, and fireworks go up after dark
   *  (`night`: the lights layer is showing). `calm`: a slow phone, no confetti or fireworks. */
  render(dt: number, night: boolean, calm: boolean): void {
    this.t += dt;
    const g = this.g;
    if (!g) return;
    const festive = g.kind === 'feast' || g.kind === 'wedding' || g.kind === 'festival';
    // (the strings, redrawn a few times a second as the pennants flutter)
    const frame = Math.floor(this.t * 8);
    if (festive && frame !== this.flutterAt) {
      this.flutterAt = frame;
      for (const s of this.strings) this.drawString(s);
    }
    for (const l of this.lanternGlows) l.s.alpha = 0.75 + 0.25 * Math.sin(this.t * 3 + l.i * 1.9);
    for (const c of this.candles) {
      const f = Math.floor(this.t * 8 + c.seed * 3) % 6;
      const src = c.s.texture;
      if (src.frame.y !== f * 32) c.s.texture = new Texture({ source: src.source, frame: new Rectangle(src.frame.x, f * 32, 32, 32) });
      c.glow.alpha = 0.7 + 0.3 * Math.sin(this.t * 7 + c.seed * 5);
    }
    // (while it's being made ready: no confetti or fireworks yet)
    if (!festive || calm || this.key.startsWith('prep|')) {
      this.confettiGfx.clear();
      this.fireGfx.clear();
      return;
    }
    this.drawConfetti(g, dt);
    this.drawFireworks(g, dt, night);
  }

  private drawString(s: (typeof this.strings)[number]): void {
    const { gfx, from, to } = s;
    const ox = gfx.position.x;
    const oy = gfx.position.y;
    gfx.clear();
    const ax = from.x - ox;
    const ay = from.y - POLE_H - oy;
    const bx = to.x - ox;
    const by = to.y - POLE_H - oy;
    const sag = 7 + Math.hypot(bx - ax, by - ay) * 0.06;
    const at = (u: number) => ({ x: ax + (bx - ax) * u, y: ay + (by - ay) * u + Math.sin(u * Math.PI) * sag });
    // the cord
    let prev = at(0);
    for (let k = 1; k <= 12; k++) {
      const p = at(k / 12);
      gfx.moveTo(prev.x, prev.y).lineTo(p.x, p.y);
      prev = p;
    }
    gfx.stroke({ color: 0x3a2a1a, width: 1 });
    // the pennants, a little triangle every few px, swaying in the breeze
    const n = Math.max(3, Math.floor(Math.hypot(bx - ax, by - ay) / 7));
    for (let k = 1; k < n; k++) {
      const u = k / n;
      const p = at(u);
      const sway = Math.sin(this.t * 5 + k * 0.9 + s.i) * 1.4;
      const col = this.colours[(k + s.i) % this.colours.length];
      gfx.poly([p.x - 2.5, p.y, p.x + 2.5, p.y, p.x + sway, p.y + 6]).fill(col);
      gfx.poly([p.x - 2.5, p.y, p.x, p.y, p.x + sway * 0.5, p.y + 6]).fill({ color: 0x000000, alpha: 0.12 });
    }
    // the lantern at the middle: a round paper lantern with a dark cap and foot
    const m = at(0.5);
    const col = this.lantern[s.i % this.lantern.length];
    gfx.rect(m.x - 0.5, m.y, 1, 3).fill(0x3a2a1a);
    gfx.ellipse(m.x, m.y + 7, 3.5, 4.5).fill(col);
    gfx.ellipse(m.x - 1, m.y + 6, 1.4, 2.6).fill({ color: 0xffffff, alpha: 0.35 });
    gfx.rect(m.x - 2, m.y + 2, 4, 1.2).fill(0x5a2a1a);
    gfx.rect(m.x - 2, m.y + 11, 4, 1.2).fill(0x5a2a1a);
  }

  private drawConfetti(g: Gathering, dt: number): void {
    const r = g.ring + POLE_OUT;
    while (this.confetti.length < CONFETTI_MOST) {
      this.confetti.push({ x: (Math.random() * 2 - 1) * r, y: -60 - Math.random() * 50, vx: (Math.random() - 0.5) * 10, vy: 14 + Math.random() * 14, color: this.colours[Math.floor(Math.random() * this.colours.length)], life: 2.5 + Math.random() * 2.5, spin: Math.random() * 6 });
    }
    const c = this.confettiGfx;
    c.position.set(g.x, g.y);
    c.zIndex = 1e7;
    c.clear();
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const b = this.confetti[i];
      b.life -= dt;
      b.spin += dt * 6;
      b.x += (b.vx + Math.sin(b.spin) * 12) * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.y > 10) {
        this.confetti.splice(i, 1);
        continue;
      }
      // (a fleck turning over: wide, then edge-on)
      const w = 1 + Math.abs(Math.cos(b.spin)) * 1.6;
      c.rect(b.x, b.y, w, 1.8).fill({ color: b.color, alpha: Math.min(1, b.life) });
    }
  }

  private drawFireworks(g: Gathering, dt: number, night: boolean): void {
    const f = this.fireGfx;
    f.position.set(0, 0);
    if (night) {
      this.nextBurst -= dt;
      if (this.nextBurst <= 0) {
        this.nextBurst = FIREWORK_EVERY * (0.5 + Math.random());
        const glow = this.lights.addChild(new Sprite(glowTexture()));
        glow.anchor.set(0.5);
        const color = this.festival ? this.colours[Math.floor(Math.random() * this.colours.length)] : [0xff5050, 0x60d0ff, 0xffd040, 0x80ff80, 0xff80ff, 0xffffff][Math.floor(Math.random() * 6)];
        glow.tint = color;
        const x = g.x + (Math.random() - 0.5) * 160;
        const y = g.y - 90 - Math.random() * 70;
        glow.position.set(x, y);
        this.bursts.push({ x, y, age: 0, color, glow, sparks: Array.from({ length: SPARKS }, (_, k) => ({ a: (k / SPARKS) * Math.PI * 2 + Math.random() * 0.2, v: 34 + Math.random() * 22 })) });
      }
    }
    f.clear();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const life = 1.4;
      if (b.age > life) {
        b.glow.destroy();
        this.bursts.splice(i, 1);
        continue;
      }
      const fade = 1 - b.age / life;
      // (the bloom of light, big at first and dying)
      b.glow.width = b.glow.height = 70 * (0.4 + b.age) * fade + 8;
      b.glow.alpha = fade;
      // (the sparks fly out, slow and fall)
      for (const s of b.sparks) {
        const d = s.v * (1 - Math.exp(-b.age * 2.6));
        const x = b.x + Math.cos(s.a) * d;
        const y = b.y + Math.sin(s.a) * d * 0.85 + b.age * b.age * 14;
        f.rect(x - 1, y - 1, 2, 2).fill({ color: b.color, alpha: fade });
        f.rect(x - 0.5, y - 0.5 - 3 * fade, 1, 3 * fade).fill({ color: 0xffffff, alpha: fade * 0.6 });
      }
    }
  }
}
