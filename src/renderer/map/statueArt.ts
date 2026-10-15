// A statue's picture on the map (sim/statues.ts): the one it stands for as the map dresses them (art/hkFolk.ts: their
// look, their calling's clothes and the gear they died in, the weapon raised if they had one), carved in stone (greyed,
// stepped into a few shades of the plinth's cool grey, lit on the left and top edges and shaded on the right and
// bottom), standing on a plinth from the 2D Top-Down Dungeon pack (its pale slab and dark brick face, cut together:
// art/memorial/plinth.png). Until their layers and the plinth have loaded, the Rocky Area pack's old man statue stands
// in (its `PICKS` entry, art/memorial/statue_old.png). `setStatueFolk` (main.ts, per snapshot) says who each is;
// `onStatueArt` tells the map to draw again when a picture is ready.

import { CanvasSource, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import type { HonouredView } from '../../shared/sim/memorials';
import { loadImage } from '../art/loadImage';
import { FINE, type PixelArt } from '../art/pixelArt';
import { HK_CELL, HK_FEET, HK_FIGURE, hkCell, hkLayers, onHkLoad, type HkWho } from '../art/hkFolk';
import plinthUrl from '../art/memorial/plinth.png';

/** The figure's height on the plinth (world px; the townsfolk stand 48), the plinth's width, and how far up its slab
 *  the feet stand (a share of its height from the top). */
const FIGURE_H = 40;
const PLINTH_W = 30;
const FEET_ON = 0.3;
/** The picture's width (px): the figure's raised arm or weapon may reach past the plinth. */
const ART_W = 56;
/** The stone's shades (dark to light), the plinth's own cool grey. */
const STONE = [
  [58, 62, 74],
  [84, 90, 104],
  [110, 116, 132],
  [136, 142, 158],
  [164, 170, 186],
  [194, 200, 214],
];
/** The pose: the arm raised (`HK_RAISED`) for one who carried a weapon, else standing; facing the square. */
const HK_RAISED = 3;
const HK_STAND = 0;

let plinth: HTMLImageElement | null = null;
let asked = false;
const listeners: (() => void)[] = [];
const tell = () => {
  for (const fn of listeners) fn();
};
/** Call back when a statue's picture may now be drawn (the plinth or someone's layers loaded). */
export function onStatueArt(fn: () => void): void {
  listeners.push(fn);
}

const folk = new Map<number, HkWho>();
const arts = new Map<string, PixelArt>();
let hooked = false;

/** Who each statue stands for (the honoured, from the snapshot). */
export function setStatueFolk(list: readonly HonouredView[]): void {
  let added = false;
  for (const h of list) {
    if (folk.has(h.id)) continue;
    folk.set(h.id, { id: h.id, look: h.look, gear: h.gear, cls: h.cls, stage: h.stage, founder: h.fcls, monster: h.monster, child: false, traveller: false, eyeLost: false, scarred: false });
    added = h.statue !== null || added;
  }
  if (added) tell(); // (a statue drawn before its folk were known is drawn again)
}

/** A statue's picture `w` cells wide, for the one it stands for (a person's id), or null while it loads. */
export function statueArt(who: number | undefined, w: number): PixelArt | null {
  if (who === undefined) return null;
  const hk = folk.get(who);
  if (!hk) return null;
  if (!asked) {
    asked = true;
    loadImage(plinthUrl).then((im) => ((plinth = im), tell()), () => undefined);
  }
  if (!plinth) return null;
  const key = `${who}|${w}`;
  const had = arts.get(key);
  if (had) return had;
  const armed = !!hk.gear.weapon;
  const keys = hkLayers(hk, { fighting: armed, activity: 'idle' });
  const cell = hkCell(keys, armed ? HK_RAISED : HK_STAND, 0);
  if (!cell) {
    if (!hooked) {
      hooked = true;
      onHkLoad(() => {
        hooked = false;
        tell();
        return true;
      });
    }
    return null;
  }
  const art = carve(cell, plinth, w);
  arts.set(key, art);
  return art;
}

/** The figure in stone on its plinth, as a picture on the fine grid. */
function carve(cell: HTMLCanvasElement, base: HTMLImageElement, w: number): PixelArt {
  const width = Math.max(ART_W, w * CELL + 8);
  const pk = PLINTH_W / base.naturalWidth;
  const ph = Math.round(base.naturalHeight * pk);
  const k = FIGURE_H / HK_FIGURE;
  // (the cell's top stands this far above the feet)
  const above = Math.ceil(HK_FEET * k);
  const height = above + Math.round(ph * (1 - FEET_ON)) + 1;
  const feetY = above;
  const plinthTop = feetY - Math.round(ph * FEET_ON);
  // the figure, on a canvas of its own, then carved
  const fig = document.createElement('canvas');
  fig.width = width * FINE;
  fig.height = height * FINE;
  const fg = fig.getContext('2d')!;
  fg.imageSmoothingEnabled = false;
  const size = Math.round(HK_CELL * k * FINE);
  fg.drawImage(cell, Math.round((width / 2) * FINE - size / 2), Math.round(feetY * FINE - HK_FEET * k * FINE), size, size);
  stone(fg, fig.width, fig.height);
  // the plinth under it, and the statue stood on its slab
  const c = document.createElement('canvas');
  c.width = width * FINE;
  c.height = height * FINE;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(base, Math.round(((width - PLINTH_W) / 2) * FINE), plinthTop * FINE, PLINTH_W * FINE, ph * FINE);
  // (a soft shadow at the figure's feet on the slab)
  g.fillStyle = 'rgba(20, 22, 30, 0.35)';
  g.beginPath();
  g.ellipse((width / 2) * FINE, feetY * FINE, 8 * FINE, 2.5 * FINE, 0, 0, Math.PI * 2);
  g.fill();
  g.drawImage(fig, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const tops = new Int16Array(width);
  for (let x = 0; x < width; x++) {
    let top = height;
    for (let y = 0; y < height && top === height; y++) if (data[(y * FINE * c.width + x * FINE) * 4 + 3] > 40 || data[(y * FINE * c.width + x * FINE + 1) * 4 + 3] > 40) top = y;
    tops[x] = top;
  }
  return { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: FINE }) }), width, height, tops };
}

/** Turn a figure to stone where it's drawn: its lightness stepped into the stone's shades, a step lighter where the
 *  edge faces up or left (the light) and a step darker where it faces down or right. */
function stone(g: CanvasRenderingContext2D, w: number, h: number): void {
  const im = g.getImageData(0, 0, w, h);
  const d = im.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 60;
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] <= 60) continue;
      const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      // (most of a figure is middling: spread it over the shades, the darkest kept for the outline)
      let step = 1 + Math.round(Math.min(1, lum * 1.25) * 3);
      if (!solid(x - 2, y) || !solid(x, y - 2)) step++;
      if (!solid(x + 2, y) || !solid(x, y + 2)) step--;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) step = Math.min(step, 1) - 1;
      const c = STONE[Math.max(0, Math.min(STONE.length - 1, step))];
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
  im.data.set(out);
  g.putImageData(im, 0, 0);
}
