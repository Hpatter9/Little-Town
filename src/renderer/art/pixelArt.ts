// Paints small pixel-art sprites onto canvases and turns them into Pixi textures.
// These are placeholders until the LPC tilesets are wired in; the rest of the renderer only sees PixelArt.

import { CanvasSource, Texture } from 'pixi.js';

export interface PixelArt {
  texture: Texture;
  width: number;
  height: number;
  /** For each column, the first opaque row from the top (height if the column is empty). Used for hit-testing. */
  tops: Int16Array;
  /** Where it gives light at night (windows, candles, fires: art pixels from its top left), how big, and its colour. */
  lights?: Light[];
  /** Frames of glints over its water, to play over it. */
  shimmer?: Texture[];
}

export interface Light {
  x: number;
  y: number;
  /** Radius of the glow, in art pixels. */
  r: number;
  color: number;
}

/** Colours that give light at night (a window's glow, a candle, flame): painted art with these lights up after dark.
 *  Art modules add their own (registerLamps). */
const LAMPS = new Set<number>(['#f0d890', '#ffd87a', '#f0d080', '#ffd96e', '#ffb347', '#f29434'].map((h) => parseInt(h.slice(1), 16)));
export function registerLamps(...hex: string[]): void {
  for (const h of hex) LAMPS.add(parseInt(h.slice(1), 16));
}
/** Colours of water, which glints. */
const WATER = new Set<number>(['#4382b8', '#86b9e0', '#7ea6c4', '#dcebf6'].map((h) => parseInt(h.slice(1), 16)));

/** Colour transform applied to every colour a painter uses (e.g. haze for the background layer). */
export type Tone = (hex: string) => string;
export const noTone: Tone = (hex) => hex;

/** A texture drawn onto a plain canvas (for the page, outside Pixi), scaled up by whole pixels to fit a box. */
export function textureCanvas(tex: Texture, boxW: number, boxH: number): HTMLCanvasElement {
  const f = tex.frame;
  const scale = Math.max(1, Math.floor(Math.min(boxW / f.width, boxH / f.height)));
  const c = document.createElement('canvas');
  c.width = Math.round(f.width * scale);
  c.height = Math.round(f.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const r = tex.source.resolution; // (the frame is in points; the canvas behind it may be finer)
  ctx.drawImage(tex.source.resource as CanvasImageSource, f.x * r, f.y * r, f.width * r, f.height * r, 0, 0, c.width, c.height);
  return c;
}

/** Painted sprites are drawn on a grid this much finer than the art's own pixels (the textures carry it as their
 *  resolution, so they're the same size on screen): the usual drawing still fills whole art pixels, and the `f`
 *  methods (frect, fpx, fline) draw the fine detail between them. */
export const FINE = 2;

export class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
    private readonly tone: Tone,
    /** Canvas pixels per art pixel. */
    readonly k = 1,
  ) {
    this.reset();
  }

  /** Back to the plain art grid (undoes a translate). */
  reset(): void {
    this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  /** A rectangle on the fine grid (coordinates in art pixels, rounded to the nearest fine pixel). */
  frect(x: number, y: number, w: number, h: number, color: string): void {
    const q = (v: number) => Math.round(v * this.k) / this.k;
    this.ctx.fillStyle = this.tone(color);
    this.ctx.fillRect(q(x), q(y), Math.max(1 / this.k, q(w)), Math.max(1 / this.k, q(h)));
  }

  /** One fine pixel (a half art pixel). */
  fpx(x: number, y: number, color: string): void {
    this.frect(x, y, 1 / this.k, 1 / this.k, color);
  }

  /** A line one fine pixel thick, from one point to another (art pixel coordinates). */
  fline(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * this.k));
    for (let i = 0; i <= n; i++) this.fpx(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color);
  }

  /** The canvas's own pixels for an area given in art pixels (for reading back what's drawn). */
  pixels(x = 0, y = 0, w = this.width, h = this.height): ImageData {
    return this.ctx.getImageData(Math.round(x * this.k), Math.round(y * this.k), Math.round(w * this.k), Math.round(h * this.k));
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = this.tone(color);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** A colour as this painter would paint it (through its tone). */
  toned(color: string): string {
    return this.tone(color);
  }

  px(x: number, y: number, color: string): void {
    this.rect(x, y, 1, 1, color);
  }

  /** Filled pixel ellipse built from horizontal spans. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    this.ctx.fillStyle = this.tone(color);
    const r = Math.max(1, Math.round(ry));
    for (let dy = -r; dy <= r; dy++) {
      const t = dy / (ry + 0.5);
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      if (half <= 0) continue;
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
    }
  }

  disc(cx: number, cy: number, r: number, color: string): void {
    this.ellipse(cx, cy, r, r, color);
  }
}

/** How strong the surface grain is (a share of brightness, up or down), fine and in clumps. */
export const GRAIN = { fine: 0.055, clump: 0.075 };
let grainSeed = 1;

/** Surface texture over everything painted: each opaque pixel a touch lighter or darker, by fine per-pixel noise and
 *  coarser clumps (2x2 and 3x3 cells), so flat fills read as wood, stone, thatch, earth and leaves, not plastic. The
 *  seed differs per canvas, so tiles side by side don't repeat the same pattern. */
function grain(img: ImageData, strength: number, k = 1): void {
  const { data, width, height } = img;
  const seed = (grainSeed = (grainSeed * 1103515245 + 12345) >>> 0);
  const h = (x: number, y: number, k: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 2246822519 + k * 3266489917) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) & 1023) / 1023 - 0.5;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      // (fine noise on every canvas pixel; clumps two and three art pixels across)
      const f = 1 + strength * (GRAIN.fine * 2 * h(x, y, 1) + GRAIN.clump * (h(Math.floor(x / (2 * k)), Math.floor(y / (2 * k)), 2) + h(Math.floor(x / (3 * k)), Math.floor(y / (3 * k)), 3)));
      data[i] = Math.max(0, Math.min(255, data[i] * f));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * f));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * f));
    }
  }
}

/* ------------------------------------------------------------ fine detail */

/** What a colour is most likely made of, from its hue, saturation and lightness (the palette's woods, thatch, stone,
 *  leaves and brick, through any tone or season). */
type Stuff = 'wood' | 'straw' | 'stone' | 'leaf' | 'brick' | 'plain';
const stuffCache = new Map<number, Stuff>();
function stuffOf(c: number): Stuff {
  let s = stuffCache.get(c);
  if (s) return s;
  const r = ((c >>> 16) & 255) / 255;
  const g = ((c >>> 8) & 255) / 255;
  const b = (c & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d) hue = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (hue < 0) hue += 360;
  if (sat < 0.14) s = l > 0.12 && l < 0.85 ? 'stone' : 'plain';
  else if (hue >= 70 && hue < 170) s = 'leaf';
  else if (hue < 20 || hue >= 340) s = sat > 0.35 && l > 0.25 ? 'brick' : 'wood';
  else if (hue < 52) s = l > 0.5 ? 'straw' : 'wood';
  else s = 'plain';
  stuffCache.set(c, s);
  return s;
}

/**
 * The fine grid's own detail, over everything painted (each art pixel is k x k canvas pixels): rounded corners where
 * a shape steps (Scale2x: the stair-steps of roofs, trees and stones become finer), light along the tops and left
 * edges of shapes and shade along their bottoms and right edges (the light is from the upper left), a crisp dark crease
 * where a lighter surface meets a darker one, and a texture for what it's made of: wood grain along the run of a plank
 * or log, straw strands in thatch, pits and cracks in stone, leaf glints, mottled brick. Art drawn on the fine grid
 * already (the `f` methods) is left as drawn.
 */
/** How the fine detail treats a painting: `tile`, a piece of a continuous strip (the ground), whose left and right
 *  edges carry on into the next tile rather than ending; `stuff: false`, no material texture (the ground draws its
 *  own). */
export interface DetailOpts {
  tile?: boolean;
  stuff?: boolean;
}

function detail(img: ImageData, k: number, seed: number, opts: DetailOpts = {}): void {
  const { data, width: W } = img;
  const aw = Math.floor(img.width / k);
  const ah = Math.floor(img.height / k);
  // the art's own pixels: their colour (0: clear), or -1 where finer detail is drawn
  const art = new Int32Array(aw * ah);
  for (let ay = 0; ay < ah; ay++) {
    for (let ax = 0; ax < aw; ax++) {
      const i0 = (ay * k * W + ax * k) * 4;
      let c = data[i0 + 3] < 128 ? 0 : ((data[i0] << 16) | (data[i0 + 1] << 8) | data[i0 + 2]) | 0x1000000;
      for (let dy = 0; dy < k && c !== -1; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const i = ((ay * k + dy) * W + ax * k + dx) * 4;
          if ((data[i + 3] < 128) !== (data[i0 + 3] < 128) || (data[i + 3] >= 128 && (data[i] !== data[i0] || data[i + 1] !== data[i0 + 1] || data[i + 2] !== data[i0 + 2]))) {
            c = -1;
            break;
          }
        }
      }
      art[ay * aw + ax] = c;
    }
  }
  const at = (x: number, y: number) => (y < 0 || y >= ah ? 0 : opts.tile && (x < 0 || x >= aw) ? art[y * aw + Math.max(0, Math.min(aw - 1, x))] : x < 0 || x >= aw ? 0 : art[y * aw + x]);
  const set = (x: number, y: number, c: number) => {
    const i = (y * W + x) * 4;
    if (c === 0) data[i + 3] = 0;
    else {
      data[i] = (c >>> 16) & 255;
      data[i + 1] = (c >>> 8) & 255;
      data[i + 2] = c & 255;
      data[i + 3] = 255;
    }
  };
  const scale = (x: number, y: number, f: number) => {
    const i = (y * W + x) * 4;
    if (data[i + 3] < 128) return;
    data[i] = Math.max(0, Math.min(255, data[i] * f));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * f));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * f));
  };
  const lum = (c: number) => (c <= 0 ? 0 : (((c >>> 16) & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + (c & 255) * 0.11) / 255);
  const hash = (x: number, y: number, n: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519 + n * 3266489917) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) & 1023) / 1023;
  };
  const h2 = k >> 1; // (the fine pixels on each side of a block's middle)
  for (let ay = 0; ay < ah; ay++) {
    for (let ax = 0; ax < aw; ax++) {
      const P = at(ax, ay);
      if (P === -1) continue;
      const A = at(ax, ay - 1);
      const B = at(ax + 1, ay);
      const C = at(ax - 1, ay);
      const D = at(ax, ay + 1);
      const x0 = ax * k;
      const y0 = ay * k;
      // rounded steps (only between plain art pixels, and never eating into a shape's only pixel)
      if (A !== -1 && B !== -1 && C !== -1 && D !== -1 && k === 2) {
        const e0 = C === A && C !== D && A !== B ? A : P;
        const e1 = A === B && A !== C && B !== D ? B : P;
        const e2 = D === C && D !== B && C !== A ? C : P;
        const e3 = B === D && B !== A && D !== C ? D : P;
        const kept = [e0, e1, e2, e3].filter((e) => e === P).length;
        if (P === 0 || kept >= 2) {
          if (e0 !== P) set(x0, y0, e0);
          if (e1 !== P) set(x0 + 1, y0, e1);
          if (e2 !== P) set(x0, y0 + 1, e2);
          if (e3 !== P) set(x0 + 1, y0 + 1, e3);
        }
      }
      if (P === 0) continue;
      // light and shade on the edges of shapes
      for (let i = 0; i < k; i++) {
        if (A === 0) scale(x0 + i, y0, 1.16);
        if (C === 0) scale(x0, y0 + i, 1.08);
        if (D === 0) scale(x0 + i, y0 + k - 1, 0.82);
        if (B === 0) scale(x0 + k - 1, y0 + i, 0.88);
      }
      // a crease where this lighter surface meets a darker one below or to the right (on the darker side)
      const lp = lum(P);
      if (D > 0 && lum(D) < lp - 0.12) for (let i = 0; i < k; i++) scale(x0 + i, y0 + k, 0.8);
      if (B > 0 && lum(B) < lp - 0.12) for (let i = 0; i < k; i++) scale(x0 + k, y0 + i, 0.86);
      // what it's made of
      if (opts.stuff === false) continue;
      const stuff = stuffOf(P & 0xffffff);
      const vertical = (A === P || D === P) && C !== P && B !== P;
      const r = hash(ax, ay, 7);
      if (stuff === 'wood') {
        // grain along the run: a darker fine streak, broken now and then, and a rare knot
        if (vertical) {
          if (hash(ax, 0, 3) < 0.5) for (let i = 0; i < k; i++) if (hash(ax, ay * k + i, 4) > 0.2) scale(x0 + h2, y0 + i, 0.86);
        } else if (hash(0, ay, 3) < 0.5) for (let i = 0; i < k; i++) if (hash(ax * k + i, ay, 4) > 0.2) scale(x0 + i, y0 + h2, 0.86);
        if (r > 0.985) scale(x0, y0, 0.7);
      } else if (stuff === 'straw') {
        // strands on the slant: light and dark fine pixels in diagonal rows
        for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) if (((x0 + dx + y0 + dy) & 3) === 0) scale(x0 + dx, y0 + dy, hash(ax + dx, ay + dy, 5) > 0.5 ? 1.12 : 0.88);
      } else if (stuff === 'stone') {
        // pits, and a glint on the odd stone
        if (r < 0.18) scale(x0 + (r < 0.09 ? 0 : 1), y0 + 1, 0.82);
        else if (r > 0.9) scale(x0 + 1, y0, 1.14);
      } else if (stuff === 'leaf') {
        // glints on the upper left of a clump, shade on the lower right
        if (r < 0.22) scale(x0, y0, 1.18);
        else if (r > 0.8) scale(x0 + 1, y0 + 1, 0.8);
      } else if (stuff === 'brick') {
        if (r < 0.3) scale(x0 + (r < 0.15 ? 1 : 0), y0 + (r < 0.08 ? 1 : 0), r < 0.15 ? 1.1 : 0.9);
      }
    }
  }
}

/** Paint a sprite (with a surface grain over it: `grainAmount` 0 for none, as for crisp icons and flat UI shapes). */
export function paint(width: number, height: number, tone: Tone, draw: (p: Painter) => void, grainAmount = 1, opts: DetailOpts = {}): PixelArt {
  const k = FINE;
  const canvas = document.createElement('canvas');
  canvas.width = width * k;
  canvas.height = height * k;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  draw(new Painter(ctx, width, height, tone, k));
  const W = canvas.width;
  const H = canvas.height;
  const found = W > 0 && H > 0 ? findLights(ctx.getImageData(0, 0, W, H), k, tone) : { lights: [], water: [] };
  if (grainAmount > 0 && W > 0 && H > 0) {
    const img = ctx.getImageData(0, 0, W, H);
    detail(img, k, grainSeed, opts);
    grain(img, grainAmount, k);
    ctx.putImageData(img, 0, 0);
  }

  // (the first opaque row in each column of art pixels, for hit-testing)
  const data = W > 0 && H > 0 ? ctx.getImageData(0, 0, W, H).data : new Uint8ClampedArray(0);
  const tops = new Int16Array(width).fill(height);
  for (let x = 0; x < width; x++) {
    scan: for (let y = 0; y < H; y++) {
      for (let dx = 0; dx < k; dx++) {
        if (data[(y * W + x * k + dx) * 4 + 3] > 40) {
          tops[x] = Math.floor(y / k);
          break scan;
        }
      }
    }
  }
  const art: PixelArt = { texture: new Texture({ source: new CanvasSource({ resource: canvas, resolution: k }) }), width, height, tops };
  if (found.lights.length) art.lights = found.lights;
  if (found.water.length > 6) art.shimmer = shimmerFrames(width, height, found.water, k);
  return art;
}

/** The lamps (clumps of light-giving colour) and the water in a painting, by its art pixels. */
function findLights(img: ImageData, k: number, tone: Tone): { lights: Light[]; water: [number, number][] } {
  const { data, width: W } = img;
  const aw = Math.floor(img.width / k);
  const ah = Math.floor(img.height / k);
  const toned = (set: Set<number>) => new Set([...set].map((c) => parseInt(tone('#' + c.toString(16).padStart(6, '0')).slice(1), 16)));
  const lamps = tone === noTone ? LAMPS : toned(LAMPS);
  const wet = tone === noTone ? WATER : toned(WATER);
  const lit = new Int32Array(aw * ah).fill(-1);
  const water: [number, number][] = [];
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      const i = (y * k * W + x * k) * 4;
      if (data[i + 3] < 200) continue;
      const c = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      if (lamps.has(c)) lit[y * aw + x] = c;
      else if (wet.has(c)) water.push([x, y]);
    }
  // clumps of lit pixels, each one light
  const lights: Light[] = [];
  const seen = new Uint8Array(aw * ah);
  for (let s = 0; s < lit.length; s++) {
    if (lit[s] < 0 || seen[s]) continue;
    let n = 0;
    let sx = 0;
    let sy = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % aw;
      const y = (q - x) / aw;
      n++;
      sx += x;
      sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const j = ny * aw + nx;
        if (nx < 0 || ny < 0 || nx >= aw || ny >= ah || seen[j] || lit[j] < 0) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (n < 2) continue;
    lights.push({ x: sx / n + 0.5, y: sy / n + 0.5, r: Math.min(26, 5 + Math.sqrt(n) * 2.2), color: lit[s] });
  }
  return { lights, water };
}

/** Three frames of glints over water: a few fine bright pixels, different each frame. */
function shimmerFrames(width: number, height: number, water: [number, number][], k: number): Texture[] {
  const out: Texture[] = [];
  for (let f = 0; f < 3; f++) {
    const c = document.createElement('canvas');
    c.width = width * k;
    c.height = height * k;
    const g = c.getContext('2d')!;
    for (let i = 0; i < water.length; i++) {
      const [x, y] = water[i];
      const r = ((x * 73856093) ^ (y * 19349663) ^ (f * 83492791)) >>> 0;
      if (r % 23 !== 0) continue;
      g.fillStyle = r % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(220,240,255,0.6)';
      g.fillRect(x * k + (r % k), y * k, r % 3 ? 2 : 1, 1); // (a fine dash of light)
    }
    out.push(new Texture({ source: new CanvasSource({ resource: c, resolution: k }) }));
  }
  return out;
}

/* ------------------------------------------------------------ colour helpers */

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + ((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0');
}

export function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** Background haze: pull colours toward a pale sky blue so the back layer reads as distant. */
export function haze(amount: number): Tone {
  const cache = new Map<string, string>();
  return (hex) => {
    let out = cache.get(hex);
    if (!out) {
      out = mixHex(hex, '#b9cfd6', amount);
      cache.set(hex, out);
    }
    return out;
  };
}
