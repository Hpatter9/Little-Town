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

export function paint(width: number, height: number, tone: Tone, draw: (p: Painter) => void): PixelArt {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  draw(new Painter(ctx, width, height, tone));

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
