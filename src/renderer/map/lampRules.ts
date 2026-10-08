// Where the street lamps stand and how they look by the age (map/streetLamps.ts draws them). Pure, so it is tested.

import type { Era } from '../../shared/data/eras';
import type { LandMap } from '../../shared/sim/land';

/** A lamp every so many road cells (by the cell's hash), at most so many, nearest the fire first. */
export const LAMP_EVERY = 5;
export const LAMPS_MOST = 70;

/** Each age's lamp: a torch, a lantern post, an iron gas lamp, an electric light; its light's colour and reach (px). */
export const LAMP_LOOK: Record<Era, { kind: 'torch' | 'post'; tint: number; light: number; radius: number }> = {
  neolithic: { kind: 'torch', tint: 0xffffff, light: 0xffa040, radius: 30 },
  medieval: { kind: 'post', tint: 0xffffff, light: 0xffc070, radius: 34 },
  industrial: { kind: 'post', tint: 0x8a90a0, light: 0xffe0a0, radius: 40 },
  modern: { kind: 'post', tint: 0xb8c0cc, light: 0xf0f4ff, radius: 46 },
  space: { kind: 'post', tint: 0xa0d0ff, light: 0xb8e0ff, radius: 50 },
};

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** The road cells a lamp stands beside, nearest the camp first, and which side of the cell it stands on. */
export function lampCells(land: Pick<LandMap, 'w' | 'h' | 'camp'>, road: (x: number, y: number) => boolean): { x: number; y: number; side: 1 | -1 }[] {
  const out: { x: number; y: number; side: 1 | -1; d: number }[] = [];
  for (let y = 0; y < land.h; y++)
    for (let x = 0; x < land.w; x++) {
      if (!road(x, y) || hash(x, y) % LAMP_EVERY !== 0) continue;
      // (beside the road, on the side away from the next road cell)
      const side: 1 | -1 = road(x + 1, y) && !road(x - 1, y) ? -1 : 1;
      out.push({ x, y, side, d: Math.hypot(x - land.camp.x, y - land.camp.y) });
    }
  return out
    .sort((a, b) => a.d - b.d)
    .slice(0, LAMPS_MOST)
    .map(({ x, y, side }) => ({ x, y, side }));
}

/** How many of the lamps are lit (a share, nearest the fire first) at a daylight: none by day, all after dusk. */
export function lampLit(daylight: number): number {
  return Math.max(0, Math.min(1, (0.62 - daylight) / 0.3));
}
