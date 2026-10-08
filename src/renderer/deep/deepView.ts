// Looking down into the Deep (the shaft's tap card: "Go down into the Deep"): a level seen from above, taking the
// screen like a watched fight. The level is painted once (deepArt.ts) and laid under the cave pack's things: the
// fungus of a grotto (glowing at night or day: it's always night down here), crystal geodes, the ruins of whoever dug
// here before (their gates and statues and totems), old bones, scattered boulders on the rock, a bonfire in the first
// chamber, and the cave gate where the way down was found. Torches burn along the tunnels (the dungeon pack's fire
// sheet), each with a warm pool of light. The miners stand at the rock they're carving, swinging their picks, with
// dust where they strike, and walk in from the way up. The HUD says which level it is, how close the way down is, how
// roused what lives down there is, and what was found lately; ▲ ▼ go between the levels, × goes back up.
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { DEEP_LEVELS } from '../../shared/data/deep';
import type { Command } from '../../shared/sim/commands';
import type { DeepView } from '../../shared/sim/snapshot';
import { hkLayers, hkPose, hkWhoById, type HkFacing } from '../art/hkFolk';
import { hkSprite } from '../art/hkTexture';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import { openCell, paintLevel, seenCells, TILE } from './deepArt';
import bonfireUrl from '../art/deep/bonfire.png';
import bones1Url from '../art/deep/bones1.png';
import bones2Url from '../art/deep/bones2.png';
import circleUrl from '../art/deep/circle.png';
import crystal1Url from '../art/deep/crystal1.png';
import crystal2Url from '../art/deep/crystal2.png';
import crystal3Url from '../art/deep/crystal3.png';
import demonSkullUrl from '../art/deep/demon_skull.png';
import gatesUrl from '../art/deep/gates.png';
import mushroom1Url from '../art/deep/mushroom1.png';
import mushroom2Url from '../art/deep/mushroom2.png';
import mushroomBigUrl from '../art/deep/mushroom_big.png';
import mushroomBig2Url from '../art/deep/mushroom_big2.png';
import rock1Url from '../art/deep/rock1.png';
import rock2Url from '../art/deep/rock2.png';
import ruin1Url from '../art/deep/ruin1.png';
import ruin2Url from '../art/deep/ruin2.png';
import skeletonUrl from '../art/deep/skeleton.png';
import statueUrl from '../art/deep/statue.png';
import totemUrl from '../art/deep/totem.png';
import firesUrl from '../art/delve/fires.png';

/* ------------------------------------------------------------ the pictures */

const textures = new Map<string, Texture | null>();
let artGen = 0;
function tex(url: string): Texture | null {
  if (textures.has(url)) return textures.get(url)!;
  textures.set(url, null);
  loadImage(url).then(
    (im) => {
      const t = Texture.from(im);
      t.source.scaleMode = 'nearest';
      textures.set(url, t);
      artGen++;
    },
    () => undefined,
  );
  return null;
}
/** The fire sheet's wall torch (art/delve/fires.png: 4 columns of 44x48, 6 frames down; the torch is column 1). */
let torchFrames: Texture[] | null = null;
function torch(frame: number): Texture | null {
  const sheet = tex(firesUrl);
  if (!sheet) return null;
  torchFrames ??= [0, 1, 2, 3, 4, 5].map((r) => new Texture({ source: sheet.source, frame: new Rectangle(44, r * 48, 44, 48) }));
  return torchFrames[frame % 6];
}

/** What stands on each kind of pocket (by the cell, so it stays put), and how big (of a cell). */
const POCKET: Record<string, { urls: string[]; size: number }> = {
  F: { urls: [mushroom1Url, mushroom2Url, mushroomBigUrl, mushroomBig2Url], size: 1.15 },
  f: { urls: [mushroomBigUrl, mushroomBig2Url, mushroom1Url], size: 1.35 },
  C: { urls: [crystal1Url, crystal2Url, crystal3Url], size: 1.2 },
  R: { urls: [ruin1Url, ruin2Url, statueUrl, totemUrl], size: 1.6 },
  B: { urls: [bones1Url, bones2Url, skeletonUrl], size: 1.4 },
};
/** The Abyss's own ruins: the demon skull and the summoning circle. */
const ABYSS_RUINS = [demonSkullUrl, circleUrl, totemUrl];
const ROCKS = [rock1Url, rock2Url];
/** The closest the camera comes (screen px an art px), and how much closer than the width allows it comes held
 *  upright (the rest is a drag away). */
const MOST_ZOOM = 2;
const UPRIGHT_MORE = 1.7;

const h32 = (a: number, b: number) => {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/* ------------------------------------------------------------ the scene */

interface Miner {
  sprite: Sprite;
  dust: Graphics;
  x: number;
  y: number;
}

export class DeepScene {
  readonly root = new Container();
  private readonly cover = new Graphics();
  private readonly world = new Container();
  private readonly ground = new Sprite();
  private readonly things = new Container();
  private readonly lights = new Container();
  private readonly veil = new Graphics();
  private readonly canvas = document.createElement('canvas');
  private groundTex: Texture | null = null;
  private key = '';
  private view: DeepView | null = null;
  private readonly miners = new Map<number, Miner>();
  private torches: { sprite: Sprite; glow: Sprite; phase: number }[] = [];
  private w = 1;
  private h = 1;
  private top = 0;
  private bottom = 0;
  private right = 0;
  private readonly hud: DeepHud;
  /** What's been dug, in cells (the camera frames it), and the camera's zoom as it eases. */
  private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private k = 0.5;
  /** How far the player has dragged the view along (art px). */
  private panX = 0;

  constructor(send: (c: Command) => void) {
    this.root.visible = false;
    this.things.sortableChildren = true;
    this.lights.blendMode = 'add';
    this.world.addChild(this.ground, this.things, this.veil, this.lights);
    this.root.addChild(this.cover, this.world);
    this.hud = new DeepHud(send);
    for (const p of Object.values(POCKET)) p.urls.forEach(tex);
    ROCKS.forEach(tex);
    [gatesUrl, bonfireUrl, firesUrl, ...ABYSS_RUINS].forEach(tex);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** A drag (screen px): look along the level. */
  pan(dx: number, _dy: number): void {
    this.panX -= dx / Math.max(0.1, this.k);
  }

  resize(w: number, h: number, top: number, bottom: number, right = 0): void {
    this.w = w;
    this.h = h;
    this.top = top;
    this.bottom = bottom;
    this.right = right;
    this.key = '';
  }

  update(v: DeepView | null): void {
    this.view = v;
    this.root.visible = !!v;
    this.hud.show(v);
    if (!v) {
      for (const m of this.miners.values()) {
        m.sprite.destroy();
        m.dust.destroy();
      }
      this.miners.clear();
    }
  }

  /** The level's picture and its things, again when the level changes, more of it is dug, or the art comes in. */
  private rebuild(v: DeepView): void {
    const key = `${v.depth}|${v.cells}|${artGen}|${this.w}x${this.h}`;
    if (key === this.key) return;
    this.key = key;
    paintLevel(v, this.canvas);
    this.groundTex?.destroy(true);
    this.groundTex = Texture.from(this.canvas);
    this.groundTex.source.scaleMode = 'nearest';
    this.ground.texture = this.groundTex;
    // the things: the pockets' pictures, boulders on the rock, the bonfire, the gate down
    for (const c of [...this.things.children]) if (!(c as Sprite & { miner?: boolean }).miner) c.destroy();
    for (const c of [...this.lights.children]) c.destroy();
    this.torches = [];
    const seen = seenCells(v);
    // (the box round everything seen, a cell to spare, never smaller than a few cells each way)
    let x0 = v.w;
    let y0 = v.h;
    let x1 = 0;
    let y1 = 0;
    seen.forEach((on, i) => {
      if (!on) return;
      x0 = Math.min(x0, i % v.w);
      x1 = Math.max(x1, (i % v.w) + 1);
      y0 = Math.min(y0, Math.floor(i / v.w));
      y1 = Math.max(y1, Math.floor(i / v.w) + 1);
    });
    const grow = (a: number, b: number, n: number, least: number) => {
      const m = Math.max(0, least - (b - a)) / 2;
      return [Math.max(0, Math.floor(a - 1 - m)), Math.min(n, Math.ceil(b + 1 + m))];
    };
    const [bx0, bx1] = grow(x0, x1, v.w, 8);
    const [by0, by1] = grow(y0, y1, v.h, 6);
    this.box = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    const glow = DEEP_LEVELS[v.depth - 1].look.glow;
    const place = (url: string, i: number, size: number, dx = 0, dy = 0) => {
      const t = tex(url);
      if (!t) return null;
      const s = new Sprite(t);
      const k = (TILE * size) / Math.max(t.width, t.height);
      s.scale.set(k);
      s.anchor.set(0.5, 0.9);
      s.position.set((i % v.w) * TILE + TILE / 2 + dx, Math.floor(i / v.w) * TILE + TILE * 0.85 + dy);
      s.zIndex = s.y;
      this.things.addChild(s);
      return s;
    };
    const pool = (i: number, color: number, r: number, alpha: number) => {
      const g = new Sprite(glowTexture());
      g.anchor.set(0.5);
      g.tint = color;
      g.alpha = alpha;
      g.width = g.height = r;
      g.position.set((i % v.w) * TILE + TILE / 2, Math.floor(i / v.w) * TILE + TILE / 2);
      this.lights.addChild(g);
      return g;
    };
    for (let i = 0; i < v.cells.length; i++) {
      if (!seen[i]) continue;
      const c = v.cells[i];
      const h = h32(i, v.depth);
      const pk = POCKET[c];
      if (pk) {
        const urls = c === 'R' && v.depth === 5 ? ABYSS_RUINS : pk.urls;
        place(urls[h % urls.length], i, pk.size * (0.8 + ((h >> 8) % 40) / 100), ((h >> 4) % 9) - 4, 0);
        if (c === 'F' || c === 'f' || c === 'C') pool(i, glow, TILE * (c === 'f' ? 3 : 2.2), c === 'f' ? 0.5 : 0.32);
      } else if (c === '#' && h % 9 === 0) place(ROCKS[h % ROCKS.length], i, 0.9, ((h >> 4) % 11) - 5, -4);
      else if (c === '>') {
        place(gatesUrl, i, 1.6);
        pool(i, 0xff8a40, TILE * 2.4, 0.4);
      }
    }
    // the bonfire in the first chamber, beside the way up
    const entry = v.cells.indexOf('^');
    if (entry >= 0) {
      place(bonfireUrl, entry + v.w + 1, 1.1);
      pool(entry + v.w + 1, 0xffa040, TILE * 4, 0.55);
    }
    // torches along the tunnels: on a rock wall above an open cell, every few cells (by the cell, so they stay)
    for (let i = 0; i < v.cells.length; i++) {
      if (!openCell(v.cells[i]) || i < v.w) continue;
      if (openCell(v.cells[i - v.w]) || v.cells[i - v.w] === '~') continue;
      if (h32(i, 77) % 5 !== 0) continue;
      const s = new Sprite();
      s.anchor.set(0.5, 1);
      s.scale.set(0.55);
      s.position.set((i % v.w) * TILE + TILE / 2, Math.floor(i / v.w) * TILE + 10);
      s.zIndex = s.y - 30;
      this.things.addChild(s);
      const g = pool(i, 0xffb050, TILE * 3.2, 0.5);
      this.torches.push({ sprite: s, glow: g, phase: (h32(i, 5) % 100) / 100 });
    }
    // the dark of the deep, deeper each level
    this.veil.clear().rect(0, 0, v.w * TILE, v.h * TILE).fill({ color: 0x05040a, alpha: DEEP_LEVELS[v.depth - 1].look.dark * 0.6 });
  }

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    this.rebuild(v);
    // the camera: what's been dug (and a cell round it) fitted to the room between the bars, eased as it grows
    const room = { w: Math.max(60, this.w - this.right), h: Math.max(60, this.h - this.top - this.bottom) };
    const box = this.box ?? { x0: 0, y0: 0, x1: v.w, y1: v.h };
    const bw = (box.x1 - box.x0) * TILE;
    const bh = (box.y1 - box.y0) * TILE;
    // (held upright the room is tall and narrow: the dug box is fitted by its height, and a drag looks along it)
    const want = Math.min(MOST_ZOOM, Math.max(room.w / bw, Math.min(room.h / bh, (room.w / bw) * UPRIGHT_MORE)), room.h / bh);
    this.k += (want - this.k) * Math.min(1, dt * 3);
    const k = this.k;
    const spare = Math.max(0, (bw * k - room.w) / 2 / k);
    this.panX = Math.max(-spare, Math.min(spare, this.panX));
    const cx = ((box.x0 + box.x1) / 2) * TILE + this.panX;
    const cy = ((box.y0 + box.y1) / 2) * TILE;
    this.cover.clear().rect(0, 0, this.w, this.h).fill(0x050408);
    this.world.scale.set(k);
    this.world.position.set(Math.round(room.w / 2 - cx * k), Math.round(this.top + room.h / 2 - cy * k));
    // the torches flicker
    for (const t of this.torches) {
      const tx = torch(Math.floor(now / 110 + t.phase * 6));
      if (tx) t.sprite.texture = tx;
      t.glow.alpha = 0.42 + Math.sin(now / 90 + t.phase * 9) * 0.05 + Math.sin(now / 37 + t.phase * 3) * 0.04;
    }
    // the miners: at their rock, swinging; else walking in from the way up
    const entry = v.cells.indexOf('^');
    const ex = ((entry >= 0 ? entry : 0) % v.w) * TILE + TILE / 2;
    const ey = Math.floor((entry >= 0 ? entry : 0) / v.w) * TILE + TILE * 1.5;
    const seen = new Set<number>();
    v.miners.forEach((m, n) => {
      seen.add(m.id);
      let d = this.miners.get(m.id);
      if (!d) {
        const sprite = new Sprite();
        (sprite as Sprite & { miner?: boolean }).miner = true;
        const dust = new Graphics();
        (dust as Graphics & { miner?: boolean }).miner = true;
        this.things.addChild(sprite, dust);
        d = { sprite, dust, x: ex, y: ey };
        this.miners.set(m.id, d);
      }
      // (they stand on the open cell beside their rock, facing it)
      let gx = ex + (n - 1) * 10;
      let gy = ey;
      let facing: HkFacing = 'down';
      if (m.cell !== null) {
        const cx = m.cell % v.w;
        const cy = Math.floor(m.cell / v.w);
        for (const [dx, dy, f] of [
          [0, 1, 'up'],
          [-1, 0, 'right'],
          [1, 0, 'left'],
          [0, -1, 'down'],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h || !openCell(v.cells[ny * v.w + nx])) continue;
          gx = nx * TILE + TILE / 2 - dx * 6;
          gy = ny * TILE + TILE * 0.9 - dy * 6;
          facing = f;
          break;
        }
      }
      const far = Math.hypot(gx - d.x, gy - d.y);
      const step = Math.min(far, dt * 40);
      if (far > 0.5) {
        d.x += ((gx - d.x) / far) * step;
        d.y += ((gy - d.y) / far) * step;
      }
      const walking = far > 1;
      const swinging = m.digging && !walking && m.cell !== null;
      const keys = hkLayers(hkWhoById(m.id, m.look, m.gear), { fighting: false, activity: 'mine' });
      const [col, row] = hkPose({ facing: walking ? (gx < d.x ? 'left' : gx > d.x ? 'right' : gy < d.y ? 'up' : 'down') : facing, moving: walking, walked: (d.x + d.y) / 2, working: swinging, sinceBlow: 999, sinceHit: 999, down: false, ranged: false, now: now + m.id * 137 });
      d.sprite.visible = hkSprite(d.sprite, keys, col, row, d.x, d.y, TILE * 1.35);
      d.sprite.zIndex = d.y;
      d.dust.clear();
      if (swinging) {
        const t = ((now + m.id * 137) % 700) / 700;
        if (t > 0.5) {
          const a = (t - 0.5) / 0.5;
          const tx = (m.cell! % v.w) * TILE + TILE / 2;
          const ty = Math.floor(m.cell! / v.w) * TILE + TILE / 2;
          d.dust.circle(tx + (d.x - tx) * 0.45, ty + (d.y - 10 - ty) * 0.45 - a * 6, 2 + a * 5).fill({ color: 0xb0a898, alpha: 0.45 * (1 - a) });
          d.dust.zIndex = d.y + 1;
        }
      }
    });
    for (const [id, d] of this.miners)
      if (!seen.has(id)) {
        d.sprite.destroy();
        d.dust.destroy();
        this.miners.delete(id);
      }
  }
}

/* ------------------------------------------------------------ the windows */

class DeepHud {
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly up: HTMLButtonElement;
  private readonly down: HTMLButtonElement;
  private readonly info: HTMLElement;
  private depth = 0;
  private levels = 0;
  private last = '';

  constructor(private readonly send: (c: Command) => void) {
    this.el = document.createElement('div');
    this.el.id = 'deep-hud';
    this.el.innerHTML =
      '<div class="dh-top"><button class="dh-up" title="Up a level">▲</button><div class="dh-title"></div><button class="dh-down" title="Down a level">▼</button><button class="dh-close" title="Back up to the town">✕</button></div><div class="dh-info"></div>';
    this.el.hidden = true;
    document.body.append(this.el);
    this.title = this.el.querySelector('.dh-title')!;
    this.info = this.el.querySelector('.dh-info')!;
    this.up = this.el.querySelector('.dh-up')!;
    this.down = this.el.querySelector('.dh-down')!;
    this.up.addEventListener('click', () => this.depth > 1 && this.send({ type: 'watchDeep', depth: this.depth - 1 }));
    this.down.addEventListener('click', () => this.depth < this.levels && this.send({ type: 'watchDeep', depth: this.depth + 1 }));
    this.el.querySelector('.dh-close')!.addEventListener('click', () => this.send({ type: 'watchDeep', depth: null }));
  }

  show(v: DeepView | null): void {
    this.el.hidden = !v;
    document.body.classList.toggle('deep-on', !!v);
    if (!v) return;
    this.depth = v.depth;
    this.levels = v.levels.length;
    this.up.disabled = v.depth <= 1;
    this.down.disabled = v.depth >= v.levels.length;
    const key = `${v.depth}|${v.toDown}|${Math.round(v.stir * 20)}|${v.miners.length}|${v.finds.join('|')}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = `Level ${v.depth} · ${v.name}`;
    const way = v.toDown > 0 ? `${v.toDown} more to dig before the way down is found` : v.depth < v.levels.length ? 'The way down is open' : 'The deepest yet dug';
    const stir = v.stir < 0.34 ? 'Quiet, for now' : v.stir < 0.67 ? 'Something stirs below' : 'Something is coming up';
    this.info.innerHTML = '';
    const row = (label: string, text: string) => {
      const d = document.createElement('div');
      d.className = 'dh-row';
      const b = document.createElement('b');
      b.textContent = label;
      d.append(b, document.createTextNode(text));
      this.info.append(d);
    };
    row('Diggers ', v.miners.length ? `${v.miners.length} at work` : 'none down here now');
    row('Below ', way);
    const bar = document.createElement('div');
    bar.className = 'dh-stir';
    bar.innerHTML = `<span>${stir}</span><i style="width:${Math.round(v.stir * 100)}%"></i>`;
    this.info.append(bar);
    for (const f of v.finds.slice(-2).reverse()) {
      const d = document.createElement('div');
      d.className = 'dh-find';
      d.textContent = f;
      this.info.append(d);
    }
  }
}
