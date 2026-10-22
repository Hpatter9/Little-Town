// The face of someone who has died (the obituary card: sim/obituary.ts keeps their look, kit and calling with the
// fallen, so they can be drawn after they are gone, as the map drew them). A head-and-shoulders picture in their
// isometric look (art/folkPortrait.ts), greyed; the paper doll (art/hkFolk.ts) stands in while it loads, painted over in
// place when it comes. Null for an older save's fallen, kept without a look.

import type { Fallen } from '../../shared/sim/annals';
import { paintPortrait } from './folkPortrait';
import { hkDraw, hkLayers, hkWhoOfLook, onHkLoad } from './hkFolk';

/** A square portrait `size` px across (drawn at twice that for a sharp picture), or null with no look kept. */
export function fallenFace(f: Pick<Fallen, 'id' | 'founder' | 'obit'>, size = 64): HTMLCanvasElement | null {
  const o = f.obit;
  if (!o) return null;
  const who = { ...hkWhoOfLook(f.id, o.look, { cls: o.cls, gear: o.gear, founder: o.founder }), stage: o.stage };
  const keys = hkLayers(who, { fighting: false, activity: 'idle' });
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  c.style.width = c.style.height = `${size}px`;
  c.style.imageRendering = 'pixelated';
  paintPortrait(c, { id: f.id, origin: o.origin, look: o.look, gear: o.gear }, {
    mode: 'face',
    grey: true,
    stand: (g) => {
      const paint = (): boolean => {
        if (c.dataset.folk) return true;
        const cell = document.createElement('canvas');
        cell.width = cell.height = 128;
        // (the figure drawn big, so its head and shoulders fill the square)
        if (!hkDraw(cell.getContext('2d')!, keys, 0, 0, 64, 150, 150)) return false;
        g.clearRect(0, 0, c.width, c.height);
        g.imageSmoothingEnabled = false;
        g.drawImage(cell, 14, 0, 100, 100, 0, 0, c.width, c.height);
        c.dataset.ready = '1'; // (painted: a copy taken now has the face)
        return true;
      };
      if (!paint()) onHkLoad(paint);
    },
  });
  return c;
}
