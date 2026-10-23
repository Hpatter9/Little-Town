// The townsfolk's isometric looks drawn into a 2D canvas, animated: for the menus' moving pictures (the event cards'
// scenes, the raid recap), where the Pixi textures of iso/folkLoader.ts can't go. The same look and colours the map
// gives them (iso/folkWho.ts). A look's sheets load by URL when first wanted, each recoloured once into a canvas;
// until a sheet is in, `drawFolk` says false and the caller draws the paper doll meanwhile. No Pixi here.

import { loadImage } from './loadImage';
import { loadRoles } from '../iso/folkRoles';
import { CHILD_SCALE, FOLK_DIRS, frameAt, play, type FolkAnim, type FolkDir } from '../iso/folkRules';
import { recolour, sheetMap, tintKey, type FolkTint } from '../iso/folkTint';
import { folkWho } from '../iso/folkWho';
import type { PortraitWho } from './folkPortrait';

/** Where the feet stand in a look's frame and how tall a grown figure is in it (as art/folkSide.ts). */
const FEET = 0.815;
const FIGURE = 0.62;

interface CanvasSet {
  frame: [number, number];
  dirs: readonly FolkDir[];
  anims: Partial<Record<FolkAnim, number>>;
  sheets: Map<string, HTMLCanvasElement | 'loading' | 'failed'>;
  base: string;
  tint: FolkTint | null;
  roles: Awaited<ReturnType<typeof loadRoles>> | null;
}

const sets = new Map<string, CanvasSet | null | 'loading'>();

function setOf(path: string, tint: FolkTint | null): CanvasSet | null {
  const key = `${path}#${tintKey(tint)}`;
  const got = sets.get(key);
  if (got === undefined) {
    sets.set(key, 'loading');
    const base = `iso/folk/${path}`;
    void (async () => {
      const res = await fetch(`${base}/index.json`);
      if (!res.ok) return null;
      const ix = (await res.json()) as { frame: [number, number]; directions?: FolkDir[]; animations?: Partial<Record<FolkAnim, { frames: number }>> };
      const roles = tint ? await loadRoles(base) : null;
      const anims: Partial<Record<FolkAnim, number>> = {};
      for (const [a, v] of Object.entries(ix.animations ?? {})) anims[a as FolkAnim] = v?.frames ?? 0;
      return { frame: ix.frame, dirs: ix.directions ?? FOLK_DIRS, anims, sheets: new Map(), base, tint, roles } as CanvasSet;
    })()
      .catch(() => null)
      .then((s) => sets.set(key, s));
    return null;
  }
  return got === 'loading' ? null : got;
}

/** A sheet of a set, recoloured, loading on the first ask. */
function sheet(s: CanvasSet, name: string): HTMLCanvasElement | null {
  const got = s.sheets.get(name);
  if (got === undefined) {
    s.sheets.set(name, 'loading');
    loadImage(`${s.base}/${name}.png`).then(
      (im) => {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(im, 0, 0);
        const map = sheetMap(s.roles, name, s.tint);
        if (map.size) {
          const px = g.getImageData(0, 0, c.width, c.height);
          recolour(px.data, map);
          g.putImageData(px, 0, 0);
        }
        s.sheets.set(name, c);
      },
      () => s.sheets.set(name, 'failed'),
    );
    return null;
  }
  return typeof got === 'string' ? null : got;
}

/** Draw someone's look in `g`, centred on `cx` with feet on `feetY`, a grown figure `height` tall: animation `want` (or
 *  the nearest the look has), facing `dir`, `t` seconds in. False until the look and its sheet are in. */
export function drawFolk(g: CanvasRenderingContext2D, who: PortraitWho, want: FolkAnim, dir: FolkDir, t: number, cx: number, feetY: number, height: number): boolean {
  const w = folkWho(who);
  const s = setOf(w.path, w.tint);
  if (!s) return false;
  const pl = play(want, (a) => (s.anims[a] ?? 0) > 0);
  const name = pl.anim === 'stand' ? 'rotations' : pl.anim;
  const sh = sheet(s, name);
  // (an animation still loading: the still figure meanwhile)
  const still = sh ? null : sheet(s, 'rotations');
  const src = sh ?? still;
  if (!src) return false;
  const [fw, fh] = s.frame;
  const d = Math.max(0, s.dirs.indexOf(dir));
  const n = sh && pl.anim !== 'stand' ? frameAt(s.anims[pl.anim] ?? 1, pl.fps * pl.rate, t, pl.loop) : 0;
  const [sx, sy] = sh && pl.anim !== 'stand' ? [n * fw, d * fh] : [d * fw, 0];
  const k = (height / (fh * FIGURE)) * (w.child ? CHILD_SCALE : 1);
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, sx, sy, fw, fh, Math.round(cx - (fw * k) / 2), Math.round(feetY - fh * FEET * k), Math.round(fw * k), Math.round(fh * k));
  g.imageSmoothingEnabled = smooth;
  return true;
}
