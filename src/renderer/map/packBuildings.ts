// Craftpix's Village tileset (the top-down tower-defence one, also the raid map's tower pads) lends the medieval
// town its houses and market awnings on the map: half-timbered houses for the cottage, the row houses and the
// inn, striped awnings for the trading post and the stalls. Each picture is scaled to its building's footprint (a
// little overhang each side), pixel for pixel on the fine grid, and stands in for the code-drawn picture in the
// looks it suits (the base town and the knights). Until a picture has loaded, the code-drawn one stands.

import { CanvasSource, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import { loadImage } from '../art/loadImage';
import { FINE, type PixelArt } from '../art/pixelArt';
import house1 from '../art/village/house1.png';
import house2 from '../art/village/house2.png';
import house4 from '../art/village/house4.png';
import tent1 from '../art/village/tent1.png';
import tent2 from '../art/village/tent2.png';
import tent3 from '../art/village/tent3.png';
import barrel from '../art/village/barrel.png';
import cart from '../art/village/cart.png';
import crate from '../art/village/crate.png';
import lantern from '../art/village/lantern.png';
import sign from '../art/village/sign.png';

import camp1 from '../art/village/camp1.png';
import camp2 from '../art/village/camp2.png';
import camp4 from '../art/village/camp4.png';
import box1 from '../art/village/box1.png';
import box2 from '../art/village/box2.png';
import log1 from '../art/village/log1.png';
import log3 from '../art/village/log3.png';
import palisade01 from '../art/village/palisade01.png';
import palisade02 from '../art/village/palisade02.png';
import palisade03 from '../art/village/palisade03.png';
import palisade36 from '../art/village/palisade36.png';
import palisade37 from '../art/village/palisade37.png';
import dwalls from '../art/village/dwalls.png';
import dprops from '../art/village/dprops.png';
import grave1 from '../art/village/grave1.png';
import grave2 from '../art/village/grave2.png';
import grave3 from '../art/village/grave3.png';
import grave4 from '../art/village/grave4.png';
import grave5 from '../art/village/grave5.png';

/** A pack picture for a building: one image, or several laid together (`parts`: image, x, y in source px, on a
 *  canvas `size`), hanging `overhang` px over the footprint each side, in the looks it suits (`styles`; none: all
 *  but the origins with their own tents and halls). */
/** A part: an image at x, y (source px), the whole of it or a crop of it (sx, sy, sw, sh). */
type Part = [string, number, number] | [string, number, number, number, number, number, number];
interface Pick {
  url?: string;
  parts?: Part[];
  size?: [number, number];
  overhang?: number;
  styles?: Set<string>;
  /** Several pictures to choose from by the building's id. */
  any?: string[];
}
/** The looks the pack's timber houses suit. */
const TIMBER = new Set(['town', 'settlers', 'knights']);
/** The looks whose origins have tents and halls of their own: the Stone Age pieces are kept from them. */
const OWN_TENTS = new Set(['vampire', 'lich', 'robot', 'nomads', 'merfolk', 'nomads_city']);
const PICKS: Record<string, Pick> = {
  cottage: { url: house1, styles: TIMBER },
  rowhouse: { url: house2, styles: TIMBER },
  fireside_inn: { url: house4, styles: TIMBER },
  tavern: { url: house4, styles: TIMBER },
  trading_post: { url: tent1, styles: TIMBER },
  market: { url: tent2, styles: TIMBER },
  general_store: { url: tent3, styles: TIMBER },
  // the Fields pack's camp: a small tent for the lean-to, a wide one for the hide tent, the long one for the longhouse
  lean_to: { url: camp2, overhang: 2 },
  hide_tent: { url: camp1 },
  longhouse: { url: camp4, overhang: 10 },
  // the stockpile: crates and logs heaped together
  stockpile: { parts: [[log3, 2, 14], [box1, 10, 4], [box2, 28, 8], [log1, 44, 6], [box1, 62, 10], [box2, 76, 2]], size: [96, 28], overhang: 0 },
  // the Village pack's palisade stakes and gate
  palisade_wall: { any: [palisade01, palisade02, palisade03], overhang: 0 },
  palisade_gate: { parts: [[palisade36, 0, 0], [palisade37, 32, 0]], size: [64, 32], overhang: 0 },
  // the dungeon pack's stonework: a stretch of wall, an arched gate with its door
  stone_wall: { parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0 },
  stone_gate: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0 },
  // the dungeon props: bookshelves for the library, an alchemist's bench for the healer, a plain table for the workbench
  library: { parts: [[dprops, 0, 0, 16, 256, 48, 48], [dprops, 48, 0, 64, 256, 48, 48], [dprops, 96, 0, 112, 256, 48, 48]], size: [144, 48], overhang: 0 },
  healers_hut: { parts: [[dprops, 0, 0, 16, 304, 48, 48]], size: [48, 48], overhang: 0 },
  workbench: { parts: [[dprops, 0, 0, 80, 144, 64, 32]], size: [64, 32], overhang: 0 },
  // the undead pack's graves for the graveyard
  graveyard: { parts: [[grave1, 0, 0], [grave2, 34, 6], [grave3, 66, 0], [grave4, 16, 28], [grave5, 50, 30]], size: [98, 62], overhang: 0 },
};
/** How far a picture hangs over its footprint, each side (px), unless the pick says. */
const OVERHANG = 6;

const images = new Map<string, HTMLImageElement | null>();
const loading = new Set<string>();
const arts = new Map<string, PixelArt>();
const listeners = new Set<() => void>();

/** Called when a picture has loaded (the map draws its buildings again). */
export function onPackArt(cb: () => void): void {
  listeners.add(cb);
}

function fetch(url: string): void {
  if (loading.has(url)) return;
  loading.add(url);
  loadImage(url).then(
    (im) => {
      images.set(url, im);
      for (const cb of listeners) cb();
    },
    () => images.set(url, null),
  );
}

/** The pack picture for a building `w` cells wide in a look, scaled to its footprint; null when there is none (or
 *  it hasn't loaded yet). */
/** Whether a pick suits a look. */
const suits = (pick: Pick, style: string) => (pick.styles ? pick.styles.has(style) : !OWN_TENTS.has(style));

/** The pick's source picture (an image, or its parts laid together), or null while something is still loading. */
function source(pick: Pick, id: number): { draw: (g: CanvasRenderingContext2D, scale: number) => void; w: number; h: number } | null {
  const urls = pick.parts ? pick.parts.map((p) => p[0]) : [pick.any ? pick.any[id % pick.any.length] : pick.url!];
  let waiting = false;
  for (const u of urls) {
    const im = images.get(u);
    if (im === undefined) {
      fetch(u);
      waiting = true;
    } else if (!im) return null;
  }
  if (waiting) return null;
  if (pick.parts) {
    const [w, h] = pick.size!;
    return {
      w,
      h,
      draw: (g, k) => {
        for (const part of pick.parts!) {
          const im = images.get(part[0])!;
          if (part.length === 7) g.drawImage(im, part[3], part[4], part[5], part[6], part[1] * k, part[2] * k, part[5] * k, part[6] * k);
          else g.drawImage(im, part[1] * k, part[2] * k, im.naturalWidth * k, im.naturalHeight * k);
        }
      },
    };
  }
  const im = images.get(urls[0])!;
  return { w: im.naturalWidth, h: im.naturalHeight, draw: (g, k) => g.drawImage(im, 0, 0, im.naturalWidth * k, im.naturalHeight * k) };
}

export function packArt(def: string, w: number, style: string, id = 0): PixelArt | null {
  const pick = PICKS[def];
  if (!pick || !suits(pick, style)) return null;
  const src = source(pick, id);
  if (!src) return null;
  const key = `${def}|${w}|${pick.any ? id % pick.any.length : 0}`;
  let art = arts.get(key);
  if (!art) {
    const target = w * CELL + (pick.overhang ?? OVERHANG) * 2;
    const scale = target / src.w;
    const width = Math.round(src.w * scale);
    const height = Math.round(src.h * scale);
    const c = document.createElement('canvas');
    c.width = width * FINE;
    c.height = height * FINE;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    src.draw(g, scale * FINE);
    // (the first opaque row of each art column, for hit-testing, as the painter records it)
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const tops = new Int16Array(width);
    for (let x = 0; x < width; x++) {
      let top = height;
      for (let y = 0; y < height && top === height; y++) {
        const fx = x * FINE;
        const fy = y * FINE;
        if (data[(fy * c.width + fx) * 4 + 3] > 40 || data[(fy * c.width + fx + 1) * 4 + 3] > 40) top = y;
      }
      tops[x] = top;
    }
    art = { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: FINE }) }), width, height, tops };
    arts.set(key, art);
  }
  return art;
}

/** The street furniture the pack lends a finished pack-drawn building: a lantern post, a barrel, a crate, a cart or a
 *  signboard at its front corners, picked by the building's id. */
const DRESSING = [lantern, barrel, crate, sign, cart, barrel, lantern, crate];

export interface Dressing {
  texture: Texture;
  /** Its foot's offset from the building's bottom-left corner (world px) and its size (px). */
  dx: number;
  dy: number;
  w: number;
  h: number;
}

const dressTex = new Map<string, Texture>();

/** What stands by a building `w` cells wide (its picture from the pack) with this id, or nothing yet. */
export function packDressing(def: string, id: number, w: number, style: string): Dressing[] {
  const pick = PICKS[def];
  if (!pick || pick.styles !== TIMBER || !suits(pick, style)) return [];
  const out: Dressing[] = [];
  const corners: [number, number][] = [
    [-2, 0],
    [w * CELL + 2, 0],
  ];
  corners.forEach(([dx, dy], i) => {
    const h = (id * 2654435761 + i * 40503) >>> 0;
    if ((h % 7) < 3) return; // (not every corner has something)
    const url = DRESSING[(h >>> 8) % DRESSING.length];
    const im = images.get(url);
    if (im === undefined) return fetch(url);
    if (!im) return;
    let tex = dressTex.get(url);
    if (!tex) {
      tex = Texture.from(im);
      tex.source.scaleMode = 'nearest';
      dressTex.set(url, tex);
    }
    out.push({ texture: tex, dx: dx - (i ? 0 : im.naturalWidth), dy, w: im.naturalWidth, h: im.naturalHeight });
  });
  return out;
}
