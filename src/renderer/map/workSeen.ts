// Work you can see (the owner's ask): the rules behind the map's felled trees and broken rock, the stockpile's heaps,
// the floating gains, the harvest left in the field, the laundry lines and a building's finishing. Pure (no Pixi), so
// the rules are tested; the drawing is in mapFelling.ts, mapStockpile.ts, mapGains.ts and mapChores.ts.

import { footprint } from '../../shared/sim/buildings';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CELL, type LandMap } from '../../shared/sim/land';
import type { Material, Stock } from '../../shared/data/materials';
import type { Building } from '../../shared/sim/state';
import type { Snapshot } from '../../shared/sim/snapshot';
import { TICKS_PER_DAY } from '../../shared/sim/time';

const mix = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* ------------------------------------------------------------ stumps and rubble */

/** The cells under a building's footprint or its yard's front row (no stump or rubble is drawn there). */
export function coveredCells(land: Pick<LandMap, 'w'>, buildings: Building[]): Set<number> {
  const out = new Set<number>();
  for (const b of buildings) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) out.add(y * land.w + x);
  }
  return out;
}

/** The wooded cells felled and not yet grown back (sim/regrow.ts): a stump stands on each, unless built over or a road. */
export function stumpCells(land: Pick<LandMap, 'w' | 'regrow' | 'roads'>, covered: Set<number>): number[] {
  const out: number[] = [];
  for (const [k, [was]] of Object.entries(land.regrow ?? {})) {
    const i = Number(k);
    if (was === 'forest' && !covered.has(i) && land.roads[i] !== '#') out.push(i);
  }
  return out.sort((a, b) => a - b);
}

/** The cells of rock broken up whose rubble still lies (sim/regrow.ts `RUBBLE_DAYS`). */
export function rubbleCells(land: Pick<LandMap, 'w' | 'rubble' | 'roads'>, covered: Set<number>): number[] {
  const out: number[] = [];
  for (const k of Object.keys(land.rubble ?? {})) {
    const i = Number(k);
    if (!covered.has(i) && land.roads[i] !== '#') out.push(i);
  }
  return out.sort((a, b) => a - b);
}

/** The stones of a cell's rubble (px from the cell's corner, and which of the pack's four stones), by the cell. */
export function rubbleBits(i: number): { x: number; y: number; k: number }[] {
  const n = 3 + Math.floor(mix(i, 1) * 3);
  const out: { x: number; y: number; k: number }[] = [];
  for (let j = 0; j < n; j++) out.push({ x: Math.round(5 + mix(i, 10 + j) * (CELL - 10)), y: Math.round(8 + mix(i, 20 + j) * (CELL - 12)), k: Math.floor(mix(i, 30 + j) * 4) });
  return out.sort((a, b) => a.y - b.y);
}

/** Which way a felled tree tips (1 right, -1 left), by its cell. */
export const fallWay = (i: number): 1 | -1 => (mix(i, 7) < 0.5 ? -1 : 1);

/* ------------------------------------------------------------ the stockpile */

export type PileKind = 'logs' | 'stone' | 'sacks' | 'barrels' | 'crates';
/** Heaps laid in this order, front to back. */
export const PILE_ORDER: PileKind[] = ['logs', 'stone', 'sacks', 'barrels', 'crates'];

/** What heap a material is kept in: logs, a pile of stone, sacks of food, barrels of drink and oil, else crates. */
export function pileOf(m: Material): PileKind {
  if (/^(wood|lumber)$/.test(m)) return 'logs';
  if (/stone|ore|coal|clay|flint|bricks|concrete|sulphur|gems|gold|rare_minerals|pearls/.test(m)) return 'stone';
  if (/^(grain|berries|vegetables|fruit|flour|bread|herbs|rations|kelp|fiber|wool|eggs|meat|dried_meat|fish)$/.test(m)) return 'sacks';
  if (/^(milk|oil|fuel|blood)$/.test(m)) return 'barrels';
  return 'crates';
}

/** A slot on the stockpile's ground (px from its picture's top-left corner) and the heap on it. */
export interface PileSlot {
  x: number;
  y: number;
  kind: PileKind;
}

/** The slots a stockpile's footprint holds (px apart): a grid, its back row first. */
export const SLOT_W = 15;
export const SLOT_H = 11;
export function slotGrid(cellsW: number, cellsH: number): { x: number; y: number }[] {
  const cols = Math.max(1, Math.floor((cellsW * CELL - 6) / SLOT_W));
  const rows = Math.max(1, Math.floor((cellsH * CELL - 8) / SLOT_H));
  const ox = (cellsW * CELL - cols * SLOT_W) / 2 + SLOT_W / 2;
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: Math.round(ox + c * SLOT_W), y: Math.round(10 + r * SLOT_H) });
  return out;
}

/** The heaps a stockpile shows for what it holds: each kind of heap as many slots as its share of a full store would
 *  fill (at least one while it holds any), so the heaps grow and shrink with the store. */
export function stockPiles(store: Stock, capacity: number, slots: number): Record<PileKind, number> {
  const units: Record<PileKind, number> = { logs: 0, stone: 0, sacks: 0, barrels: 0, crates: 0 };
  for (const [m, n] of Object.entries(store) as [Material, number][]) if (n > 0) units[pileOf(m)] += n;
  const per = Math.max(1, capacity / Math.max(1, slots));
  const out: Record<PileKind, number> = { logs: 0, stone: 0, sacks: 0, barrels: 0, crates: 0 };
  let left = slots;
  for (const k of PILE_ORDER) {
    if (units[k] <= 0 || left <= 0) continue;
    out[k] = Math.min(left, Math.max(1, Math.ceil(units[k] / per)));
    left -= out[k];
  }
  return out;
}

/** The heaps laid out on the slots: kinds dealt across the grid from the front row, each kind kept together. */
export function layPiles(counts: Record<PileKind, number>, grid: { x: number; y: number }[]): PileSlot[] {
  const order = [...grid].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: PileSlot[] = [];
  let at = 0;
  for (const k of PILE_ORDER) for (let j = 0; j < counts[k] && at < order.length; j++) out.push({ ...order[at++], kind: k });
  return out;
}

/* ------------------------------------------------------------ floating gains */

export interface Gain {
  kind: 'stored' | 'coins' | 'made';
  x: number;
  y: number;
  /** The material stored, or the item made. */
  what: string;
  n: number;
}

/** Ticks between two snapshots past which nothing is lifted (a catch-up after time away would be a fountain). */
export const GAINS_GAP = 40;
/** The most gains lifted from one snapshot to the next. */
export const GAINS_MOST = 6;

const storeTotal = (s: Snapshot): Stock => {
  const t: Stock = {};
  for (const b of s.buildings) for (const [m, n] of Object.entries(b.store ?? {}) as [Material, number][]) t[m] = (t[m] ?? 0) + n;
  return t;
};

/** What rises over the town between two snapshots: a load put into the stores (+3 wood over whoever stored it), a
 *  sale at a venue (coins at its door), a piece finished at a workshop (its picture over the station). */
export function gainsBetween(prev: Snapshot | null, next: Snapshot): Gain[] {
  if (!prev || next.tick <= prev.tick || next.tick - prev.tick > GAINS_GAP) return [];
  const out: Gain[] = [];
  // loads stored: what someone stopped carrying that the stores gained
  const before = storeTotal(prev);
  const after = storeTotal(next);
  const room: Stock = {};
  for (const [m, n] of Object.entries(after) as [Material, number][]) if (n > (before[m] ?? 0)) room[m] = n - (before[m] ?? 0);
  const was = new Map(prev.people.map((p) => [p.id, p]));
  for (const p of next.people) {
    const q = was.get(p.id);
    if (!q || p.away !== null || p.indoors) continue;
    for (const [m, n] of Object.entries(q.carrying) as [Material, number][]) {
      const k = Math.min(n - (p.carrying[m] ?? 0), room[m] ?? 0);
      if (k <= 0) continue;
      room[m] = (room[m] ?? 0) - k;
      out.push({ kind: 'stored', x: p.x, y: p.y, what: m, n: k });
    }
  }
  // sales at the venues
  const shops = new Map(prev.buildings.map((b) => [b.id, b.shop?.takings]));
  for (const b of next.buildings) {
    const t = b.shop?.takings;
    if (!t || !shops.has(b.id)) continue;
    const o = shops.get(b.id);
    const k = o && o.day === t.day ? t.today - o.today : o ? t.today : 0;
    if (k > 0) out.push({ kind: 'coins', ...doorOf(b), what: 'coins', n: Math.round(k) });
  }
  // pieces finished at the workshops
  const orders = new Map(prev.crafting.map((o) => [o.id, o]));
  const at = new Map(next.buildings.map((b) => [b.id, b]));
  const lift = (station: number | null, item: string, n: number) => {
    const b = station != null ? at.get(station) : undefined;
    if (b && n > 0) out.push({ kind: 'made', ...doorOf(b), what: item, n });
  };
  for (const o of next.crafting) {
    const q = orders.get(o.id);
    if (q && o.made > q.made) lift(o.station, o.item, o.made - q.made);
    orders.delete(o.id);
  }
  // (an order gone that was under way: its last piece was finished)
  for (const q of orders.values()) if (q.progress > 0 || q.crafter) lift(q.station, q.item, 1);
  return out.slice(0, GAINS_MOST);
}

/** A building's door (world px): the middle of its front edge. */
export function doorOf(b: Building): { x: number; y: number } {
  const f = footprint(b);
  return { x: (f.x + f.w / 2) * CELL, y: (f.y + f.h) * CELL - 4 };
}

/* ------------------------------------------------------------ a building finished */

export interface Finished {
  id: number;
  x: number;
  y: number;
  /** Its picture's top (world px), where the flag goes up. */
  top: number;
  w: number;
  /** Who was building it (they cheer). */
  builders: number[];
}

/** How near (px) someone at work counts as one of a site's builders. */
const BUILDER_NEAR = 2.5 * CELL;

/** The buildings finished between two snapshots (a site become a building), with who was working on them. Not a
 *  plot, a wall piece or a castle's room, which go up without ceremony. */
export function finishedBetween(prev: Snapshot | null, next: Snapshot): Finished[] {
  if (!prev || next.tick <= prev.tick || next.tick - prev.tick > GAINS_GAP) return [];
  const was = new Map(prev.buildings.map((b) => [b.id, b]));
  const out: Finished[] = [];
  for (const b of next.buildings) {
    const q = was.get(b.id);
    if (!q || q.status !== 'blueprint' || b.status !== 'done' || b.room || b.ring !== undefined || b.crop || b.herd) continue;
    const f = footprint(b);
    const x = (f.x + f.w / 2) * CELL;
    const y = (f.y + f.h) * CELL;
    const builders = prev.people
      .filter((p) => (p.activity === 'build' || next.people.some((n) => n.id === p.id && n.activity === 'build')) && Math.abs(p.x - x) < f.w * CELL * 0.5 + BUILDER_NEAR && Math.abs(p.y - (f.y + f.h / 2) * CELL) < f.h * CELL * 0.5 + BUILDER_NEAR)
      .map((p) => p.id);
    out.push({ id: b.id, x, y, top: f.y * CELL - 14, w: f.w * CELL, builders });
  }
  return out;
}

/* ------------------------------------------------------------ the harvest left in the field */

/** Days the sheaves and haystacks stand on the stubble after the reaping. */
export const HAY_DAYS = 3;

/** The haystacks standing on a field reaped in the last `HAY_DAYS`, about one a cell (px from the footprint's corner),
 *  but none where it has been sown again (`sown`: the share of its sowing done, which runs left to right). An orchard
 *  never goes fallow, so it keeps none. */
export function hayStacks(b: Pick<Building, 'id' | 'def' | 'tile' | 'row' | 'crop' | 'wide'>, tick: number, sown: number): { x: number; y: number }[] {
  const c = b.crop;
  if (!c || c.stage !== 'fallow' || c.reaped === undefined || tick - c.reaped > HAY_DAYS * TICKS_PER_DAY || tick < c.reaped) return [];
  const f = footprint(b);
  const out: { x: number; y: number }[] = [];
  for (let s = 0; s < f.w; s++)
    for (let r = 0; r < Math.max(1, f.h); r++) {
      if ((s + 0.5) / f.w < sown || mix(b.id * 31 + s, r) < 0.25) continue; // (not one on every cell)
      out.push({ x: Math.round(s * CELL + 8 + mix(b.id + s, 40 + r) * (CELL - 16)), y: Math.round(r * CELL + 14 + mix(b.id + s, 60 + r) * (CELL - 16)) });
    }
  return out;
}

/* ------------------------------------------------------------ sowing, the well, the washing */

/** A sower's arm swings out every `SOW_EVERY` ms (by their id), scattering a handful for `SOW_THROW` of it. */
export const SOW_EVERY = 1100;
export const SOW_THROW = 0.3;
export const sowThrow = (now: number, id: number): boolean => ((now + id * 377) % SOW_EVERY) / SOW_EVERY < SOW_THROW;

/** The share of homes with a washing line by their door, and the weather it's hung out in. */
export const LAUNDRY_SHARE = 0.35;
export function hasLaundry(b: Pick<Building, 'id' | 'def' | 'status' | 'room'>): boolean {
  const homes = BUILDING_BY_ID[b.def]?.housing ?? 0;
  return b.status === 'done' && !b.room && homes > 0 && homes <= 10 && mix(b.id, 91) < LAUNDRY_SHARE;
}
/** The washing is out by day in fair weather (not rain, snow, a storm or fog), and never in winter. */
export function laundryOut(weather: string, season: string, daylight: number): boolean {
  return daylight > 0.5 && season !== 'winter' && (weather === 'clear' || weather === 'cloudy');
}
/** The clothes on a line: colours by the home, three to five pieces. */
export function laundryPieces(id: number): { colour: number; w: number; h: number }[] {
  const COLOURS = [0xf0ece0, 0xc8d8e8, 0xd88a6a, 0x8aa8c8, 0xe0c870, 0xa8c890, 0xf4f4f4, 0xb890b0];
  const n = 3 + Math.floor(mix(id, 3) * 3);
  return Array.from({ length: n }, (_, j) => ({ colour: COLOURS[Math.floor(mix(id, 50 + j) * COLOURS.length)], w: 4 + Math.floor(mix(id, 70 + j) * 3), h: 5 + Math.floor(mix(id, 80 + j) * 4) }));
}
