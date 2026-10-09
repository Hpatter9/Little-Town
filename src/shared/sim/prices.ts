// What a good costs today (sim/markets.ts moves the index each morning). Kept apart, with nothing but types imported,
// so the shop, the caravans and the planner can ask without pulling the trade house in.

import type { Material } from '../data/materials';
import { WORTH } from '../data/trade';
import type { GameState } from './state';

/** The price index of a good: 1 is its plain worth. */
export const priceIndex = (s: GameState, m: Material): number => s.market?.price[m] ?? 1;

/** A unit of a good at today's price (its worth before the markets begin). */
export const priceOf = (s: GameState, m: Material): number => (WORTH[m] ?? 1) * priceIndex(s, m);

/** Note goods sold (n > 0) or bought (n < 0) by the town: supply moves the price (sim/markets.ts). */
export function noteFlow(s: GameState, m: Material, n: number): void {
  const mk = s.market;
  if (!mk || !n) return;
  mk.flow[m] = (mk.flow[m] ?? 0) + n * (WORTH[m] ?? 1);
}
