// Looking into the Underdark (the shaft's or a mine's tap card, or the Deep's bar: "The Underdark"): the cave layer
// under the town's land seen from above, taking the screen like the Deep. The ground is painted once from the packs'
// tiles (the mine tileset's rock, the dungeon pack's floor and water, the water burning orange for the magma), and
// the cave pack's things stand on it: mushrooms in the fungus forests, crystals in their caverns, the ruins of whoever
// dug here first, cave dwellings in the towns of the other peoples, boulders by the tunnels, and a ladder down at the
// foot of each of the town's ways down. It's always night below: the dark is lifted only by what glows (the glowmoss,
// the crystals, the magma, the cave towns' lamps and the town's own fires). What hasn't been seen is left black. The
// crystal cave backdrop lies behind it all. The bar says what's been found, how the cave towns stand, and the news.
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Command } from '../../shared/sim/commands';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { UnderView } from '../../shared/sim/underdark';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import bonfireUrl from '../art/deep/bonfire.png';
import crystal1Url from '../art/deep/crystal1.png';
import crystal2Url from '../art/deep/crystal2.png';
import crystal3Url from '../art/deep/crystal3.png';
import gatesUrl from '../art/deep/gates.png';
import mushroom1Url from '../art/deep/mushroom1.png';
import mushroom2Url from '../art/deep/mushroom2.png';
import mushroomBigUrl from '../art/deep/mushroom_big.png';
import mushroomBig2Url from '../art/deep/mushroom_big2.png';
import rock1Url from '../art/deep/rock1.png';
import rock2Url from '../art/deep/rock2.png';
import ruin1Url from '../art/deep/ruin1.png';
import ruin2Url from '../art/deep/ruin2.png';
import statueUrl from '../art/deep/statue.png';
import floorUrl from '../art/under/floor.png';
import house1Url from '../art/under/house1.png';
import house2Url from '../art/under/house2.png';
import ladderUrl from '../art/under/ladder.png';
import rockUrl from '../art/under/rock.png';
import rockFaceUrl from '../art/under/rock_face.png';
import waterUrl from '../art/under/water.png';

/** A cell's size on the canvas (art px). */
const TILE = 16;
const MOST_ZOOM = 3;

/* ------------------------------------------------------------ the pictures */

const images = new Map<string, HTMLImageElement | null>();
const textures = new Map<string, Texture>();
let artGen = 0;
function img(url: string): HTMLImageElement | null {
  if (images.has(url)) return images.get(url)!;
  images.set(url, null);
  loadImage(url).then(
    (im) => {
      images.set(url, im);
      artGen++;
    },
    () => undefined,
  );
  return null;
}
function tex(url: string): Texture | null {
  const t = textures.get(url);
  if (t) return t;
  const im = img(url);
  if (!im) return null;
  const made = Texture.from(im);
  made.source.scaleMode = 'nearest';
  textures.set(url, made);
  return made;
}
let backdrop: HTMLImageElement | null = null;

/** What stands on each kind of open ground (by the cell, so it stays put): which pictures, how big (of a cell), one
 *  cell in how many, and the glow over it. */
const THINGS: Record<string, { urls: string[]; size: number; every: number; glow?: number; light?: number }> = {
  g: { urls: [mushroomBigUrl, mushroomBig2Url, mushroom1Url, mushroom2Url], size: 1.7, every: 2, glow: 0x6af0b0, light: 0.4 },
  c: { urls: [crystal1Url, crystal2Url, crystal3Url], size: 1.6, every: 2, glow: 0x9ab8ff, light: 0.45 },
  r: { urls: [ruin1Url, ruin2Url, statueUrl, gatesUrl], size: 2.2, every: 4 },
  t: { urls: [house1Url, house2Url], size: 2.6, every: 4, glow: 0xffc860, light: 0.5 },
};
const ROCKS = [rock1Url, rock2Url];
/** The ground's tint over the floor tile: the fungus green, the crystal blue, the ruins sand, the cave towns warm,
 *  the town's own cuttings brown. */
const FLOOR_TINT: Record<string, string> = { g: 'rgba(60,160,110,0.32)', c: 'rgba(110,140,255,0.28)', r: 'rgba(170,140,90,0.3)', t: 'rgba(200,150,80,0.25)', d: 'rgba(120,80,40,0.3)', e: 'rgba(120,80,40,0.3)' };
const open = (c: string) => c === '.' || c === 'd' || c === 'e' || c === 'g' || c === 'c' || c === 'r' || c === 't';

const h32 = (a: number, b: number) => {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** The ground painted from the tiles; false while the tiles are still loading. */
function paint(v: UnderView, canvas: HTMLCanvasElement): boolean {
  const rock = img(rockUrl);
  const face = img(rockFaceUrl);
  const floor = img(floorUrl);
  const water = img(waterUrl);
  if (!rock || !face || !floor || !water) return false;
  canvas.width = v.w * TILE;
  canvas.height = v.h * TILE;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < v.cells.length; i++) {
    const c = v.cells[i];
    if (c === '?') continue;
    const x = (i % v.w) * TILE;
    const y = Math.floor(i / v.w) * TILE;
    const below = i + v.w < v.cells.length ? v.cells[i + v.w] : '#';
    if (c === '#') {
      // (rock over open ground shows its lit face; the rest, the deep rock: a quarter of the tile, by the cell)
      const src = open(below) ? face : rock;
      const q = h32(i, 3) % 4;
      g.drawImage(src, (q % 2) * 16, Math.floor(q / 2) * 16, 16, 16, x, y, TILE, TILE);
    } else if (c === '~' || c === 'v') {
      g.drawImage(water, 0, 0, 16, 16, x, y, TILE, TILE);
      if (c === 'v') {
        g.fillStyle = h32(i, 9) % 3 ? 'rgba(255,96,24,0.82)' : 'rgba(255,170,40,0.82)';
        g.fillRect(x, y, TILE, TILE);
      }
    } else {
      const q = h32(i, 5) % 4;
      g.drawImage(floor, (q % 2) * 16, Math.floor(q / 2) * 16, 16, 16, x, y, TILE, TILE);
      const tint = FLOOR_TINT[c];
      if (tint) {
        g.fillStyle = tint;
        g.fillRect(x, y, TILE, TILE);
      }
    }
  }
  return true;
}

/* ------------------------------------------------------------ the scene */

export class UnderScene {
  readonly root = new Container();
  private readonly cover = new Graphics();
  private readonly back = new Sprite();
  private readonly world = new Container();
  private readonly ground = new Sprite();
  private readonly things = new Container();
  private readonly veil = new Graphics();
  private readonly lights = new Container();
  private readonly labels = new Container();
  private readonly canvas = document.createElement('canvas');
  private groundTex: Texture | null = null;
  private key = '';
  private view: UnderView | null = null;
  private glows: { sprite: Sprite; base: number; phase: number; fast: boolean }[] = [];
  private w = 1;
  private h = 1;
  private top = 0;
  private bottom = 0;
  private right = 0;
  private readonly hud: UnderHud;
  private backed = false;
  private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private k = 1;
  private panX = 0;
  private panY = 0;

  constructor(send: (c: Command) => void) {
    this.root.visible = false;
    this.things.sortableChildren = true;
    this.lights.blendMode = 'add';
    this.world.addChild(this.ground, this.things, this.veil, this.lights, this.labels);
    this.root.addChild(this.cover, this.back, this.world);
    this.hud = new UnderHud(send);
    [rockUrl, rockFaceUrl, floorUrl, waterUrl, ladderUrl, bonfireUrl, ...ROCKS, ...Object.values(THINGS).flatMap((t) => t.urls)].forEach(img);
    void loadImage('backdrops/crystal_2.webp').then(
      (im) => {
        backdrop = im;
        artGen++;
      },
      () => undefined,
    );
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** A drag (screen px): look about the caves. */
  pan(dx: number, dy: number): void {
    this.panX -= dx / Math.max(0.1, this.k);
    this.panY -= dy / Math.max(0.1, this.k);
  }

  resize(w: number, h: number, top: number, bottom: number, right = 0): void {
    this.w = w;
    this.h = h;
    this.top = top;
    this.bottom = bottom;
    this.right = right;
  }

  update(v: UnderView | null, snap: Snapshot | null): void {
    this.view = v;
    this.root.visible = !!v;
    this.hud.show(v, snap);
  }

  /** The caves' picture and its things, again when more is seen or dug, or the art comes in. */
  private rebuild(v: UnderView): void {
    const key = `${v.cells}|${v.sites.map((s) => s.stance ?? '').join()}|${artGen}|${this.w}x${this.h}`;
    if (key === this.key) return;
    if (!paint(v, this.canvas)) return;
    this.key = key;
    this.groundTex?.destroy(true);
    this.groundTex = Texture.from(this.canvas);
    this.groundTex.source.scaleMode = 'nearest';
    this.ground.texture = this.groundTex;
    for (const c of [...this.things.children, ...this.lights.children, ...this.labels.children]) c.destroy();
    this.glows = [];
    if (backdrop && !this.backed) {
      this.backed = true;
      this.back.texture = Texture.from(backdrop);
    }
    // (the box round everything seen, a cell to spare, never smaller than a few cells each way)
    let x0 = v.w;
    let y0 = v.h;
    let x1 = 0;
    let y1 = 0;
    for (let i = 0; i < v.cells.length; i++) {
      if (v.cells[i] === '?') continue;
      x0 = Math.min(x0, i % v.w);
      x1 = Math.max(x1, (i % v.w) + 1);
      y0 = Math.min(y0, Math.floor(i / v.w));
      y1 = Math.max(y1, Math.floor(i / v.w) + 1);
    }
    const grow = (a: number, b: number, n: number, least: number) => {
      const m = Math.max(0, least - (b - a)) / 2;
      return [Math.max(0, Math.floor(a - 1 - m)), Math.min(n, Math.ceil(b + 1 + m))];
    };
    const [bx0, bx1] = grow(x0, x1, v.w, 12);
    const [by0, by1] = grow(y0, y1, v.h, 12);
    this.box = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    const place = (url: string, i: number, size: number, dx = 0) => {
      const t = tex(url);
      if (!t) return;
      const s = new Sprite(t);
      s.scale.set((TILE * size) / Math.max(t.width, t.height));
      s.anchor.set(0.5, 0.9);
      s.position.set((i % v.w) * TILE + TILE / 2 + dx, Math.floor(i / v.w) * TILE + TILE * 0.85);
      s.zIndex = s.y;
      this.things.addChild(s);
    };
    const pool = (i: number, color: number, r: number, alpha: number, fast = false) => {
      const g = new Sprite(glowTexture());
      g.anchor.set(0.5);
      g.tint = color;
      g.alpha = alpha;
      g.width = g.height = r;
      g.position.set((i % v.w) * TILE + TILE / 2, Math.floor(i / v.w) * TILE + TILE / 2);
      this.lights.addChild(g);
      this.glows.push({ sprite: g, base: alpha, phase: (h32(i, 11) % 100) / 100, fast });
    };
    for (let i = 0; i < v.cells.length; i++) {
      const c = v.cells[i];
      if (c === '?') continue;
      const h = h32(i, 1);
      const t = THINGS[c];
      if (t) {
        if (h % t.every === 0) place(t.urls[(h >>> 4) % t.urls.length], i, t.size * (0.8 + ((h >>> 8) % 40) / 100), ((h >>> 12) % 7) - 3);
        if (t.glow && h % (t.every * 2) === 0) pool(i, t.glow, TILE * 4, t.light ?? 0.4);
      } else if (c === '#' && h % 11 === 0 && i + v.w < v.cells.length && open(v.cells[i + v.w])) place(ROCKS[h % 2], i + v.w, 1.1);
      else if (c === 'v' && h % 2 === 0) pool(i, 0xff6a2a, TILE * 5, 0.55, true);
    }
    // the town's ways down: a ladder, and a fire beside it
    for (const e of v.entries) {
      place(ladderUrl, e, 2);
      place(bonfireUrl, e + 1, 1.3);
      pool(e, 0xffa040, TILE * 7, 0.6, true);
    }
    // the places' names
    for (const site of v.sites) {
      const color = site.stance === 'war' ? 0xff8070 : site.stance === 'friend' ? 0x9af0a0 : site.stance === 'fallen' ? 0x8a8a8a : 0xf0dcb0;
      const label = new Text({ text: site.name.charAt(0).toUpperCase() + site.name.slice(1), style: { fontFamily: 'sans-serif', fontSize: 9, fill: color, stroke: { color: 0x000000, width: 3 }, fontWeight: '700' }, resolution: 4 });
      label.anchor.set(0.5, 1);
      label.position.set(site.x * TILE + TILE / 2, site.y * TILE - 4);
      this.labels.addChild(label);
    }
    // always night below
    this.veil.clear().rect(0, 0, v.w * TILE, v.h * TILE).fill({ color: 0x04030a, alpha: 0.45 });
  }

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    this.rebuild(v);
    const room = { w: Math.max(60, this.w - this.right), h: Math.max(60, this.h - this.top - this.bottom) };
    const box = this.box ?? { x0: 0, y0: 0, x1: v.w, y1: v.h };
    const bw = (box.x1 - box.x0) * TILE;
    const bh = (box.y1 - box.y0) * TILE;
    // (what's seen fitted to the room, closer than that up to twice over: the rest is a drag away)
    const want = Math.min(MOST_ZOOM, Math.min(room.w / bw, room.h / bh) * 2);
    this.k += (want - this.k) * Math.min(1, dt * 3);
    const k = this.k;
    const spareX = Math.max(0, (bw * k - room.w) / 2 / k);
    const spareY = Math.max(0, (bh * k - room.h) / 2 / k);
    this.panX = Math.max(-spareX, Math.min(spareX, this.panX));
    this.panY = Math.max(-spareY, Math.min(spareY, this.panY));
    const cx = ((box.x0 + box.x1) / 2) * TILE + this.panX;
    const cy = ((box.y0 + box.y1) / 2) * TILE + this.panY;
    this.cover.clear().rect(0, 0, this.w, this.h).fill(0x040308);
    // (the crystal cave behind it all, dim, filling the room)
    if (this.backed) {
      const t = this.back.texture;
      const s = Math.max(room.w / t.width, room.h / t.height);
      this.back.scale.set(s);
      this.back.position.set((room.w - t.width * s) / 2, this.top + (room.h - t.height * s) / 2);
      this.back.alpha = 0.35;
    }
    this.world.scale.set(k);
    this.world.position.set(Math.round(room.w / 2 - cx * k), Math.round(this.top + room.h / 2 - cy * k));
    // what glows breathes; the fires and the magma flicker
    for (const g of this.glows) g.sprite.alpha = g.base + (g.fast ? Math.sin(now / 90 + g.phase * 9) * 0.06 + Math.sin(now / 37 + g.phase * 3) * 0.04 : Math.sin(now / 900 + g.phase * 6) * 0.08);
  }
}

/* ------------------------------------------------------------ the bar */

const STANCE: Record<string, string> = { peace: 'at peace', friend: 'friends, trading', war: 'at war', fallen: 'fallen' };

class UnderHud {
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly info: HTMLElement;
  private last = '';

  constructor(send: (c: Command) => void) {
    this.el = document.createElement('div');
    this.el.id = 'under-hud';
    this.el.innerHTML = '<div class="dh-top"><div class="dh-title">The Underdark</div><button class="dh-close" title="Back up to the town">✕</button></div><div class="dh-info"></div>';
    this.el.hidden = true;
    document.body.append(this.el);
    this.title = this.el.querySelector('.dh-title')!;
    this.info = this.el.querySelector('.dh-info')!;
    this.el.querySelector('.dh-close')!.addEventListener('click', () => send({ type: 'watchUnder', on: false }));
  }

  show(v: UnderView | null, snap: Snapshot | null): void {
    this.el.hidden = !v;
    document.body.classList.toggle('under-on', !!v);
    if (!v) return;
    const u = snap?.underdark;
    const key = `${v.miners}|${v.through}|${v.flooded}|${v.sites.length}|${v.finds.join('|')}|${JSON.stringify(u?.towns ?? [])}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = 'The Underdark';
    this.info.innerHTML = '';
    const row = (label: string, text: string) => {
      const d = document.createElement('div');
      d.className = 'dh-row';
      const b = document.createElement('b');
      b.textContent = label;
      d.append(b, document.createTextNode(text));
      this.info.append(d);
    };
    row('Diggers ', v.flooded ? 'none: the tunnels are flooded' : v.miners ? `${v.miners} at work` : 'none below now');
    row('Below ', v.through ? `${v.sites.length} place${v.sites.length === 1 ? '' : 's'} found` : 'still cutting through the rock to the caves');
    for (const t of u?.towns ?? []) row(`${t.name.replace(/^the /, 'The ')} `, `${t.kind}, ${STANCE[t.stance] ?? t.stance}${t.feud ? `, feuding with ${t.feud}` : ''}`);
    for (const f of v.finds.slice(-2).reverse()) {
      const d = document.createElement('div');
      d.className = 'dh-find';
      d.textContent = f;
      this.info.append(d);
    }
  }
}
