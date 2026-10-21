// Loads the isometric townsfolk art: a look's index.json and its frames, fetched BY URL (the web build inlines
// imported PNGs, which would grow the phone app by megabytes). A look loads only when first asked for. Textures are
// cached per (look, variant); a variant is a recolour baked once (folkTint.ts).
//
// The base URL is relative to the page, like the himeko layers: the build must copy art/iso/folk to `iso/folk`
// beside the page (see docs/notes/iso-folk.md).

import { Texture } from 'pixi.js';
import { loadImage } from '../art/loadImage';
import { FOLK_DIRS, type FolkAnim, type FolkDir } from './folkRules';
import { recolour } from './folkTint';

export interface FolkIndex {
  frame: [number, number];
  directions: FolkDir[];
  animations: Partial<Record<FolkAnim, { frames: number }>>;
}

/** A loaded look: what it has, and the textures by animation, facing and frame. */
export interface FolkSet {
  index: FolkIndex;
  has(anim: FolkAnim): boolean;
  count(anim: FolkAnim): number;
  /** The texture of a frame (`stand` is the still rotation, whatever `n`). Null if it isn't there. */
  texture(anim: FolkAnim, dir: FolkDir, n: number): Texture | null;
}

export const FOLK_ROOT = { url: 'iso/folk' };

const sets = new Map<string, Promise<FolkSet | null>>();

/** The set for a look path (`settlers/woman_leather+axe`) and a colour variant, loading it on the first ask. Resolves
 *  null if the look isn't drawn yet (the caller then uses the bare look). The same promise comes back every time. */
export function loadFolkSet(path: string, variant = 0): Promise<FolkSet | null> {
  const key = `${path}#${variant}`;
  let p = sets.get(key);
  if (!p) sets.set(key, (p = build(path, variant).catch(() => null)));
  return p;
}

/** Forget everything loaded (a new town, or to free memory). */
export function clearFolkSets(): void {
  sets.clear();
}

async function build(path: string, variant: number): Promise<FolkSet | null> {
  const base = `${FOLK_ROOT.url}/${path}`;
  const res = await fetch(`${base}/index.json`);
  if (!res.ok) return null;
  const index = (await res.json()) as FolkIndex;
  const tex = new Map<string, Texture>();
  const jobs: Promise<void>[] = [];
  const add = (key: string, url: string) =>
    jobs.push(
      loadImage(url).then(
        (im) => void tex.set(key, toTexture(im, variant)),
        () => undefined, // (a missing frame: that facing shows nothing rather than failing the look)
      ),
    );
  const dirs = index.directions ?? [...FOLK_DIRS];
  for (const d of dirs) add(`stand/${d}/0`, `${base}/rotations/${d}.png`);
  for (const [anim, info] of Object.entries(index.animations ?? {})) {
    for (const d of dirs) for (let n = 0; n < (info?.frames ?? 0); n++) add(`${anim}/${d}/${n}`, `${base}/${anim}/${d}/${n}.png`);
  }
  await Promise.all(jobs);
  return {
    index,
    has: (a) => a === 'stand' || !!index.animations?.[a],
    count: (a) => (a === 'stand' ? 1 : (index.animations?.[a]?.frames ?? 0)),
    texture: (a, d, n) => tex.get(`${a}/${d}/${a === 'stand' ? 0 : n}`) ?? null,
  };
}

/** A picture as a texture, recoloured for a variant (variant 0 is used as drawn, with no canvas copy). */
function toTexture(im: HTMLImageElement, variant: number): Texture {
  if (variant === 0) return Texture.from(im);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(im, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height);
  recolour(px.data, variant);
  g.putImageData(px, 0, 0);
  return Texture.from(c);
}
