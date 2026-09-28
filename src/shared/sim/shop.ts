// The shop (Phase 2 of the ant-farm redesign). Once the town has built a shop, travellers pass through: each walks
// in from an end of town, stops at the shop to buy what the town has spare (for coins) and to sell it what it's
// short of, browses a while, and walks on out the other end. The shopkeeper sets out the furnishings the town makes
// (shelves, tables, stands, decorations); the better furnished the shop, the more often travellers stop and the more
// they spend. What the town sells and buys is the planner's call (see forSale and shoppingList in planner.ts).

import { TILE } from '../constants';
import { BUILDING_BY_ID } from '../data/buildings';
import { ITEM_BY_ID, type ItemDef } from '../data/items';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { NAMES, randomLook } from '../data/people';
import {
  APPEAL_HALVES_WAIT,
  APPEAL_SPEND,
  BUY_MARKUP,
  COIN_RESERVE,
  isShop,
  KEEPER_SPEND,
  MAX_BUY_EACH,
  MAX_KINDS,
  MAX_SELL_EACH,
  MAX_TRAVELLERS,
  PURSE,
  PURSE_SCALE,
  SHOP_LOG,
  SHOPPING_HOURS,
  TRAVELLER_EVERY,
  TRAVELLER_KINDS,
  TRAVELLER_SPEED,
  travellerGoods,
} from '../data/shop';
import { WORTH } from '../data/trade';
import { biomeOf } from '../data/biomes';
import type { Rng } from '../rng';
import { buildingCentreX, depositNear, storages, totalCapacity, totalStock } from './buildings';
import { operatorOf, operatorSkill } from './operators';
import { addStock, notify, poolSize, type Building, type GameState, type ShopPiece, type Traveller } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';

/* ------------------------------------------------------------ the shop and its floor */

/** The town's shop, once built (there's only ever one). */
export const shopOf = (s: GameState): Building | undefined => s.buildings.find((b) => b.status === 'done' && isShop(b.def));
/** Open for business: built, and someone to keep it (at home and on their feet). */
export const shopOpen = (s: GameState): Building | undefined => {
  const b = shopOf(s);
  return b && operatorOf(s, b.def) ? b : undefined;
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The fixed parts of a shop's floor: the counter (the shopkeeper stands behind it, against the back wall) and the
 *  door in the front wall (with a cell in from it kept clear). Cells run from the back wall (y 0) to the front. */
export function shopLayout(def: string): { cols: number; rows: number; counter: Rect; keeper: Rect; door: number } {
  const { cols, rows } = BUILDING_BY_ID[def].shop!;
  return { cols, rows, counter: { x: cols - 3, y: 1, w: 2, h: 1 }, keeper: { x: cols - 3, y: 0, w: 2, h: 1 }, door: Math.floor(cols / 2) - 1 };
}

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Cells nothing can be set on. */
function fixedCell(def: string, x: number, y: number): boolean {
  const l = shopLayout(def);
  return inRect(l.counter, x, y) || inRect(l.keeper, x, y) || (x === l.door && y >= l.rows - 2);
}

const piecesOf = (b: Building): ShopPiece[] => (b.shop ??= { pieces: [] }).pieces;
const footprint = (p: ShopPiece): Rect => {
  const f = ITEM_BY_ID[p.item]?.furnish;
  return { x: p.x, y: p.y, w: f?.w ?? 1, h: f?.h ?? 1 };
};

/** Whether a piece fits at a spot: on the floor, clear of the counter and door, and of the other pieces. */
function fits(b: Building, item: ItemDef, x: number, y: number, ignore?: ShopPiece): boolean {
  const f = item.furnish!;
  const { cols, rows } = shopLayout(b.def);
  if (x < 0 || y < 0 || x + f.w > cols || y + f.h > rows) return false;
  for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.h; dy++) if (fixedCell(b.def, x + dx, y + dy)) return false;
  const me = { x, y, w: f.w, h: f.h };
  return !piecesOf(b).some((p) => p !== ignore && overlap(me, footprint(p)));
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a shopkeeper likes each kind of piece: shelves against the back wall (or a side wall), decorations in the
 *  corners, tables and rugs out in the middle of the floor. Lower is better. */
function placeScore(b: Building, item: ItemDef, x: number, y: number): number {
  const f = item.furnish!;
  const { cols, rows } = shopLayout(b.def);
  const wallX = x === 0 || x + f.w === cols;
  const wallY = y === 0 || y + f.h === rows;
  switch (f.kind) {
    case 'shelf':
      return y === 0 ? 0 : wallX ? 1 : 4;
    case 'decor':
      return wallX && wallY ? 0 : wallX || wallY ? 1 : 3;
    case 'table':
    case 'rug':
      return !wallX && !wallY ? 0 : !wallY ? 1 : 2;
    case 'stand':
      return wallX || wallY ? 0 : 1;
  }
}

/** The best free spot for a piece, or null if there's no room. */
export function spotFor(b: Building, item: ItemDef): { x: number; y: number } | null {
  const { cols, rows } = shopLayout(b.def);
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (!fits(b, item, x, y)) continue;
      const score = placeScore(b, item, x, y);
      if (!best || score < best.score) best = { x, y, score };
    }
  return best && { x: best.x, y: best.y };
}

/** The piece a better one would replace, when the floor's full: the least appealing of the same size. */
export function replaceable(b: Building, item: ItemDef): ShopPiece | undefined {
  const f = item.furnish!;
  return piecesOf(b)
    .filter((p) => {
      const g = ITEM_BY_ID[p.item]?.furnish;
      return g && g.w === f.w && g.h === f.h && g.appeal < f.appeal;
    })
    .sort((p, q) => ITEM_BY_ID[p.item].furnish!.appeal - ITEM_BY_ID[q.item].furnish!.appeal)[0];
}

/** Whether a piece would make the shop better: it has room for it, or it beats one already out. */
export const wouldFurnish = (b: Building, item: ItemDef) => !!spotFor(b, item) || !!replaceable(b, item);

/** How much a shop draws travellers in: what it has bare, and what's been set out (a second piece just like one
 *  already out counts for half: travellers like to see something new). */
export function appeal(b: Building): number {
  const seen = new Set<string>();
  let n = BUILDING_BY_ID[b.def].shop?.appeal ?? 0;
  for (const p of b.shop?.pieces ?? []) {
    n += (ITEM_BY_ID[p.item]?.furnish?.appeal ?? 0) / (seen.has(p.item) ? 2 : 1);
    seen.add(p.item);
  }
  return Math.round(n);
}

/** What one more of a piece would add to the shop's appeal (half for a piece like one already out). */
export function appealGain(b: Building, item: ItemDef): number {
  return item.furnish!.appeal / ((b.shop?.pieces ?? []).some((p) => p.item === item.id) ? 2 : 1);
}

/** Pieces that no longer fit (the shop was rebuilt bigger and its counter moved, say) go back to the stores for the
 *  shopkeeper to set out again. */
function settle(s: GameState, b: Building): void {
  const pieces = piecesOf(b);
  b.shop!.pieces = [];
  for (const p of pieces) {
    const item = ITEM_BY_ID[p.item];
    if (item?.furnish && fits(b, item, p.x, p.y)) b.shop!.pieces.push(p);
    else if (item) s.items[p.item] = (s.items[p.item] ?? 0) + 1;
  }
}

/** The shopkeeper sets out one made piece (the most appealing that helps), replacing a poorer one if the floor's full. */
function setOut(s: GameState, b: Building): void {
  const keeper = operatorOf(s, b.def);
  if (!keeper) return;
  const spare = Object.keys(s.items)
    .map((id) => ITEM_BY_ID[id])
    .filter((i) => i?.furnish && (s.items[i.id] ?? 0) > 0)
    .sort((p, q) => q.furnish!.appeal - p.furnish!.appeal);
  for (const item of spare) {
    const spot = spotFor(b, item);
    const old = spot ? undefined : replaceable(b, item);
    if (!spot && !old) continue;
    s.items[item.id]--;
    if (!s.items[item.id]) delete s.items[item.id];
    if (old) {
      // (the old piece goes to whoever wants it: it isn't kept)
      old.item = item.id;
      log(s, `${keeper.name} put out a ${item.name} in place of an older piece.`);
    } else {
      piecesOf(b).push({ item: item.id, ...spot! });
      log(s, `${keeper.name} set out a ${item.name}.`);
    }
    return;
  }
}

/* ------------------------------------------------------------ travellers */

const worldWidth = (s: GameState) => s.tiles.length * TILE;

/** Game ticks until the next traveller, for a shop this appealing. */
export function travellerGap(s: GameState, rng: Rng, shopAppeal: number): number {
  const hours = rng.range(TRAVELLER_EVERY[0], TRAVELLER_EVERY[1]) / (1 + shopAppeal / APPEAL_HALVES_WAIT) / (biomeOf(s).caravans ?? 1);
  return Math.round(hours * TICKS_PER_HOUR);
}

/** What the town wants from travellers (the planner's shopping list), and what it has spare to sell them. */
export interface ShopTown {
  forSale(s: GameState): Stock;
  wants(s: GameState): { m: Material; n: number; essential: boolean }[];
}

/** Every tick: travellers walk in, shop, and walk on; once an hour the shopkeeper sets out a new piece. */
export function updateShop(s: GameState, rng: Rng, town: ShopTown): void {
  const shop = shopOf(s);
  if (shop && s.tick % TICKS_PER_HOUR === 0) {
    settle(s, shop);
    setOut(s, shop);
  }
  const travellers = (s.travellers ??= []);
  const step = TRAVELLER_SPEED / TICK_HZ;
  for (const t of [...travellers]) {
    // raiders, or no shop to go to: they hurry on
    if (t.phase !== 'leaving' && (!shop || s.raid?.phase === 'active')) leave(s, t);
    if (t.phase === 'shopping') {
      if (s.tick >= t.until) leave(s, t);
      continue;
    }
    const d = t.toX - t.x;
    t.dir = d >= 0 ? 1 : -1;
    if (Math.abs(d) > step) {
      t.x += t.dir * step;
      continue;
    }
    t.x = t.toX;
    if (t.phase === 'leaving') travellers.splice(travellers.indexOf(t), 1);
    else if (shop) {
      t.phase = 'shopping';
      t.until = s.tick + SHOPPING_HOURS * TICKS_PER_HOUR;
      deal(s, shop, t, town);
    }
  }

  const open = shopOpen(s);
  if (!open) return;
  if (s.nextTravellerTick === undefined) s.nextTravellerTick = s.tick + travellerGap(s, rng, appeal(open));
  if (s.tick < s.nextTravellerTick || s.raid || travellers.length >= MAX_TRAVELLERS) return;
  s.nextTravellerTick = s.tick + travellerGap(s, rng, appeal(open));
  const side = rng.chance(0.5) ? -1 : 1;
  const taken = [...s.people.map((p) => p.name), ...travellers.map((t) => t.name)];
  const free = NAMES.filter((n) => !taken.includes(n));
  const purse = rng.int(PURSE[0], PURSE[1]) * PURSE_SCALE[s.era] * (1 + appeal(open) * APPEAL_SPEND) * (1 + operatorSkill(s, open.def) * KEEPER_SPEND);
  travellers.push({
    id: s.nextId++,
    name: rng.pick(free.length ? free : NAMES),
    kind: rng.pick(TRAVELLER_KINDS),
    look: randomLook(rng),
    x: side < 0 ? -TILE : worldWidth(s) + TILE,
    dir: side < 0 ? 1 : -1,
    phase: 'arriving',
    toX: buildingCentreX(open),
    until: 0,
    purse: Math.round(purse),
  });
}

/** On their way out of town, the way they were going. */
function leave(s: GameState, t: Traveller): void {
  t.phase = 'leaving';
  t.toX = t.dir > 0 ? worldWidth(s) + TILE : -TILE;
}

/** At the shop: they buy what the town has spare, and sell it what it wants (as far as its coins go). */
function deal(s: GameState, shop: Building, t: Traveller, town: ShopTown): void {
  const who = `${t.name} the ${t.kind}`;
  // what they buy: the most valuable spare goods first, a few kinds at most
  const spare = town.forSale(s);
  const sold: Stock = {};
  let spent = 0;
  const goods = (Object.entries(spare) as [Material, number][]).filter(([, n]) => n > 0).sort((a, b) => WORTH[b[0]] - WORTH[a[0]] || b[1] - a[1]);
  for (const [m, have] of goods) {
    if (Object.keys(sold).length >= MAX_KINDS) break;
    const n = Math.min(have, MAX_BUY_EACH, Math.floor((t.purse - spent) / WORTH[m]));
    if (n <= 0) continue;
    takeStock(s, m, n);
    sold[m] = n;
    spent += n * WORTH[m];
  }
  if (spent > 0) {
    const first = s.coins === undefined; // (the purse is made with the first sale)
    s.coins = (s.coins ?? 0) + spent;
    log(s, `${who} bought ${list(sold)} (${spent} coins).`);
    if (first) notify(s, `The ${BUILDING_BY_ID[shop.def].name} made its first sale: ${who} bought ${list(sold)} for ${spent} coins.`, true);
  }

  // what the town buys from them
  const has = new Set(travellerGoods(s.era));
  const bought: Stock = {};
  let paid = 0;
  let room = totalCapacity(s) - poolSize(totalStock(s));
  for (const w of town.wants(s)) {
    if (!has.has(w.m) || room <= 0) continue;
    const price = WORTH[w.m] * BUY_MARKUP;
    const keep = w.essential ? 0 : COIN_RESERVE * PURSE_SCALE[s.era];
    const afford = Math.floor(((s.coins ?? 0) - paid - keep) / price);
    const n = Math.min(w.n, MAX_SELL_EACH, afford, room);
    if (n <= 0) continue;
    const cost = Math.ceil(n * price);
    const left = depositNear(s, buildingCentreX(shop), { [w.m]: n });
    const got = n - (left[w.m] ?? 0);
    if (got <= 0) continue;
    bought[w.m] = got;
    paid += got === n ? cost : Math.ceil(got * price);
    room -= got;
  }
  if (paid > 0) {
    s.coins = (s.coins ?? 0) - paid;
    log(s, `Bought ${list(bought)} from ${who} (${paid} coins).`);
    notify(s, `Bought ${list(bought)} from a passing ${t.kind} for ${paid} coins.`);
  }
  if (!spent && !paid) log(s, `${who} looked around and left empty-handed.`);
}

/** Take materials out of storage (wherever they are). */
function takeStock(s: GameState, m: Material, n: number): void {
  let left = n;
  for (const st of storages(s)) {
    const k = Math.min(left, st.store[m] ?? 0);
    if (k <= 0) continue;
    addStock(st.store, m, -k);
    left -= k;
  }
}

function log(s: GameState, text: string): void {
  const l = (s.shopLog ??= []);
  l.push({ tick: s.tick, text });
  if (l.length > SHOP_LOG) l.splice(0, l.length - SHOP_LOG);
}

const list = (st: Stock) =>
  MATERIALS.filter((m) => st[m])
    .map((m) => `${st[m]} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');
