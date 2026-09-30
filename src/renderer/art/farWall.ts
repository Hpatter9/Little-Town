// The wall round a town walled at both ends (sim/buildings.ts enclosure()), seen far off behind the fields: drawn in
// the background layer's farthest depth, in front of the mountains and behind everything else, from one end of the
// town to the other, in what its walls are built of (a palisade of stakes, stone with battlements and towers, brick,
// concrete, or a shimmering force field), hazed by the distance.

import { hexToNum, type Tone } from './pixelArt';
import { hash, shade } from './terrain';
import type { Layer } from '../town/layer';

type Kind = { body: string; light: string; dark: string; height: number; tower: number; style: 'stakes' | 'stone' | 'brick' | 'slab' | 'force' };

const KINDS: Record<string, Kind> = {
  palisade_wall: { body: '#6a4a2a', light: '#8a6a40', dark: '#3e2a18', height: 16, tower: 26, style: 'stakes' },
  stone_wall: { body: '#7a7670', light: '#a09a92', dark: '#4e4a46', height: 20, tower: 32, style: 'stone' },
  brick_wall: { body: '#9a4a32', light: '#b8644a', dark: '#5e2a1e', height: 22, tower: 34, style: 'brick' },
  concrete_wall: { body: '#9a9c9e', light: '#c0c2c4', dark: '#606264', height: 24, tower: 36, style: 'slab' },
  force_wall: { body: '#3a8ad8', light: '#a8e0ff', dark: '#1a4a8a', height: 26, tower: 40, style: 'force' },
};

/** Towers stand about this far apart (background px). */
const TOWER_EVERY = 150;

/** Draw the wall from x0 to x1 (background-local px; its foot at y 0, hidden behind the fields' top edge). */
export function drawFarWall(L: Layer, x0: number, x1: number, wallId: string, tone: Tone, seed: number): void {
  const k = KINDS[wallId] ?? KINDS.palisade_wall;
  const col = (c: string) => hexToNum(tone(c));
  // a little way beyond the town at each end, so the towers stand at its corners
  const lo = x0 - 20;
  const hi = x1 + 20;
  const towers: number[] = [lo];
  const n = Math.max(1, Math.round((hi - lo) / TOWER_EVERY));
  for (let i = 1; i < n; i++) towers.push(Math.round(lo + ((hi - lo) * i) / n));
  towers.push(hi);

  for (let x = lo; x < hi; x += 2) {
    const g = L.gfx(x, 'far');
    const h = k.height;
    switch (k.style) {
      case 'stakes': {
        // sharpened stakes of uneven height
        const sh = h + Math.floor(hash(seed, x, 1) * 3);
        g.rect(x, -sh + 2, 2, sh - 2).fill(col((x >> 1) % 2 ? k.body : k.light));
        g.rect(x + ((x >> 1) % 2), -sh, 1, 2).fill(col(k.body));
        g.rect(x, -8, 2, 1).fill(col(k.dark)); // a rail lashed across
        L.markSpan(x, 2, -sh);
        break;
      }
      case 'stone':
      case 'brick': {
        g.rect(x, -h, 2, h).fill(col(k.body));
        // courses of stone or brick
        for (let y = -h + 3; y < 0; y += 3) g.rect(x, y, 2, 1).fill(col(k.dark));
        if (((x >> 1) + (k.style === 'brick' ? 0 : 1)) % 3 === 0) for (let y = -h + 1; y < 0; y += 6) g.rect(x, y, 1, 2).fill(col(k.dark));
        g.rect(x, -h, 2, 1).fill(col(k.light));
        // battlements
        if (((x - lo) >> 2) % 2 === 0) {
          g.rect(x, -h - 3, 2, 3).fill(col(k.body));
          g.rect(x, -h - 3, 2, 1).fill(col(k.light));
          L.markSpan(x, 2, -h - 3);
        } else L.markSpan(x, 2, -h);
        break;
      }
      case 'slab': {
        g.rect(x, -h, 2, h).fill(col(k.body));
        if (((x - lo) >> 1) % 12 === 0) g.rect(x, -h, 1, h).fill(col(k.dark)); // the joints between slabs
        g.rect(x, -h, 2, 2).fill(col(k.light));
        g.rect(x, -h - 2, 2, 1).fill(col(shade(k.dark, -0.2))); // wire along the top
        L.markSpan(x, 2, -h - 2);
        break;
      }
      case 'force': {
        // a translucent sheet of light: bright edge, fainter body, scan lines
        g.rect(x, -h, 2, h).fill({ color: col(k.body), alpha: 0.35 });
        g.rect(x, -h, 2, 1).fill(col(k.light));
        for (let y = -h + 4; y < 0; y += 5) if (hash(seed, x, y) < 0.5) g.rect(x, y, 2, 1).fill({ color: col(k.light), alpha: 0.5 });
        L.markSpan(x, 2, -h);
        break;
      }
    }
  }

  // towers (for a palisade, watchtowers on stilts)
  for (const tx of towers) {
    const g = L.gfx(tx, 'far');
    const th = k.tower;
    const tw = k.style === 'stakes' ? 10 : 14;
    const left = tx - tw / 2;
    if (k.style === 'stakes') {
      g.rect(left + 1, -th + 8, 1, th - 8).fill(col(k.dark)).rect(left + tw - 2, -th + 8, 1, th - 8).fill(col(k.dark));
      g.rect(left, -th + 4, tw, 5).fill(col(k.body)).rect(left, -th + 4, tw, 1).fill(col(k.light));
      // a little pointed roof
      for (let r = 0; r < 4; r++) g.rect(left + r, -th + 3 - r, tw - r * 2, 1).fill(col('#8a7040'));
      L.markSpan(left, tw, -th);
    } else if (k.style === 'force') {
      g.rect(tx - 2, -th, 4, th).fill(col(k.dark)).rect(tx - 1, -th, 2, th).fill(col(k.light));
      g.rect(tx - 3, -th - 3, 6, 3).fill(col(k.light));
      L.markSpan(tx - 3, 6, -th - 3);
    } else {
      g.rect(left, -th, tw, th).fill(col(k.body));
      g.rect(left, -th, 2, th).fill(col(k.light));
      g.rect(left + tw - 2, -th, 2, th).fill(col(k.dark));
      for (let y = -th + 4; y < 0; y += 4) g.rect(left, y, tw, 1).fill(col(k.dark));
      g.rect(tx - 1, -th + 8, 2, 4).fill(col('#1a1a20')); // an arrow slit (a window, in concrete)
      // the crown: battlements, or a flat roof with a lamp
      if (k.style === 'slab') {
        g.rect(left - 1, -th - 2, tw + 2, 2).fill(col(k.dark));
        g.rect(tx, -th - 6, 1, 4).fill(col(k.dark)).rect(tx - 1, -th - 7, 3, 1).fill(col('#f8e8a0'));
        L.markSpan(left - 1, tw + 2, -th - 7);
      } else {
        for (let bx = left; bx < left + tw; bx += 4) g.rect(bx, -th - 3, 2, 3).fill(col(k.body)).rect(bx, -th - 3, 2, 1).fill(col(k.light));
        L.markSpan(left, tw, -th - 3);
      }
    }
  }
  // a gate in the middle of each run between towers (a dark arch), on the town's side of the land
  for (let i = 0; i + 1 < towers.length; i++) {
    if (k.style === 'force') break;
    const gx = Math.round((towers[i] + towers[i + 1]) / 2);
    if (hash(seed, gx, 2) < 0.5) continue;
    const g = L.gfx(gx, 'far');
    g.rect(gx - 4, -9, 8, 9).fill(col('#1e1a18'));
    g.rect(gx - 3, -10, 6, 1).fill(col('#1e1a18'));
  }
}
