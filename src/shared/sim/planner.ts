// The town runs itself (the "ant farm"): every quarter of a game hour it looks at what it needs and decides what
// to research, what to craft, what to build (and where), and which land to gather from. The player doesn't place
// buildings or pick research any more; they set the town's direction and send out expeditions. What it decided,
// and why, is kept in `s.plan` for the panels to show.

import { BUILDINGS, BUILDING_BY_ID, UPGRADES, type BuildingDef } from '../data/buildings';
import { CROPS, WORKPLACES } from '../data/crops';
import { ITEMS, ITEM_BY_ID, MAX_POTS, type ItemDef } from '../data/items';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { RESEARCH_STATIONS, TOPICS, type Topic } from '../data/research';
import { TERRAIN } from '../data/terrain';
import type { BackTerrain } from '../world';
import { blueprintCount, buildSlots, canPlace, canUpgrade, isUnlocked, placeBlueprint, stillNeeded, storages, totalCapacity, totalStock, unlockInfo, upgrade } from './buildings';
import { craftNeeded, craftSlots, itemUnlocked, queueCraft, reduceCraft, stationFor } from './crafting';
import { canQueue, modifiers, queueResearch } from './research';
import { acceptVisitor, housingCapacity } from './townsfolk';
import { addStock, campX, type Building, type GameState } from './state';
import { TILE } from '../constants';
import { TICKS_PER_HOUR } from './time';
import { COIN_RESERVE, FARE, PIECE_RATE, saleValue, FARE_STOCK, furnishes, isShop, isTavern, PURSE_SCALE, tiersDrawn, travellerGoods, VENUE_CHAIN, venueOfDef, WARE_STOCK, WARES } from '../data/shop';
import { wageBill } from './wages';
import { appealGain, attractiveness, extend, extensionPrice, improve, levelPrice, SALE_GEAR, shopOf, spotFor, tavernOf, venueKind, wouldFurnish } from './shop';
import { gearScore } from './crafting';

/* ------------------------------------------------------------ the town's direction */

export type Direction = 'growth' | 'defense' | 'trade' | 'knowledge';
export const DIRECTIONS: readonly Direction[] = ['growth', 'defense', 'trade', 'knowledge'];
export const DIRECTION_DEFS: Record<Direction, { name: string; description: string; branches: readonly string[] }> = {
  growth: { name: 'Growth', description: 'More people: homes, food and building come first.', branches: ['construction', 'agriculture', 'society'] },
  defense: { name: 'Defence', description: 'Walls, towers and weapons before anything else.', branches: ['military', 'medicine'] },
  trade: { name: 'Trade', description: 'Workshops, crafts and the market: make things and sell them.', branches: ['crafting', 'logistics'] },
  knowledge: { name: 'Knowledge', description: 'Research first: stations, schools and books.', branches: ['society', 'medicine', 'logistics'] },
};
export const directionOf = (s: GameState): Direction => s.direction ?? 'growth';

/** How often the town takes stock and decides (game ticks). */
export const PLAN_TICKS = TICKS_PER_HOUR / 4;
/** New homes at most this often (game ticks), once there are a few people. */
const HOME_EVERY = 12 * TICKS_PER_HOUR;
/** Most wild tiles marked for gathering at once: this many plus one per person. */
const BASE_MARKED = 2;

export interface TownPlan {
  /** What it last decided to build, and why. */
  build: { def: string; why: string } | null;
  /** What it's researching next, and why. */
  research: { id: string; why: string } | null;
  /** What it's gathering for (material names). */
  gathering: string[];
  /** What it can't do yet, for the panels (e.g. "No room to build: clearing land"). */
  waiting: string[];
  /** When it last started a home (the town grows a home at a time). */
  lastHome?: number;
}

/* ------------------------------------------------------------ what the town needs */

interface Needs {
  people: number;
  freeBeds: number;
  foodDays: number;
  storageFill: number;
  stock: Stock;
  /** Materials wanted: what blueprints and craft orders still need, plus a small reserve. */
  demand: Stock;
  raided: boolean;
  direction: Direction;
  /** Materials the town wants but can't gather, grow or make: only travellers can sell it them. */
  unsourced: Material[];
  /** Customer tiers the shop draws that the town can't make a single ware for yet (their research is wanted). */
  wareGaps: number[];
}

/** A small stock the town likes to keep of each basic material it can get (so building never waits long). */
const RESERVE: Partial<Record<Material, number>> = { wood: 20, stone: 12, fiber: 8, lumber: 12, bricks: 10, cloth: 4, iron: 4 };

function needs(s: GameState): Needs {
  const stock = totalStock(s);
  const eaters = s.people.filter((p) => p.monster !== 'undead').length || 1;
  const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (stock[m] ?? 0) * v, 0);
  const demand: Stock = {};
  const want = (m: Material, n: number) => (demand[m] = (demand[m] ?? 0) + n);
  for (const b of s.buildings) if (b.status === 'blueprint') for (const [m, n] of Object.entries(stillNeeded(b)) as [Material, number][]) want(m, n);
  for (const o of s.crafting) for (const [m, n] of Object.entries(craftNeeded(o)) as [Material, number][]) want(m, n * o.count);
  for (const [m, n] of Object.entries(RESERVE) as [Material, number][]) if (sourceable(s, m)) want(m, n);
  const used = MATERIALS.reduce((n, m) => n + (stock[m] ?? 0), 0);
  // (homes already started count: they're beds on the way)
  const coming = s.buildings.filter((b) => b.status === 'blueprint').reduce((k, b) => k + (BUILDING_BY_ID[b.def]?.housing ?? 0), 0);
  // (the basics every town builds with, and whatever a blueprint is waiting on)
  const wanted = new Set<Material>(['wood', 'stone', 'fiber']);
  for (const b of s.buildings) if (b.status === 'blueprint') for (const m of Object.keys(stillNeeded(b)) as Material[]) wanted.add(m);
  const shop = shopOf(s);
  const drawn = shop ? tiersDrawn(attractiveness(s, shop)).map((c) => c.tier) : [];
  return {
    wareGaps: drawn.filter((t) => t > 1 && !WARES.some((w) => w.ware!.tier === t && itemUnlocked(s, w))),
    unsourced: [...wanted].filter((m) => m !== 'totem' && !sourceable(s, m, 0, false)),
    people: s.people.length,
    freeBeds: housingCapacity(s) + coming - s.people.length,
    foodDays: food / eaters,
    storageFill: used / Math.max(1, totalCapacity(s)),
    stock,
    demand,
    raided: s.journal.some((j) => j.text.startsWith('Raid by')),
    direction: directionOf(s),
  };
}

/* ------------------------------------------------------------ where materials come from */

const GATHERABLE = new Set<Material>(Object.values(TERRAIN).flatMap((t) => Object.keys(t.pool) as Material[]));
const RECIPES_FOR = (m: Material) => ITEMS.filter((i) => i.makes && (i.makes as Stock)[m]);

const unlocked = (s: GameState, id: string) => !!BUILDING_BY_ID[id] && isUnlocked(unlockInfo(s), BUILDING_BY_ID[id]);
const planned = (s: GameState, id: string) => s.buildings.some((b) => b.def === id);

/** Whether the town has a way to get a material: from the land, a field, a mine, or a recipe it can make (its
 *  station built or at least unlocked, and the recipe's own inputs obtainable), or (unless `buy` is off) from the
 *  travellers who stop at its shop. */
function sourceable(s: GameState, m: Material, depth = 0, buy = true): boolean {
  if (depth > 3) return false;
  if (buy && buyable(s, m)) return true;
  if (GATHERABLE.has(m) && s.tiles.some((t) => t.terrain !== 'clear' && (t.pool[m] ?? 0) > 0)) return true;
  for (const [id, c] of Object.entries(CROPS)) if (c.material === m && unlocked(s, id)) return true;
  for (const [id, w] of Object.entries(WORKPLACES)) if ((w.outputs as Stock)[m] && unlocked(s, id)) return true;
  return RECIPES_FOR(m).some((r) => itemUnlocked(s, r) && unlocked(s, r.station) && (Object.keys(r.cost) as Material[]).every((i) => sourceable(s, i, depth + 1, buy)));
}

/** Travellers sell it, and the town has a shop for them to stop at. */
const buyable = (s: GameState, m: Material) => !!shopOf(s) && travellerGoods(s.era).includes(m);

/** Whether every material a building costs can be had (the totem only if it's already in store). */
function affordable(s: GameState, def: BuildingDef, stock: Stock): boolean {
  return (Object.entries(def.cost) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n || (m !== 'totem' && sourceable(s, m)));
}

/* ------------------------------------------------------------ research */

const BRANCH_OF = (t: Topic) => t.branch as string;

function topicScore(t: Topic, n: Needs): number {
  let score = 60 / Math.sqrt(t.seconds); // quicker topics first, all else equal
  for (const b of BUILDINGS.filter((d) => d.research === t.id)) {
    score += 4;
    if (b.housing && n.freeBeds <= 1) score += 30;
    if (CROPS[b.id] && n.foodDays < 5) score += 25;
    if (b.storage && n.storageFill > 0.6) score += 15;
    if (RESEARCH_STATIONS[b.id]) score += 15;
    if (WORKPLACES[b.id]) score += 10;
    if (b.healing) score += 8;
    if (b.hp || b.defense) score += n.raided || n.direction === 'defense' ? 14 : 2;
    if (b.stalls || b.id === 'tavern') score += n.direction === 'trade' ? 12 : 3;
    // (a shop is the only way to get what the land doesn't give: without it the town can't build at all)
    if (isShop(b.id)) score += (n.unsourced.length ? 60 : 0) + (n.direction === 'trade' ? 12 : 3);
    if (isTavern(b.id)) score += n.direction === 'trade' ? 12 : 3;
  }
  // (wares for the grand customers the shop draws, which it has nothing to sell yet)
  if (ITEMS.some((i) => i.ware && n.wareGaps.includes(i.ware.tier) && i.research.includes(t.id))) score += n.direction === 'trade' ? 30 : 15;
  const items = ITEMS.filter((i) => i.research.includes(t.id)).length;
  score += Math.min(12, items * 3);
  for (const e of t.effects) {
    if (e.type === 'eraCapstone') score += 30;
    else if (e.type === 'researchSpeed' || e.type === 'researchSlots') score += n.direction === 'knowledge' ? 18 : 8;
    else if (e.type === 'storage') score += n.storageFill > 0.6 ? 15 : 4;
    else score += 6;
  }
  if (DIRECTION_DEFS[n.direction].branches.includes(BRANCH_OF(t))) score *= 1.6;
  if (t.branch === 'occult') score *= 0.35; // (the town dabbles, but it's not what it's for)
  return score;
}

function whyTopic(t: Topic, n: Needs): string {
  const unlocks = BUILDINGS.filter((d) => d.research === t.id);
  if (unlocks.some((b) => b.housing) && n.freeBeds <= 1) return 'the town needs more beds';
  if (unlocks.some((b) => CROPS[b.id]) && n.foodDays < 5) return 'food is running short';
  if (unlocks.some((b) => isShop(b.id)) && n.unsourced.length) return `it can't get ${names(n.unsourced)} any other way`;
  if (ITEMS.some((i) => i.ware && n.wareGaps.includes(i.ware.tier) && i.research.includes(t.id))) return 'the shop\'s grander customers want finer wares';
  if (t.effects.some((e) => e.type === 'eraCapstone')) return 'it leads to the next era';
  if (DIRECTION_DEFS[n.direction].branches.includes(BRANCH_OF(t))) return `the town is set on ${DIRECTION_DEFS[n.direction].name.toLowerCase()}`;
  return 'it opens new things to build and make';
}

function planResearch(s: GameState, n: Needs, plan: TownPlan): void {
  const slots = modifiers(s.research).researchSlots;
  while (s.research.queue.length < slots) {
    let best: Topic | null = null;
    let bestScore = -Infinity;
    for (const t of TOPICS) {
      if (!canQueue(s.research, t.id, s.era).ok) continue;
      const sc = topicScore(t, n);
      if (sc > bestScore) {
        best = t;
        bestScore = sc;
      }
    }
    if (!best) break;
    queueResearch(s.research, best.id, s.era);
  }
  const head = s.research.queue[0];
  const t = head ? TOPICS.find((q) => q.id === head) : undefined;
  plan.research = t ? { id: t.id, why: whyTopic(t, n) } : null;
}

/* ------------------------------------------------------------ crafting */

const toolPower = (i: ItemDef) => Math.max(0, ...Object.values(i.effects.gather ?? {}), i.effects.construct ?? 0);
const kept = (s: GameState, pred: (i: ItemDef) => boolean) =>
  ITEMS.filter(pred).reduce((n, i) => n + (s.items[i.id] ?? 0), 0) + s.people.reduce((n, p) => n + Object.values(p.gear).filter((id) => id && pred(ITEM_BY_ID[id])).length, 0);
const ordered = (s: GameState, pred: (i: ItemDef) => boolean) => s.crafting.filter((o) => pred(ITEM_BY_ID[o.item])).reduce((n, o) => n + o.count, 0);

/** Whether the town has the makings of one piece right now: its materials in store, and any items it's made from. */
function inputsReady(s: GameState, i: ItemDef, stock: Stock): boolean {
  return (Object.entries(i.cost) as [Material, number][]).every(([m, k]) => (stock[m] ?? 0) >= k) && Object.entries(i.items ?? {}).every(([id, k]) => (s.items[id] ?? 0) >= k);
}

/** The best thing of a kind the town can make at all (unlocked, its station built, anything it's made from in hand). */
function bestMakeable(s: GameState, pred: (i: ItemDef) => boolean, power: (i: ItemDef) => number): ItemDef | undefined {
  return ITEMS.filter((i) => pred(i) && !i.research.includes('__relic') && itemUnlocked(s, i) && stationFor(s, i) && Object.entries(i.items ?? {}).every(([id, k]) => (s.items[id] ?? 0) >= k))
    .sort((a, b) => power(b) - power(a))[0];
}

/** Decide what to make. Returns the materials it wanted but lacked (so they can be gathered). Nothing is queued
 *  until its makings are in store, so an order never sits blocking the queue. */
function planCrafting(s: GameState, n: Needs): Stock {
  const want: Stock = {};
  const lack = (i: ItemDef) => {
    for (const [m, k] of Object.entries(i.cost) as [Material, number][]) if ((n.stock[m] ?? 0) < k) want[m] = Math.max(want[m] ?? 0, k);
  };
  const tryMake = (i: ItemDef | undefined) => {
    if (!i) return;
    if (inputsReady(s, i, n.stock)) queueCraft(s, i.id);
    else lack(i);
  };
  // orders that can't go on (their makings are gone and can't be got) are dropped
  for (const o of [...s.crafting]) {
    const def = ITEM_BY_ID[o.item];
    const stuck = (!o.itemsTaken && Object.entries(def.items ?? {}).some(([id, k]) => (s.items[id] ?? 0) < k)) || (Object.keys(craftNeeded(o)) as Material[]).some((m) => (n.stock[m] ?? 0) === 0 && !sourceable(s, m));
    if (stuck) reduceCraft(s, o.id, true);
  }
  const room = () => s.crafting.length < craftSlots(s);
  const adults = s.people.filter((p) => p.bornTick == null).length;

  // 1. materials the town is short of, which a workshop can make (lumber for a cottage, bricks for a bakery...)
  for (const m of MATERIALS) {
    const short = (n.demand[m] ?? 0) - (n.stock[m] ?? 0);
    if (short <= 0) continue;
    const r = RECIPES_FOR(m).find((i) => itemUnlocked(s, i) && stationFor(s, i));
    if (!r) continue;
    const per = (r.makes as Stock)[m] ?? 1;
    const have = s.crafting.find((o) => o.item === r.id)?.count ?? 0;
    if (!inputsReady(s, r, n.stock)) lack(r);
    else for (let k = have; k * per < short && k < 2; k++) if (!queueCraft(s, r.id).ok) break;
  }
  if (!room()) return want;

  // 2. a tool for everyone who works
  const isTool = (i: ItemDef) => i.slot === 'tool';
  if (!ordered(s, isTool) && kept(s, isTool) < adults) tryMake(bestMakeable(s, isTool, toolPower));
  // 3. arms and armour once raiders have come (or when the town is set on defence)
  if (n.raided || n.direction === 'defense') {
    for (const slot of ['weapon', 'body'] as const) {
      if (!room()) return want;
      const is = (i: ItemDef) => i.slot === slot;
      if (ordered(s, is) || kept(s, is) >= adults) continue;
      tryMake(bestMakeable(s, is, (i) => (i.effects.damage ?? 0) + (i.effects.armor ?? 0) * 10));
    }
  }
  // 4. a few bandages or poultices, and pots when the stores are filling up
  const isMedicine = (i: ItemDef) => i.id === 'poultice' || i.id === 'bandage';
  if (room() && !ordered(s, isMedicine) && kept(s, isMedicine) < 3) tryMake(bestMakeable(s, isMedicine, (i) => (i.id === 'bandage' ? 2 : 1)));
  // (one pot on order at a time: the crafters have other work)
  // Everything made to sell or to dress a venue is made only from what the town has spare (beyond what it needs, a
  // reserve, and several days' food), never from what it can only buy (like a desert's fiber); nothing is gathered for
  // it but what the land gives.
  const spareStock = forSale(s);
  const fromSpare = (w: ItemDef) => (Object.entries(w.cost) as [Material, number][]).every(([m, k]) => (spareStock[m] ?? 0) >= k && !n.unsourced.includes(m)) && inputsReady(s, w, n.stock);
  const gatherFor = (w: ItemDef) => {
    if ((Object.keys(w.cost) as Material[]).every((m) => !n.unsourced.includes(m) && GATHERABLE.has(m))) lack(w);
  };
  /** Of some things worth making, the first that can be made from what's spare (the rest are gathered for). */
  const makeFirst = (options: ItemDef[]) => {
    const ready = options.find(fromSpare);
    for (const w of options) {
      if (w === ready) break;
      gatherFor(w);
    }
    if (ready) queueCraft(s, ready.id);
  };
  const makeable = (i: ItemDef) => itemUnlocked(s, i) && !!stationFor(s, i);
  const settled = n.foodDays >= 2;

  // (whatever's queued below for a venue is a commission: its keeper asks, and the crafter is paid)
  const commission = (venue: Building | undefined, before: Set<number>) => {
    if (!venue) return;
    for (const o of s.crafting) {
      if (before.has(o.id) || o.for) continue;
      const def = ITEM_BY_ID[o.item];
      const worth = saleValue(def, undefined) * (def.fare ? PURSE_SCALE[s.era] : 1);
      o.for = { venue: venueKind(venue), by: venue.operator ?? null, pay: Math.round(def.furnish ? worth : worth * PIECE_RATE) };
    }
  };
  const queued = () => new Set(s.crafting.map((o) => o.id));

  // 5. a furnishing for each venue, one at a time (they start bare): the one that adds the most that would improve it
  // (room for it, or it beats a piece already out), and not yet another of a kind it has plenty of
  const isFurnishing = (i: ItemDef) => !!i.furnish;
  for (const venue of [shopOf(s), tavernOf(s)]) {
    if (!venue || !room() || !settled) continue;
    const mine = (i: ItemDef) => furnishes(i, venueKind(venue));
    if (ordered(s, (i) => isFurnishing(i) && mine(i)) || kept(s, (i) => isFurnishing(i) && mine(i))) continue;
    // (every piece is bought: only what the town can pay for, keeping tomorrow's wages back)
    const purse = (s.coins ?? 0) - wageBill(s);
    const before = queued();
    tryMake(bestMakeable(s, (i) => mine(i) && wouldFurnish(venue, i) && appealGain(venue, i) >= 1 && saleValue(i, undefined) <= purse, (i) => appealGain(venue, i)));
    commission(venue, before);
  }
  const shop = shopOf(s);
  // 6. wares to sell, one order at a time: for the grandest customers the shop draws first, whichever of their wares it
  // has least of (a few of each kept in stock)
  const isWare = (i: ItemDef) => !!i.ware;
  if (shop && room() && settled && !ordered(s, isWare)) {
    const before = queued();
    const tiers = tiersDrawn(attractiveness(s, shop)).map((c) => c.tier).reverse();
    makeFirst(tiers.flatMap((tier) => WARES.filter((i) => i.ware!.tier === tier && makeable(i) && (s.items[i.id] ?? 0) < WARE_STOCK).sort((a, b) => (s.items[a.id] ?? 0) - (s.items[b.id] ?? 0))));
    commission(shop, before);
  }
  // 7. gear customers came for and didn't find (the most asked-for first), a couple of each kind kept in stock
  if (shop && room() && settled && !ordered(s, (i) => SALE_GEAR.includes(i))) {
    const before = queued();
    const options: ItemDef[] = [];
    for (const [key] of Object.entries(shop.shop?.asked ?? {}).sort((a, b) => b[1] - a[1])) {
      const [kind, what] = key.split(':');
      const slots = kind === 'gear' ? what.split(',') : kind === 'item' ? [ITEM_BY_ID[what]?.slot] : [];
      if (!slots.length) continue;
      const inStock = SALE_GEAR.filter((i) => slots.includes(i.slot!)).reduce((k, i) => k + (s.items[i.id] ?? 0), 0);
      if (inStock >= 2) continue;
      if (kind === 'item' && ITEM_BY_ID[what] && makeable(ITEM_BY_ID[what])) options.push(ITEM_BY_ID[what]);
      else options.push(...SALE_GEAR.filter((i) => slots.includes(i.slot!) && makeable(i) && !i.items).sort((a, b) => gearScore(b, undefined) - gearScore(a, undefined)));
    }
    makeFirst(options);
    commission(shop, before);
  }
  // 8. fare for the tavern, one order at a time: the kind guests asked for most (or have least of), a few of each
  const tavern = tavernOf(s);
  if (tavern && room() && settled && !ordered(s, (i) => !!i.fare)) {
    const before = queued();
    const asked = tavern.shop?.asked ?? {};
    const wanted = (i: ItemDef) => (asked[`dish:${i.id}`] ?? 0) + (asked[`fare:${i.fare!.kind}`] ?? 0);
    const stockOf = (kind: string) => FARE.filter((i) => i.fare!.kind === kind).reduce((k, i) => k + (s.items[i.id] ?? 0), 0);
    makeFirst(
      FARE.filter((i) => makeable(i) && stockOf(i.fare!.kind) < FARE_STOCK)
        .sort((a, b) => wanted(b) - wanted(a) || stockOf(a.fare!.kind) - stockOf(b.fare!.kind) || b.fare!.price - a.fare!.price),
    );
    commission(tavern, before);
  }
  if (room() && n.storageFill > 0.7 && !ordered(s, (i) => i.id === 'clay_pot') && (s.items.clay_pot ?? 0) < MAX_POTS && stationFor(s, ITEM_BY_ID.clay_pot) && itemUnlocked(s, ITEM_BY_ID.clay_pot)) tryMake(ITEM_BY_ID.clay_pot);
  return want;
}

/* ------------------------------------------------------------ building */

/** The era capstones, and the launch at the end: built when the town can. */
const CAPSTONES = ['elder_lodge', 'town_hall', 'power_station', 'mission_control', 'launch_site'];
/** Never built by the planner: tied to hidden choices, or one-off rescue machines the player earns. */
const NEVER = new Set(['phylactery', 'resurrection_shrine', 'cryo_pod', 'clone_vat', 'palisade_gate', 'stone_gate']);

/** The camp's tile (where the town grows out from). */
const campTile = (s: GameState) => Math.floor(campX(s) / TILE);

/** The nearest free spot for a building, out from the camp on either side (null if there's no room). */
function findSpot(s: GameState, back: readonly BackTerrain[], def: BuildingDef): number | null {
  const c = campTile(s);
  for (let d = 0; d < s.tiles.length; d++) {
    for (const t of d === 0 ? [c] : [c + d, c - d - def.width + 1]) {
      if (canPlace(s, back, def, t).ok) return t;
    }
  }
  return null;
}

const isWall = (d: BuildingDef | undefined) => !!d && !!d.hp && d.width === 1 && !d.defense;

/** Where a wall goes: just past the last building at an end of town that has no wall out there yet (raiders come in
 *  from the ends). Returns the tile, or the tile that has to be cleared first (`clear`), or null (both ends walled). */
function wallSpot(s: GameState, back: readonly BackTerrain[], def: BuildingDef): { tile: number; clear: boolean } | null {
  const town = s.buildings.filter((b) => BUILDING_BY_ID[b.def].layer !== 'back' && !isWall(BUILDING_BY_ID[b.def]));
  if (!town.length) return null;
  const lo = Math.min(...town.map((b) => b.tile)) - 2;
  const hi = Math.max(...town.map((b) => b.tile + BUILDING_BY_ID[b.def].width)) + 1;
  const walls = s.buildings.filter((b) => isWall(BUILDING_BY_ID[b.def]));
  for (const [tile, done] of [
    [lo, walls.some((w) => w.tile <= lo)],
    [hi, walls.some((w) => w.tile >= hi)],
  ] as [number, boolean][]) {
    if (done || tile < 0 || tile >= s.tiles.length) continue;
    if (canPlace(s, back, def, tile).ok) return { tile, clear: false };
    if (s.tiles[tile].terrain !== 'clear') return { tile, clear: true };
  }
  return null;
}

/** What the town would like built next, most wanted first, each with its reason. */
function wishes(s: GameState, n: Needs): { def: string; why: string }[] {
  const out: { def: string; why: string }[] = [];
  const add = (def: string | undefined, why: string) => def && !out.some((w) => w.def === def) && out.push({ def, why });
  const can = (d: BuildingDef) => unlocked(s, d.id) && !NEVER.has(d.id);
  const count = (id: string) => s.buildings.filter((b) => b.def === id).length;

  // (every kind that would do, best first: if the best can't be had, the next is tried)
  const options = (pred: (d: BuildingDef) => boolean, power: (d: BuildingDef) => number, why: string) => {
    for (const d of BUILDINGS.filter((q) => pred(q) && can(q)).sort((a, b) => power(b) - power(a))) add(d.id, why);
  };
  // homes: a bed ahead of the people, but only as fast as the town can feed them: food holding up, fields for
  // everyone, and one new home at a time (half a day apart, once past the first few)
  const fieldsNow = s.buildings.filter((b) => CROPS[b.def] && CROPS[b.def].material !== 'herbs').length;
  const fed = n.people < 4 || (n.foodDays >= 2 && fieldsNow >= Math.ceil(n.people / 2) - 1);
  const paced = n.people < 4 || s.tick - (s.plan?.lastHome ?? -Infinity) >= HOME_EVERY;
  if (n.freeBeds < 1 && fed && paced) options((d) => !!d.housing, (d) => d.housing!, `${n.people} people and ${n.people + n.freeBeds} beds`);
  // food: a field for every two people (one or two more when stores are low; never a field per person)
  const fields = s.buildings.filter((b) => CROPS[b.def] && CROPS[b.def].material !== 'herbs').length;
  // (poor soil, like the desert's, feeds fewer per field: while food is short it keeps adding fields)
  const fieldsWanted = Math.ceil(n.people / 2) + (n.foodDays < 3 ? Math.ceil(n.people / 3) : 0);
  if (fields < Math.min(fieldsWanted, n.people + 1)) options((d) => !!CROPS[d.id] && CROPS[d.id].material !== 'herbs', (d) => CROPS[d.id].yield, n.foodDays < 3 ? 'food is running low' : 'more fields for more people');
  // a shop, first thing, when the land can't give what the town needs (a desert's fiber, once it's gathered out)
  const shopPlanned = s.buildings.some((b) => isShop(b.def));
  const firstShop = BUILDING_BY_ID.trading_post;
  // (a tavern starts as a Fireside Inn, or straight away as a Tavern for a town that learned brewing first)
  const tavernPlanned = s.buildings.some((b) => isTavern(b.def));
  const firstTavern = VENUE_CHAIN.tavern.map((id) => BUILDING_BY_ID[id]).find((d) => can(d));
  if (!shopPlanned && can(firstShop) && n.unsourced.length) add(firstShop.id, `to buy the ${names(n.unsourced)} it can't gather`);
  // storage when it's filling up (a few stores, not a field of them: the rest is what the shop is for)
  const stores = s.buildings.filter((b) => BUILDING_BY_ID[b.def]?.storage && b.def !== 'campfire').length;
  if (n.storageFill > 0.8 && stores < 2 + Math.floor(n.people / 4)) options((d) => !!d.storage && d.id !== 'campfire', (d) => d.storage!, 'the stores are nearly full');
  // defence first, if that's the aim or raiders keep coming
  if (n.direction === 'defense' || n.raided) {
    for (const d of BUILDINGS) if (can(d) && d.defense && count(d.id) < (n.direction === 'defense' ? 2 : 1)) add(d.id, 'raiders have to be kept out');
    for (const d of BUILDINGS) if (can(d) && d.warningMinutes && !planned(s, d.id)) add(d.id, 'to see raiders coming');
    const walls = s.buildings.filter((b) => isWall(BUILDING_BY_ID[b.def])).length;
    if (walls < 4) options((d) => isWall(d), (d) => d.hp!, 'a wall at each end of town');
  }
  // a shop to sell to travellers (sooner when the town is set on trade)
  if (!shopPlanned && can(firstShop) && n.direction === 'trade') add(firstShop.id, 'to sell to travellers for coins');
  // a better place to research, and more of them as the town grows (one person studies at each: about one station for
  // every four grown-ups, up to one per topic it can study at once)
  const station = Object.entries(RESEARCH_STATIONS).filter(([id]) => BUILDING_BY_ID[id] && can(BUILDING_BY_ID[id])).sort((a, b) => b[1].mult - a[1].mult)[0];
  if (station && !planned(s, station[0])) add(station[0], 'somewhere better to study');
  const stations = s.buildings.filter((b) => RESEARCH_STATIONS[b.def]).length;
  const grown = s.people.filter((p) => p.bornTick == null).length;
  const wantStations = Math.min(modifiers(s.research).researchSlots, 1 + Math.floor(grown / 4));
  if (station && stations < wantStations) add(station[0], `a desk for another researcher (${stations} for ${grown} people)`);
  // the next era, once the town can manage it
  for (const id of CAPSTONES) if (BUILDING_BY_ID[id] && can(BUILDING_BY_ID[id]) && !planned(s, id)) add(id, 'the way to the next era');
  if (!shopPlanned && can(firstShop)) add(firstShop.id, 'to sell to travellers for coins');
  if (!tavernPlanned && firstTavern) add(firstTavern.id, 'to feed travellers for coins');
  // one of every workshop, mine, farm building and comfort it has learned to build
  const order = n.direction === 'trade' ? (d: BuildingDef) => (d.stalls || d.id === 'tavern' || ITEMS.some((i) => i.station === d.id) ? 0 : 1) : () => 0;
  for (const d of [...BUILDINGS].sort((a, b) => order(a) - order(b))) {
    if (!can(d) || planned(s, d.id) || d.housing || d.storage || d.hp || d.defense || CAPSTONES.includes(d.id)) continue;
    if (d.id === 'graveyard' && !(s.graves?.length)) continue; // (only once someone has died)
    if (venueOfDef(d.id)) continue; // (one shop and one tavern, which grow by being rebuilt bigger)
    add(d.id, WORKPLACES[d.id] ? 'to dig what the town needs' : ITEMS.some((i) => i.station === d.id) ? 'a new workshop' : d.morale ? 'to lift spirits' : 'the town has learned to build it');
  }
  return out;
}

/** Place the next building the town wants (one at a time), or upgrade one. Returns wild tiles to clear for a
 *  building it wanted but had no room for (or for a wall's spot at the end of town). */
function planBuilding(s: GameState, back: readonly BackTerrain[], n: Needs, plan: TownPlan): number[] {
  if (blueprintCount(s) >= buildSlots(s)) return [];
  const clear: number[] = [];
  let blocked: BuildingDef | null = null;
  for (const w of wishes(s, n)) {
    const def = BUILDING_BY_ID[w.def];
    if (!affordable(s, def, n.stock)) continue;
    let tile: number | null;
    if (isWall(def)) {
      const spot = wallSpot(s, back, def);
      if (!spot) continue;
      if (spot.clear) {
        clear.push(spot.tile);
        continue;
      }
      tile = spot.tile;
    } else tile = findSpot(s, back, def);
    if (tile === null) {
      if (def.layer !== 'back') blocked ??= def; // (the back fields need meadow; nothing to clear there)
      continue;
    }
    if (placeBlueprint(s, back, def.id, tile).ok) {
      plan.build = w;
      if (def.housing) plan.lastHome = s.tick;
      return clear;
    }
  }
  // nothing new to build: improve what's there
  for (const b of s.buildings) {
    if (b.status !== 'done' || !UPGRADES[b.def]) continue;
    const to = BUILDING_BY_ID[UPGRADES[b.def]];
    if (!to || !affordable(s, to, n.stock) || !canUpgrade(s, back, b.id).ok) continue;
    if (upgrade(s, back, b.id).ok) {
      plan.build = { def: to.id, why: `a better ${BUILDING_BY_ID[b.def].name}` };
      return clear;
    }
  }
  if (blocked) {
    plan.waiting.push(`No room for a ${blocked.name}: clearing land`);
    // the nearest wild land, out from the camp
    const c = campTile(s);
    const wild = s.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.terrain !== 'clear').sort((a, b) => Math.abs(a.i - c) - Math.abs(b.i - c));
    for (const { i } of wild.slice(0, blocked.width + 1)) clear.push(i);
  }
  return clear;
}

/* ------------------------------------------------------------ gathering */

/** Mark wild land for what the town is short of (nearest first: for building, for crafting, food when it's low), and
 *  to clear room for a building it wants. */
function planGathering(s: GameState, n: Needs, plan: TownPlan, clear: number[], craftWants: Stock): void {
  const c = campTile(s);
  const byDistance = s.tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.terrain !== 'clear').sort((a, b) => Math.abs(a.i - c) - Math.abs(b.i - c));
  let marked = s.tiles.filter((t) => t.designated).length;
  const cap = BASE_MARKED + s.people.filter((p) => p.bornTick == null).length;
  const mark = (i: number) => {
    if (s.tiles[i].designated || marked >= cap) return false;
    s.tiles[i].designated = true;
    s.tileRev++;
    marked++;
    return true;
  };
  for (const m of MATERIALS) {
    if (!GATHERABLE.has(m)) continue;
    let short = Math.max((n.demand[m] ?? 0) - (n.stock[m] ?? 0), craftWants[m] ?? 0);
    if (m === 'berries' && n.foodDays < 3) short = Math.max(short, n.people * 3);
    // (the reserve isn't worth gathering into full stores; what building, crafting or hunger needs still is)
    if (n.storageFill > 0.95 && !(craftWants[m] ?? 0) && !s.buildings.some((b) => b.status === 'blueprint' && (stillNeeded(b)[m] ?? 0) > 0) && m !== 'berries') continue;
    if (short <= 0) continue;
    // what's already marked counts toward it
    short -= s.tiles.filter((t) => t.designated).reduce((k, t) => k + (t.pool[m] ?? 0), 0);
    if (!plan.gathering.includes(MATERIAL_NAMES[m])) plan.gathering.push(MATERIAL_NAMES[m]);
    for (const { t, i } of byDistance) {
      if (short <= 0) break;
      if ((t.pool[m] ?? 0) <= 0 || t.designated) continue;
      if (mark(i)) short -= t.pool[m] ?? 0;
    }
  }
  for (const i of clear) mark(i);
}

/* ------------------------------------------------------------ the shop: selling and buying */

/** Days of food the town holds back before it sells any. */
const FOOD_KEEP_DAYS = 5;
/** With this many times its coin reserve in the purse, the town also buys toward its usual stock of materials. */
const RICH = 3;
/** Ammunition kept for the town's slings, bows and guns. */
const AMMO: readonly Material[] = ['sling_stones', 'arrows', 'shot', 'cartridges'];
const AMMO_KEEP = 30;

/** What the town will sell to travellers: what it has beyond what building and crafting need and a healthy reserve
 *  (twice its usual one), food beyond several days' worth, and never the totem. */
export function forSale(s: GameState): Stock {
  const n = needs(s);
  const eaters = s.people.filter((p) => p.monster !== 'undead').length || 1;
  let spareFood = Math.max(0, (n.foodDays - FOOD_KEEP_DAYS) * eaters);
  const out: Stock = {};
  for (const m of MATERIALS) {
    const have = n.stock[m] ?? 0;
    if (m === 'totem' || have <= 0) continue;
    let spare: number;
    const value = FOOD_VALUE[m];
    if (value) {
      spare = Math.min(have, Math.floor(spareFood / value));
      spareFood -= spare * value;
    } else spare = have - Math.max(n.demand[m] ?? 0, (RESERVE[m] ?? 6) * 2, AMMO.includes(m) ? AMMO_KEEP : 0);
    if (spare > 0) out[m] = spare;
  }
  return out;
}

/** What the town would buy from a traveller, most needed first. What it can't get any other way it buys whatever
 *  it costs (`essential`); what it could gather or make it buys only for a building it's waiting on, and only with
 *  coins to spare; and food when it's running out. */
export function shoppingList(s: GameState): { m: Material; n: number; essential: boolean }[] {
  const n = needs(s);
  const out: { m: Material; n: number; essential: boolean }[] = [];
  if (n.foodDays < 2) {
    const eaters = s.people.filter((p) => p.monster !== 'undead').length || 1;
    const food = travellerGoods(s.era).filter((m) => FOOD_VALUE[m]).sort((a, b) => FOOD_VALUE[b]! - FOOD_VALUE[a]!)[0];
    if (food) out.push({ m: food, n: Math.ceil(((3 - n.foodDays) * eaters) / FOOD_VALUE[food]!), essential: true });
  }
  const rich = (s.coins ?? 0) >= RICH * COIN_RESERVE * PURSE_SCALE[s.era];
  const building: Stock = {};
  for (const b of s.buildings) if (b.status === 'blueprint') for (const [m, k] of Object.entries(stillNeeded(b)) as [Material, number][]) addStock(building, m, k);
  for (const m of MATERIALS) {
    const short = (n.demand[m] ?? 0) - (n.stock[m] ?? 0);
    if (short <= 0 || m === 'totem') continue;
    const essential = !sourceable(s, m, 0, false);
    const k = essential || rich ? short : Math.min(short, building[m] ?? 0);
    if (k > 0) out.push({ m, n: k, essential });
  }
  return out.sort((a, b) => Number(b.essential) - Number(a.essential));
}

const names = (ms: readonly Material[]) => ms.map((m) => MATERIAL_NAMES[m].toLowerCase()).join(' and ');

/** Once an hour, what's left in the purse after a good reserve goes into the shop: an extension when its floor is
 *  crowded (no room for another shelf or table), else a level on the piece that's cheapest to improve. */
function planShop(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const venue of [shopOf(s), tavernOf(s)]) {
    if (!venue) continue;
    // (a good reserve, and tomorrow's wages, are kept back)
    const spare = (s.coins ?? 0) - 2 * COIN_RESERVE * PURSE_SCALE[s.era] - wageBill(s);
    const ext = extensionPrice(s, venue);
    const table = venueKind(venue) === 'tavern' ? ITEM_BY_ID.log_table : ITEM_BY_ID.trestle_table;
    const crowded = !spotFor(venue, ITEM_BY_ID.clay_urns) && !spotFor(venue, table);
    if (crowded && ext !== null) {
      if (spare >= ext) extend(s, venue);
      continue; // (saving up for it)
    }
    const cheapest = (venue.shop?.pieces ?? []).filter((p) => levelPrice(p) !== null).sort((a, b) => levelPrice(a)! - levelPrice(b)!)[0];
    if (cheapest && spare >= levelPrice(cheapest)!) improve(s, venue, cheapest);
  }
}

/* ------------------------------------------------------------ making room */

/** Bulk materials the town clears out when its stores are full (clearing land piles up far more wood and stone
 *  than it can use). Never food: a full store with no room for the harvest starved a whole town. */
const BULK: readonly Material[] = ['wood', 'stone', 'fiber', 'flint', 'clay', 'bone'];

function makeRoom(s: GameState, n: Needs): void {
  if (n.storageFill < 0.9) return;
  for (const m of BULK) {
    const keep = Math.max((RESERVE[m] ?? 10) * 3, n.demand[m] ?? 0);
    let extra = (n.stock[m] ?? 0) - keep;
    for (const b of storages(s)) {
      if (extra <= 0) break;
      const k = Math.min(extra, b.store[m] ?? 0);
      if (k > 0) addStock(b.store, m, -k);
      extra -= k;
    }
  }
}

/* ------------------------------------------------------------ newcomers */

/** A wanderer at the edge of town is let in when there's a bed for them (or they bring a rare calling). */
function planVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo) return;
  if (housingCapacity(s) > s.people.length || v.person.cls) acceptVisitor(s);
}

/* ------------------------------------------------------------ the whole plan */

export function runPlanner(s: GameState, back: readonly BackTerrain[]): void {
  if (s.gameOver || s.autopilot === false || s.tick % PLAN_TICKS !== 0) return;
  const n = needs(s);
  makeRoom(s, n);
  const plan: TownPlan = { build: s.plan?.build ?? null, research: null, gathering: [], waiting: [], lastHome: s.plan?.lastHome };
  planResearch(s, n, plan);
  const craftWants = planCrafting(s, n);
  const clear = planBuilding(s, back, n, plan);
  planGathering(s, needs(s), plan, clear, craftWants);
  planVisitor(s);
  planShop(s);
  s.plan = plan;
}
