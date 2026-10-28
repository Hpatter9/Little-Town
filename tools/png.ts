// A small PNG reader for the tools (no packages): 8-bit paletted and 8-bit RGBA, the two kinds art/iso/ holds. Gives
// the alpha of each pixel, which is all the grid audit (tools/grid-audit.ts) needs.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface Png {
  w: number;
  h: number;
  /** Alpha 0..255, row by row. */
  alpha: Uint8Array;
}

export function readPng(path: string): Png {
  const buf = readFileSync(path);
  let p = 8;
  let w = 0, h = 0, depth = 0, kind = 0;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      kind = data[9];
      if (data[12]) throw new Error(`${path}: interlaced PNGs aren't read`);
    } else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += len + 12;
  }
  if (depth !== 8 || (kind !== 3 && kind !== 6 && kind !== 2)) throw new Error(`${path}: a ${depth}-bit PNG of kind ${kind} isn't read`);
  const bpp = kind === 6 ? 4 : kind === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  // (each row's filter undone against the row above)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = out.subarray(y * stride, (y + 1) * stride);
    const up = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = up ? up[i] : 0;
      const c = up && i >= bpp ? up[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[i] = v & 255;
    }
  }
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = kind === 6 ? out[i * 4 + 3] : kind === 2 ? 255 : trns && out[i] < trns.length ? trns[out[i]] : 255;
  return { w, h, alpha };
}
