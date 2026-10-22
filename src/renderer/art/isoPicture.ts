// A building's picture for the menus and cards when the isometric view is on: the kit piece the map draws for it
// (iso/isoKits.ts `pieceFor`), cropped to its visible pixels and fitted to the box whole pixels at a time. The kit's
// PNGs are loaded by URL as the strip does (iso/isoView.ts), once each, and kept per (people, piece). Null until
// the image has arrived: the caller shows the old picture meanwhile and asks again.

import { isoViewOn } from '../iso/isoSetting';
import { kitNameFor, kitOf, kitUrl, pieceFor } from '../iso/isoKits';
import { loadImage } from './loadImage';

const images = new Map<string, HTMLImageElement | null>();
const cropped = new Map<string, HTMLCanvasElement>();

/** The piece's image once loaded (the first call starts the load); null until then, or if it never loads. */
function imageOf(url: string, onLoad: () => void): HTMLImageElement | null {
  const had = images.get(url);
  if (had !== undefined) return had;
  images.set(url, null);
  loadImage(url)
    .then((im) => {
      images.set(url, im);
      onLoad();
    })
    .catch(() => undefined);
  return null;
}

/** The piece's visible pixels on a canvas that fits `boxW` by `boxH` (whole-pixel scaled up, never blurred). */
function fit(im: HTMLImageElement, boxW: number, boxH: number): HTMLCanvasElement | null {
  const src = document.createElement('canvas');
  src.width = im.naturalWidth;
  src.height = im.naturalHeight;
  const g = src.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const px = g.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (px[(y * src.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const k = Math.min(boxW / w, boxH / h);
  const scale = k >= 1 ? Math.floor(k) : k;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.dataset.settled = '1';
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height);
  return c;
}

/** The iso picture of a building for a town of this people, or null (iso off, or the image not in yet: `onLoad` is
 *  called when it arrives, so the caller can ask again). */
export function isoPicture(defId: string, origin: string | undefined, theme: string | undefined, boxW: number, boxH: number, onLoad: () => void = () => undefined): HTMLCanvasElement | null {
  if (!origin || !isoViewOn()) return null;
  const kit = kitOf(kitNameFor(origin, theme));
  const piece = pieceFor(kit, defId);
  const key = `${kit.name}:${piece}:${boxW}x${boxH}`;
  const have = cropped.get(key);
  if (have) return have;
  const im = imageOf(kitUrl(kit.name, piece), onLoad);
  if (!im) return null;
  const c = fit(im, boxW, boxH);
  if (c) cropped.set(key, c);
  return c;
}
