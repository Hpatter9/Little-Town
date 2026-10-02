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

/** Which pack picture stands for which building. */
const PICKS: Record<string, string> = {
  cottage: house1,
  rowhouse: house2,
  fireside_inn: house4,
  tavern: house4,
  trading_post: tent1,
  market: tent2,
  general_store: tent3,
};
/** The looks the pack's timber houses suit. */
const STYLES = new Set(['town', 'settlers', 'knights']);
/** How far a picture hangs over its footprint, each side (px). */
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
export function packArt(def: string, w: number, style: string): PixelArt | null {
  const url = PICKS[def];
  if (!url || !STYLES.has(style)) return null;
  const im = images.get(url);
  if (im === undefined) {
    fetch(url);
    return null;
  }
  if (!im) return null;
  const key = `${def}|${w}`;
  let art = arts.get(key);
  if (!art) {
    const target = w * CELL + OVERHANG * 2;
    const scale = target / im.naturalWidth;
    const width = Math.round(im.naturalWidth * scale);
    const height = Math.round(im.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = width * FINE;
    c.height = height * FINE;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, c.width, c.height);
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
  if (!PICKS[def] || !STYLES.has(style)) return [];
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
