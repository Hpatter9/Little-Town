// The townsfolk's faces and figures in the menus: the same isometric look, colour variant and dress the map gives
// them (iso/folkWho.ts is the one rule both use), drawn from the look's still `rotations.png`, south-facing, cropped to
// the figure and scaled with crisp pixels. No Pixi here: the menus live in their own frame. A look is fetched by URL
// when first wanted (async); until it is in, the caller's own stand-in (the old paper doll) is drawn, and the canvas is
// painted again in place as the look arrives, so layouts never jump. Cached per look and variant.

import type { Slot } from '../../shared/data/items';
import type { OriginId } from '../../shared/data/origins';
import type { Look } from '../../shared/data/people';
import { recolour } from '../iso/folkTint';
import { folkWho } from '../iso/folkWho';
import { loadImage } from './loadImage';

/** What a portrait needs to know about someone (a PersonView fits; so does an obituary with an id). */
export interface PortraitWho {
  id: number;
  origin?: OriginId;
  look: Look;
  gear: Partial<Record<Slot, string>>;
}

/** A look's south-facing standing frame, tight to the figure. */
export interface FolkFigure {
  canvas: HTMLCanvasElement;
  /** The figure's own size in the canvas (it is the whole canvas). */
  w: number;
  h: number;
}

const ROOT = 'iso/folk';
const figures = new Map<string, Promise<FolkFigure | null>>();
const ready = new Map<string, FolkFigure | null>();
const waiting = new Set<() => void>();

/** The figure for a look path and variant if it is in already (and starts it loading if not). Null while it loads, or
 *  for ever if the look isn't drawn. */
export function folkFigure(path: string, variant: number): FolkFigure | null {
  const key = `${path}#${variant}`;
  if (ready.has(key)) return ready.get(key) ?? null;
  if (!figures.has(key)) {
    figures.set(
      key,
      build(path, variant)
        .catch(() => null)
        .then((f) => {
          ready.set(key, f);
          return f;
        }),
    );
  }
  return null;
}

async function build(path: string, variant: number): Promise<FolkFigure | null> {
  const base = `${ROOT}/${path}`;
  const res = await fetch(`${base}/index.json`);
  if (!res.ok) return null;
  const index = (await res.json()) as { frame: [number, number]; directions?: string[] };
  const [fw, fh] = index.frame;
  const col = Math.max(0, (index.directions ?? ['south']).indexOf('south'));
  const im = await loadImage(`${base}/rotations.png`);
  const c = document.createElement('canvas');
  c.width = fw;
  c.height = fh;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, col * fw, 0, fw, fh, 0, 0, fw, fh);
  const px = g.getImageData(0, 0, fw, fh);
  recolour(px.data, variant);
  // (the figure's bounds: the rows and columns with any pixel at all)
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px.data[(y * fw + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  g.putImageData(px, 0, 0);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const f = { canvas: out, w: out.width, h: out.height };
  // (told once the look is in; the paints waiting on it run on the next turn)
  setTimeout(() => waiting.forEach((fn) => fn()), 0);
  return f;
}

export interface PortraitOpts {
  /** `face`: head and shoulders filling the canvas; `full`: the whole figure, feet at the bottom. */
  mode: 'face' | 'full';
  /** Greyed (the dead in the annals and memorials). */
  grey?: boolean;
  /** Painted while the look loads (or if it never comes): the old picture. Return false to leave the canvas empty. */
  stand?: (g: CanvasRenderingContext2D, c: HTMLCanvasElement) => void;
}

/** Draw a figure into `c` (cleared first), by mode. */
export function paintFigure(c: HTMLCanvasElement, f: FolkFigure, o: Pick<PortraitOpts, 'mode' | 'grey'>): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  if (o.grey) g.filter = 'grayscale(1) brightness(0.8)';
  if (o.mode === 'face') {
    // (the head and shoulders: the top half of the figure, as wide as the box, a little room round the crown)
    const side = Math.min(f.w, Math.round(f.h * 0.52));
    const sx = Math.round((f.w - side) / 2);
    g.drawImage(f.canvas, sx, 0, side, side, 0, 0, c.width, c.height);
  } else {
    // (in quarter steps, so the pixels stay square and even)
    const k = Math.max(0.25, Math.floor(Math.min((c.width * 0.9) / f.w, (c.height * 0.94) / f.h) * 4) / 4);
    const w = Math.round(f.w * k), h = Math.round(f.h * k);
    g.drawImage(f.canvas, Math.round((c.width - w) / 2), c.height - h - Math.round(c.height * 0.03), w, h);
  }
  g.filter = 'none';
  c.dataset.folk = '1'; // (painted from the iso look)
  c.dataset.ready = '1'; // (a copy taken now has the face)
}

/** Paint a portrait of someone into a canvas now if their look is in, else the stand-in, and again when it comes. */
export function paintPortrait(c: HTMLCanvasElement, who: PortraitWho, o: PortraitOpts): void {
  const w = folkWho(who);
  const now = (): boolean => {
    const f = folkFigure(w.path, w.variant);
    if (!f) return false;
    paintFigure(c, f, o);
    return true;
  };
  if (now()) return;
  if (o.stand) {
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    o.stand(c.getContext('2d')!, c);
  }
  const again = (): void => {
    if (now()) waiting.delete(again);
    else if (ready.has(`${w.path}#${w.variant}`)) waiting.delete(again); // (not drawn: the stand-in stays)
  };
  waiting.add(again);
}

/** A new canvas `w` by `h` (drawn at `res` times that, for a sharp picture) holding someone's portrait. */
export function folkPortrait(who: PortraitWho, o: PortraitOpts & { w: number; h?: number; res?: number }, cls = 'pixel-figure'): HTMLCanvasElement {
  const res = o.res ?? 2;
  const h = o.h ?? o.w;
  const c = document.createElement('canvas');
  c.className = cls;
  c.width = o.w * res;
  c.height = h * res;
  c.style.width = `${o.w}px`;
  c.style.height = `${h}px`;
  c.style.imageRendering = 'pixelated';
  paintPortrait(c, who, o);
  return c;
}

/** Draw a figure centred on `cx`, feet on `feetY`, `height` tall (nearest-pixel). */
export function drawFigureAt(g: CanvasRenderingContext2D, f: FolkFigure, cx: number, feetY: number, height: number): void {
  const k = height / f.h;
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(f.canvas, Math.round(cx - (f.w * k) / 2), Math.round(feetY - height), Math.round(f.w * k), Math.round(height));
  g.imageSmoothingEnabled = smooth;
}

/** The townsfolk as of the last snapshot (panel.ts, main.ts: `folkKnow`), so a view that has only someone's id and
 *  look (a party member, a shop's keeper) wears the look the map gives them. */
const known = new Map<number, PortraitWho>();
export function folkKnow(people: { id: number; origin?: OriginId; look: Look; gear: Partial<Record<Slot, string>> }[]): void {
  known.clear();
  for (const p of people) known.set(p.id, { id: p.id, origin: p.origin, look: p.look, gear: p.gear });
}
/** Someone by their id (with the gear given, which may be what they carry); a stranger is a settler in plain dress. */
export function folkWhoById(id: number, look: Look, gear?: Partial<Record<Slot, string>>, origin?: OriginId): PortraitWho {
  const w = known.get(id);
  return w ? { ...w, gear: gear ?? w.gear } : { id, origin, look, gear: gear ?? {} };
}
