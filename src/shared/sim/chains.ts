// Crafting chains for the planner (data/chains.ts): whether the town can make a thing through its parts, what to queue
// next on the way to it, and what the whole chain still wants from the land. Nothing is queued until its makings are
// in hand, as before: a finished piece waits for its parts, and a part for its materials.

import { PART_IDS, partsOf, RARE_SET } from '../data/chains';
import { ITEM_BY_ID, ITEMS, type ItemDef } from '../data/items';
import type { Material, Stock } from '../data/materials';
import { itemUnlocked, stationFor } from './crafting';
import type { GameState } from './state';

/** Parts go no deeper than this (a part of a part of a part). */
const MAX_DEPTH = 4;

const costOf = (def: ItemDef) => Object.entries(def.cost) as [Material, number][];
const missingOf = (s: GameState, def: ItemDef) => Object.entries(def.items ?? {}).filter(([id, k]) => (s.items[id] ?? 0) < k);

/** Its materials are in store. */
export const materialsIn = (def: ItemDef, stock: Stock) => costOf(def).every(([m, k]) => (stock[m] ?? 0) >= k);

/** Each part it lacks could be made in turn (unlocked, its station standing), and any other item it's made from (a
 *  rope, a spear) is in hand. */
export function partsMakeable(s: GameState, def: ItemDef, stock: Stock, depth = 0): boolean {
  for (const [id] of missingOf(s, def)) {
    if (!PART_IDS.has(id) || depth >= MAX_DEPTH) return false;
    const p = ITEM_BY_ID[id];
    if (!itemUnlocked(s, p) || !stationFor(s, p) || !partsMakeable(s, p, stock, depth + 1)) return false;
  }
  return true;
}

/** Whether the town could make one: unlocked, its station standing, its rare inputs (silver, gems...) in store, and
 *  its parts in hand or makeable. */
export function chainMakeable(s: GameState, def: ItemDef, stock: Stock): boolean {
  if (!itemUnlocked(s, def) || !stationFor(s, def)) return false;
  if (costOf(def).some(([m, k]) => RARE_SET.has(m) && (stock[m] ?? 0) < k)) return false;
  return partsMakeable(s, def, stock);
}

/** The order to queue now on the way to one of `def`: the thing itself when its parts are in hand and its materials
 *  in store; else the first part it lacks (not already on order) whose own makings are ready, down the chain; else
 *  nothing (its materials are to be gathered first, or a part is on its way). */
export function nextStep(s: GameState, def: ItemDef, stock: Stock, depth = 0): ItemDef | null {
  const missing = missingOf(s, def);
  if (!missing.length) return materialsIn(def, stock) ? def : null;
  if (depth >= MAX_DEPTH) return null;
  for (const [id] of missing) {
    if (!PART_IDS.has(id)) return null;
    if (s.crafting.some((o) => o.item === id)) continue;
    const p = ITEM_BY_ID[id];
    if (!itemUnlocked(s, p) || !stationFor(s, p)) return null;
    const step = nextStep(s, p, stock, depth + 1);
    if (step) return step;
  }
  return null;
}

/** The materials one of `def` still wants, all the way down its chain (its own, and its missing parts'). */
export function chainCost(s: GameState, def: ItemDef, depth = 0): Stock {
  const out: Stock = {};
  for (const [m, k] of costOf(def)) out[m] = (out[m] ?? 0) + k;
  if (depth >= MAX_DEPTH) return out;
  for (const [id, k] of missingOf(s, def)) {
    if (!PART_IDS.has(id)) continue;
    const p = ITEM_BY_ID[id];
    const runs = Math.ceil((k - (s.items[id] ?? 0)) / (p.yields ?? 1));
    for (const [m, n] of Object.entries(chainCost(s, p, depth + 1)) as [Material, number][]) out[m] = (out[m] ?? 0) + n * runs;
  }
  return out;
}

/** Gear whose parts the town might want a station for. */
const GEAR = ITEMS.filter((i) => (i.slot === 'weapon' || i.slot === 'tool' || i.slot === 'body' || i.slot === 'head' || i.slot === 'offhand') && partsOf(i).length);

/** The stations the parts of the gear the town can make want, that it hasn't built: each with its reason (the town
 *  recommends them; the founder builds). Kept while the research and the buildings stay the same. */
export function partStationWishes(s: GameState): { def: string; why: string }[] {
  const key = `${s.research.done.length}|${s.buildings.reduce((n, b) => n + (b.status === 'done' ? 1 : 0), 0)}|${s.cheats.unlockAll ? 1 : 0}`;
  if (wished?.s === s && wished.key === key) return wished.out;
  const out: { def: string; why: string }[] = [];
  for (const i of GEAR) {
    if (!itemUnlocked(s, i) || !stationFor(s, i)) continue;
    for (const [id] of partsOf(i)) {
      const p = ITEM_BY_ID[id];
      if (!itemUnlocked(s, p) || stationFor(s, p) || out.some((w) => w.def === p.station)) continue;
      out.push({ def: p.station, why: `to make the ${p.name.toLowerCase()} for the ${i.name.toLowerCase()}` });
    }
  }
  wished = { s, key, out };
  return out;
}
let wished: { s: GameState; key: string; out: { def: string; why: string }[] } | null = null;
