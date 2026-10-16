// The props of a cutscene drawn (data/sceneProps.ts says what each kind is; sceneClock.ts's `propsAt` where each stands
// and what's been done to it, and `actorsAt` what's in each hand). Behind the actors or before them, from the packs'
// sprites: fires with the 5000 Pixel Effects flames licking over them, pvfx smoke rising, embers drifting up, a warm
// pool of light on the ground flickering as a flame does (map/flicker.ts) and warming whoever stands near; Duchess the
// goat chewing or wandering, bleating when startled; birds pecking until something sends them up; banners in the wind;
// rain, snow, falling ash and fireflies over the whole stage; and in the actors' hands the things they hold, swung
// with a strike, raised with a cheer, held out low into the fire, each with a small shadow under it. The flames, the
// light and the sparks are drawn over the scene's darkening (`over`), so a fire shows in the dark.
//
// Cheap on purpose (the phone): a sprite or two a prop, the sparks and the weather as a few hundred rects in two
// Graphics redrawn each frame, every texture loaded once.

import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { FEET } from '../../shared/data/cutscenes';
import { FLAMES_ANY, HELD, PROPS, type HeldDef, type PropDef } from '../../shared/data/sceneProps';
import { flameFrame, smokeFrame } from '../art/effects';
import { loadImage } from '../art/loadImage';
import { flicker } from '../map/flicker';
import { glowTexture } from '../town/layer';
import { PROP_ART } from './propArt';
import type { ActorNow, PropNow } from './sceneClock';

/** A fire's light on the stage: where (its foot), how far it reaches (stage px), how strong now (0..1). */
export interface Light {
  x: number;
  y: number;
  r: number;
  k: number;
}

/* ------------------------------------------------------------ textures (each file loaded once) */

const loaded = new Map<string, Texture[] | 'loading' | 'failed'>();
/** A file's frames (side by side; the birds' sheet is 5 kinds across and 2 frames down), or null while it loads. */
function framesOf(art: string, n = 1): Texture[] | null {
  const got = loaded.get(art);
  if (got === 'loading' || got === 'failed') return null;
  if (got) return got;
  const url = PROP_ART[art];
  if (!url) {
    loaded.set(art, 'failed');
    return null;
  }
  loaded.set(art, 'loading');
  loadImage(url)
    .then((im) => {
      const src = Texture.from(im).source;
      src.scaleMode = 'nearest';
      const birds = art === 'birds.png';
      const across = birds ? 5 : n;
      const down = birds ? 2 : 1;
      const w = im.width / across;
      const h = im.height / down;
      const out: Texture[] = [];
      for (let r = 0; r < down; r++) for (let c = 0; c < across; c++) out.push(new Texture({ source: src, frame: new Rectangle(c * w, r * h, w, h) }));
      loaded.set(art, out);
    })
    .catch(() => loaded.set(art, 'failed'));
  return null;
}

/** A fraction from a number, the same every frame (for the sparks' and drops' places). */
const frac = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Where the weather is drawn: the stage and a margin, as far as any camera looks. */
const AIR_X0 = -110;
const AIR_W = 540;
const AIR_TOP = -10;
const AIR_H = 200;

interface Drawn {
  body: Sprite;
  shadow: boolean;
  dressing: Sprite[];
  flames: Sprite[];
  smoke: Sprite[];
  pool: Sprite;
  halo: Sprite;
  bubble?: Text;
  /** Birds: a sprite each. */
  flock: Sprite[];
}

export class SceneProps {
  /** Behind the actors, before them, and over the scene's darkening (flames, light, sparks, weather, words). */
  readonly back = new Container();
  readonly front = new Container();
  readonly over = new Container();
  /** What the actors hold: added to the actors' own layer, so each is drawn with its holder. */
  readonly held = new Container();
  private readonly marks = new Graphics();
  private readonly air = new Graphics();
  private readonly sparks = new Graphics();
  private readonly sticks = new Graphics();
  private readonly drawn = new Map<string, Drawn>();
  private readonly hands = new Map<string, { item: Sprite; flame: Sprite; glow: Sprite }>();
  /** How toasted each marshmallow is (seconds held to a fire). */
  private readonly toast = new Map<string, number>();
  private readonly stickFlames = new Map<string, Sprite>();

  constructor() {
    this.back.sortableChildren = true;
    this.front.sortableChildren = true;
    this.marks.zIndex = -2000;
    this.back.addChild(this.marks);
    this.sparks.blendMode = 'add';
    this.over.addChild(this.air, this.sparks);
    this.held.zIndex = FEET + 1;
    this.held.addChild(this.sticks);
  }

  /** A new scene: everything taken off. */
  clear(): void {
    for (const d of this.drawn.values()) this.drop(d);
    this.drawn.clear();
    for (const h of this.hands.values()) for (const s of Object.values(h)) s.destroy();
    this.hands.clear();
    for (const s of this.stickFlames.values()) s.destroy();
    this.stickFlames.clear();
    this.toast.clear();
    this.marks.clear();
    this.air.clear();
    this.sparks.clear();
    this.sticks.clear();
  }

  private drop(d: Drawn): void {
    for (const s of [d.body, d.pool, d.halo, ...d.dressing, ...d.flames, ...d.smoke, ...d.flock]) s.destroy();
    d.bubble?.destroy();
  }

  /** Draw the props as they stand now; the lights of whatever burns, for the actors' warmth and the camera's. */
  draw(props: Record<string, PropNow>, now: number): Light[] {
    const t = now / 1000;
    const lights: Light[] = [];
    this.marks.clear();
    this.air.clear();
    this.sparks.clear();
    for (const [id, d] of this.drawn) if (!props[id]) {
      this.drop(d);
      this.drawn.delete(id);
    }
    let n = 0;
    for (const p of Object.values(props)) {
      n++;
      const def = PROPS[p.kind as keyof typeof PROPS] as PropDef | undefined;
      if (!def) continue;
      if (def.weather) {
        this.weather(def.weather, t);
        continue;
      }
      let d = this.drawn.get(p.id);
      if (!d) {
        d = this.make(def);
        this.drawn.set(p.id, d);
      }
      const layer = p.layer === 'front' ? this.front : this.back;
      if (d.body.parent !== layer) layer.addChild(d.body);
      if (def.anim === 'birds') this.drawBirds(p, d, t);
      else this.drawBody(p, def, d, t, n);
      this.drawFire(p, def, d, t, n, lights);
    }
    return lights;
  }

  private make(def: PropDef): Drawn {
    const glow = () => {
      const g = new Sprite(glowTexture());
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.visible = false;
      this.over.addChild(g);
      return g;
    };
    const d: Drawn = { body: new Sprite(), shadow: !def.flat, dressing: [], flames: [], smoke: [], pool: glow(), halo: glow(), flock: [] };
    d.body.anchor.set(0.5, 1);
    for (let i = 0; i < (def.dressing?.length ?? 0); i++) {
      const s = new Sprite();
      s.anchor.set(0.5, 1);
      d.body.addChild(s);
      d.dressing.push(s);
    }
    return d;
  }

  /** The thing itself: its sprite, its frame (the goat's steps, a banner's flutter), knocked over, charred. */
  private drawBody(p: PropNow, def: PropDef, d: Drawn, t: number, n: number): void {
    const b = d.body;
    const out = p.out && def.out;
    const frames = framesOf(out ? def.out! : def.art!, out ? 1 : (def.frames ?? 1));
    b.visible = !!frames;
    if (!frames) return;
    const k = def.scale * p.scale;
    let x = p.x;
    let y = p.y;
    let flip = p.flip;
    let frame = 0;
    if (def.anim === 'flutter') frame = Math.floor(t * 8 + n * 2) % frames.length;
    if (def.anim === 'goat') {
      // (her sheet: three steps walking left, three walking right)
      let walking = p.moving;
      if (p.anim === 'wander' && !p.moving) {
        // (ambling back and forth on her own, stopping to chew)
        const ph = (t / 9 + n * 0.37) % 1;
        const go = ph < 0.3 ? ph / 0.3 : ph < 0.5 ? 1 : ph < 0.8 ? 1 - (ph - 0.5) / 0.3 : 0;
        x += go * 22 - 11;
        walking = (ph < 0.3 || (ph >= 0.5 && ph < 0.8));
        flip = ph < 0.5;
      }
      const steps = walking ? [0, 1, 2, 1][Math.floor((walking && p.moving ? p.walked / 4 : t * 6)) % 4] : 1;
      frame = (flip ? 3 : 0) + steps;
      flip = false;
      // (chewing: a little bob; startled: a hop)
      if (!walking) y -= Math.floor(t * 3 + n) % 2 ? 0.5 : 0;
      if (p.sinceStartled < 0.5) y -= Math.sin((p.sinceStartled / 0.5) * Math.PI) * 5;
      this.bubble(d, p.startled && p.sinceStartled < 1.8 ? (def.bleat ?? '') : '', x, y - 20 * p.scale);
    }
    b.texture = frames[Math.min(frame, frames.length - 1)];
    b.tint = p.out && !def.out ? 0x5a4a42 : (def.tint ?? 0xffffff);
    b.scale.set(flip ? -k : k, k);
    b.position.set(x, y);
    b.zIndex = def.flat ? -1000 : y;
    // (knocked over: it falls away from the middle of the stage, and lies there)
    const fall = p.broken ? Math.min(1, p.sinceBroken / 0.3) : 0;
    b.rotation = fall * (x < 160 ? -1.35 : 1.35);
    // (what's set on it: food on a table)
    (def.dressing ?? []).forEach(([art, dx, dy], i) => {
      const f = framesOf(art);
      const s = d.dressing[i];
      s.visible = !!f;
      if (!f) return;
      s.texture = f[0];
      // (the dressing's files are 16px cells: drawn small, in the table's own scale)
      const kk = 0.7 / def.scale;
      s.scale.set(kk);
      s.position.set(dx / def.scale, -b.texture.height + dy / def.scale);
    });
    if (d.shadow && !p.broken) this.marks.ellipse(x, y + 0.5, Math.max(3, b.texture.width * k * 0.42), 1.4).fill({ color: 0x000000, alpha: 0.22 });
  }

  /** A word over a prop (the goat's bleat), shown while `text` is set. */
  private bubble(d: Drawn, text: string, x: number, y: number): void {
    if (!text) {
      if (d.bubble) d.bubble.visible = false;
      return;
    }
    if (!d.bubble) {
      d.bubble = new Text({ text, style: { fontFamily: 'monospace', fontSize: 6, fontWeight: 'bold', fill: 0xfff8e8, stroke: { color: 0x201810, width: 1.6 } }, resolution: 8 });
      d.bubble.anchor.set(0.5, 1);
      this.over.addChild(d.bubble);
    }
    d.bubble.visible = true;
    d.bubble.position.set(x, y);
  }

  /** A flock pecking about until startled, then up and away (the map's birds: five kinds, two frames). */
  private drawBirds(p: PropNow, d: Drawn, t: number): void {
    const frames = framesOf('birds.png');
    d.body.visible = false;
    if (!frames) return;
    while (d.flock.length < 5) {
      const s = new Sprite();
      s.anchor.set(0.5, 1);
      this.front.addChild(s);
      d.flock.push(s);
    }
    d.flock.forEach((s, i) => {
      const kind = i === 4 ? 4 : i % 3;
      const home = p.x + (i - 2) * 7 + Math.sin(i * 3.1) * 3;
      if (!p.startled || p.sinceStartled < 0) {
        // (pecking: a hop now and then)
        const hop = (t * 1.3 + i * 0.41) % 1 < 0.12 ? 1 : 0;
        s.texture = frames[kind];
        s.position.set(home, p.y - hop);
        s.scale.set(((i % 2 ? -1 : 1) * 0.5) * p.scale, 0.5 * p.scale);
        s.visible = true;
        return;
      }
      const f = p.sinceStartled - i * 0.06;
      const dir = i % 2 ? -1 : 1;
      s.visible = f < 6 && f > -1;
      s.texture = frames[kind + (Math.floor(t * 12 + i) % 2) * 5];
      s.position.set(home + dir * Math.max(0, f) * (34 + i * 6), p.y - Math.max(0, f) * (28 + i * 4) - Math.max(0, f) ** 2 * 6);
      s.scale.set(dir * 0.5 * p.scale, 0.5 * p.scale);
    });
  }

  /** Flames over a lit thing, its smoke, its sparks and its light; and a lantern's glow. */
  private drawFire(p: PropNow, def: PropDef, d: Drawn, t: number, n: number, lights: Light[]): void {
    const b = d.body;
    const w = b.texture ? b.texture.width * Math.abs(b.scale.x) : 0;
    const h = b.texture ? b.texture.height * b.scale.y : 0;
    const fire = def.fire ?? { spots: FLAMES_ANY, smoke: true, light: Math.max(24, w * 1.1) };
    // (catching: the flames grow over a second; going out: they sink)
    const grow = p.lit ? Math.min(1, 0.25 + p.since / 1.2) : p.since < 0.8 ? 1 - p.since / 0.8 : 0;
    const fl = flicker('campfire', t, n * 1.7);
    while (d.flames.length < (grow > 0 ? fire.spots.length : 0)) {
      const s = new Sprite();
      s.anchor.set(0.5, 0.92);
      this.over.addChild(s);
      d.flames.push(s);
    }
    d.flames.forEach((s, i) => {
      const spot = fire.spots[i];
      const tex = grow > 0 && b.visible ? flameFrame(t * 11 + i * 3 + n) : null;
      s.visible = !!tex && !!spot;
      if (!tex || !spot) return;
      s.texture = tex;
      const sx = p.flip ? 1 - spot[0] : spot[0];
      const k = spot[2] * 0.55 * grow * p.scale * (0.92 + 0.12 * Math.sin(t * 9 + i));
      s.scale.set(i % 2 ? -k : k, k);
      s.position.set(b.x - w / 2 + sx * w, b.y - spot[1] * h);
    });
    // (smoke: rising from a big fire while it burns, and for a while after it goes out)
    const smoking = b.visible && (fire.smoke ? grow > 0 || p.since < 4 : p.out && p.since < 3);
    while (smoking && d.smoke.length < 3) {
      const s = new Sprite();
      s.anchor.set(0.5);
      this.front.addChild(s);
      d.smoke.push(s);
    }
    d.smoke.forEach((s, i) => {
      const life = (t / 3.2 + i / 3 + n * 0.13) % 1;
      const tex = smoking ? smokeFrame(4 + life * 9) : null;
      s.visible = !!tex;
      if (!tex) return;
      s.texture = tex;
      const k = (0.22 + life * 0.45) * Math.max(0.6, Math.min(1.4, w / 40)) * p.scale;
      s.scale.set(k);
      s.zIndex = 9999;
      s.alpha = 0.5 * (1 - life) * (p.lit ? 1 : 0.7);
      s.tint = 0x5a5250;
      s.position.set(b.x + (i - 1) * w * 0.22 + life * 12, b.y - h * 0.7 - life * 46);
    });
    // (the light: a pool on the ground and a glow about the flames, flickering; sparks drifting up)
    const strength = grow * fl;
    const r = fire.light * p.scale;
    const lit = strength > 0.02 && b.visible;
    d.pool.visible = d.halo.visible = lit || (!!def.glow && b.visible);
    if (lit) {
      d.pool.tint = 0xff9440;
      d.pool.alpha = 0.42 * strength;
      d.pool.width = r * 2.2;
      d.pool.height = r * 0.7;
      d.pool.position.set(b.x, b.y - 2);
      d.halo.tint = 0xffb050;
      d.halo.alpha = 0.3 * strength;
      d.halo.width = d.halo.height = Math.max(w, 16) * 1.6;
      d.halo.position.set(b.x, b.y - h * 0.55);
      lights.push({ x: b.x, y: b.y, r, k: strength });
      const count = Math.min(10, Math.round(fire.spots.length * 2.5));
      for (let i = 0; i < count; i++) {
        const life = (t * (0.45 + frac(i + n) * 0.3) + frac(i * 7 + n)) % 1;
        const ex = b.x - w / 2 + frac(i * 3 + n) * w + Math.sin(life * 6 + i) * 4;
        const ey = b.y - h * 0.5 - life * (26 + frac(i) * 22);
        this.sparks.rect(ex, ey, 0.8, 0.8).fill({ color: life < 0.5 ? 0xffd060 : 0xff7020, alpha: (1 - life) * 0.9 * grow });
      }
    } else if (def.glow && b.visible) {
      const g = def.glow * p.scale * flicker('lantern', t, n);
      d.pool.tint = d.halo.tint = 0xffd080;
      d.pool.alpha = 0.3;
      d.pool.width = g * 2;
      d.pool.height = g * 0.6;
      d.pool.position.set(b.x, b.y - 1);
      d.halo.alpha = 0.35;
      d.halo.width = d.halo.height = g;
      d.halo.position.set(b.x + w * 0.2, b.y - h * 0.75);
      lights.push({ x: b.x, y: b.y, r: g, k: 0.6 });
    }
  }

  /** The air: rain, snow, ash or fireflies over the whole stage (each drop's place from its number and the time). */
  private weather(kind: NonNullable<PropDef['weather']>, t: number): void {
    const g = kind === 'fireflies' ? this.sparks : this.air;
    const count = { rain: 90, snow: 60, ash: 55, fireflies: 16 }[kind];
    const fall = { rain: 230, snow: 16, ash: 11, fireflies: 0 }[kind];
    for (let i = 0; i < count; i++) {
      const u = frac(i * 1.31);
      const v = frac(i * 2.77 + 5);
      let x = AIR_X0 + u * AIR_W;
      let y = AIR_TOP + ((v * AIR_H + t * fall * (0.8 + u * 0.4)) % AIR_H);
      if (kind === 'rain') {
        x -= (y - AIR_TOP) * 0.18;
        g.rect(x, y, 0.7, 5);
      } else if (kind === 'snow' || kind === 'ash') {
        x += Math.sin(t * 0.9 + i) * 6;
        g.rect(x, y, kind === 'snow' ? 1 : 0.9, kind === 'snow' ? 1 : 0.7);
      } else {
        // (fireflies drift low over the ground and blink)
        x = AIR_X0 + 100 + u * 340 + Math.sin(t * 0.4 + i * 2) * 14;
        y = FEET - 6 - v * 50 + Math.cos(t * 0.6 + i) * 6;
        const blink = Math.max(0, Math.sin(t * 1.7 + i * 2.3));
        g.rect(x, y, 1, 1).fill({ color: 0xd8ff70, alpha: blink });
        continue;
      }
    }
    if (kind === 'rain') g.fill({ color: 0xc0d4f0, alpha: 0.55 });
    if (kind === 'snow') g.fill({ color: 0xffffff, alpha: 0.85 });
    if (kind === 'ash') {
      g.fill({ color: 0x8a8480, alpha: 0.75 });
      // (and a few still glowing)
      for (let i = 0; i < 10; i++) {
        const x = AIR_X0 + frac(i * 9.1) * AIR_W + Math.sin(t + i) * 8;
        const y = AIR_TOP + ((frac(i * 4.3) * AIR_H + t * 14) % AIR_H);
        this.sparks.rect(x, y, 0.8, 0.8).fill({ color: 0xff8030, alpha: 0.5 + 0.5 * Math.sin(t * 3 + i) });
      }
    }
  }

  /* ------------------------------------------------------------ what's in hand */

  /** Each actor's held thing, at their hand as their pose puts it; `lights` toast a marshmallow held to them. */
  drawHeld(actors: Record<string, ActorNow>, sprites: Map<string, Sprite>, now: number, dt: number, lights: Light[]): void {
    this.sticks.clear();
    for (const [id, a] of Object.entries(actors)) {
      const def = a.hold ? (HELD[a.hold as keyof typeof HELD] as HeldDef | undefined) : undefined;
      const on = !!def && a.visible && !!sprites.get(id)?.visible;
      let h = this.hands.get(id);
      if (!on || !def) {
        if (h) h.item.visible = h.flame.visible = h.glow.visible = false;
        const sf = this.stickFlames.get(id);
        if (sf) sf.visible = false;
        continue;
      }
      if (!h) {
        h = { item: new Sprite(), flame: new Sprite(), glow: new Sprite(glowTexture()) };
        h.flame.anchor.set(0.5, 0.9);
        h.glow.anchor.set(0.5);
        h.glow.blendMode = 'add';
        this.held.addChild(h.item);
        this.over.addChild(h.glow, h.flame);
        this.hands.set(id, h);
      }
      const dir = a.facing === 'left' ? -1 : 1;
      const grip = handOf(a, now);
      const hx = a.x + dir * grip.dx;
      const hy = FEET - grip.dy;
      const angle = def.carried ? 0 : grip.angle;
      // (the shadow it casts: a little dark on the ground under the hand)
      this.marks.ellipse(hx + dir * 2, FEET + 0.5, def.carried ? 2 : 3.5, 0.9).fill({ color: 0x000000, alpha: 0.2 });
      if (def.stick) {
        h.item.visible = h.flame.visible = h.glow.visible = false;
        this.drawStick(id, hx, hy, dir, angle, lights, now, dt);
        continue;
      }
      const tex = def.art ? framesOf(def.art)?.[0] : undefined;
      h.item.visible = !!tex;
      if (!tex) continue;
      h.item.texture = tex;
      const k = def.scale;
      if (def.carried) {
        h.item.anchor.set(0.5);
        h.item.rotation = 0;
        h.item.scale.set(dir * k, k);
      } else {
        const [gx, gy] = def.grip ?? [2, tex.height - 2];
        h.item.anchor.set(gx / tex.width, gy / tex.height);
        h.item.rotation = dir * (angle - (def.points ?? 0));
        h.item.scale.set(dir * k, k);
      }
      h.item.position.set(hx, hy);
      // (a torch's flame at its tip, always burning upward)
      h.flame.visible = h.glow.visible = !!def.burns;
      if (def.burns) {
        const len = tex.width * k * 1.1;
        const tx = hx + Math.cos(angle) * len * dir;
        const ty = hy + Math.sin(angle) * len;
        const f = flameFrame(now / 90 + id.length);
        h.flame.visible = !!f;
        if (f) h.flame.texture = f;
        h.flame.scale.set(0.3);
        h.flame.position.set(tx, ty + 1);
        const fl = flicker('torch', now / 1000, id.length);
        h.glow.tint = 0xffa850;
        h.glow.alpha = 0.35 * fl;
        h.glow.width = h.glow.height = 34;
        h.glow.position.set(tx, ty);
        lights.push({ x: tx, y: FEET, r: 24, k: 0.7 * fl });
      }
    }
  }

  /** A stick with a marshmallow on the end, which goes golden and then catches fire if held to a flame too long. */
  private drawStick(id: string, hx: number, hy: number, dir: number, angle: number, lights: Light[], now: number, dt: number): void {
    const len = 15;
    const tx = hx + Math.cos(angle) * len * dir;
    const ty = hy + Math.sin(angle) * len;
    this.sticks.moveTo(hx, hy).lineTo(tx, ty).stroke({ color: 0x6a4428, width: 0.8 });
    const hot = lights.some((l) => Math.abs(l.x - tx) < l.r * 0.32 && ty > l.y - 22 && l.k > 0.3);
    const toast = Math.min(3, (this.toast.get(id) ?? 0) + (hot ? dt : 0));
    this.toast.set(id, toast);
    // (white, then golden, then brown; past that it's alight)
    const colour = toast < 0.45 ? 0xf8f4ec : toast < 0.9 ? 0xe8b860 : 0x6a3a1c;
    this.sticks.roundRect(tx - 1.6 + dir * 0.6, ty - 1.3, 3.2, 2.6, 0.9).fill(colour);
    let f = this.stickFlames.get(id);
    if (!f) {
      f = new Sprite();
      f.anchor.set(0.5, 0.9);
      this.over.addChild(f);
      this.stickFlames.set(id, f);
    }
    const tex = toast > 1.2 ? flameFrame(now / 80) : null;
    f.visible = !!tex;
    if (tex) {
      f.texture = tex;
      f.scale.set(0.2);
      f.position.set(tx, ty);
    }
  }
}

/** Where a hand is (stage px forward of the feet, and up from them) and the angle a held thing points (radians,
 *  facing right: 0 forward, negative up), for each pose. A strike swings it over and down in time with the blow's
 *  frames (art/hkFolk.ts's `hkPose`: a blow every 1.4 s). */
export function handOf(a: ActorNow, now: number): { dx: number; dy: number; angle: number } {
  switch (a.pose) {
    case 'strike': {
      const p = ((now / 100) % 14) / 6;
      if (p > 1) return { dx: 7, dy: 12, angle: 0.4 };
      return { dx: 3 + p * 5, dy: 22 - p * 9, angle: -2.3 + p * 2.8 };
    }
    case 'cast':
      return { dx: 7, dy: 19, angle: -1.1 };
    case 'cheer':
      return { dx: 3, dy: 27, angle: -1.45 };
    case 'kneel':
      return { dx: 7, dy: 8, angle: 0.25 };
    case 'reach':
      return { dx: 8, dy: 13, angle: 0.32 };
    case 'down':
      return { dx: 9, dy: 1, angle: 0 };
    default: {
      // (walking, it swings a little with the steps; talking, it waves)
      const sway = a.walking ? Math.sin(a.walked / 2) * 0.12 : a.pose === 'talk' ? Math.sin(now / 260) * 0.18 : 0;
      return { dx: 5, dy: 15, angle: -0.85 + sway };
    }
  }
}
