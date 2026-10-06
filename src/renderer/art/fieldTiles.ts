// The Fields tileset (Craftpix, top-down tower defence) on the town map: its tilled soil under the plots and pens
// (whole tiles inside a plot, grass-edged ones round its border, mirrored where the sheet has no right-hand or
// north-east piece), its rail fences round the pens, and its campfire (the flames, six frames) for the town's own.
// Until the images load, the painted plots and campfire stand.

import { CanvasSource, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import { loadImage } from './loadImage';
import { FINE, type PixelArt } from './pixelArt';
import fence7 from './fields/fence7.png';
import soil01 from './fields/soil01.png';
import soil05 from './fields/soil05.png';
import soil07 from './fields/soil07.png';
import soil11 from './fields/soil11.png';
import soil14 from './fields/soil14.png';
import soil18 from './fields/soil18.png';
import soil20 from './fields/soil20.png';
import soil27 from './fields/soil27.png';
import soil33 from './fields/soil33.png';
import soil37 from './fields/soil37.png';
import soil45 from './fields/soil45.png';
import soil59 from './fields/soil59.png';
import soil34 from './fields/soil34.png';
import soil35 from './fields/soil35.png';
import soil36 from './fields/soil36.png';
import soil55 from './fields/soil55.png';
import soil02 from './fields/soil02.png';
import soil03 from './fields/soil03.png';
import soil04 from './fields/soil04.png';
import soil52 from './fields/soil52.png';
import soil13 from './fields/soil13.png';
import soil21 from './fields/soil21.png';
import soil29 from './fields/soil29.png';
import soil54 from './fields/soil54.png';
import soil10 from './fields/soil10.png';
import soil22 from './fields/soil22.png';
import soil26 from './fields/soil26.png';
import soil09 from './fields/soil09.png';
import soil17 from './fields/soil17.png';
import soil24 from './fields/soil24.png';
import soil25 from './fields/soil25.png';
import fence1 from './fields/fence1.png';
import fence2 from './fields/fence2.png';
import fence3 from './fields/fence3.png';
import fence4 from './fields/fence4.png';
import fence9 from './fields/fence9.png';
import fence10 from './fields/fence10.png';
import campfire from './fields/campfire.png';

/** The soil tiles by what they have grass on: none, the top, the bottom, the left (mirrored for the right), the
 *  top-left corner (mirrored for the top-right), the bottom-left, the bottom-right (mirrored for the bottom-left). */
const SOIL = {
  full: [soil01, soil05, soil07, soil11, soil14, soil18, soil20, soil27, soil33, soil37, soil45, soil59],
  top: [soil34, soil35, soil36, soil55],
  bottom: [soil02, soil03, soil04, soil52],
  left: [soil13, soil21, soil29, soil54],
  nw: [soil10],
  sw: [soil22, soil26],
  se: [soil09, soil17, soil24, soil25],
};
/** Fence rails (a cell wide each) and posts. */
const RAILS = [fence1, fence2, fence3, fence4];
const POSTS = [fence9, fence10];

const ALL = [...Object.values(SOIL).flat(), ...RAILS, ...POSTS, fence7, campfire];
const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadFieldTiles(): Promise<void> {
  if (!loading)
    loading = Promise.all(ALL.map((u) => loadImage(u).then((im) => images.set(u, im), () => undefined))).then(() => {
      for (const cb of listeners) cb();
    });
  return loading;
}
/** Called once the images are in (the map draws its plots again). */
export function onFieldTiles(cb: () => void): void {
  listeners.add(cb);
}
export const fieldTilesReady = () => images.size === ALL.length;

const pick = <T>(list: T[], h: number) => list[Math.abs(h) % list.length];
const hashOf = (a: number, b: number, c: number) => (Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263) ^ Math.imul(c + 1, 1274126177)) >>> 0;

/** Lay the soil over a plot `w` by `h` cells on a canvas scaled `k` (the fine grid), grass showing round its edge. */
export function drawSoil(g: CanvasRenderingContext2D, w: number, h: number, seed: number, k = FINE): void {
  const S = CELL * k;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hh = hashOf(seed, x, y);
      const top = y === 0;
      const bottom = y === h - 1;
      const left = x === 0;
      const right = x === w - 1;
      let url: string;
      let flip = false;
      if (top && left) url = pick(SOIL.nw, hh);
      else if (top && right) {
        url = pick(SOIL.nw, hh);
        flip = true;
      } else if (bottom && left) url = pick(SOIL.sw, hh);
      else if (bottom && right) url = pick(SOIL.se, hh);
      else if (top) url = pick(SOIL.top, hh);
      else if (bottom) url = pick(SOIL.bottom, hh);
      else if (left) url = pick(SOIL.left, hh);
      else if (right) {
        url = pick(SOIL.left, hh);
        flip = true;
      } else url = pick(SOIL.full, hh);
      const im = images.get(url);
      if (!im) continue;
      if (flip) {
        g.save();
        g.translate((x + 1) * S, y * S);
        g.scale(-1, 1);
        g.drawImage(im, 0, 0, S, S);
        g.restore();
      } else g.drawImage(im, x * S, y * S, S, S);
    }
}

/** A rail fence round a pen `w` by `h` cells, with a gap for the gate in the middle of the front, on a canvas scaled `k`. */
export function drawFence(g: CanvasRenderingContext2D, w: number, h: number, seed: number, k = FINE): void {
  const S = CELL * k;
  const draw = (url: string, x: number, y: number, width?: number) => {
    const im = images.get(url);
    if (im) g.drawImage(im, x, y, width ?? im.naturalWidth * k, im.naturalHeight * k);
  };
  const W = w * S;
  const H = h * S;
  const side = images.get(fence7);
  const sideH = side ? side.naturalHeight * k : 31 * k;
  // the sides first (the pack's rail seen end on, one a cell), then the back rail along the top and the front along the
  // bottom with a gap for the gate, then a post at each corner
  for (let y = 4 * k; y < H - 14 * k; y += sideH - k) {
    draw(fence7, 0, y);
    draw(fence7, W - 7 * k, y);
  }
  // (each rail stretched to its cell, so the run has no gaps between them; the plain rails along the back and front)
  const rail = (i: number) => (hashOf(seed, i, 7) % 2 ? RAILS[0] : RAILS[2]);
  for (let x = 0; x < w; x++) draw(rail(x), x * S, 0, S);
  const gate = Math.floor(w / 2);
  for (let x = 0; x < w; x++) if (x !== gate) draw(rail(100 + x), x * S, H - 16 * k, S);
}

let fire: PixelArt[] | null = null;
/** The pack's campfire, a frame at a time (null until loaded). */
export function campfirePack(): PixelArt[] | null {
  if (fire) return fire;
  const im = images.get(campfire);
  if (!im) return null;
  const n = 6;
  const fw = im.naturalWidth / n;
  const fh = im.naturalHeight;
  fire = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas');
    c.width = fw * FINE;
    c.height = fh * FINE;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, i * fw, 0, fw, fh, 0, 0, c.width, c.height);
    const tops = new Int16Array(fw).fill(Math.round(fh * 0.4));
    fire.push({ texture: new Texture({ source: new CanvasSource({ resource: c, resolution: FINE }) }), width: fw, height: fh, tops });
  }
  return fire;
}
