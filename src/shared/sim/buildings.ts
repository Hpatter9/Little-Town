// Building rules shared by the sim and the renderer (the placement ghost uses canPlace too).

import { castleOn, castleSpan } from './castle';
import { BACK_PAD_TILES, TILE } from '../constants';
import { BUILD_QUEUE_SLOTS, BUILDING_BY_ID, DEMOLISH_REFUND, UPGRADES, type BuildingDef } from '../data/buildings';
import { TOPIC_BY_ID } from '../data/research';
import { MAX_POTS, POT_STORAGE } from '../data/items';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import type { BackTerrain } from '../world';
import { modifiers } from './research';
import { addStock, notify, poolSize, type Building, type GameState, type TileState } from './state';

/** Background terrain a background building can go on. */
const BACK_BUILDABLE: ReadonlySet<BackTerrain> = new Set(['meadow', 'fertile']);
/** Background wilds that are cleared along with the land in front of them (a river never is). */
const BACK_CLEARABLE: ReadonlySet<BackTerrain> = new Set(['forest', 'hills', 'marsh']);

/** The background column behind tile t as it is now: its forest, hills or marsh are gone once the land in front of it
 *  has been cleared (the town clears outward, the fields behind it too). */
export function backNow(back: readonly BackTerrain[], tiles: readonly Pick<TileState, 'terrain'>[], t: number): BackTerrain | 'cleared' {
  const kind = back[t + BACK_PAD_TILES];
  return BACK_CLEARABLE.has(kind) && tiles[t]?.terrain === 'clear' ? 'cleared' : kind;
}

/** Whether a background building can stand behind tile t. */
export const backOpen = (back: readonly BackTerrain[], tiles: readonly Pick<TileState, 'terrain'>[], t: number) => {
  const k = backNow(back, tiles, t);
  return k === 'cleared' || BACK_BUILDABLE.has(k);
};

/** A town walled at both ends: the span between its outermost finished walls, and the best wall kind among them (for
 *  the far wall drawn round it), or null. */
export function enclosure(s: GameState): { lo: number; hi: number; wall: string } | null {
  // (a nomad camp's wagon circle doesn't count: it's drawn up only while raiders are about)
  const isWall = (d: BuildingDef | undefined) => !!d && !!d.hp && d.width === 1 && !d.defense && !d.never;
  const town = s.buildings.filter((b) => defOf(b)?.layer !== 'back' && !isWall(defOf(b)) && !defOf(b)?.never);
  const walls = s.buildings.filter((b) => b.status === 'done' && isWall(defOf(b)));
  if (!town.length || walls.length < 2) return null;
  const lo = Math.min(...town.map((b) => b.tile));
  const hi = Math.max(...town.map((b) => b.tile + defOf(b).width));
  const left = walls.filter((w) => w.tile < lo).sort((a, b) => a.tile - b.tile)[0];
  const right = walls.filter((w) => w.tile >= hi).sort((a, b) => b.tile - a.tile)[0];
  if (!left || !right) return null;
  const best = [left, right].map(defOf).sort((a, b) => (a.hp ?? 0) - (b.hp ?? 0))[0]; // (the weaker end is what it's walled with)
  return { lo: left.tile, hi: right.tile + 1, wall: best.id };
}

export const defOf = (b: { def: string }): BuildingDef => BUILDING_BY_ID[b.def];

/** World x of a building's centre (where workers stand). Background tiles line up with world columns. */
export function buildingCentreX(b: { def: string; tile: number }): number {
  return (b.tile + defOf(b).width / 2) * TILE;
}

/** Whether a building can be placed: its research is done (or the debug unlock is on). */
export function isUnlocked(u: { unlockAll: boolean; done: readonly string[] }, def: BuildingDef): boolean {
  return !def.research || u.unlockAll || u.done.includes(def.research);
}

export const unlockInfo = (s: GameState) => ({ unlockAll: s.cheats.unlockAll, done: s.research.done });

/* ------------------------------------------------------------ storage */

export function storageCapacity(s: GameState, b: Building): number {
  const base = b.status === 'done' ? (defOf(b).storage ?? 0) : 0;
  const pots = b.def === 'campfire' && b.status === 'done' ? potStorage(s) : 0;
  return Math.floor(base * modifiers(s.research).storage) + pots;
}

/** Extra campfire storage from clay pots. */
export const potStorage = (s: Pick<GameState, 'items'>) => Math.min(MAX_POTS, s.items.clay_pot ?? 0) * POT_STORAGE;

export function storageFree(s: GameState, b: Building): number {
  return storageCapacity(s, b) - poolSize(b.store);
}

export function storages(s: GameState): Building[] {
  return s.buildings.filter((b) => storageCapacity(s, b) > 0);
}

/** Everything held in storage, summed. */
export function totalStock(s: GameState): Stock {
  const out: Stock = {};
  for (const b of storages(s)) for (const m of MATERIALS) if (b.store[m]) addStock(out, m, b.store[m]!);
  return out;
}

export function totalCapacity(s: GameState): number {
  return storages(s).reduce((n, b) => n + storageCapacity(s, b), 0);
}

/** Put materials into storage, nearest to x first. Returns what didn't fit. */
export function depositNear(s: GameState, x: number, stock: Stock): Stock {
  const left: Stock = { ...stock };
  const byDistance = storages(s).sort((a, b) => Math.abs(buildingCentreX(a) - x) - Math.abs(buildingCentreX(b) - x));
  for (const st of byDistance) {
    for (const m of MATERIALS) {
      const n = Math.min(left[m] ?? 0, storageFree(s, st));
      if (n <= 0) continue;
      addStock(st.store, m, n);
      addStock(left, m, -n);
    }
  }
  return left;
}

/** Throw out all of one material from a storage building. Returns how much was discarded. */
export function discardStock(s: GameState, id: number, m: Material): number {
  const b = s.buildings.find((q) => q.id === id);
  const n = b?.store[m] ?? 0;
  if (!b || n <= 0 || m === 'totem') return 0; // (the Bear Cave's totem can't be thrown out)
  delete b.store[m];
  return n;
}

/* ------------------------------------------------------------ construction */

/** Materials a blueprint still needs delivered. */
export function stillNeeded(b: Building): Stock {
  const out: Stock = {};
  for (const [m, n] of Object.entries(defOf(b).cost) as [Material, number][]) {
    const need = n - (b.delivered[m] ?? 0);
    if (need > 0) out[m] = need;
  }
  return out;
}

/** Blueprints allowed at once (research adds more). */
export const buildSlots = (s: Pick<GameState, 'research'>) => BUILD_QUEUE_SLOTS + modifiers(s.research).queueSlots;

export function blueprintCount(s: Pick<GameState, 'buildings'>): number {
  return s.buildings.filter((b) => b.status === 'blueprint').length;
}

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** Whether `def` fits with its left edge on `tile` (terrain, bounds, overlap), on a castle floor (0: the ground). */
export function canPlace(
  view: { tiles: readonly Pick<TileState, 'terrain'>[]; buildings: readonly Pick<Building, 'def' | 'tile' | 'floor'>[] },
  back: readonly BackTerrain[],
  def: BuildingDef,
  tile: number,
  floor = 0,
): PlaceCheck {
  if (tile < 0 || tile + def.width > view.tiles.length) return { ok: false, reason: 'Outside the town' };
  for (let t = tile; t < tile + def.width; t++) {
    if (def.layer === 'back') {
      if (!backOpen(back, view.tiles, t)) return { ok: false, reason: back[t + BACK_PAD_TILES] === 'river' ? 'The river runs here' : 'Clear the land in front of it first' };
    } else if (view.tiles[t].terrain !== 'clear') {
      return { ok: false, reason: 'Clear the land first' };
    }
  }
  for (const b of view.buildings) {
    const d = defOf(b);
    if (d.layer === def.layer && (b.floor ?? 0) === floor && b.tile < tile + def.width && tile < b.tile + d.width) return { ok: false, reason: `Overlaps ${d.name}` };
  }
  return { ok: true };
}

/** Place a blueprint (a castle's room: on a floor). Returns the reason on failure. */
export function placeBlueprint(s: GameState, back: readonly BackTerrain[], defId: string, tile: number, room?: { floor: number }): PlaceCheck {
  const def = BUILDING_BY_ID[defId];
  if (!def || def.never) return { ok: false, reason: 'Unknown building' };
  if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: 'Not researched yet' };
  if (blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: 'Construction queue is full' };
  const check = canPlace(s, back, def, tile, room?.floor ?? 0);
  if (!check.ok) return check;
  s.buildings.push({ id: s.nextId++, def: defId, tile, status: 'blueprint', delivered: {}, progress: 0, store: {}, ...(room ? { room: true, floor: room.floor } : {}) });
  return { ok: true };
}

/** Whether a finished building can be upgraded in place now, and to what. */
export function canUpgrade(s: GameState, back: readonly BackTerrain[], id: number, absorb?: number): PlaceCheck & { to?: string; tile?: number } {
  const b = s.buildings.find((q) => q.id === id);
  const to = b && UPGRADES[b.def];
  if (!b || !to || b.status !== 'done') return { ok: false, reason: 'Nothing to upgrade to' };
  const def = BUILDING_BY_ID[to];
  if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: `Needs research: ${TOPIC_BY_ID[def.research!]?.name ?? def.research}`, to };
  if (blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: 'Construction queue is full', to };
  if (b.fire !== undefined) return { ok: false, reason: 'It is on fire', to };
  // it may grow: keep its left edge if there's room, else grow to the left
  // (absorbing a neighbour: it's pulled down to make room, so it doesn't count as in the way)
  const others = { tiles: s.tiles, buildings: s.buildings.filter((q) => q !== b && q.id !== absorb) };
  const grow = def.width - defOf(b).width;
  for (const tile of grow > 0 ? [b.tile, b.tile - grow] : [b.tile]) {
    // (a castle's room grows within the keep)
    if (b.room && ((b.floor ?? 0) > 0 || castleOn(s))) {
      const [lo, hi] = castleSpan(s);
      if (tile < lo || tile + def.width > hi) continue;
    }
    if (canPlace(others, back, def, tile, b.floor ?? 0).ok) return { ok: true, to, tile };
  }
  return { ok: false, reason: `No room for the ${def.name}`, to };
}

/**
 * Rebuild a finished building as its upgrade, where it stands: half the old building's materials go into
 * the new one, and it's a blueprint (not working) until finished.
 */
export function upgrade(s: GameState, back: readonly BackTerrain[], id: number, absorb?: number): PlaceCheck {
  const check = canUpgrade(s, back, id, absorb);
  if (!check.ok) return check;
  const b = s.buildings.find((q) => q.id === id)!;
  const next = BUILDING_BY_ID[check.to!];
  // salvage: half the old cost (and of a neighbour pulled down with it), as far as the new building needs it; the
  // rest (and what they stored) goes to storage
  const salvage: Stock = {};
  const merged = absorb === undefined ? undefined : s.buildings.find((q) => q.id === absorb);
  for (const old of merged ? [b, merged] : [b]) {
    for (const [m, n] of Object.entries(defOf(old).cost) as [Material, number][]) addStock(salvage, m, Math.floor(n * DEMOLISH_REFUND));
    for (const m of MATERIALS) if (old.store[m]) addStock(salvage, m, old.store[m]!);
  }
  if (merged) s.buildings.splice(s.buildings.indexOf(merged), 1);
  const delivered: Stock = {};
  for (const [m, n] of Object.entries(next.cost) as [Material, number][]) {
    const k = Math.min(n, salvage[m] ?? 0);
    if (k > 0) {
      delivered[m] = k;
      addStock(salvage, m, -k);
    }
  }
  const x = buildingCentreX(b);
  b.def = next.id;
  b.tile = check.tile!;
  b.status = 'blueprint';
  b.progress = 0;
  b.delivered = delivered;
  b.store = {};
  delete b.hp;
  delete b.readyTick;
  depositNear(s, x, salvage);
  notify(s, `Upgrading to a ${next.name}.`);
  return { ok: true };
}

/**
 * Cancel a blueprint (refunds everything delivered) or demolish a finished building (refunds part of
 * its cost). Refunds and stored contents go to the nearest storage with room; anything else is lost.
 */
export function demolish(s: GameState, id: number): void {
  const i = s.buildings.findIndex((b) => b.id === id);
  if (i < 0) return;
  const b = s.buildings[i];
  const refund: Stock = { ...b.delivered };
  if (b.status === 'done') {
    for (const [m, n] of Object.entries(defOf(b).cost) as [Material, number][]) refund[m] = Math.floor(n * DEMOLISH_REFUND);
    for (const m of MATERIALS) if (b.store[m]) addStock(refund, m, b.store[m]!);
  }
  s.buildings.splice(i, 1);
  depositNear(s, buildingCentreX(b), refund);
}
