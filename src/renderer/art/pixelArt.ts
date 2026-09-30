// Paints small pixel-art sprites onto canvases and turns them into Pixi textures.
// These are placeholders until the LPC tilesets are wired in; the rest of the renderer only sees PixelArt.

import { Texture } from 'pixi.js';

export interface PixelArt {
  texture: Texture;
  width: number;
  height: number;
  /** For each column, the first opaque row from the top (height if the column is empty). Used for hit-testing. */
  tops: Int16Array;
}

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
  ctx.drawImage(tex.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, c.width, c.height);
  return c;
}

export class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
    private readonly tone: Tone,
  ) {}

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
function grain(img: ImageData, strength: number): void {
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
      const f = 1 + strength * (GRAIN.fine * 2 * h(x, y, 1) + GRAIN.clump * (h(x >> 1, y >> 1, 2) + h(Math.floor(x / 3), Math.floor(y / 3), 3)));
      data[i] = Math.max(0, Math.min(255, data[i] * f));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * f));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * f));
    }
  }
}

/** Paint a sprite (with a surface grain over it: `grainAmount` 0 for none, as for crisp icons and flat UI shapes). */
export function paint(width: number, height: number, tone: Tone, draw: (p: Painter) => void, grainAmount = 1): PixelArt {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  draw(new Painter(ctx, width, height, tone));
  if (grainAmount > 0 && width > 0 && height > 0) {
    const img = ctx.getImageData(0, 0, width, height);
    grain(img, grainAmount);
    ctx.putImageData(img, 0, 0);
  }

  const data = ctx.getImageData(0, 0, width, height).data;
  const tops = new Int16Array(width).fill(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        tops[x] = y;
        break;
      }
    }
  }
  return { texture: Texture.from(canvas), width, height, tops };
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
