// What hill ground does for the town's work (sim/relief.ts, data/hills.ts): a field on the downs yields less and an
// orchard or a vineyard more, a herd grazed there gives more, a windmill up on the hills grinds faster in the stronger
// wind, and a tower on the high ground sees and shoots further. All by the share of a building's footprint on such
// ground; a land with no relief (a town founded before it) is level everywhere, so nothing changes there.

import { HIGH_SIGHT, HIGH_WIND, HILL_FIELD, HILL_GRAZING, HILL_ORCHARD, SLOPE_CROPS } from '../data/hills';
import { footprint } from './buildings';
import type { LandMap, Rect } from './land';
import { isHigh, isHilly } from './relief';
import type { Building, GameState } from './state';

/** The share of a footprint's cells that are hill country (`high`: the high ground only). */
export function hillShare(m: Pick<LandMap, 'relief' | 'w' | 'h'>, r: Rect, high = false): number {
  if (!m.relief) return 0;
  let n = 0;
  let all = 0;
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      all++;
      const c = m.relief[y * m.w + x];
      if (high ? isHigh(c) : isHilly(c)) n++;
    }
  return all ? n / all : 0;
}

/** A field's harvest on the hills: less for most crops, more for an orchard or a vineyard. */
export function hillHarvest(s: GameState, b: Building): number {
  if (!s.land.relief) return 1;
  const share = hillShare(s.land, footprint(b));
  return 1 + ((SLOPE_CROPS.has(b.def) ? HILL_ORCHARD : HILL_FIELD) - 1) * share;
}

/** A pen's yield on the hills' grazing. */
export const hillGrazing = (s: GameState, b: Building) => (s.land.relief ? 1 + (HILL_GRAZING - 1) * hillShare(s.land, footprint(b)) : 1);

/** A windmill's grinding up in the wind. */
export const hillWind = (s: GameState, b: Building) => (s.land.relief && b.def === 'windmill' ? 1 + (HIGH_WIND - 1) * hillShare(s.land, footprint(b)) : 1);

/** How much further a tower (a watchtower, a defence) sees and shoots from the high ground. */
export const highSight = (s: GameState, b: Building) => (s.land.relief ? 1 + (HIGH_SIGHT - 1) * hillShare(s.land, footprint(b), true) : 1);
