// What the stores readout shows (storesReadout.ts): the pure part, with no DOM and no pictures, so the tests read it.

import type { Material } from '../../shared/data/materials';
import { PART_IDS, RARE_INPUTS } from '../../shared/data/chains';

export interface ReadoutItem {
  /** `coins`, `food` or a material. */
  id: string;
  label: string;
  n: number;
}

/** What counts as food, summed into one figure. */
const FOOD: readonly Material[] = ['meat', 'berries', 'grain', 'dried_meat', 'rations', 'eggs', 'milk', 'vegetables', 'fruit', 'bread', 'flour', 'fish'];
/** The materials that matter as a town grows, in the order they're preferred when the town holds them. */
const STAGE: readonly Material[] = ['iron', 'lumber', 'cloth', 'bricks', 'leather', 'steel', 'iron_ore', 'copper', 'bronze', 'fiber', 'hide', 'clay', 'coal', 'glass', 'concrete', 'electronics', 'alloys'];
const MOST = 5;
const EXTRAS = 2;

const NAMES: Partial<Record<string, string>> = { coins: 'Coins', food: 'Food', wood: 'Wood', stone: 'Stone' };

/** The figures shown: coins (once the town has any), wood, stone, food, then up to two more of what the town holds:
 *  a rare input first when it has one (silver, gems, heartwood...: what its finest things wait on), then the parts it
 *  holds (blade blanks, hafts... summed: data/chains.ts), then its stage's materials. */
export function readoutItems(stock: Partial<Record<Material, number>>, coins: number, items: Record<string, number> = {}): ReadoutItem[] {
  const out: ReadoutItem[] = [];
  if (coins > 0) out.push({ id: 'coins', label: 'Coins', n: Math.floor(coins) });
  out.push({ id: 'wood', label: 'Wood', n: Math.floor(stock.wood ?? 0) }, { id: 'stone', label: 'Stone', n: Math.floor(stock.stone ?? 0) });
  out.push({ id: 'food', label: 'Food', n: Math.floor(FOOD.reduce((a, m) => a + (stock[m] ?? 0), 0)) });
  const label = (m: string) => NAMES[m] ?? m.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const extras: ReadoutItem[] = [];
  // (the rare input it holds most of)
  const rare = RARE_INPUTS.map((m) => ({ m, n: Math.floor(stock[m] ?? 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  if (rare) extras.push({ id: rare.m, label: label(rare.m), n: rare.n });
  // (the parts it holds, summed)
  const parts = Object.entries(items).reduce((n, [id, k]) => n + (PART_IDS.has(id) ? k : 0), 0);
  if (parts > 0) extras.push({ id: 'parts', label: 'Parts', n: parts });
  // (the stage's materials the town holds, the most plentiful first; ties keep the list's order)
  const held = STAGE.map((m, i) => ({ m, i, n: Math.floor(stock[m] ?? 0) })).filter((x) => x.n > 0);
  held.sort((a, b) => b.n - a.n || a.i - b.i);
  for (const x of held) extras.push({ id: x.m, label: label(x.m), n: x.n });
  out.push(...extras.slice(0, Math.min(EXTRAS, MOST - out.length)));
  return out.slice(0, MOST);
}

/** "1.2k" for the big figures, so the readout stays narrow. */
export function short(n: number): string {
  return n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}
