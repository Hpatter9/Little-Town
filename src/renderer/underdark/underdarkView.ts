// Looking into the Underdark (the shaft's or a mine's tap card, or the Deep's bar: "The Underdark"): the cave layer
// under the town's land seen from above, taking the screen like the Deep, and each deeper depth the scouts have opened
// (▲ ▼ in the bar). The ground is painted from the packs: the undead tileset's cave floor (cobbled where the town or a
// cave town has worked it), the Mine Tileset's rock with its stony edges, the undead tileset's jagged cliffs where rock
// overhangs open ground, its cracks and stalagmites strewn about, the dungeon pack's water (running, glinting) and the
// same water burning for magma. On it stand the cave pack's things: mushrooms in the fungus forests, crystals that
// sparkle, the ruins of whoever dug here first, the cave towns' dwellings, boulders, a ladder and a fire at each of the
// town's ways down (a hold's hallway its carved gate, torches along the passage). It's always dark below: a light map
// (worked out like the town's: each light reaching as far as its kind does, `falloff` from sim/lightField.ts, and
// stopped by rock) is laid over it in multiply, so the town's workings, the glowmoss, the crystals, the magma and the
// cave towns' lamps read against the black; by day the main shaft lets a shaft of daylight down. What hasn't been
// seen is black, with the caves beyond drawn as a faint outline.
//
// The place lives: the town's miners at the rock face, the under-village's folk about their houses, each cave town's
// people on patrol near home, its trains of goods and envoys walking up to the shaft, two towns at feud fighting at
// the border between them, a fallen town smoking. Creatures lurk and prowl in the unlit tunnels (more at night); one
// that takes a miner is seen dragging them off, and the search party's torches go after them; a cave-in throws dust and
// shakes the screen; a flood fills the town's cuttings; and a raid coming up the shaft is a horde streaming toward its
// mouth. A tap on any place shows its card: what it is, what it gives, what lives there, and the trip to it. A drag
// looks about, a pinch or the wheel zooms; the camera starts on the town's workings.
import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { ENEMIES } from '../../shared/data/enemies';
import type { Look } from '../../shared/data/people';
import { falloff } from '../../shared/sim/lightField';
import type { PanelId } from '../../shared/ipc';
import type { Command } from '../../shared/sim/commands';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { UnderFolk, UnderMark, UnderSiteSeen, UnderView } from '../../shared/sim/underdark';
import { creatureFeet, creatureFlip, creatureFrame, type CreatureSheet } from '../art/creatures';
import { hkLayers, hkPose, hkWhoById, hkWhoOfLook, type HkFacing } from '../art/hkFolk';
import { hkSprite } from '../art/hkTexture';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import bones1Url from '../art/deep/bones1.png';
import bones2Url from '../art/deep/bones2.png';
import bonfireUrl from '../art/deep/bonfire.png';
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
import cliffUrl from '../art/under/cliff.png';
import detailsUrl from '../art/under/details.png';
import groundUrl from '../art/under/ground.png';
import house1Url from '../art/under/house1.png';
import house2Url from '../art/under/house2.png';
import ladderUrl from '../art/under/ladder.png';
import rockEdgesUrl from '../art/under/rock_edges.png';
import stairsUrl from '../art/under/stairs.png';
import waterUrl from '../art/under/water.png';

/** A cell's size on the canvas (art px), the closest and farthest the camera comes (screen px an art px), and how much
 *  of the caves the first look takes in (cells across). */
const TILE = 16;
const MOST_ZOOM = 3;
const FIRST_CELLS = 30;
const FIRST_ROWS = 24;
/** Ticks an hour (sim/time.ts), and how long a walk up from a cave town to the shaft takes (game hours). */
const TICKS_PER_HOUR = 600;
const WALK_HOURS = 2;

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
/** A piece of a picture (cached). */
const pieces = new Map<string, Texture>();
function piece(url: string, x: number, y: number, w: number, h: number): Texture | null {
  const key = `${url}|${x},${y},${w},${h}`;
  const had = pieces.get(key);
  if (had) return had;
  const t = tex(url);
  if (!t) return null;
  const p = new Texture({ source: t.source, frame: new Rectangle(x, y, w, h) });
  pieces.set(key, p);
  return p;
}
/** The fire sheet's wall torch (art/delve/fires.png: column 1 of 44x48, 6 frames down). */
const torchFrame = (f: number) => piece(firesUrl, 44, (f % 6) * 48, 44, 48);
let backdrop: HTMLImageElement | null = null;

/** What stands on each kind of open ground (by the cell, so it stays put): which pictures, how big (of a cell), one
 *  cell in how many, and the glow over it. */
const THINGS: Record<string, { urls: string[]; size: number; every: number; glow?: number; light?: number }> = {
  g: { urls: [mushroomBigUrl, mushroomBig2Url, mushroom1Url, mushroom2Url], size: 1.7, every: 2, glow: 0x6af0b0, light: 0.4 },
  c: { urls: [crystal1Url, crystal2Url, crystal3Url], size: 1.6, every: 2, glow: 0x9ab8ff, light: 0.45 },
  r: { urls: [ruin1Url, ruin2Url, statueUrl, gatesUrl, totemUrl], size: 2.2, every: 4 },
  t: { urls: [house1Url, house2Url], size: 2.6, every: 4, glow: 0xffc860, light: 0.5 },
  l: { urls: [bones1Url, bones2Url, skeletonUrl, demonSkullUrl], size: 1.6, every: 3 },
};
const ROCKS = [rock1Url, rock2Url];
/** The undead tileset's cracks, pebbles and stalagmites (art/under/details.png: 32 px slots). */
const DETAILS = 8;
const open = (c: string) => c === '.' || c === 'd' || c === 'e' || c === 'g' || c === 'c' || c === 'r' || c === 't' || c === 'l' || c === 'x';
/** Ground the town or a cave town has worked: cobbled. */
const worked = (c: string) => c === 'd' || c === 'e' || c === 't';

const h32 = (a: number, b: number) => {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** The Mine Tileset's rock piece for a cell of rock, by which of its sides face open ground (its 6x4 sheet: the 4x3
 *  box with its edges and corners, the 1-high strip, the 1-wide strip, the single block). */
function rockPiece(t: boolean, b: boolean, l: boolean, r: boolean, i: number): [number, number] {
  if (t && b && l && r) return [4, 0];
  if (t && b) return l ? [0, 0] : r ? [3, 0] : [1 + (i % 2), 0];
  if (l && r) return t ? [4, 1] : b ? [4, 3] : [4, 2];
  const row = t ? 1 : b ? 3 : 2;
  const col = l ? 0 : r ? 3 : 1 + (i % 2);
  return [col, row];
}

/** The ground painted from the tiles; false while the tiles are still loading. */
function paint(v: UnderView, canvas: HTMLCanvasElement): boolean {
  const rock = img(rockEdgesUrl);
  const ground = img(groundUrl);
  const water = img(waterUrl);
  const cliff = img(cliffUrl);
  const details = img(detailsUrl);
  if (!rock || !ground || !water || !cliff || !details) return false;
  canvas.width = v.w * TILE;
  canvas.height = v.h * TILE;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#020204';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= v.w || y >= v.h ? '#' : v.cells[y * v.w + x]);
  const seenOpen = (c: string) => open(c);
  for (let i = 0; i < v.cells.length; i++) {
    const c = v.cells[i];
    if (c === '?' || c === ',') continue;
    const cx = i % v.w;
    const cy = Math.floor(i / v.w);
    const x = cx * TILE;
    const y = cy * TILE;
    if (c === '#') {
      const t = seenOpen(at(cx, cy - 1));
      const b = seenOpen(at(cx, cy + 1));
      const l = seenOpen(at(cx - 1, cy));
      const r = seenOpen(at(cx + 1, cy));
      if (!t && !b && !l && !r) continue; // (deep rock: black)
      const [px, py] = rockPiece(t, b, l, r, h32(i, 3));
      g.drawImage(rock, px * 16, py * 16, 16, 16, x, y, TILE, TILE);
    } else if (c === '~' || c === 'v') {
      g.drawImage(water, 0, 0, 16, 16, x, y, TILE, TILE);
      if (c === 'v') {
        // (magma: a dark crust, molten where it cracks)
        g.fillStyle = 'rgba(150,36,12,0.92)';
        g.fillRect(x, y, TILE, TILE);
        const h = h32(i, 9);
        g.fillStyle = h % 3 ? 'rgba(255,120,30,0.9)' : 'rgba(255,190,60,0.9)';
        g.fillRect(x + (h % 9), y + ((h >>> 4) % 12), 6 + ((h >>> 8) % 5), 2);
        g.fillRect(x + ((h >>> 12) % 10), y + ((h >>> 16) % 8) + 6, 2, 4);
      } else {
        g.fillStyle = 'rgba(10,30,60,0.35)';
        g.fillRect(x, y, TILE, TILE);
      }
    } else {
      // (the cave floor; cobbled where it's been worked)
      g.drawImage(ground, worked(c) ? 16 : 0, 0, 16, 16, x, y, TILE, TILE);
      const h = h32(i, 5);
      if (!worked(c) && h % 4 === 0) {
        const k = (h >>> 4) % DETAILS;
        g.drawImage(details, k * 32, 0, 32, 32, x - 8, y - 16, 32, 32);
      }
      if (c === 'g') {
        g.fillStyle = 'rgba(60,160,110,0.22)';
        g.fillRect(x, y, TILE, TILE);
      } else if (c === 'c') {
        g.fillStyle = 'rgba(110,140,255,0.2)';
        g.fillRect(x, y, TILE, TILE);
      } else if (c === 'l') {
        g.fillStyle = 'rgba(90,20,20,0.3)';
        g.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // (the cliffs: where rock overhangs the open ground below it, its jagged face hangs down onto the floor)
  for (let i = 0; i < v.cells.length; i++) {
    if (v.cells[i] !== '#') continue;
    const cx = i % v.w;
    const cy = Math.floor(i / v.w);
    if (!seenOpen(at(cx, cy + 1))) continue;
    const sx = (h32(i, 13) % 30) * 16;
    g.drawImage(cliff, sx, 0, 16, 30, cx * TILE, cy * TILE + 6, TILE, 30);
  }
  return true;
}

/* ------------------------------------------------------------ the light */

interface Light {
  cell: number;
  r: number;
  color: [number, number, number];
}
const rgb = (n: number): [number, number, number] => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];

/** Whether a light at one cell reaches another: no rock (or what's unseen) between. */
function clear(v: UnderView, a: number, b: number): boolean {
  let x0 = a % v.w;
  let y0 = Math.floor(a / v.w);
  const x1 = b % v.w;
  const y1 = Math.floor(b / v.w);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) return true;
    const i = y0 * v.w + x0;
    if (i !== a && !open(v.cells[i]) && v.cells[i] !== '~' && v.cells[i] !== 'v') return false;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** The light map: a pixel a cell, the light falling on it (black where nothing reaches, the dim cave's own where it's
 *  seen). Drawn smoothed and multiplied over the scene. */
function paintLight(v: UnderView, lights: Light[], canvas: HTMLCanvasElement, day: boolean): void {
  canvas.width = v.w;
  canvas.height = v.h;
  const g = canvas.getContext('2d')!;
  const px = g.createImageData(v.w, v.h);
  const acc = new Float32Array(v.w * v.h * 3);
  // (the cave's own dim: just enough to make out the rock by; less at night above, when the shaft lets nothing down)
  const amb = day ? 0.24 : 0.19;
  for (let i = 0; i < v.cells.length; i++) {
    const c = v.cells[i];
    if (c === '?' || c === ',') continue;
    acc[i * 3] = amb * 0.8;
    acc[i * 3 + 1] = amb * 0.8;
    acc[i * 3 + 2] = amb * 1.2;
  }
  for (const L of lights) {
    const lx = L.cell % v.w;
    const ly = Math.floor(L.cell / v.w);
    const r = Math.ceil(L.r);
    for (let y = Math.max(0, ly - r); y <= Math.min(v.h - 1, ly + r); y++)
      for (let x = Math.max(0, lx - r); x <= Math.min(v.w - 1, lx + r); x++) {
        const i = y * v.w + x;
        const c = v.cells[i];
        if (c === '?' || c === ',') continue;
        const f = falloff(Math.hypot(x - lx, y - ly), L.r);
        if (f <= 0 || !clear(v, L.cell, i)) continue;
        acc[i * 3] += L.color[0] * f;
        acc[i * 3 + 1] += L.color[1] * f;
        acc[i * 3 + 2] += L.color[2] * f;
      }
  }
  for (let i = 0; i < v.cells.length; i++) {
    px.data[i * 4] = Math.min(255, acc[i * 3] * 255);
    px.data[i * 4 + 1] = Math.min(255, acc[i * 3 + 1] * 255);
    px.data[i * 4 + 2] = Math.min(255, acc[i * 3 + 2] * 255);
    px.data[i * 4 + 3] = 255;
  }
  g.putImageData(px, 0, 0);
}

/* ------------------------------------------------------------ the walkers */

/** The open cells between two, a step at a time (breadth first; cached). */
const paths = new Map<string, number[]>();
function pathOf(v: UnderView, a: number, b: number): number[] {
  const key = `${v.depth}|${a}|${b}|${v.cells.length}`;
  const had = paths.get(key);
  if (had) return had;
  const from = new Int32Array(v.cells.length).fill(-1);
  from[a] = a;
  const q = [a];
  const walk = (c: string) => open(c) || c === ',';
  for (let k = 0; k < q.length && from[b] < 0; k++) {
    const i = q[k];
    const x = i % v.w;
    const y = Math.floor(i / v.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
      const j = ny * v.w + nx;
      if (from[j] >= 0 || !walk(v.cells[j])) continue;
      from[j] = i;
      q.push(j);
    }
  }
  const out: number[] = [];
  if (from[b] >= 0) for (let i = b; ; i = from[i]) {
    out.push(i);
    if (i === a) break;
  }
  out.reverse();
  if (!out.length) out.push(a, b);
  if (paths.size > 200) paths.clear();
  paths.set(key, out);
  return out;
}
/** A point a share of the way along a path (art px, the cell's middle). */
function along(v: UnderView, path: number[], t: number): { x: number; y: number; dir: number } {
  const f = Math.max(0, Math.min(1, t)) * (path.length - 1);
  const k = Math.min(path.length - 2, Math.floor(f));
  const a = path[Math.max(0, k)];
  const b = path[Math.max(0, k + 1)] ?? a;
  const u = f - k;
  const ax = (a % v.w) * TILE + TILE / 2;
  const ay = Math.floor(a / v.w) * TILE + TILE * 0.8;
  const bx = (b % v.w) * TILE + TILE / 2;
  const by = Math.floor(b / v.w) * TILE + TILE * 0.8;
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, dir: bx < ax ? -1 : 1 };
}

/** The cave peoples drawn: as townsfolk of their own looks (the Himeko paper dolls) or as their creature. */
const CAVE_FOLK: Record<string, { look?: Look; creature?: string; scale?: number }> = {
  glimmerdeep: { look: { gender: 'm', skin: '#a8b4c8', hair: 'plain', hairColor: '#a8a29a', beard: true, outfit: '#4a5468', ears: 'big', height: 0.72 } },
  umbral: { look: { gender: 'f', skin: '#cfc4e8', hair: 'long', hairColor: '#ecebf4', beard: false, outfit: '#1e1626', ears: 'elf', eyes: 'red' } },
  sporemoot: { creature: 'ud_sporeling' },
  greyhold: { look: { gender: 'm', skin: '#c9956a', hair: 'plain', hairColor: '#8a8a90', beard: true, outfit: '#5a5a66', height: 0.8 } },
};
const STANCE_COLOR: Record<string, number> = { war: 0xff8070, friend: 0x9af0a0, fallen: 0x8a8a8a, peace: 0xf0dcb0 };

interface Actor {
  sprite: Sprite;
  extra?: Graphics;
  seen: number;
  walked: number;
  x: number;
  y: number;
}

/* ------------------------------------------------------------ the scene */

export class UnderScene {
  readonly root = new Container();
  private readonly cover = new Graphics();
  private readonly back = new Sprite();
  private readonly world = new Container();
  private readonly ground = new Sprite();
  private readonly waterFx = new Graphics();
  private readonly things = new Container();
  private readonly dark = new Sprite();
  private readonly lights = new Container();
  private readonly fx = new Graphics();
  private readonly fog = new Graphics();
  private readonly labels = new Container();
  private readonly canvas = document.createElement('canvas');
  private readonly lightCanvas = document.createElement('canvas');
  private groundTex: Texture | null = null;
  private lightTex: Texture | null = null;
  private key = '';
  private lightKey = '';
  private view: UnderView | null = null;
  private glows: { sprite: Sprite; base: number; phase: number; fast: boolean }[] = [];
  private torches: { sprite: Sprite; phase: number }[] = [];
  private sparkles: { x: number; y: number; phase: number; color: number }[] = [];
  private waterCells: number[] = [];
  private magmaCells: number[] = [];
  private readonly actors = new Map<string, Actor>();
  private frame = 0;
  private w = 1;
  private h = 1;
  private top = 0;
  private bottom = 0;
  private right = 0;
  private readonly hud: UnderHud;
  private backed = false;
  /** The camera: the zoom (screen px an art px) and where it looks (art px); set on the first look at a depth. */
  private k = 1;
  private cx = 0;
  private cy = 0;
  private looked = -1;
  /** The game's clock between snapshots: the last tick seen, when (ms), and how fast it's been running. */
  private tickSeen = 0;
  private tickAt = 0;
  private tickRate = 10;
  /** The screen's shake (a cave-in), and the marks already shaken for. */
  private shake = 0;
  private shookFor = 0;

  constructor(send: (c: Command) => void, openPanel: (id: PanelId) => void = () => undefined) {
    this.root.visible = false;
    this.things.sortableChildren = true;
    this.lights.blendMode = 'add';
    this.dark.blendMode = 'multiply';
    this.world.addChild(this.ground, this.waterFx, this.things, this.dark, this.lights, this.fx, this.fog, this.labels);
    this.root.addChild(this.cover, this.back, this.world);
    this.hud = new UnderHud(send, openPanel);
    [rockEdgesUrl, groundUrl, waterUrl, cliffUrl, detailsUrl, ladderUrl, bonfireUrl, firesUrl, stairsUrl, gatesUrl, circleUrl, ...ROCKS, ...Object.values(THINGS).flatMap((t) => t.urls)].forEach(img);
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
    const f = this.px();
    this.cx -= (dx * f) / Math.max(0.1, this.k);
    this.cy -= (dy * f) / Math.max(0.1, this.k);
    this.hud.card(null);
  }

  /** A pinch or the wheel (by a factor, about a point on the screen). */
  zoom(factor: number, sx: number, sy: number): void {
    const v = this.view;
    if (!v) return;
    sx *= this.px();
    sy *= this.px();
    const room = this.room();
    const least = Math.min(room.w / (v.w * TILE), room.h / (v.h * TILE));
    const k = Math.max(least, Math.min(MOST_ZOOM, this.k * factor));
    // (the point under the fingers stays put)
    const wx = this.cx + (sx - room.w / 2) / this.k;
    const wy = this.cy + (sy - this.top - room.h / 2) / this.k;
    this.cx = wx - (sx - room.w / 2) / k;
    this.cy = wy - (sy - this.top - room.h / 2) / k;
    this.k = k;
  }

  /** A tap (screen px): the place there, its card. */
  tap(sx: number, sy: number): void {
    const v = this.view;
    if (!v) return;
    sx *= this.px();
    sy *= this.px();
    const room = this.room();
    const wx = this.cx + (sx - room.w / 2) / this.k;
    const wy = this.cy + (sy - this.top - room.h / 2) / this.k;
    // (a cell's things stand up off it: a tap a little above the cell counts as on it)
    const cx = wx / TILE;
    const cy = wy / TILE + 0.7;
    let best: UnderSiteSeen | null = null;
    let bd = 3.2;
    for (const s of v.sites) {
      const d = Math.min(Math.hypot(s.x + 0.5 - cx, s.y + 0.5 - cy), Math.hypot((s.at % v.w) + 0.5 - cx, Math.floor(s.at / v.w) + 0.5 - cy));
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    const way = v.ways.find((w) => Math.hypot((w.cell % v.w) + 0.5 - cx, Math.floor(w.cell / v.w) + 0.5 - cy) < 2.4);
    const vil = v.village && Math.hypot((v.village.cell % v.w) + 0.5 - cx, Math.floor(v.village.cell / v.w) + 0.5 - cy) < 2.5 ? v.village : null;
    if (vil && (!best || bd > 1.5)) return this.hud.card({ title: vil.name, lines: [`A village of the town's own, down in the dark: ${vil.pop} folk.`, 'It grows mushrooms, fishes the black water and digs deep ore, and sends it up the shaft.'] });
    if (way && (!best || bd > 1)) return this.hud.card(wayCard(v, way.def));
    if (best) return this.hud.card(siteCard(v, best));
    if (v.depth > 0 && Math.hypot((v.entries[0] % v.w) + 0.5 - cx, Math.floor(v.entries[0] / v.w) + 0.5 - cy) < 2) return this.hud.card({ title: 'The stair from above', lines: [`The way up out of ${v.name}, to the caves above and the town's shaft.`] });
    this.hud.card(null);
  }

  resize(w: number, h: number, top: number, bottom: number, right = 0): void {
    this.w = w;
    this.h = h;
    this.top = top;
    this.bottom = bottom;
    this.right = right;
  }

  /** The renderer's pixels to a touch's (the strip draws finer than the page's CSS pixels on a phone). */
  private px(): number {
    return this.w / Math.max(1, window.innerWidth);
  }

  private room() {
    return { w: Math.max(60, this.w - this.right), h: Math.max(60, this.h - this.top - this.bottom) };
  }

  update(v: UnderView | null, snap: Snapshot | null): void {
    if (v && v.tick !== this.tickSeen) {
      const now = performance.now();
      if (this.tickAt && v.tick > this.tickSeen) this.tickRate = this.tickRate * 0.7 + Math.min(200, ((v.tick - this.tickSeen) / Math.max(1, now - this.tickAt)) * 1000) * 0.3;
      this.tickSeen = v.tick;
      this.tickAt = now;
    }
    if (!v) this.hud.card(null);
    this.view = v;
    this.root.visible = !!v;
    this.hud.show(v, snap);
  }

  /** The game's tick now, between snapshots. */
  private ticks(now: number): number {
    return this.tickSeen + Math.min(3000, ((now - this.tickAt) / 1000) * this.tickRate);
  }

  /** The caves' picture and its things, again when more is seen or dug, or the art comes in. */
  private rebuild(v: UnderView): void {
    const key = `${v.depth}|${v.cells}|${v.sites.map((s) => `${s.stance ?? ''}${s.slain ? 'x' : ''}`).join()}|${v.village?.cell ?? ''}|${artGen}`;
    if (key === this.key) return;
    if (!paint(v, this.canvas)) return;
    this.key = key;
    this.lightKey = '';
    this.groundTex?.destroy(true);
    this.groundTex = Texture.from(this.canvas);
    this.groundTex.source.scaleMode = 'nearest';
    this.ground.texture = this.groundTex;
    for (const c of [...this.things.children, ...this.lights.children, ...this.labels.children]) c.destroy();
    for (const a of this.actors.values()) a.extra?.destroy();
    this.actors.clear();
    this.glows = [];
    this.torches = [];
    this.sparkles = [];
    if (backdrop && !this.backed) {
      this.backed = true;
      this.back.texture = Texture.from(backdrop);
    }
    const place = (url: string, i: number, size: number, dx = 0, tint?: number) => {
      const t = tex(url);
      if (!t) return null;
      const s = new Sprite(t);
      s.scale.set((TILE * size) / Math.max(t.width, t.height));
      s.anchor.set(0.5, 0.9);
      s.position.set((i % v.w) * TILE + TILE / 2 + dx, Math.floor(i / v.w) * TILE + TILE * 0.85);
      s.zIndex = s.y;
      if (tint !== undefined) s.tint = tint;
      this.things.addChild(s);
      return s;
    };
    const pool = (i: number, color: number, r: number, alpha: number, fast = false, dx = 0, dy = 0) => {
      const g = new Sprite(glowTexture());
      g.anchor.set(0.5);
      g.tint = color;
      g.alpha = alpha;
      g.width = g.height = r;
      g.position.set((i % v.w) * TILE + TILE / 2 + dx, Math.floor(i / v.w) * TILE + TILE / 2 + dy);
      this.lights.addChild(g);
      this.glows.push({ sprite: g, base: alpha, phase: (h32(i, 11) % 100) / 100, fast });
    };
    const torchAt = (i: number, dy = -4) => {
      const t = torchFrame(0);
      if (!t) return;
      const s = new Sprite(t);
      s.anchor.set(0.5, 1);
      s.scale.set((TILE * 1.1) / 48);
      s.position.set((i % v.w) * TILE + TILE / 2, Math.floor(i / v.w) * TILE + TILE + dy);
      s.zIndex = s.y;
      this.things.addChild(s);
      this.torches.push({ sprite: s, phase: h32(i, 21) % 6 });
      pool(i, 0xffa040, TILE * 3.5, 0.45, true, 0, -6);
    };
    const fallen = new Set(v.sites.filter((s) => s.stance === 'fallen').map((s) => s.id));
    const townOf = (i: number) => v.sites.find((s) => s.kind === 'town' && Math.hypot((i % v.w) - s.x, Math.floor(i / v.w) - s.y) < 6);
    const lights: Light[] = [];
    const day = v.hour >= 7 && v.hour <= 18;
    this.waterCells = [];
    this.magmaCells = [];
    for (let i = 0; i < v.cells.length; i++) {
      const c = v.cells[i];
      if (c === '?' || c === ',') continue;
      const h = h32(i, 1);
      if (c === '~') {
        this.waterCells.push(i);
        continue;
      }
      if (c === 'v') {
        this.magmaCells.push(i);
        if (h % 2 === 0) pool(i, 0xff6a2a, TILE * 5, 0.5, true);
        if (h % 3 === 0) lights.push({ cell: i, r: 3.5, color: rgb(0xff8a40) });
        continue;
      }
      const t = THINGS[c];
      if (c === 't') {
        const town = townOf(i);
        if (town && fallen.has(town.id)) {
          // (a fallen town: its dwellings burnt black, bones in the doorways, no lamps)
          if (h % 4 === 0) place(t.urls[(h >>> 4) % t.urls.length], i, t.size * 0.9, 0, 0x403838);
          else if (h % 5 === 0) place(h % 2 ? bones1Url : bones2Url, i, 1.2);
          continue;
        }
      }
      if (t) {
        if (h % t.every === 0) {
          const sp = place(t.urls[(h >>> 4) % t.urls.length], i, t.size * (0.8 + ((h >>> 8) % 40) / 100), ((h >>> 12) % 7) - 3);
          if (sp && c === 'c') this.sparkles.push({ x: sp.x, y: sp.y - TILE * 0.8, phase: (h >>> 6) % 100, color: 0xd8e8ff });
        }
        if (t.glow && h % (t.every * 2) === 0) pool(i, t.glow, TILE * 4, t.light ?? 0.4);
        if (c === 'g' && h % 3 === 0) lights.push({ cell: i, r: 2.6, color: rgb(0x48c890) });
        if (c === 'c' && h % 3 === 0) lights.push({ cell: i, r: 2.8, color: rgb(0x6a88ff) });
        if (c === 't' && h % 3 === 0) lights.push({ cell: i, r: 3.2, color: rgb(0xffb050) });
        if (c === 'g' && h % 5 === 0) this.sparkles.push({ x: (i % v.w) * TILE + TILE / 2, y: Math.floor(i / v.w) * TILE, phase: h % 100, color: 0x9affc8 });
      } else if (c === 'd' && h % 6 === 0 && !v.entries.includes(i)) {
        // (the town's cuttings: torches along them)
        torchAt(i);
        lights.push({ cell: i, r: 3.4, color: rgb(0xffa050) });
      } else if (c === '#' && h % 11 === 0 && i + v.w < v.cells.length && open(v.cells[i + v.w])) place(ROCKS[h % 2], i + v.w, 1.1);
      else if (c === 'x') {
        place(stairsUrl, i, 1.8);
        lights.push({ cell: i, r: 2.5, color: rgb(0x8a7aa0) });
      }
    }
    // the deeper places' own light: a forge's embers, a grotto's or a vein's shine, the Lost Hold's gold, the halls'
    // old lamps still burning blue
    const SITE_LIGHT: Record<string, [number, number]> = { hall: [0x7a90c0, 3.2], forge: [0xff8a40, 3.8], grotto: [0x7aa0ff, 3.2], vein: [0xffc850, 3.6], hold: [0xffd070, 5], ruins: [0x8a8070, 2.6] };
    for (const s of v.sites) {
      const L = SITE_LIGHT[s.kind];
      if (!L) continue;
      lights.push({ cell: s.at, r: L[1], color: rgb(L[0]) });
      pool(s.at, L[0], TILE * L[1] * 1.4, 0.32, s.kind === 'forge');
    }
    // the lairs: the dweller asleep in its bones (or its own bones, slain), a dull red over it
    for (const s of v.sites) {
      if (s.kind !== 'lair') continue;
      if (!s.slain) {
        lights.push({ cell: s.at, r: 4, color: rgb(0x902818) });
        pool(s.at, 0xff3020, TILE * 5, 0.3, false);
      } else place(skeletonUrl, s.at, 2.2);
    }
    // the town's ways down: a ladder and a fire (a hold's hallway: its carved gate, and torches down the passage)
    const ways = v.ways.length ? v.ways : v.entries.map((cell) => ({ cell, def: v.depth > 0 ? 'stair' : 'deep_shaft' }));
    for (const w of ways) {
      if (w.def === 'hold_hallway') {
        place(gatesUrl, w.cell, 2.4);
        for (const p of hallPassage(v, w.cell)) torchAt(p);
      } else if (w.def === 'stair') place(stairsUrl, w.cell, 2);
      else place(ladderUrl, w.cell, 2);
      place(bonfireUrl, w.cell + 1, 1.3);
      pool(w.cell, 0xffa040, TILE * 7, 0.6, true);
      lights.push({ cell: w.cell, r: 6, color: rgb(0xffb070) });
    }
    // by day the main shaft lets the daylight down
    if (day && v.depth === 0 && v.entries.length) {
      lights.push({ cell: v.entries[0], r: 7, color: rgb(0x9ab0d0) });
      pool(v.entries[0], 0xc8d8ff, TILE * 6, 0.22);
    }
    // the under-village: its houses round a fire
    if (v.village) {
      const c = v.village.cell;
      for (const [dx, dy, k] of [[-2, -1, 0], [2, -1, 1], [0, -2, 0], [-2, 1, 1], [2, 1, 0]] as const) {
        const j = c + dy * v.w + dx;
        if (j >= 0 && j < v.cells.length && open(v.cells[j])) place(k ? house2Url : house1Url, j, 2.4);
      }
      place(bonfireUrl, c, 1.4);
      pool(c, 0xffb050, TILE * 8, 0.55, true);
      lights.push({ cell: c, r: 5.5, color: rgb(0xffb868) });
    }
    this.lightsList = lights;
    // the places' names (and the cave towns coloured by how they stand with the town)
    for (const site of v.sites) {
      const color = STANCE_COLOR[site.stance ?? ''] ?? (site.kind === 'lair' ? (site.slain ? 0x9a9a9a : 0xff9a80) : 0xf0dcb0);
      const label = new Text({ text: site.name.charAt(0).toUpperCase() + site.name.slice(1), style: { fontFamily: 'sans-serif', fontSize: 9, fill: color, stroke: { color: 0x000000, width: 3 }, fontWeight: '700' }, resolution: 4 });
      label.anchor.set(0.5, 1);
      label.position.set(site.x * TILE + TILE / 2, Math.max(12, site.y * TILE - 4));
      this.labels.addChild(label);
    }
    if (v.village) {
      const label = new Text({ text: v.village.name, style: { fontFamily: 'sans-serif', fontSize: 9, fill: 0xffe0a0, stroke: { color: 0x000000, width: 3 }, fontWeight: '700' }, resolution: 4 });
      label.anchor.set(0.5, 1);
      label.position.set((v.village.cell % v.w) * TILE + TILE / 2, Math.floor(v.village.cell / v.w) * TILE - 18);
      this.labels.addChild(label);
    }
    // the dark beyond what's seen: the caves out there drawn as a faint outline
    this.fog.clear();
    for (let i = 0; i < v.cells.length; i++) {
      if (v.cells[i] !== ',') continue;
      const x = (i % v.w) * TILE;
      const y = Math.floor(i / v.w) * TILE;
      const edge = (j: number, inRange: boolean) => !inRange || v.cells[j] === '?';
      if (edge(i - v.w, y > 0)) this.fog.moveTo(x, y).lineTo(x + TILE, y);
      if (edge(i + v.w, i + v.w < v.cells.length)) this.fog.moveTo(x, y + TILE).lineTo(x + TILE, y + TILE);
      if (edge(i - 1, i % v.w > 0)) this.fog.moveTo(x, y).lineTo(x, y + TILE);
      if (edge(i + 1, i % v.w < v.w - 1)) this.fog.moveTo(x + TILE, y).lineTo(x + TILE, y + TILE);
    }
    this.fog.stroke({ color: 0x9a8ac0, width: 1, alpha: 0.28 });
  }
  private lightsList: Light[] = [];

  /** The light map, again when the lights change (the day's light at the shaft, the marks' torches). */
  private relight(v: UnderView): void {
    const day = v.hour >= 7 && v.hour <= 18;
    const key = `${this.key}|${day}|${v.flooded}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    paintLight(v, this.lightsList, this.lightCanvas, day);
    if (!this.lightTex) {
      this.lightTex = Texture.from(this.lightCanvas);
      this.lightTex.source.scaleMode = 'linear';
      this.dark.texture = this.lightTex;
    } else this.lightTex.source.update();
    this.dark.scale.set(TILE);
  }

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    this.rebuild(v);
    if (!this.key) return;
    this.relight(v);
    this.frame++;
    const room = this.room();
    // the first look at a depth: on the town's workings (or the stair's foot), a few cells across
    if (this.looked !== v.depth) {
      this.looked = v.depth;
      const e = v.entries[0] ?? 0;
      this.cx = (e % v.w) * TILE + TILE / 2;
      this.cy = Math.floor(e / v.w) * TILE + TILE / 2;
      this.k = Math.min(MOST_ZOOM, Math.max(1, Math.min(room.w / (FIRST_CELLS * TILE), room.h / (FIRST_ROWS * TILE))));
      this.hud.card(null);
    }
    const least = Math.min(room.w / (v.w * TILE), room.h / (v.h * TILE));
    if (this.k < least) this.k = least;
    // (kept to the caves: never far past their edge)
    const halfW = room.w / 2 / this.k;
    const halfH = room.h / 2 / this.k;
    const maxW = v.w * TILE;
    const maxH = v.h * TILE;
    this.cx = maxW <= halfW * 2 ? maxW / 2 : Math.max(halfW, Math.min(maxW - halfW, this.cx));
    this.cy = maxH <= halfH * 2 ? maxH / 2 : Math.max(halfH, Math.min(maxH - halfH, this.cy));
    this.cover.clear().rect(0, 0, this.w, this.h).fill(0x020204);
    if (this.backed) {
      const t = this.back.texture;
      const s = Math.max(room.w / t.width, room.h / t.height);
      this.back.scale.set(s);
      this.back.position.set((room.w - t.width * s) / 2, this.top + (room.h - t.height * s) / 2);
      this.back.alpha = 0.16;
    }
    // a cave-in just now shakes the screen
    const fresh = v.marks.filter((m) => m.kind === 'cavein' && m.at > this.shookFor);
    if (fresh.length) {
      this.shookFor = Math.max(...fresh.map((m) => m.at));
      if (this.ticks(now) - this.shookFor < TICKS_PER_HOUR) this.shake = 1;
    }
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sx = this.shake ? Math.sin(now / 23) * 4 * this.shake : 0;
    const sy = this.shake ? Math.cos(now / 31) * 3 * this.shake : 0;
    this.world.scale.set(this.k);
    this.world.position.set(Math.round(room.w / 2 - this.cx * this.k + sx), Math.round(this.top + room.h / 2 - this.cy * this.k + sy));
    // what glows breathes; the fires and the magma flicker; torches burn
    for (const g of this.glows) g.sprite.alpha = g.base + (g.fast ? Math.sin(now / 90 + g.phase * 9) * 0.06 + Math.sin(now / 37 + g.phase * 3) * 0.04 : Math.sin(now / 900 + g.phase * 6) * 0.08);
    for (const t of this.torches) {
      const f = torchFrame(Math.floor(now / 110) + t.phase);
      if (f) t.sprite.texture = f;
    }
    this.drawWater(v, now);
    this.fx.clear();
    // crystals sparkle, glowmoss motes drift
    for (const s of this.sparkles) {
      const p = ((now / 1700 + s.phase / 100) % 1 + 1) % 1;
      if (s.color === 0x9affc8) this.fx.circle(s.x + Math.sin(now / 700 + s.phase) * 4, s.y - p * 14, 0.9).fill({ color: s.color, alpha: 0.7 * (1 - p) });
      else if (p < 0.12) {
        const a = 1 - p / 0.12;
        this.fx.rect(s.x - 0.5, s.y - 3 * a, 1, 6 * a).fill({ color: s.color, alpha: a });
        this.fx.rect(s.x - 3 * a, s.y - 0.5, 6 * a, 1).fill({ color: s.color, alpha: a });
      }
    }
    this.drawLife(v, now);
  }

  /** The river and the lake run and glint; the magma bubbles; a flood fills the town's cuttings. */
  private drawWater(v: UnderView, now: number): void {
    const g = this.waterFx;
    g.clear();
    for (const i of this.waterCells) {
      const x = (i % v.w) * TILE;
      const y = Math.floor(i / v.w) * TILE;
      const h = h32(i, 17);
      const p = ((now / 2600 + (h % 100) / 100) % 1 + 1) % 1;
      if (h % 2 === 0) g.rect(x + ((h >>> 3) % 10) + p * 4, y + 3 + ((h >>> 7) % 9), 4, 1).fill({ color: 0x9ac8f0, alpha: 0.35 * Math.sin(p * Math.PI) });
      if (h % 7 === 0 && p < 0.08) g.rect(x + ((h >>> 5) % 12) + 1, y + ((h >>> 9) % 12) + 1, 1, 1).fill({ color: 0xffffff, alpha: 0.9 });
    }
    for (const i of this.magmaCells) {
      const x = (i % v.w) * TILE;
      const y = Math.floor(i / v.w) * TILE;
      const h = h32(i, 19);
      const p = ((now / 1500 + (h % 100) / 100) % 1 + 1) % 1;
      if (h % 3 === 0) g.circle(x + 3 + ((h >>> 4) % 10), y + 3 + ((h >>> 8) % 10), 1 + p * 2.5).fill({ color: 0xffd060, alpha: 0.7 * (1 - p) });
    }
    if (v.flooded && v.depth === 0) {
      for (let i = 0; i < v.cells.length; i++) {
        const c = v.cells[i];
        if (c !== 'd' && c !== 'e') continue;
        const x = (i % v.w) * TILE;
        const y = Math.floor(i / v.w) * TILE;
        g.rect(x, y, TILE, TILE).fill({ color: 0x2a5a8a, alpha: 0.55 });
        const p = ((now / 1800 + (h32(i, 23) % 100) / 100) % 1 + 1) % 1;
        g.rect(x + 2 + p * 8, y + 6, 5, 1).fill({ color: 0xb8e0ff, alpha: 0.5 });
      }
    }
  }

  /* ------------------------------------------------------------ life below */

  private actor(key: string, now: number): Actor {
    let a = this.actors.get(key);
    if (!a) {
      const sprite = new Sprite();
      this.things.addChild(sprite);
      a = { sprite, seen: now, walked: 0, x: 0, y: 0 };
      this.actors.set(key, a);
    }
    a.seen = this.frame;
    return a;
  }

  /** A person below (a paper doll), walking or working, at an art px point. */
  private person(key: string, who: UnderFolk | { id: number; look: Look }, x: number, y: number, now: number, o: { activity?: string; working?: boolean; facing?: HkFacing; height?: number; tint?: number } = {}): void {
    const a = this.actor(key, now);
    const moved = Math.hypot(x - a.x, y - a.y);
    a.walked += moved;
    const facing: HkFacing = o.facing ?? (moved < 0.05 ? 'down' : Math.abs(x - a.x) > Math.abs(y - a.y) ? (x < a.x ? 'left' : 'right') : y < a.y ? 'up' : 'down');
    a.x = x;
    a.y = y;
    const w = 'gear' in who ? hkWhoById(who.id, who.look, who.gear) : hkWhoOfLook(who.id, who.look);
    const keys = hkLayers(w, { fighting: !!o.working && o.activity === 'fight', activity: o.activity ?? 'walk' });
    const [col, row] = hkPose({ facing, moving: moved > 0.05, walked: a.walked, working: !!o.working, sinceBlow: o.activity === 'fight' ? ((now / 100) % 8) : 999, sinceHit: 999, down: false, ranged: false, now: now + who.id * 137 });
    a.sprite.visible = hkSprite(a.sprite, keys, col, row, x, y, TILE * 1.35 * (o.height ?? 1));
    a.sprite.tint = o.tint ?? 0xffffff;
    a.sprite.zIndex = y;
  }

  /** A creature below (an enemy's sheet), at an art px point. */
  private creature(key: string, id: string, x: number, y: number, dir: number, now: number, o: { attack?: boolean; alpha?: number; scale?: number } = {}): void {
    const def = ENEMIES[id];
    const a = this.actor(key, now);
    a.walked += Math.hypot(x - a.x, y - a.y);
    a.x = x;
    a.y = y;
    const sp = def && 'sheet' in def.sprite ? (def.sprite as { sheet: CreatureSheet; block: number; scale: number }) : null;
    if (!sp) {
      a.sprite.visible = false;
      return;
    }
    const facing = dir < 0 ? 'left' : 'right';
    a.sprite.texture = creatureFrame(sp.sheet, sp.block, facing, Math.floor(a.walked / 4 + now / 400), !!o.attack);
    a.sprite.anchor.set(0.5, creatureFeet(sp.sheet));
    // (a creature sized for the land's 32 px cells, drawn at the caves' 16)
    const k = (sp.scale / 2) * (o.scale ?? 1);
    a.sprite.scale.set(k * creatureFlip(sp.sheet, facing), k);
    a.sprite.position.set(Math.round(x), Math.round(y));
    a.sprite.tint = def.tint ?? 0xffffff;
    a.sprite.alpha = o.alpha ?? 1;
    a.sprite.visible = true;
    a.sprite.zIndex = y;
  }

  private drawLife(v: UnderView, now: number): void {
    const tick = this.ticks(now);
    const cellXY = (i: number) => ({ x: (i % v.w) * TILE + TILE / 2, y: Math.floor(i / v.w) * TILE + TILE * 0.8 });
    const night = v.hour >= 21 || v.hour <= 4;
    // the miners at the rock face, swinging (none while the tunnels are flooded)
    if (v.depth === 0 && !v.flooded) {
      const faces = this.faces(v);
      v.workers.forEach((w, k) => {
        const face = faces.length ? faces[(k * 5 + Math.floor(tick / 3000)) % faces.length] : v.entries[0];
        const from = v.entries[k % v.entries.length] ?? face;
        const path = pathOf(v, from, face);
        // (a load dug, carried back to the shaft, and down again)
        const cyc = ((tick / 900 + k * 0.37) % 1 + 1) % 1;
        const t = cyc < 0.35 ? cyc / 0.35 : cyc < 0.75 ? 1 : 1 - (cyc - 0.75) / 0.25;
        const p = along(v, path, t);
        this.person(`w${w.id}`, w, p.x, p.y, now, { activity: 'mine', working: cyc >= 0.35 && cyc < 0.75 });
        if (cyc >= 0.35 && cyc < 0.75 && ((now + w.id * 137) % 700) / 700 > 0.55) {
          const q = ((now + w.id * 137) % 700) / 700;
          this.fx.circle(p.x + 5, p.y - 8 - q * 5, 1.5 + q * 3).fill({ color: 0xb0a898, alpha: 0.4 * (1 - q) });
        }
      });
    }
    // the under-village's folk about their houses
    if (v.village) {
      const c = cellXY(v.village.cell);
      v.village.folk.forEach((f, k) => {
        const ang = now / (5000 + k * 900) + k * 1.7;
        this.person(`v${f.id}`, f, c.x + Math.cos(ang) * (12 + k * 3), c.y + Math.sin(ang) * 6 + 4, now, { activity: 'walk' });
      });
    }
    // the cave towns: folk on patrol near home, and at feud, fighting at the border
    for (const s of v.sites) {
      if (s.kind !== 'town' || !s.people || s.stance === 'fallen') {
        if (s.stance === 'fallen') {
          // (smoke still rising from the fallen town)
          for (let k = 0; k < 3; k++) {
            const p = ((now / 3000 + k / 3) % 1 + 1) % 1;
            this.fx.circle(s.x * TILE + TILE / 2 + (k - 1) * 6 + Math.sin(now / 800 + k) * 3, s.y * TILE - p * 30, 3 + p * 6).fill({ color: 0x5a5058, alpha: 0.35 * (1 - p) });
          }
        }
        continue;
      }
      const folk = CAVE_FOLK[s.people] ?? {};
      for (let k = 0; k < 2; k++) {
        const ang = now / 6000 + k * Math.PI + s.id;
        const x = s.x * TILE + TILE / 2 + Math.cos(ang) * TILE * 2.5;
        const y = s.y * TILE + TILE * 0.8 + Math.sin(ang) * TILE * 1.2;
        if (folk.look) this.person(`p${s.id}:${k}`, { id: 9000 + s.id * 10 + k, look: folk.look }, x, y, now, { height: folk.look.height });
        else if (folk.creature) this.creature(`p${s.id}:${k}`, folk.creature, x, y, Math.cos(ang + Math.PI / 2) < 0 ? -1 : 1, now, { scale: 0.8 });
      }
      if (s.feudAt !== undefined && s.id < (v.sites.find((o) => o.at === s.feudAt)?.id ?? 0)) {
        // (the border between them: the middle of the way from one to the other)
        const foe = v.sites.find((o) => o.at === s.feudAt);
        const path = pathOf(v, s.at, s.feudAt);
        const mid = along(v, path, 0.5);
        for (const [side, site] of [[-1, s], [1, foe]] as const) {
          if (!site?.people) continue;
          const f = CAVE_FOLK[site.people] ?? {};
          for (let k = 0; k < 2; k++) {
            const x = mid.x + side * (7 + k * 4) + Math.sin(now / 160 + k * 2) * 1.5;
            const y = mid.y + (k - 0.5) * 8;
            if (f.look) this.person(`f${site.id}:${k}`, { id: 9500 + site.id * 10 + k, look: f.look }, x, y, now, { activity: 'fight', working: true, facing: side < 0 ? 'right' : 'left', height: f.look.height });
            else if (f.creature) this.creature(`f${site.id}:${k}`, f.creature, x, y, -side, now, { attack: true, scale: 0.8 });
          }
        }
        if (Math.floor(now / 180) % 3 === 0) this.fx.star(mid.x + Math.sin(now / 50) * 3, mid.y - 10, 4, 4, 1.5).fill({ color: 0xffe080, alpha: 0.9 });
      }
    }
    // the marks: trains and envoys walking up to the shaft, things that took someone, the search, a rising horde
    for (const m of v.marks) this.drawMark(v, m, tick, now);
    if (v.rising && v.entries.length) {
      // (a raid coming up the shaft: a horde streaming toward its mouth)
      const kinds = v.creatures;
      const from = farCell(v, v.entries[0]);
      const path = pathOf(v, from, v.entries[0]);
      for (let k = 0; k < 6; k++) {
        const p = along(v, path, ((now / 9000 + k / 6) % 1 + 1) % 1);
        this.creature(`r${k}`, kinds[k % kinds.length], p.x + ((k % 3) - 1) * 4, p.y, p.dir, now);
      }
    }
    // the scouts with their lamps, out at the edge of what's been seen (while there's dark left to scout)
    const edge = this.frontier(v);
    if (edge.length && v.entries.length)
      for (let k = 0; k < 2; k++) {
        const slot = Math.floor(tick / 3600 + k * 0.5);
        const to = edge[h32(slot, k + 11) % edge.length];
        const path = pathOf(v, v.entries[0], to);
        const cyc = ((tick / 3600 + k * 0.5) % 1 + 1) % 1;
        const p = along(v, path, cyc < 0.6 ? cyc / 0.6 : 1);
        this.person(`s${k}`, { id: 9700 + k, look: { gender: k ? 'f' : 'm', skin: '#e3b890', hair: 'unkempt', hairColor: '#5a4636', beard: !k, outfit: '#3a4a3a' } }, p.x, p.y, now);
        this.fx.circle(p.x + 5, p.y - 14, 1.6).fill({ color: 0xffd080, alpha: 0.95 });
        this.fx.circle(p.x + 5, p.y - 14, 9).fill({ color: 0xffb050, alpha: 0.16 });
      }
    // creatures lurking and prowling in the unlit tunnels (more at night)
    const lurkers = night ? 4 : 2;
    const roam = this.roamCells(v);
    for (let k = 0; k < lurkers && roam.length > 1; k++) {
      const slot = Math.floor(tick / 2400 + k * 0.31);
      const a = roam[h32(slot, k * 7 + v.depth) % roam.length];
      const b = roam[h32(slot, k * 7 + 3 + v.depth) % roam.length];
      const path = pathOf(v, a, b);
      const t = ((tick / 2400 + k * 0.31) % 1 + 1) % 1;
      const p = along(v, path, t);
      this.creature(`c${k}`, v.creatures[(k + slot) % v.creatures.length], p.x, p.y, p.dir, now, { alpha: 0.95 });
    }
    // (actors not drawn this frame go)
    for (const [key, a] of this.actors)
      if (a.seen !== this.frame) {
        a.sprite.destroy();
        a.extra?.destroy();
        this.actors.delete(key);
      }
  }

  /** The town's cuttings beside rock: where the miners swing (cached by the picture). */
  private faceKey = '';
  private faceList: number[] = [];
  private faces(v: UnderView): number[] {
    if (this.faceKey === this.key) return this.faceList;
    this.faceKey = this.key;
    const out: number[] = [];
    for (let i = 0; i < v.cells.length && out.length < 12; i++) if (v.cells[i] === 'd' && [i - 1, i + 1, i - v.w, i + v.w].some((j) => v.cells[j] === '#')) out.push(i);
    this.faceList = out;
    return out;
  }

  /** Seen open cells at the edge of the dark (beside the caves' outline): where the scouts are (cached by the picture). */
  private edgeKey = '';
  private edgeList: number[] = [];
  private frontier(v: UnderView): number[] {
    if (this.edgeKey === this.key) return this.edgeList;
    this.edgeKey = this.key;
    const out: number[] = [];
    for (let i = 0; i < v.cells.length; i++) if (open(v.cells[i]) && [i - 1, i + 1, i - v.w, i + v.w].some((j) => v.cells[j] === ',')) out.push(i);
    this.edgeList = out;
    return out;
  }

  /** Dark open cells away from the town's lights, for the creatures to prowl (cached by the picture). */
  private roamKey = '';
  private roamList: number[] = [];
  private roamCells(v: UnderView): number[] {
    if (this.roamKey === this.key) return this.roamList;
    this.roamKey = this.key;
    const out: number[] = [];
    const lit = (i: number) => this.lightsList.some((L) => Math.hypot((L.cell % v.w) - (i % v.w), Math.floor(L.cell / v.w) - Math.floor(i / v.w)) < 5 && L.r >= 4);
    for (let i = 0; i < v.cells.length; i++) if ((v.cells[i] === '.' || v.cells[i] === 'r') && h32(i, 31) % 3 === 0 && !lit(i)) out.push(i);
    this.roamList = out;
    return out;
  }

  private drawMark(v: UnderView, m: UnderMark, tick: number, now: number): void {
    const age = (tick - m.at) / TICKS_PER_HOUR;
    const key = `m${m.at}:${m.kind}`;
    if (m.kind === 'trade' || m.kind === 'envoy') {
      if (age > WALK_HOURS || m.to === undefined) return;
      const path = pathOf(v, m.cell, m.to);
      const folk = CAVE_FOLK[m.people ?? ''] ?? {};
      const n = m.kind === 'trade' ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const p = along(v, path, age / WALK_HOURS - k * 0.03);
        if (folk.look) this.person(`${key}:${k}`, { id: 9800 + k + (m.at % 97), look: folk.look }, p.x, p.y, now, { height: folk.look.height });
        else if (folk.creature) this.creature(`${key}:${k}`, folk.creature, p.x, p.y, p.dir, now, { scale: 0.8 });
        // (the train's packs)
        if (m.kind === 'trade') this.fx.rect(p.x - 3, p.y - 14, 6, 4).fill({ color: 0x8a6a40 });
        else this.fx.rect(p.x + 3, p.y - 20, 1, 10).fill({ color: 0xe8e0d0 }).rect(p.x + 4, p.y - 20, 5, 3).fill({ color: 0xf0f0f0 });
      }
    } else if (m.kind === 'taken') {
      // (a thing dragging someone off into the dark)
      if (age > 1.5 || m.to === undefined) return;
      const path = pathOf(v, m.cell, m.to);
      const p = along(v, path, age / 1.5);
      this.creature(key, m.foe ?? 'giant_spider', p.x, p.y, p.dir, now);
      this.fx.ellipse(p.x - p.dir * 8, p.y - 2, 6, 2.5).fill({ color: 0x6a4a3a, alpha: 0.9 });
      this.fx.rect(p.x - p.dir * 20, p.y - 1, 12, 1).fill({ color: 0x5a1010, alpha: 0.6 });
    } else if (m.kind === 'search') {
      // (the search party's torches going out after them, and coming back)
      if (age > 3) return;
      const taken = v.marks.find((o) => o.kind === 'taken' && o.at === m.at);
      const to = taken?.to ?? m.cell;
      const path = pathOf(v, m.cell, to);
      const t = age < 1.5 ? age / 1.5 : 1 - (age - 1.5) / 1.5;
      for (let k = 0; k < 3; k++) {
        const p = along(v, path, t - k * 0.04);
        this.person(`${key}:${k}`, { id: 9900 + k, look: { gender: k % 2 ? 'f' : 'm', skin: '#d6a67c', hair: 'plain', hairColor: '#4a3020', beard: k === 0, outfit: '#6a4a2a' } }, p.x, p.y, now);
        this.fx.circle(p.x + 4, p.y - 16, 2).fill({ color: 0xffc060, alpha: 0.9 });
        this.fx.circle(p.x + 4, p.y - 16, 7).fill({ color: 0xffa040, alpha: 0.18 });
      }
    } else if (m.kind === 'cavein') {
      // (dust billowing, rocks still falling)
      if (age > 0.6) return;
      const c = { x: (m.cell % v.w) * TILE + TILE / 2, y: Math.floor(m.cell / v.w) * TILE + TILE / 2 };
      const a = 1 - age / 0.6;
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * Math.PI * 2 + now / 2000;
        const r = 6 + (1 - a) * 16 + Math.sin(now / 300 + k) * 2;
        this.fx.circle(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r * 0.6, 5 + (1 - a) * 6).fill({ color: 0x9a9080, alpha: 0.45 * a });
      }
      for (let k = 0; k < 4; k++) {
        const p = ((now / 500 + k / 4) % 1 + 1) % 1;
        this.fx.rect(c.x - 8 + k * 5, c.y - 18 + p * 18, 3, 3).fill({ color: 0x5a5048, alpha: a });
      }
    } else if (m.kind === 'rise' && m.foe && ENEMIES[m.foe] && age < 1) {
      // (a dweller come up: it walks to the shaft's mouth)
      const from = farCell(v, m.cell);
      const p = along(v, pathOf(v, from, m.cell), age);
      this.creature(key, m.foe, p.x, p.y, p.dir, now, { scale: 1.5 });
    } else if (m.kind === 'lost' && age < 2) {
      const c = { x: (m.cell % v.w) * TILE + TILE / 2, y: Math.floor(m.cell / v.w) * TILE };
      this.fx.rect(c.x - 1, c.y - 30, 1, 30).fill({ color: 0xc8b890, alpha: 0.7 * (1 - age / 2) });
    }
  }
}

/** The open cell of the caves farthest along the tunnels from one (where things come from; cached by the cells). */
const fars = new Map<string, number>();
function farCell(v: UnderView, from: number): number {
  const key = `${from}|${v.cells}`;
  const had = fars.get(key);
  if (had !== undefined) return had;
  if (fars.size > 8) fars.clear();
  const out = farthest(v, from);
  fars.set(key, out);
  return out;
}
function farthest(v: UnderView, from: number): number {
  const d = new Int32Array(v.cells.length).fill(-1);
  d[from] = 0;
  const q = [from];
  let last = from;
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    last = i;
    if (d[i] > 24) break;
    const x = i % v.w;
    const y = Math.floor(i / v.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
      const j = ny * v.w + nx;
      if (d[j] >= 0 || !open(v.cells[j])) continue;
      d[j] = d[i] + 1;
      q.push(j);
    }
  }
  return last;
}

/** A hold's hallway: the town's own cells running from its foot out to the caves (for the torches along it). */
function hallPassage(v: UnderView, from: number): number[] {
  const out: number[] = [];
  const seen = new Set([from]);
  const q = [from];
  for (let k = 0; k < q.length && out.length < 40; k++) {
    const i = q[k];
    const x = i % v.w;
    const y = Math.floor(i / v.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * v.w + x + dx;
      if (x + dx < 0 || x + dx >= v.w || y + dy < 0 || y + dy >= v.h || seen.has(j) || v.cells[j] !== 'd') continue;
      seen.add(j);
      q.push(j);
      if (Math.abs((j % v.w) - (from % v.w)) + Math.abs(Math.floor(j / v.w) - Math.floor(from / v.w)) > 2) out.push(j);
    }
  }
  // (a torch every third cell along it)
  return out.filter((_, k) => k % 3 === 1).slice(0, 10);
}

/* ------------------------------------------------------------ the cards */

interface Card {
  title: string;
  lines: string[];
  trip?: boolean;
}

const KIND_WORD: Record<string, string> = {
  fungus: 'A fungus forest',
  lake: 'Black water',
  crystal: 'A crystal cavern',
  magma: 'A magma vent',
  ruins: 'Lost ruins',
  town: 'A cave town',
  hall: 'A hall of the road-builders',
  forge: 'Old forges',
  shore: 'A shore of the Sunless Sea',
  grotto: 'A grotto',
  vein: 'A vein of gold',
  hold: 'The bottom of the world',
  lair: 'A lair',
  stair: 'The way on down',
};
const STANCE_WORDS: Record<string, string> = { peace: 'At peace with the town.', friend: 'Friends of the town: they trade up the shaft.', war: 'At war with the town: their warriors come up the shaft by night.', fallen: 'Fallen. Their lamps are out.' };

function siteCard(v: UnderView, s: UnderSiteSeen): Card {
  const name = s.name.charAt(0).toUpperCase() + s.name.slice(1);
  const lines = [`${KIND_WORD[s.kind] ?? 'A place'}${v.depth > 0 ? `, in ${v.name}` : ''}.`];
  if (s.stance) lines.push(STANCE_WORDS[s.stance] ?? '');
  if (s.feudAt !== undefined) lines.push(`At feud with ${v.sites.find((o) => o.at === s.feudAt)?.name ?? 'another town'}: they fight at the border.`);
  if (s.gives) lines.push(`Gives: ${s.gives}.`);
  if (s.lives) lines.push(`Lives there: ${s.lives}.`);
  return { title: name, lines, trip: s.kind !== 'stair' && !(s.kind === 'town' && s.stance !== 'fallen') && !(s.kind === 'lair' && s.slain) };
}

function wayCard(v: UnderView, def: string): Card {
  if (def === 'hold_hallway')
    return { title: "The hold's hallway", lines: ['The hold runs on down into the rock here: a carved passage lit by torches, from the halls above straight into the caves.', v.flooded ? 'Flooded: nobody works below until it drains.' : `${v.miners} at work below.`] };
  return { title: def === 'deep_shaft' ? 'The shaft' : 'The mine', lines: ["One of the town's ways down: miners cut on from here into the rock, and what the caves give comes up it. So does what comes up at night.", v.flooded ? 'Flooded: the miners are driven out until it drains.' : `${v.miners} at work below.`] };
}

/* ------------------------------------------------------------ the bar */

const STANCE: Record<string, string> = { peace: 'at peace', friend: 'friends, trading', war: 'at war', fallen: 'fallen' };
/** The Underdark's own styles (the bar's depth buttons, the place card), apart from the shared blocks. */
const STYLE = `
#under-hud .uh-depths { display: flex; gap: 4px; }
#under-hud .uh-card { position: absolute; left: 10px; right: 10px; top: 58px; max-width: 360px; margin: 0 auto; padding: 10px 12px 8px; box-sizing: border-box; background: rgba(18,14,18,0.94); border: 2px solid #6a5440; border-radius: 8px; pointer-events: auto; box-shadow: 0 4px 14px rgba(0,0,0,0.6); }
#under-hud .uh-card[hidden] { display: none; }
#under-hud .uh-card h3 { margin: 0 24px 4px 0; font: 700 15px var(--font-display, serif); color: #ffd890; }
#under-hud .uh-card p { margin: 0 0 3px; font-size: 13px; color: #e8dcc8; }
#under-hud .uh-card .uh-x { position: absolute; right: 6px; top: 6px; min-width: 28px; height: 28px; }
#under-hud .uh-card .uh-go { margin-top: 6px; width: 100%; height: 34px; }
#under-hud .uh-tally { font-size: 12px; color: #c8b898; margin-bottom: 3px; }
#under-hud .dh-info { overflow-y: auto; }
@media (orientation: landscape) and (max-height: 500px) {
  #under-hud .uh-card { right: 262px; left: 10px; }
}
`;

class UnderHud {
  private readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly info: HTMLElement;
  private readonly up: HTMLButtonElement;
  private readonly down: HTMLButtonElement;
  private readonly cardEl: HTMLElement;
  private last = '';
  private depth = 0;
  private depths: number[] = [0];

  constructor(send: (c: Command) => void, openPanel: (id: PanelId) => void) {
    if (!document.getElementById('under-style')) {
      const st = document.createElement('style');
      st.id = 'under-style';
      st.textContent = STYLE;
      document.head.append(st);
    }
    this.el = document.createElement('div');
    this.el.id = 'under-hud';
    this.el.innerHTML =
      '<div class="dh-top"><div class="uh-depths"><button class="uh-up" title="Up a depth">▲</button><button class="uh-down" title="Down a depth">▼</button></div><div class="dh-title">The Underdark</div><button class="dh-close" title="Back up to the town">✕</button></div><div class="uh-card" hidden><button class="uh-x">✕</button><h3></h3><div class="uh-lines"></div><button class="uh-go">Trips below…</button></div><div class="dh-info"></div>';
    this.el.hidden = true;
    document.body.append(this.el);
    this.title = this.el.querySelector('.dh-title')!;
    this.info = this.el.querySelector('.dh-info')!;
    this.up = this.el.querySelector('.uh-up')!;
    this.down = this.el.querySelector('.uh-down')!;
    this.cardEl = this.el.querySelector('.uh-card')!;
    this.el.querySelector('.dh-close')!.addEventListener('click', () => send({ type: 'watchUnder', on: false }));
    this.el.querySelector('.uh-x')!.addEventListener('click', () => this.card(null));
    this.el.querySelector('.uh-go')!.addEventListener('click', () => {
      this.card(null);
      openPanel('expeditions');
    });
    const go = (dir: number) => {
      const k = this.depths.indexOf(this.depth) + dir;
      if (k >= 0 && k < this.depths.length) send({ type: 'watchUnder', on: true, depth: this.depths[k] });
    };
    this.up.addEventListener('click', () => go(-1));
    this.down.addEventListener('click', () => go(1));
  }

  card(c: Card | null): void {
    this.cardEl.hidden = !c;
    if (!c) return;
    this.cardEl.querySelector('h3')!.textContent = c.title;
    const box = this.cardEl.querySelector('.uh-lines')!;
    box.innerHTML = '';
    for (const l of c.lines) {
      const p = document.createElement('p');
      p.textContent = l;
      box.append(p);
    }
    (this.cardEl.querySelector('.uh-go') as HTMLElement).hidden = !c.trip;
  }

  show(v: UnderView | null, snap: Snapshot | null): void {
    this.el.hidden = !v;
    document.body.classList.toggle('under-on', !!v);
    if (!v) return;
    const u = snap?.underdark;
    this.depth = v.depth;
    this.depths = v.depths.map((d) => d.n);
    const key = `${v.depth}|${v.depths.length}|${v.miners}|${v.through}|${v.flooded}|${v.sites.length}|${v.finds.join('|')}|${JSON.stringify(u?.towns ?? [])}|${JSON.stringify(u?.tally ?? {})}|${u?.seeking ?? ''}|${u?.searching ?? ''}|${JSON.stringify(u?.depths.map((d) => [d.scouted, d.slain]) ?? [])}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = v.depth ? v.name.replace(/^the /, 'The ') : 'The Underdark';
    this.up.disabled = this.depths.indexOf(v.depth) <= 0;
    this.down.disabled = this.depths.indexOf(v.depth) >= this.depths.length - 1;
    this.up.hidden = this.down.hidden = this.depths.length < 2;
    this.info.innerHTML = '';
    const row = (label: string, text: string) => {
      const d = document.createElement('div');
      d.className = 'dh-row';
      const b = document.createElement('b');
      b.textContent = label;
      d.append(b, document.createTextNode(text));
      this.info.append(d);
    };
    if (v.depth > 0) {
      const d = u?.depths.find((x) => x.n === v.depth);
      if (d) {
        row('Scouted ', `${d.scouted}%`);
        row(d.slain ? 'Slain: ' : 'Its dweller: ', d.slain ? d.dweller : `${d.dweller}, ${d.n === this.depths[this.depths.length - 1] && d.n >= 3 ? 'asleep on its hoard' : 'guarding the way on down'}`);
        row('Found ', d.found.length ? d.found.map((f) => f.name).join(', ') : 'nothing yet');
      }
    } else {
      row('Diggers ', v.flooded ? 'none: the tunnels are flooded, the miners driven out' : v.miners ? `${v.miners} at work` : 'none below now');
      row('Below ', v.through ? `${v.sites.length} place${v.sites.length === 1 ? '' : 's'} found` : 'still cutting through the rock to the caves');
      if (u?.seeking !== null && u?.seeking !== undefined) row('The stair ', u.seeking > 0 ? `the scouts are searching the ruins for a way down (${u.seeking} h)` : 'under the ruins: a bigger town would send scouts down it');
      if (u?.searching) row('Searching ', `for ${u.searching}, with torches`);
      if (u?.towns.length) row('Cave towns ', u.towns.map((t) => `${t.name.replace(/^the /, '')} (${STANCE[t.stance] ?? t.stance}${t.feud ? `, at feud with ${t.feud.replace(/^the /, '')}` : ''})`).join('; '));
    }
    if (u?.tally) {
      const t = u.tally;
      const d = document.createElement('div');
      d.className = 'uh-tally';
      d.textContent = `Up the shaft so far: ${t.goods} goods, ${t.coins} coins, ${t.trades} trade${t.trades === 1 ? '' : 's'}. Lost below: ${t.deaths}.`;
      this.info.append(d);
    }
    for (const f of v.finds.slice(-2).reverse()) {
      const d = document.createElement('div');
      d.className = 'dh-find';
      d.textContent = f;
      this.info.append(d);
    }
  }
}
