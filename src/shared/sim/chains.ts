// Crafting chains for the planner (data/chains.ts): whether the town can make a thing through its parts, what to queue
// next on the way to it, and what the whole chain still wants from the land. Nothing is queued until its makings are
// in hand, as before: a finished piece waits for its parts, and a part for its materials.

import { PART_IDS, partsOf, RARE_SET } from '../data/chains';
import { ITEM_BY_ID, ITEMS, type ItemDef } from '../data/items';
import type { Material, Stock } from '../data/materials';
import { itemUnlocked, stationFor } from './crafting';
import type { ExpeditionType } from '../data/expeditions';
import { hashSeed, Rng } from '../rng';
import { addStock, notify, type Expedition, type GameState, type Person } from './state';

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

/* ------------------------------------------------------------ rare inputs from the land and from quests */

/** The chance a unit of wood felled from the Medieval age on comes with heartwood (an old tree's core). */
export const HEARTWOOD_CHANCE = 1 / 80;

/** Felling: now and then the tree is an old one, with heartwood at its core (on the chains' own stream). */
export function fellHeartwood(s: GameState, p: Person): void {
  if (!s.autopilot || s.era === 'neolithic') return;
  if (!new Rng(hashSeed(`${s.seed}:heartwood:${s.tick}:${p.id}`)).chance(HEARTWOOD_CHANCE)) return;
  addStock(p.carrying, 'heartwood', 1);
  notify(s, `${p.name} felled an old tree with heartwood at its core.`);
}

/** What a party may bring home besides its loot, by the kind of trip: the chance, and the rare inputs it may be. A
 *  trade trip brings what it buys (data/minerals.ts) instead. */
export const RARE_FINDS: Partial<Record<ExpeditionType, [number, Partial<Record<Material, number>>]>> = {
  gather: [0.1, { heartwood: 3, silver: 1 }],
  hunt: [0.25, { thick_pelt: 3, heartwood: 1 }],
  scout: [0.1, { heartwood: 1, silver: 1, gems: 1 }],
  rescue: [0.15, { silver: 2, gems: 1 }],
  salvage: [0.3, { silver: 2, gems: 1, heartwood: 1 }],
  clear: [0.4, { silver: 2, gems: 1, thick_pelt: 1 }],
  delve: [0.5, { gems: 2, silver: 2, thick_pelt: 1 }],
  legendary: [0.8, { gems: 2, silver: 1, heartwood: 1, pearls: 1 }],
};

/** A party home from a quest (not recalled): maybe a rare input in its loot (two from a legendary trip or a cleared
 *  delve), from the Medieval age on. Rolled on the chains' own stream. */
export function rareFind(s: GameState, e: Expedition, type: ExpeditionType): void {
  const find = RARE_FINDS[type];
  if (!find || !s.autopilot || s.era === 'neolithic' || e.recalled) return;
  const rng = new Rng(hashSeed(`${s.seed}:rarefind:${s.tick}:${e.id}`));
  if (!rng.chance(find[0])) return;
  const n = type === 'legendary' || (type === 'delve' && e.cleared) ? 2 : 1;
  for (let k = 0; k < n; k++) addStock(e.loot, rng.weighted(find[1] as Record<Material, number>), 1);
}
