// The shop (the ant-farm redesign, Phase 2). Once the town has built a shop, travellers pass through: each walks in
// from an end of town, stops at the shop to buy what the town has spare (for coins) and to sell it what it's short of,
// browses a while, and walks on out the other end.
//
// How attractive the shop is decides who comes: its appeal (the furnishings the shopkeeper sets out, and how far the
// town has improved them with coins) plus its renown. Ordinary travellers come to any shop; an attractive one draws
// merchants, then nobles, then magnates, with far bigger purses, who come for wares: fine goods the town crafts only to
// sell, each tier's unlocked by research. A customer who finds a ware of their tier spreads the shop's renown; one who
// doesn't leaves disappointed, and it fades. The town spends its coins on the shop too: extensions make the floor
// bigger, and pieces can be improved a level or two. What it sells, buys, makes and spends on is the planner's call.

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
  CUSTOMER_TIERS,
  extensionCost,
  isShop,
  KEEPER_SPEND,
  MAX_BUY_EACH,
  MAX_EXTENSIONS,
  MAX_KINDS,
  MAX_PIECE_LEVEL,
  MAX_SELL_EACH,
  MAX_TRAVELLERS,
  PIECE_LEVEL_COST,
  PURSE,
  PURSE_SCALE,
  RENOWN_FADE,
  RENOWN_LOSS,
  RENOWN_MAX,
  RENOWN_WIN,
  SHOP_LOG,
  SHOPPING_HOURS,
  tierOf,
  tiersDrawn,
  TRAVELLER_EVERY,
  TRAVELLER_SPEED,
  travellerGoods,
  WARES,
} from '../data/shop';
import { WORTH } from '../data/trade';
import { biomeOf } from '../data/biomes';
import type { Rng } from '../rng';
import { buildingCentreX, depositNear, storages, totalCapacity, totalStock } from './buildings';
import { operatorOf, operatorSkill } from './operators';
import { addStock, notify, poolSize, type Building, type GameState, type ShopPiece, type Traveller } from './state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

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

type ShopBuilding = Pick<Building, 'def' | 'shop'>;
export const extensionsOf = (b: ShopBuilding) => b.shop?.extensions ?? 0;

/** The shop's floor: its size (bigger with each extension), the counter (the shopkeeper stands behind it, against the
 *  back wall) and the door in the front wall (with a cell in from it kept clear). Cells run from the back wall (y 0)
 *  to the front. */
export function shopLayout(b: ShopBuilding): { cols: number; rows: number; counter: Rect; keeper: Rect; door: number } {
  const base = BUILDING_BY_ID[b.def].shop!;
  const cols = base.cols + extensionsOf(b) * 2;
  const rows = base.rows + extensionsOf(b);
  return { cols, rows, counter: { x: cols - 3, y: 1, w: 2, h: 1 }, keeper: { x: cols - 3, y: 0, w: 2, h: 1 }, door: Math.floor(cols / 2) - 1 };
}

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Cells nothing can be set on. */
function fixedCell(b: ShopBuilding, x: number, y: number): boolean {
  const l = shopLayout(b);
  return inRect(l.counter, x, y) || inRect(l.keeper, x, y) || (x === l.door && y >= l.rows - 2);
}

const piecesOf = (b: Building): ShopPiece[] => (b.shop ??= { pieces: [] }).pieces;
const footprint = (p: ShopPiece): Rect => {
  const f = ITEM_BY_ID[p.item]?.furnish;
  return { x: p.x, y: p.y, w: f?.w ?? 1, h: f?.h ?? 1 };
};

/** Whether a piece fits at a spot: on the floor, clear of the counter and door, and of the other pieces. */
function fits(b: Building, item: ItemDef, x: number, y: number): boolean {
  const f = item.furnish!;
  const { cols, rows } = shopLayout(b);
  if (x < 0 || y < 0 || x + f.w > cols || y + f.h > rows) return false;
  for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.h; dy++) if (fixedCell(b, x + dx, y + dy)) return false;
  const me = { x, y, w: f.w, h: f.h };
  return !piecesOf(b).some((p) => overlap(me, footprint(p)));
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a shopkeeper likes each kind of piece: shelves against the back wall (or a side wall), decorations in the
 *  corners, tables and rugs out in the middle of the floor. Lower is better. */
function placeScore(b: Building, item: ItemDef, x: number, y: number): number {
  const f = item.furnish!;
  const { cols, rows } = shopLayout(b);
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
  const { cols, rows } = shopLayout(b);
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
      return g && g.w === f.w && g.h === f.h && pieceAppeal(p) < f.appeal;
    })
    .sort((p, q) => pieceAppeal(p) - pieceAppeal(q))[0];
}

/** Whether a piece would make the shop better: it has room for it, or it beats one already out. */
export const wouldFurnish = (b: Building, item: ItemDef) => !!spotFor(b, item) || !!replaceable(b, item);

/** A piece's appeal: its own, and half as much again for each level it's been improved. */
export function pieceAppeal(p: ShopPiece): number {
  return (ITEM_BY_ID[p.item]?.furnish?.appeal ?? 0) * (1 + ((p.level ?? 1) - 1) / 2);
}

/** How much a shop's floor draws people in: what it has bare, and what's been set out. Travellers like to see
 *  something new: a second piece just like one already out counts for half, a third a quarter, and so on (the best
 *  of them counting most). */
export function appeal(b: Building): number {
  const byItem = new Map<string, number[]>();
  for (const p of b.shop?.pieces ?? []) byItem.set(p.item, [...(byItem.get(p.item) ?? []), pieceAppeal(p)]);
  let n = BUILDING_BY_ID[b.def].shop?.appeal ?? 0;
  for (const list of byItem.values()) list.sort((x, y) => y - x).forEach((a, i) => (n += a / 2 ** i));
  return Math.round(n);
}

/** What one more of a piece would add to the shop's appeal (halved for each like it already out). */
export function appealGain(b: Building, item: ItemDef): number {
  return item.furnish!.appeal / 2 ** (b.shop?.pieces ?? []).filter((p) => p.item === item.id).length;
}

/** How attractive the shop is, all told: its appeal and its renown. This decides who comes, and how often. */
export const attractiveness = (s: GameState, b: Building) => appeal(b) + Math.floor(s.renown ?? 0);

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
      delete old.level;
      log(s, `${keeper.name} put out a ${item.name} in place of an older piece.`);
    } else {
      piecesOf(b).push({ item: item.id, ...spot! });
      log(s, `${keeper.name} set out a ${item.name}.`);
    }
    return;
  }
}

/* ------------------------------------------------------------ spending coins on the shop */

/** What the next extension costs, or null if the shop has all it can have. */
export function extensionPrice(s: GameState, b: Building): number | null {
  const n = extensionsOf(b);
  return n >= MAX_EXTENSIONS ? null : extensionCost(n) * PURSE_SCALE[s.era];
}

/** What improving a piece to its next level costs, or null if it's as good as it gets. */
export function levelPrice(p: ShopPiece): number | null {
  const next = (p.level ?? 1) + 1;
  const f = ITEM_BY_ID[p.item]?.furnish;
  return !f || next > MAX_PIECE_LEVEL ? null : f.appeal * PIECE_LEVEL_COST * next;
}

/** Pay to make the floor bigger. */
export function extend(s: GameState, b: Building): boolean {
  const price = extensionPrice(s, b);
  if (price === null || (s.coins ?? 0) < price) return false;
  s.coins = (s.coins ?? 0) - price;
  (b.shop ??= { pieces: [] }).extensions = extensionsOf(b) + 1;
  log(s, `The ${BUILDING_BY_ID[b.def].name} was extended: more floor for more furnishings (${price} coins).`);
  notify(s, `The town paid ${price} coins to extend its ${BUILDING_BY_ID[b.def].name}.`, true);
  return true;
}

/** Pay to improve one piece a level. */
export function improve(s: GameState, p: ShopPiece): boolean {
  const price = levelPrice(p);
  if (price === null || (s.coins ?? 0) < price) return false;
  s.coins = (s.coins ?? 0) - price;
  p.level = (p.level ?? 1) + 1;
  const name = ITEM_BY_ID[p.item].name;
  log(s, p.level === 2 ? `The ${name} was built up a second tier (${price} coins).` : `The ${name} was polished and trimmed in brass (${price} coins).`);
  return true;
}

/* ------------------------------------------------------------ travellers */

const worldWidth = (s: GameState) => s.tiles.length * TILE;

/** Game ticks until the next traveller, for a shop this attractive. */
export function travellerGap(s: GameState, rng: Rng, attract: number): number {
  const hours = rng.range(TRAVELLER_EVERY[0], TRAVELLER_EVERY[1]) / (1 + attract / APPEAL_HALVES_WAIT) / (biomeOf(s).caravans ?? 1);
  return Math.round(hours * TICKS_PER_HOUR);
}

/** What the town wants from travellers (the planner's shopping list), and what it has spare to sell them. */
export interface ShopTown {
  forSale(s: GameState): Stock;
  wants(s: GameState): { m: Material; n: number; essential: boolean }[];
}

/** Every tick: travellers walk in, shop, and walk on; once an hour the shopkeeper sets out a new piece; once a day
 *  the shop's renown fades a little. */
export function updateShop(s: GameState, rng: Rng, town: ShopTown): void {
  const shop = shopOf(s);
  if (shop && s.tick % TICKS_PER_HOUR === 0) {
    settle(s, shop);
    setOut(s, shop);
  }
  if (s.renown && s.tick % TICKS_PER_DAY === 0) s.renown = Math.max(0, s.renown * (1 - RENOWN_FADE));
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
  const attract = attractiveness(s, open);
  if (s.nextTravellerTick === undefined) s.nextTravellerTick = s.tick + travellerGap(s, rng, attract);
  if (s.tick < s.nextTravellerTick || s.raid || travellers.length >= MAX_TRAVELLERS) return;
  s.nextTravellerTick = s.tick + travellerGap(s, rng, attract);
  // who comes: any tier the shop is attractive enough for, the grander ones less often
  const tiers = tiersDrawn(attract);
  let roll = rng.range(0, tiers.reduce((n, c) => n + c.weight, 0));
  const tier = tiers.find((c) => (roll -= c.weight) < 0) ?? tiers[0];
  const side = rng.chance(0.5) ? -1 : 1;
  const taken = [...s.people.map((p) => p.name), ...travellers.map((t) => t.name)];
  const free = NAMES.filter((n) => !taken.includes(n));
  const purse = rng.int(PURSE[0], PURSE[1]) * PURSE_SCALE[s.era] * tier.purse * (1 + attract * APPEAL_SPEND) * (1 + operatorSkill(s, open.def) * KEEPER_SPEND);
  const look = randomLook(rng);
  if (tier.outfit) look.outfit = tier.outfit; // (dressed for their station)
  travellers.push({
    id: s.nextId++,
    name: rng.pick(free.length ? free : NAMES),
    kind: rng.pick(tier.kinds),
    tier: tier.tier,
    look,
    x: side < 0 ? -TILE : worldWidth(s) + TILE,
    dir: side < 0 ? 1 : -1,
    phase: 'arriving',
    toX: buildingCentreX(open),
    until: 0,
    purse: Math.round(purse),
  });
  if (tier.tier > 1 && !s.shopLog?.some((l) => l.text.includes(` ${tier.name.toLowerCase()} `) || l.text.includes(tier.plural))) {
    notify(s, `Word of the shop has spread: ${tier.plural.toLowerCase()} have started to come. They want finer wares.`, true);
  }
}

/** On their way out of town, the way they were going. */
function leave(s: GameState, t: Traveller): void {
  t.phase = 'leaving';
  t.toX = t.dir > 0 ? worldWidth(s) + TILE : -TILE;
}

/** Wares the town has made and has in store, for a customer of this tier: theirs first, the finest first. */
export function waresFor(s: GameState, tier: number): ItemDef[] {
  return WARES.filter((w) => w.ware!.tier <= tier && (s.items[w.id] ?? 0) > 0).sort((a, b) => b.ware!.tier - a.ware!.tier || b.ware!.price - a.ware!.price);
}

/** At the shop: they buy wares, then what the town has spare, and sell it what it wants (as far as its coins go). */
function deal(s: GameState, shop: Building, t: Traveller, town: ShopTown): void {
  const tier = tierOf(t.tier ?? 1);
  const who = `${t.name} the ${t.kind}`;
  const first = s.coins === undefined; // (the purse is made with the first sale)
  let spent = 0;

  // wares first: the finest the shop has that they can afford, two of a kind at most, three in all
  const wares: string[] = [];
  let theirs = false;
  for (const w of waresFor(s, tier.tier)) {
    for (let k = 0; k < 2 && wares.length < 3 && (s.items[w.id] ?? 0) > 0 && t.purse - spent >= w.ware!.price; k++) {
      s.items[w.id]--;
      if (!s.items[w.id]) delete s.items[w.id];
      spent += w.ware!.price;
      wares.push(w.name);
      if (w.ware!.tier === tier.tier) theirs = true;
    }
  }
  // (a customer above the ordinary has come for wares of their own standing)
  if (tier.tier > 1) {
    if (theirs) s.renown = Math.min(RENOWN_MAX, (s.renown ?? 0) + RENOWN_WIN * tier.tier);
    else s.renown = Math.max(0, (s.renown ?? 0) - RENOWN_LOSS * tier.tier);
  } else if (wares.length) s.renown = Math.min(RENOWN_MAX, (s.renown ?? 0) + RENOWN_WIN / 2);

  // then materials: ordinary travellers take anything spare, the grander only refined goods
  const spare = town.forSale(s);
  const sold: Stock = {};
  const goods = (Object.entries(spare) as [Material, number][])
    .filter(([m, n]) => n > 0 && (tier.tier === 1 || WORTH[m] >= 3))
    .sort((a, b) => WORTH[b[0]] - WORTH[a[0]] || b[1] - a[1]);
  for (const [m, have] of goods) {
    if (Object.keys(sold).length >= MAX_KINDS) break;
    const n = Math.min(have, MAX_BUY_EACH * tier.purse, Math.floor((t.purse - spent) / WORTH[m]));
    if (n <= 0) continue;
    takeStock(s, m, n);
    sold[m] = n;
    spent += n * WORTH[m];
  }
  if (spent > 0) {
    s.coins = (s.coins ?? 0) + spent;
    const what = [...counted(wares), ...(poolSize(sold) ? [list(sold)] : [])].join(', ');
    log(s, `${who} bought ${what} (${spent} coins).`);
    if (first) notify(s, `The ${BUILDING_BY_ID[shop.def].name} made its first sale: ${who} bought ${what} for ${spent} coins.`, true);
  }
  if (tier.tier > 1 && !theirs) log(s, `${who} left disappointed: nothing fine enough for ${tier.plural.toLowerCase()}.`);

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
    const left = depositNear(s, buildingCentreX(shop), { [w.m]: n });
    const got = n - (left[w.m] ?? 0);
    if (got <= 0) continue;
    bought[w.m] = got;
    paid += Math.ceil(got * price);
    room -= got;
  }
  if (paid > 0) {
    s.coins = (s.coins ?? 0) - paid;
    log(s, `Bought ${list(bought)} from ${who} (${paid} coins).`);
    notify(s, `Bought ${list(bought)} from a passing ${t.kind} for ${paid} coins.`);
  }
  if (!spent && !paid && tier.tier === 1) log(s, `${who} looked around and left empty-handed.`);
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

/** "2 Iron Brooches"-style counts of a list of names ("Iron Brooch ×2"). */
const counted = (names: string[]) => [...new Set(names)].map((n) => (names.filter((q) => q === n).length > 1 ? `${n} ×${names.filter((q) => q === n).length}` : n));

const list = (st: Stock) =>
  MATERIALS.filter((m) => st[m])
    .map((m) => `${st[m]} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

/** Every tier, for display: whether the shop draws it yet. */
export const customerTiers = (s: GameState, b: Building) => CUSTOMER_TIERS.map((c) => ({ ...c, drawn: attractiveness(s, b) >= c.from }));
