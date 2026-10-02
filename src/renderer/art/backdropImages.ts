// The painted backdrops from the Craftpix parallax packs (tools/compose-backdrops.cjs): each a file beside the page
// (copied there by the builds), its layers stacked one under another, far to near. Loaded when a fight first shows
// one, cut into a texture per layer, and kept.

import { Texture } from 'pixi.js';
import type { BackdropId } from '../../shared/data/backdrops';
import { loadImage } from './loadImage';
import manifest from './backdrops.json';

/** Each layer's size (art px). */
export const BACKDROP_W = 576;
export const BACKDROP_H = 324;

const loaded = new Map<BackdropId, Promise<Texture[]>>();

export function loadBackdrop(id: BackdropId): Promise<Texture[]> {
  let p = loaded.get(id);
  if (!p) {
    const m = (manifest as Record<string, { layers: number; ext: string }>)[id];
    p = loadImage(`backdrops/${id}.${m.ext}`).then((im) =>
      Array.from({ length: m.layers }, (_, i) => {
        // (a canvas per layer, so each tiles on its own)
        const c = document.createElement('canvas');
        c.width = BACKDROP_W;
        c.height = BACKDROP_H;
        c.getContext('2d')!.drawImage(im, 0, i * BACKDROP_H, BACKDROP_W, BACKDROP_H, 0, 0, BACKDROP_W, BACKDROP_H);
        const t = Texture.from(c);
        t.source.scaleMode = 'nearest';
        return t;
      }),
    );
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return p;
}
