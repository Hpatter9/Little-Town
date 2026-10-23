// Loads the isometric townsfolk art: a look's index.json and its frames, fetched BY URL (the web build inlines
// imported PNGs, which would grow the phone app by megabytes). A look loads only when first asked for. Textures are
// cached per (look, variant); a variant is a recolour baked once (folkTint.ts).
//
// The base URL is relative to the page, like the himeko layers: the build must copy art/iso/folk to `iso/folk`
// beside the page (see docs/notes/iso-folk.md).

import { Rectangle, Texture } from 'pixi.js';
import { loadImage } from '../art/loadImage';
import { CREATURE_ROOT } from './creatureRules';
import { FOLK_DIRS, type FolkAnim, type FolkDir } from './folkRules';
import { recolour } from './folkTint';

export interface FolkIndex<A extends string = FolkAnim> {
  frame: [number, number];
  directions: FolkDir[];
  animations: Partial<Record<A, { frames: number }>>;
}

/** A loaded look: what it has, and the textures by animation, facing and frame. */
export interface SheetSet<A extends string> {
  index: FolkIndex<A>;
  has(anim: A | 'stand'): boolean;
  count(anim: A | 'stand'): number;
  /** The texture of a frame (`stand` is the still rotation, whatever `n`). Null if it isn't there. */
  texture(anim: A | 'stand', dir: FolkDir, n: number): Texture | null;
}
export type FolkSet = SheetSet<FolkAnim>;

export const FOLK_ROOT = { url: 'iso/folk' };

const sets = new Map<string, Promise<FolkSet | null>>();

/** The set for a look path (`settlers/woman_leather+axe`) and a colour variant, loading it on the first ask. Resolves
 *  null if the look isn't drawn yet (the caller then uses the bare look). The same promise comes back every time. */
export function loadFolkSet(path: string, variant = 0): Promise<FolkSet | null> {
  const key = `${path}#${variant}`;
  let p = sets.get(key);
  if (!p) sets.set(key, (p = build<FolkAnim>(`${FOLK_ROOT.url}/${path}`, variant).catch(() => null)));
  return p;
}

/** The God creature's sheets for a kind (`wolf`), loading them on the first ask. Resolves null while the kind has no
 *  index.json yet (the caller keeps its old stand-in). Drawn in its own colours: no variants. */
export function loadCreatureSet<A extends string>(kind: string): Promise<SheetSet<A> | null> {
  const key = `creature:${kind}`;
  let p = sets.get(key) as Promise<SheetSet<A> | null> | undefined;
  if (!p) sets.set(key, (p = build<A>(`${CREATURE_ROOT.url}/${kind}`, 0).catch(() => null)) as Promise<FolkSet | null>);
  return p;
}

/** Forget everything loaded (a new town, or to free memory). */
export function clearFolkSets(): void {
  sets.clear();
}

async function build<A extends string>(base: string, variant: number): Promise<SheetSet<A> | null> {
  const res = await fetch(`${base}/index.json`);
  if (!res.ok) return null;
  const index = (await res.json()) as FolkIndex<A>;
  const tex = new Map<string, Texture>();
  const dirs = index.directions ?? [...FOLK_DIRS];
  const [w, h] = index.frame;
  // (each animation is one sheet, a row a facing and a column a frame; rotations.png is one row, a frame a facing)
  const cut = (url: string, keyOf: (col: number, row: number) => string, cols: number, rows: number) =>
    loadImage(url).then(
      (im) => {
        const src = toTexture(im, variant).source;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.set(keyOf(c, r), new Texture({ source: src, frame: new Rectangle(c * w, r * h, w, h) }));
      },
      () => undefined, // (a missing sheet: that animation shows nothing rather than failing the look)
    );
  // (only the still rotations load now: an animation's sheet loads, and is recoloured, the first time someone plays it.
  // Each sheet is a megapixel or so, and a town's looks times their colour variants made hundreds of them at the start)
  await cut(`${base}/rotations.png`, (c) => `stand/${dirs[c]}/0`, dirs.length, 1);
  const asked = new Set<string>();
  const ask = (anim: string): void => {
    if (asked.has(anim)) return;
    asked.add(anim);
    const info = index.animations?.[anim as A];
    if (info) void cut(`${base}/${anim}.png`, (c, r) => `${anim}/${dirs[r]}/${c}`, info.frames ?? 0, dirs.length);
  };
  return {
    index,
    has: (a) => a === 'stand' || !!index.animations?.[a as A],
    count: (a) => (a === 'stand' ? 1 : (index.animations?.[a as A]?.frames ?? 0)),
    texture: (a, d, n) => {
      if (a !== 'stand') ask(a);
      return tex.get(`${a}/${d}/${a === 'stand' ? 0 : n}`) ?? null;
    },
  };
}

/** A picture as a texture, recoloured for a variant (variant 0 is used as drawn, with no canvas copy). */
function toTexture(im: HTMLImageElement, variant: number): Texture {
  if (variant === 0) return Texture.from(im);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!; // (read back whole: kept off the graphics card)
  g.drawImage(im, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height);
  recolour(px.data, variant);
  g.putImageData(px, 0, 0);
  return Texture.from(c);
}
