// Venues: the shop and the tavern (the ant-farm redesign, Phases 2 and 3). Once the town has built one, strangers pass
// through: each walks in from an end of town, goes to the shop or the tavern, deals, stays a while, and walks on out
// the other end. They're all different: named, of some temper (a haggler, a big spender, picky, chatty, in a hurry),
// and each comes wanting something in particular.
//
// The shop: a customer wants gear of a kind (a tool, a weapon, armour), one piece in particular, the fine wares of
// their standing, or a load of some material. How attractive the shop is (its furnishings' appeal plus its renown)
// decides who comes: ordinary travellers to any shop; merchants, nobles and magnates to a grand one, with far bigger
// purses and an eye for quality. The tavern: a guest wants a kind of fare (a hearty meal, a drink, something sweet)
// or one dish, and needs the place comfortable enough (its furnishings' comfort) or walks out.
//
// The keeper (shopkeeper, barkeep) can talk a customer into more: a finer piece than they came for, a second round,
// something extra, a better price; or, when there's nothing they want, into something else. The better their Social
// skill, the likelier. Customers served spread the venue's renown; the disappointed don't. What goes unsold is
// remembered, and the town makes it. The town also spends its coins on its venues: extensions (a bigger floor) and
// levels on the pieces set out. What it sells, buys, makes and spends on is the planner's call (planner.ts).

import { BUILDING_BY_ID, type Venue } from '../data/buildings';
import { FARE_NAMES, ITEM_BY_ID, ITEMS, type FareKind, type ItemDef } from '../data/items';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { COMMON, pieceLabel, qualityMult, qualityOf } from '../data/quality';
import {
  APPEAL_HALVES_WAIT,
  APPEAL_CAP,
  APPEAL_SPEND,
  ASKED_KEEP,
  BUY_MARKUP,
  BYNAMES,
  COIN_RESERVE,
  COMFORT_BASE,
  COMFORT_REACH,
  CUSTOMER_TIERS,
  DISH_CHANCE,
  extensionCost,
  saleValue,
  FARE,
  FIRST_NAMES,
  furnishes,
  GUEST_KINDS,
  GUEST_PURSE,
  GUEST_STAY,
  KEEPER_SPEND,
  FILL_MAX,
  LODGING,
  MAX_BUY_EACH,
  MAX_EXTENSIONS,
  MAX_KINDS,
  MAX_PIECE_LEVEL,
  MAX_SELL_EACH,
  MAX_TRAVELLERS,
  ORIGINS,
  PIECE_LEVEL_COST,
  PREMIUM,
  PURSE,
  PURSE_SCALE,
  RENOWN_FADE,
  RENOWN_LOSS,
  RENOWN_MAX,
  RENOWN_WIN,
  SALE_XP,
  SHOP_LOG,
  SHOP_WANTS,
  SHOPPING_HOURS,
  TASTES,
  temperOf,
  TEMPERS,
  tierOf,
  tiersDrawn,
  TRAVELLER_EVERY,
  TRAVELLER_SPEED,
  travellerGoods,
  UPSELL_MAX,
  UPSELL_PER_LEVEL,
  UPSELL_XP,
  venueOfDef,
  lineOfDef,
  LINE_ITEMS,
  WANT_SLOTS,
  WARES,
  type ShopWantKind,
} from '../data/shop';
import { WORTH } from '../data/trade';
import { LINES, SHOP_LINES, type ShopLine } from '../data/stores';
import { biomeOf } from '../data/biomes';
import { randomLook } from '../data/people';
import type { Rng } from '../rng';
import { buildingCentreX, buildingDoor, depositNear, footprint as plotOf, storages, totalCapacity, totalStock } from './buildings';
import { addItems, itemUnlocked, qualitiesOf, takeItem } from './crafting';
import { operatorOf, operatorSkill } from './operators';
import { addStock, earn, edgeXY, notify, poolSize, remember, type Building, type GameState, type ShopPiece, type Traveller, type Want } from './state';
import { calendar, TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill, housingCapacity } from './townsfolk';
import { offerToSettle, strangerLook, strangerOrigin } from './strangers';
import { priceRate, travellerRate } from './origin';
import { walk } from './walk';

/* ------------------------------------------------------------ the venues and their floors */

/** The town's venue of a kind, once built (there's only ever one of each). */
export const venueOf = (s: GameState, venue: Venue): Building | undefined => s.buildings.find((b) => b.status === 'done' && venueOfDef(b.def) === venue && !lineOfDef(b.def));
/** The town's specialty shop of a line (data/stores.ts), once built. */
export const storeOf = (s: GameState, line: ShopLine): Building | undefined => s.buildings.find((b) => b.status === 'done' && lineOfDef(b.def) === line);
/** Open: built, and its keeper at home and on their feet. */
export const storeOpen = (s: GameState, line: ShopLine): Building | undefined => {
  const b = storeOf(s, line);
  return b && operatorOf(s, b.def) ? b : undefined;
};
/** Where a traveller is headed: their specialty shop, or the general store or the tavern. */
const venueFor = (s: GameState, t: Traveller) => (t.line ? storeOf(s, t.line) : venueOf(s, t.venue ?? 'shop'));
/** Open: built, and someone to keep it (at home and on their feet). */
export const venueOpen = (s: GameState, venue: Venue): Building | undefined => {
  const b = venueOf(s, venue);
  return b && operatorOf(s, b.def) ? b : undefined;
};
export const shopOf = (s: GameState) => venueOf(s, 'shop');
export const shopOpen = (s: GameState) => venueOpen(s, 'shop');
export const tavernOf = (s: GameState) => venueOf(s, 'tavern');

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type VenueBuilding = Pick<Building, 'def' | 'shop'>;
export const extensionsOf = (b: VenueBuilding) => b.shop?.extensions ?? 0;
export const venueKind = (b: VenueBuilding): Venue => venueOfDef(b.def) ?? 'shop';

/** The floor: its size (bigger with each extension), the counter (the keeper stands behind it, against the back
 *  wall; a tavern's is its bar) and the door in the front wall (with a cell in from it kept clear). Cells run from the
 *  back wall (y 0) to the front. */
export function shopLayout(b: VenueBuilding): { cols: number; rows: number; counter: Rect; keeper: Rect; door: number } {
  const base = BUILDING_BY_ID[b.def].floor!;
  const cols = base.cols + extensionsOf(b) * 2;
  const rows = base.rows + extensionsOf(b);
  return { cols, rows, counter: { x: cols - 3, y: 1, w: 2, h: 1 }, keeper: { x: cols - 3, y: 0, w: 2, h: 1 }, door: Math.floor(cols / 2) - 1 };
}

/** A tavern's guest rooms, upstairs over the common room: one for every three cells of its width (so more as it's
 *  extended, and more again as a Tavern). Each holds one bed, set at y -1 with x the room. A shop has none. */
export const UPSTAIRS = -1;
export const roomsOf = (b: VenueBuilding) => (venueKind(b) === 'tavern' ? Math.floor(shopLayout(b).cols / 3) : 0);
const isBed = (item: ItemDef) => item.furnish?.kind === 'bed';

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Cells nothing can be set on: the counter and the keeper's place behind it, and the aisles kept clear for people
 *  to walk (from the door straight up to the row in front of the counter, and along that row to the counter). */
function fixedCell(b: VenueBuilding, x: number, y: number): boolean {
  const l = shopLayout(b);
  const front = l.counter.y + 1;
  const aisle = (x === l.door && y >= front) || (y === front && x >= Math.min(l.door, l.counter.x) && x < Math.max(l.door + 1, l.counter.x + l.counter.w));
  return inRect(l.counter, x, y) || inRect(l.keeper, x, y) || aisle;
}

/** How much of the floor's free cells are taken up. */
export function fill(b: Building): number {
  const { cols, rows } = shopLayout(b);
  let free = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!fixedCell(b, x, y)) free++;
  const used = piecesOf(b)
    .filter((p) => p.y >= 0)
    .reduce((n, p) => n + footprint(p).w * footprint(p).h, 0);
  return free ? used / free : 1;
}

const piecesOf = (b: Building): ShopPiece[] => (b.shop ??= { pieces: [] }).pieces;
const footprint = (p: ShopPiece): Rect => {
  const f = ITEM_BY_ID[p.item]?.furnish;
  return { x: p.x, y: p.y, w: f?.w ?? 1, h: f?.h ?? 1 };
};

/** Whether a piece fits at a spot: it belongs in this venue, and it's on the floor, clear of the counter and door, and
 *  of the other pieces. */
function fits(b: Building, item: ItemDef, x: number, y: number): boolean {
  if (!furnishes(item, venueKind(b))) return false;
  // (a bed goes in a guest room upstairs, one to a room)
  if (isBed(item)) return y === UPSTAIRS && x >= 0 && x < roomsOf(b) && !piecesOf(b).some((p) => p.y === UPSTAIRS && p.x === x);
  const f = item.furnish!;
  const { cols, rows } = shopLayout(b);
  if (x < 0 || y < 0 || x + f.w > cols || y + f.h > rows) return false;
  for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.h; dy++) if (fixedCell(b, x + dx, y + dy)) return false;
  const me = { x, y, w: f.w, h: f.h };
  return !piecesOf(b).some((p) => overlap(me, footprint(p)));
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a keeper likes each kind of piece: shelves (and hearths) against the back wall (or a side wall), decorations
 *  in the corners, tables and rugs out in the middle of the floor. Lower is better. */
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
    case 'bed':
      // (along the side walls, away from the bar and the fire)
      return wallX && y > 0 ? 0 : wallX ? 1 : wallY && y > 0 ? 2 : 4;
  }
}

/** The best free spot for a piece, or null if there's no room (or it doesn't belong here). */
export function spotFor(b: Building, item: ItemDef): { x: number; y: number } | null {
  if (isBed(item)) {
    for (let x = 0; x < roomsOf(b); x++) if (fits(b, item, x, UPSTAIRS)) return { x, y: UPSTAIRS };
    return null;
  }
  // (past half full it's crowded: better to extend than to cram more in)
  if (fill(b) >= FILL_MAX) return null;
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
export function replaceable(b: Building, item: ItemDef, quality = COMMON): ShopPiece | undefined {
  const f = item.furnish!;
  if (!furnishes(item, venueKind(b))) return undefined;
  const mine = f.appeal * qualityMult(quality);
  return piecesOf(b)
    .filter((p) => {
      const g = ITEM_BY_ID[p.item]?.furnish;
      return g && g.w === f.w && g.h === f.h && pieceAppeal(p) < mine;
    })
    .sort((p, q) => pieceAppeal(p) - pieceAppeal(q))[0];
}

/** Whether a piece would make the venue better: it belongs, and there's room for it or it beats one already out. */
export const wouldFurnish = (b: Building, item: ItemDef) => furnishes(item, venueKind(b)) && (!!spotFor(b, item) || !!replaceable(b, item));

/** A piece's appeal (or comfort): its own, times its quality, and half as much again for each level it's been improved. */
export function pieceAppeal(p: ShopPiece): number {
  return (ITEM_BY_ID[p.item]?.furnish?.appeal ?? 0) * qualityMult(p.q) * (1 + ((p.level ?? 1) - 1) / 2);
}

/** How much a venue's floor draws people in (a shop's appeal, a tavern's comfort): what it has bare, and what's been
 *  set out. People like to see something new: a second piece just like one already out counts for half, a third a
 *  quarter, and so on (the best of them counting most). */
export function appeal(b: Building): number {
  const byItem = new Map<string, number[]>();
  for (const p of b.shop?.pieces ?? []) byItem.set(p.item, [...(byItem.get(p.item) ?? []), pieceAppeal(p)]);
  let n = BUILDING_BY_ID[b.def].floor?.appeal ?? 0;
  for (const list of byItem.values()) list.sort((x, y) => y - x).forEach((a, i) => (n += a / 2 ** i));
  return Math.round(n);
}

/** Lodgers are in bed from late evening till morning (before that they sit up over their food). */
export const asleepHour = (hour: number) => hour >= LODGING.night || hour < LODGING.morning;

/** The beds set out in a tavern. */
export const bedsOf = (b: Building) => (b.shop?.pieces ?? []).filter((p) => ITEM_BY_ID[p.item]?.furnish?.kind === 'bed');

/** How much the keeper would like one more of a piece: what it adds (comfort, appeal), and for a bed, the guests it
 *  would put up (more when guests have been turned away for want of one). */
export function furnishValue(b: Building, item: ItemDef): number {
  const gain = appealGain(b, item);
  if (item.furnish?.kind !== 'bed') return gain;
  const beds = bedsOf(b).length;
  return gain + (4 + 3 * (b.shop?.asked?.bed ?? 0)) / (1 + beds);
}

/** What one more of a piece would add (halved for each like it already out). */
export function appealGain(b: Building, item: ItemDef): number {
  return item.furnish!.appeal / 2 ** (b.shop?.pieces ?? []).filter((p) => p.item === item.id).length;
}

export const renownOf = (b: Building) => b.shop?.renown ?? 0;
export function addRenown(b: Building, n: number): void {
  (b.shop ??= { pieces: [] }).renown = Math.max(0, Math.min(RENOWN_MAX, renownOf(b) + n));
}

/** How attractive a venue is, all told: its floor and its renown. This decides who comes, and how often. */
export const attractiveness = (s: GameState, b: Building) => appeal(b) + Math.floor(renownOf(b)) + trophyRenown(s);

/** Renown each treasure on show in a Trophy Hall adds to every venue (a boss's trophy, a unique weapon). */
export const TROPHY_RENOWN = 3;
/** The town's treasures: the uniques it has found, and the relics (bosses' trophies) it holds or wears. */
export function treasuresHeld(s: GameState): number {
  const relics = new Set<string>();
  for (const [id, n] of Object.entries(s.items)) if (n > 0 && ITEM_BY_ID[id]?.relic) relics.add(id);
  for (const p of s.people) for (const id of Object.values(p.gear)) if (id && ITEM_BY_ID[id]?.relic) relics.add(id);
  for (const u of s.uniques ?? []) relics.add(u);
  return relics.size;
}
/** What a finished Trophy Hall adds to the venues' renown. */
export const trophyRenown = (s: GameState) => (s.buildings.some((b) => b.def === 'trophy_hall' && b.status === 'done') ? treasuresHeld(s) * TROPHY_RENOWN : 0);

/** Pieces that no longer fit (the building was rebuilt bigger and its counter moved, say) go back to the stores for
 *  the keeper to set out again. */
function settle(s: GameState, b: Building): void {
  const pieces = piecesOf(b);
  b.shop!.pieces = [];
  for (const p of pieces) {
    const item = ITEM_BY_ID[p.item];
    if (item?.furnish && fits(b, item, p.x, p.y)) b.shop!.pieces.push(p);
    else if (item) addItems(s, p.item, 1, p.q ?? COMMON);
  }
}

/** The keeper sets out one made piece (the most appealing that helps, the finest of it), replacing a poorer one if the
 *  floor's full. */
function setOut(s: GameState, b: Building): void {
  const keeper = operatorOf(s, b.def);
  if (!keeper) return;
  const venue = venueKind(b);
  const worth = (i: ItemDef) => i.furnish!.appeal * qualityMult(qualitiesOf(s, i.id)[0]);
  const spare = Object.keys(s.items)
    .map((id) => ITEM_BY_ID[id])
    .filter((i) => i && furnishes(i, venue) && (s.items[i.id] ?? 0) > 0)
    .sort((p, q) => worth(q) - worth(p));
  for (const item of spare) {
    const spot = spotFor(b, item);
    const old = spot ? undefined : replaceable(b, item, qualitiesOf(s, item.id)[0]);
    if (!spot && !old) continue;
    const q = takeItem(s, item.id, 'best') ?? COMMON;
    const name = pieceLabel(item.name, q);
    if (old) {
      // (the old piece goes to whoever wants it: it isn't kept)
      old.item = item.id;
      old.q = q;
      delete old.level;
      log(s, b, `${keeper.name} put out a ${name} in place of an older piece.`);
    } else {
      piecesOf(b).push({ item: item.id, ...spot!, q });
      log(s, b, `${keeper.name} set out a ${name}.`);
    }
    return;
  }
}

/* ------------------------------------------------------------ spending coins on a venue */

/** What the next extension costs, or null if the venue has all it can have. */
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
  earn(s, 'venues', -price);
  (b.shop ??= { pieces: [] }).extensions = extensionsOf(b) + 1;
  log(s, b, `The ${BUILDING_BY_ID[b.def].name} was extended: more floor for more furnishings (${price} coins).`);
  notify(s, `The town paid ${price} coins to extend its ${BUILDING_BY_ID[b.def].name}.`, true);
  return true;
}

/** Pay to improve one piece a level. */
export function improve(s: GameState, b: Building, p: ShopPiece): boolean {
  const price = levelPrice(p);
  if (price === null || (s.coins ?? 0) < price) return false;
  s.coins = (s.coins ?? 0) - price;
  earn(s, 'venues', -price);
  p.level = (p.level ?? 1) + 1;
  const name = ITEM_BY_ID[p.item].name;
  log(s, b, p.level === 2 ? `The ${name} was built up a second tier (${price} coins).` : `The ${name} was polished and trimmed in brass (${price} coins).`);
  return true;
}

/* ------------------------------------------------------------ what things sell for */

/** What a piece of gear or a ware sells for, at a quality. */
export const itemPrice = (i: ItemDef, q: number | undefined) => saleValue(i, q);

/** Fare's price, at a quality, in the town's era. */
export const farePrice = (s: GameState, i: ItemDef, q: number | undefined) => Math.max(1, Math.round(i.fare!.price * PURSE_SCALE[s.era] * qualityMult(q)));

/** Gear the shop can sell: anything in the stores (the townsfolk wear, or buy, the best of it first). */
export const SALE_GEAR: readonly ItemDef[] = ITEMS.filter((i) => i.slot && !i.relic && !i.research.includes('__relic'));

/* ------------------------------------------------------------ strangers */

/** Game ticks until the next stranger, for a venue this attractive. */
export function travellerGap(s: GameState, rng: Rng, attract: number): number {
  const hours = rng.range(TRAVELLER_EVERY[0], TRAVELLER_EVERY[1]) / (1 + Math.min(attract, APPEAL_CAP) / APPEAL_HALVES_WAIT) / (biomeOf(s).caravans ?? 1) / travellerRate(s);
  return Math.round(hours * TICKS_PER_HOUR);
}

/** What the town wants from travellers (the planner's shopping list), and what it has spare to sell them. */
export interface ShopTown {
  forSale(s: GameState): Stock;
  wants(s: GameState): { m: Material; n: number; essential: boolean }[];
}

/** A name nobody in town or on the road has: a first name, with a byname or where they're from. */
function strangerName(s: GameState, rng: Rng): string {
  const taken = new Set([...s.people.map((p) => p.name), ...(s.travellers ?? []).map((t) => t.name)]);
  for (let k = 0; k < 20; k++) {
    const first = rng.pick(FIRST_NAMES);
    const roll = rng.next();
    const name = roll < 0.45 ? `${first} ${rng.pick(BYNAMES)}` : roll < 0.75 ? `${first} of ${rng.pick(ORIGINS)}` : roll < 0.85 ? `Old ${first}` : first;
    if (!taken.has(name)) return name;
  }
  return rng.pick(FIRST_NAMES);
}

function weighted<T>(rng: Rng, list: [T, number][]): T {
  let roll = rng.range(0, list.reduce((n, [, w]) => n + w, 0));
  return (list.find(([, w]) => (roll -= w) < 0) ?? list[0])[0];
}

/** What a specialty shop's customer comes for: a weapon or armour (of their standing's quality), or anything of its
 *  line (furniture, medicine). */
function lineWant(line: ShopLine, tier: number): Want {
  const minQ = tier >= 4 ? 4 : tier >= 3 ? 3 : tier >= 2 ? 2 : 0;
  if (line === 'weapons') return { kind: 'gear', slots: [...WANT_SLOTS.weapon], label: 'a weapon', minQ };
  if (line === 'armour') return { kind: 'gear', slots: [...WANT_SLOTS.armor], label: 'armour', minQ };
  return { kind: 'line', line, minQ };
}
/** Whether an item is sold by a specialty shop the town has open (the general store leaves it to them). */
function lineOfItemOpen(s: GameState, i: ItemDef): boolean {
  for (const line of SHOP_LINES) if (LINE_ITEMS[line].includes(i) && storeOpen(s, line)) return true;
  return false;
}

/** What a shop customer of a tier comes for. A piece in particular is something the town knows how to make (or a
 *  customer would only ever be disappointed); a material is one of the goods of the town's era. The grand want finer
 *  things. */
function shopWant(s: GameState, rng: Rng, tier: number, forSale: Stock): Want {
  const kind: ShopWantKind = weighted(rng, SHOP_WANTS[tier] ?? SHOP_WANTS[1]);
  const minQ = tier >= 4 ? 4 : tier >= 3 ? 3 : tier >= 2 ? 2 : 0;
  switch (kind) {
    case 'tool':
    case 'weapon':
    case 'armor': {
      // (with a Weapons Store or an Armour Store open, those customers go there: the general store sells tools)
      const elsewhere = (kind === 'weapon' && storeOpen(s, 'weapons')) || (kind === 'armor' && storeOpen(s, 'armour'));
      if (elsewhere) return { kind: 'gear', slots: ['tool'], label: 'a tool', minQ };
      return { kind: 'gear', slots: [...WANT_SLOTS[kind]], label: kind === 'armor' ? 'armour' : `a ${kind}`, minQ };
    }
    case 'item': {
      const known = SALE_GEAR.filter((i) => itemUnlocked(s, i) && !(lineOfItemOpen(s, i)));
      if (known.length) return { kind: 'item', item: rng.pick(known).id, minQ };
      return { kind: 'gear', slots: ['tool'], label: 'a tool', minQ };
    }
    case 'ware':
      return { kind: 'ware' };
    case 'material': {
      const goods = travellerGoods(s.era).filter((m) => tier === 1 || WORTH[m] >= 3);
      const theirs = (Object.keys(forSale) as Material[]).filter((m) => goods.includes(m));
      // (usually something the town has: that's why they came this way)
      const m = theirs.length && rng.chance(0.6) ? rng.pick(theirs) : rng.pick(goods.length ? goods : (['stone'] as Material[]));
      return { kind: 'material', m, n: rng.int(3, 8) * (tier > 1 ? 2 : 1) };
    }
  }
}

/** What a tavern guest comes for: a kind of fare, or one dish (one the town knows how to make). */
function guestWant(s: GameState, rng: Rng): Want {
  if (rng.chance(DISH_CHANCE)) {
    const known = FARE.filter((i) => itemUnlocked(s, i));
    if (known.length) return { kind: 'dish', item: rng.pick(known).id };
  }
  return { kind: 'fare', fare: weighted(rng, TASTES) };
}

/** What someone wants, in words ("a weapon", "a Spear (Rare or better)", "6 iron", "a drink"). */
export function wantText(w: Want): string {
  const fine = (q?: number) => (q ? ` (${qualityOf(q).name} or better)` : '');
  switch (w.kind) {
    case 'gear':
      return w.label + fine(w.minQ);
    case 'item':
      return `a ${ITEM_BY_ID[w.item]?.name ?? w.item}` + fine(w.minQ);
    case 'ware':
      return 'fine goods';
    case 'material':
      return `${w.n} ${MATERIAL_NAMES[w.m].toLowerCase()}`;
    case 'fare':
      return FARE_NAMES[w.fare];
    case 'dish':
      return ITEM_BY_ID[w.item]?.name ?? w.item;
    case 'line':
      return LINES[w.line].label + fine(w.minQ);
  }
}

/** The key an unmet want is remembered by (the town makes what's asked for). */
export function wantKey(w: Want, tier = 1): string {
  switch (w.kind) {
    case 'gear':
      return `gear:${w.slots.join(',')}`;
    case 'item':
      return `item:${w.item}`;
    case 'ware':
      return `ware:${tier}`;
    case 'material':
      return `mat:${w.m}`;
    case 'fare':
      return `fare:${w.fare}`;
    case 'dish':
      return `dish:${w.item}`;
    case 'line':
      return `line:${w.line}`;
  }
}

/** Every tick: strangers walk in, deal, and walk on; once an hour the keepers set out a new piece; once a day renown
 *  fades a little and old wants are forgotten. */
export function updateShop(s: GameState, rng: Rng, town: ShopTown): void {
  for (const b of s.buildings) {
    if (b.status !== 'done' || !venueOfDef(b.def)) continue;
    if (s.tick % TICKS_PER_HOUR === 0) {
      settle(s, b);
      setOut(s, b);
    }
    if (s.tick % TICKS_PER_DAY === 0 && b.shop) {
      if (b.shop.renown) b.shop.renown *= 1 - RENOWN_FADE;
      for (const [k, n] of Object.entries(b.shop.asked ?? {})) {
        if (n * ASKED_KEEP < 0.5) delete b.shop.asked![k];
        else b.shop.asked![k] = n * ASKED_KEEP;
      }
    }
  }
  const travellers = (s.travellers ??= []);
  const step = TRAVELLER_SPEED / TICK_HZ;
  for (const t of [...travellers]) {
    const venue = venueFor(s, t);
    // raiders, or nowhere to go: they hurry on
    if (t.phase !== 'leaving' && (!venue || s.raid?.phase === 'active')) leave(s, t);
    if (t.phase === 'shopping') {
      if (s.tick >= t.until) {
        // (a traveller well served may ask to settle: sim/strangers.ts)
        if (!t.bed && offerToSettle(s, t, rng, housingCapacity(s) > s.people.length)) {
          travellers.splice(travellers.indexOf(t), 1);
          continue;
        }
        leave(s, t);
      }
      continue;
    }
    if (!walk(s, t, { x: t.toX, y: t.toY }, step, venue ? plotOf(venue) : undefined, s.tick)) continue;
    if (t.phase === 'leaving') travellers.splice(travellers.indexOf(t), 1);
    else if (venue) {
      t.phase = 'shopping';
      t.until = s.tick + Math.round(SHOPPING_HOURS * temperOf(t.temper).stay * (t.venue === 'tavern' ? GUEST_STAY : 1) * TICKS_PER_HOUR);
      if (t.venue === 'tavern') serveGuest(s, venue, t, rng);
      else serveCustomer(s, venue, t, town, rng);
    }
  }
  arrive(s, rng, 'shop', town);
  arrive(s, rng, 'tavern', town);
  for (const line of SHOP_LINES) arrive(s, rng, 'shop', town, line);
}

/** A new stranger on the road, if one's due for a venue. */
function arrive(s: GameState, rng: Rng, kind: Venue, town: ShopTown, line?: ShopLine): void {
  const open = line ? storeOpen(s, line) : venueOpen(s, kind);
  if (!open) return;
  const travellers = s.travellers!;
  const attract = attractiveness(s, open);
  const due = line ? s.nextStoreTick?.[line] : kind === 'shop' ? s.nextTravellerTick : s.nextGuestTick;
  const schedule = () => {
    const next = s.tick + travellerGap(s, rng, attract);
    if (line) (s.nextStoreTick ??= {})[line] = next;
    else if (kind === 'shop') s.nextTravellerTick = next;
    else s.nextGuestTick = next;
  };
  if (due === undefined) return schedule();
  if (s.tick < due || s.raid || travellers.filter((t) => (t.venue ?? 'shop') === kind && t.line === line).length >= MAX_TRAVELLERS) return;
  schedule();
  const side = rng.chance(0.5) ? -1 : 1;
  const temper = weighted(rng, Object.entries(TEMPERS).map(([id, t]) => [id, t.weight] as [string, number]));
  const look = randomLook(rng);
  const keeper = operatorSkill(s, open.def) * KEEPER_SPEND;
  // (a traveller may be of another people: their look is theirs, sim/strangers.ts)
  const origin = strangerOrigin(s, rng, true);
  const stranger = (what: string, tier: number, purse: number): Traveller => {
    const t: Traveller = {
    id: s.nextId++,
    name: strangerName(s, rng),
    kind: what,
    tier,
    temper,
    venue: kind,
    look,
    ...edgeXY(s, side),
    dir: side < 0 ? 1 : -1,
    phase: 'arriving',
    toX: buildingDoor(open).x,
    toY: buildingDoor(open).y,
    until: 0,
    purse: Math.round(purse),
    };
    if (origin) strangerLook(t, origin);
    return t;
  };
  let t: Traveller;
  if (kind === 'shop') {
    // who comes: any tier the shop is attractive enough for, the grander ones less often
    const tier = weighted(rng, tiersDrawn(attract).map((c) => [c, c.weight] as [(typeof CUSTOMER_TIERS)[number], number]));
    if (tier.outfit) look.outfit = tier.outfit; // (dressed for their station)
    const purse = rng.int(PURSE[0], PURSE[1]) * PURSE_SCALE[s.era] * tier.purse * (1 + Math.min(attract, APPEAL_CAP) * APPEAL_SPEND) * (1 + keeper) * temperOf(temper).purse * priceRate(s);
    t = stranger(rng.pick(tier.kinds), tier.tier, purse);
    t.want = line ? lineWant(line, tier.tier) : shopWant(s, rng, tier.tier, town.forSale(s));
    if (line) t.line = line;
    if (tier.tier > 1 && !(open.shop?.seen ?? []).includes(tier.tier)) {
      ((open.shop ??= { pieces: [] }).seen ??= []).push(tier.tier);
      notify(s, `Word of the ${BUILDING_BY_ID[open.def].name} has spread: ${tier.plural.toLowerCase()} have started to come. They want finer things.`, true);
    }
  } else {
    // a guest: used to some comfort (there's always someone who finds the place too rough), the better-off spending more
    const req = Math.round(rng.range(0, appeal(open) * COMFORT_REACH + COMFORT_BASE));
    const band = [...GUEST_KINDS].reverse().find(([from]) => req >= from) ?? GUEST_KINDS[0];
    const outfit = CUSTOMER_TIERS[band[1] - 1]?.outfit;
    if (outfit) look.outfit = outfit;
    const purse = rng.int(GUEST_PURSE[0], GUEST_PURSE[1]) * PURSE_SCALE[s.era] * (1 + req / 15) * (1 + keeper) * temperOf(temper).purse * priceRate(s);
    t = stranger(rng.pick(band[2]), band[1], purse);
    t.want = guestWant(s, rng);
    t.req = req;
  }
  travellers.push(t);
}

/** On their way out of town, the way they were going. */
function leave(s: GameState, t: Traveller): void {
  t.phase = 'leaving';
  const out = edgeXY(s, t.dir > 0 ? 1 : -1);
  t.toX = out.x;
  t.toY = out.y;
}

/** One piece on offer: which item, at what quality, and what it costs. */
export interface Offer {
  item: ItemDef;
  q: number;
  price: number;
}

/** Every piece of some items in stock (each quality once), cheapest first. */
export function offers(s: GameState, items: readonly ItemDef[], price: (i: ItemDef, q: number) => number): Offer[] {
  const out: Offer[] = [];
  for (const i of items) if ((s.items[i.id] ?? 0) > 0) for (const q of new Set(qualitiesOf(s, i.id))) out.push({ item: i, q, price: price(i, q) });
  return out.sort((a, b) => a.price - b.price);
}

/** Take one offered piece out of the inventory. */
export function takeOffer(s: GameState, o: Offer): boolean {
  const q = qualitiesOf(s, o.item.id);
  const i = q.indexOf(o.q);
  if (i < 0) return false;
  q.splice(i, 1);
  if (q.length) s.itemQ![o.item.id] = q;
  else delete s.itemQ![o.item.id];
  const v = (s.items[o.item.id] ?? 1) - 1;
  if (v > 0) s.items[o.item.id] = v;
  else delete s.items[o.item.id];
  return true;
}

/** The keeper's chance of talking this customer round. */
function talkChance(s: GameState, b: Building, t: Traveller): number {
  const skill = operatorSkill(s, b.def);
  return Math.max(0, Math.min(UPSELL_MAX, (skill - 2) * UPSELL_PER_LEVEL + temperOf(t.temper).upsell));
}

export const pieceName = (o: { item: ItemDef; q: number }) => pieceLabel(o.item.name, o.q);

/** Remember a want that went unmet (the town makes what's asked for). */
function asked(b: Building, key: string): void {
  const a = ((b.shop ??= { pieces: [] }).asked ??= {});
  a[key] = (a[key] ?? 0) + 1;
}

/** At the shop: the customer looks for what they came for. The shopkeeper may talk them into something finer, or
 *  something extra, or a better price; with nothing they want, maybe into something else. Then the town buys from
 *  them what it wants (as far as its coins go). */
function serveCustomer(s: GameState, shop: Building, t: Traveller, town: ShopTown, rng: Rng): void {
  const tier = tierOf(t.tier ?? 1);
  const temper = temperOf(t.temper);
  const keeper = operatorOf(s, shop.def);
  const keeperName = keeper?.name ?? 'The shopkeeper';
  const who = `${t.name} the ${t.kind}`;
  const want: Want = t.want ?? { kind: 'ware' };
  const haggle = t.temper === 'haggler' ? 0.85 : 1;
  const chance = talkChance(s, shop, t);
  const first = s.coins === undefined; // (the purse is made with the first sale)
  let spent = 0;
  const bought: string[] = [];
  let talked = '';
  const afford = (o: Offer) => spent + o.price * haggle <= t.purse;
  const buy = (o: Offer) => {
    if (!takeOffer(s, o)) return;
    spent += Math.round(o.price * haggle);
    bought.push(pieceName(o));
  };

  // what fits what they came for, cheapest first (and what would do instead, if they can be talked round)
  let matches: Offer[] = [];
  let instead: Offer[] = [];
  if (want.kind === 'gear') {
    matches = offers(s, SALE_GEAR.filter((i) => want.slots.includes(i.slot!)), itemPrice).filter((o) => o.q >= (want.minQ ?? 0));
    instead = offers(s, SALE_GEAR.filter((i) => want.slots.includes(i.slot!)), itemPrice).filter((o) => o.q < (want.minQ ?? 0));
  } else if (want.kind === 'item') {
    const it = ITEM_BY_ID[want.item];
    matches = offers(s, [it], itemPrice).filter((o) => o.q >= (want.minQ ?? 0));
    instead = offers(s, SALE_GEAR.filter((i) => i.slot === it.slot), itemPrice).filter((o) => !matches.includes(o));
  } else if (want.kind === 'line') {
    const all = offers(s, LINE_ITEMS[want.line], itemPrice);
    matches = all.filter((o) => o.q >= (want.minQ ?? 0));
    instead = all.filter((o) => o.q < (want.minQ ?? 0));
  } else if (want.kind === 'ware') {
    const all = offers(s, WARES.filter((w) => w.ware!.tier <= tier.tier), itemPrice);
    matches = all.filter((o) => o.item.ware!.tier === tier.tier);
    instead = all.filter((o) => o.item.ware!.tier < tier.tier);
  }

  let met = false;
  if (want.kind === 'material') {
    const spare = town.forSale(s);
    const n = Math.min(spare[want.m] ?? 0, want.n, Math.floor(t.purse / WORTH[want.m]));
    if (n > 0) {
      met = true;
      takeStock(s, want.m, n);
      spent += Math.round(n * WORTH[want.m] * haggle);
      bought.push(`${n} ${MATERIAL_NAMES[want.m].toLowerCase()}`);
    }
  } else {
    const pick = matches.find(afford);
    if (pick) {
      met = true;
      // talked into the finest they can afford, instead of the cheapest that would do
      const finest = [...matches].reverse().find(afford);
      if (finest && finest !== pick && rng.chance(chance)) {
        buy(finest);
        talked = `${keeperName} talked them up to the ${pieceName(finest)}`;
      } else buy(pick);
    }
  }
  // nothing they came for: perhaps talked into something else (never the picky)
  if (!met && !temper.picky) {
    const other = instead.find(afford);
    if (other && rng.chance(chance * 0.8)) {
      buy(other);
      met = true;
      talked = `${keeperName} talked them into the ${pieceName(other)} instead`;
    }
  }
  // satisfied: talked into something more (a ware on the side, or a better price)
  const line = lineOfDef(shop.def);
  if (met && !talked && rng.chance(chance)) {
    // (a specialty shop sells another of its own line on the side; the general store a ware)
    const extra = offers(s, line ? LINE_ITEMS[line] : WARES.filter((w) => w.ware!.tier <= tier.tier), itemPrice).find(afford);
    if (extra) {
      buy(extra);
      talked = `${keeperName} sold them the ${pieceName(extra)} on the side`;
    } else if (spent > 0) {
      const more = Math.round(spent * (PREMIUM - 1));
      spent += more;
      talked = `${keeperName} talked the price up ${more}`;
    }
  }
  if (keeper) {
    if (spent) gainSkill(keeper, 'social', SALE_XP);
    if (talked) gainSkill(keeper, 'social', UPSELL_XP);
  }

  // renown: the grand came for something of their standing
  if (met) addRenown(shop, tier.tier > 1 ? RENOWN_WIN * tier.tier : RENOWN_WIN / 4);
  else {
    addRenown(shop, -(tier.tier > 1 ? RENOWN_LOSS * tier.tier : RENOWN_LOSS / 4));
    asked(shop, wantKey(want, tier.tier));
  }

  // they pick up something spare too, with half what's left (the grand only refined goods; a specialty shop sells
  // only its line, and doesn't buy)
  const spare = line ? {} : town.forSale(s);
  const sold: Stock = {};
  const goods = (Object.entries(spare) as [Material, number][])
    .filter(([m, n]) => n > 0 && (tier.tier === 1 || WORTH[m] >= 3) && !(want.kind === 'material' && m === want.m))
    .sort((a, b) => WORTH[b[0]] - WORTH[a[0]] || b[1] - a[1]);
  const budget = (t.purse - spent) / 2;
  let extra = 0;
  for (const [m, have] of goods) {
    if (Object.keys(sold).length >= MAX_KINDS - 1) break;
    const n = Math.min(have, MAX_BUY_EACH * tier.purse, Math.floor((budget - extra) / WORTH[m]));
    if (n <= 0) continue;
    takeStock(s, m, n);
    sold[m] = n;
    extra += n * WORTH[m];
  }
  spent += extra;
  if (spent > 0) {
    s.coins = (s.coins ?? 0) + spent;
    earn(s, 'shop', spent);
  }
  const also = poolSize(sold) ? list(sold) : '';
  const text = met
    ? `${who} came for ${wantText(want)}: bought ${[...bought, ...(also ? [also] : [])].join(', ')}${talked ? `. ${talked}` : ''} (${spent} coins).`
    : `${who} came for ${wantText(want)} and found none${also ? `, but bought ${also}` : ''}${tier.tier > 1 ? `; left disappointed` : ''}${spent ? ` (${spent} coins)` : ''}.`;
  log(s, shop, text);
  if (keeper) remember(s, keeper, met ? `Served ${t.name} the ${t.kind}: ${bought.join(', ')} (${spent} coins)${talked ? ', talked them round' : ''}` : `Had nothing for ${t.name}, who wanted ${wantText(want)}`);
  if (first && spent > 0) notify(s, `The ${BUILDING_BY_ID[shop.def].name} made its first sale: ${text}`, true);

  if (!line) buyFrom(s, shop, t, town, who);
}

/** At the tavern: a guest used to more comfort than the place has walks out. The rest order what they came for (or,
 *  talked round by the barkeep, something else); a good barkeep sells them a finer dish, or pours another round. */
function serveGuest(s: GameState, tavern: Building, t: Traveller, rng: Rng): void {
  const keeper = operatorOf(s, tavern.def);
  const keeperName = keeper?.name ?? 'The barkeep';
  const who = `${t.name} the ${t.kind}`;
  const want: Want = t.want ?? { kind: 'fare', fare: 'drink' };
  const comfort = appeal(tavern);
  const first = s.coins === undefined;
  if ((t.req ?? 0) > comfort) {
    addRenown(tavern, -RENOWN_LOSS / 2);
    asked(tavern, 'comfort');
    log(s, tavern, `${who} found the ${BUILDING_BY_ID[tavern.def].name} too rough (used to comfort ${t.req}; it has ${comfort}) and walked on.`);
    t.until = s.tick; // (they don't stay)
    return;
  }
  const haggle = t.temper === 'haggler' ? 0.85 : 1;
  const chance = talkChance(s, tavern, t);
  const price = (i: ItemDef, q: number) => farePrice(s, i, q);
  const kindOf = (o: Offer) => o.item.fare!.kind;
  const wantedKind: FareKind | undefined = want.kind === 'fare' ? want.fare : want.kind === 'dish' ? ITEM_BY_ID[want.item]?.fare?.kind : undefined;
  const menu = offers(s, FARE, price);
  const matches = menu.filter((o) => (want.kind === 'dish' ? o.item.id === want.item : kindOf(o) === wantedKind));
  let spent = 0;
  const had: string[] = [];
  let talked = '';
  const afford = (o: Offer) => spent + o.price * haggle <= t.purse;
  const buy = (o: Offer) => {
    if (!takeOffer(s, o)) return;
    spent += Math.round(o.price * haggle);
    had.push(pieceName(o));
  };
  let met = false;
  const pick = matches.find(afford);
  if (pick) {
    met = true;
    const finest = [...matches].reverse().find(afford);
    if (finest && finest !== pick && rng.chance(chance)) {
      buy(finest);
      talked = `${keeperName} talked them into the ${pieceName(finest)}`;
    } else buy(pick);
  } else if (!temperOf(t.temper).picky) {
    // (the same kind of thing, for someone after one dish; anything, for the rest)
    const other = menu.filter((o) => (want.kind === 'dish' ? kindOf(o) === wantedKind : true)).find(afford);
    if (other && rng.chance(chance * 0.8)) {
      buy(other);
      met = true;
      talked = `${keeperName} talked them into the ${pieceName(other)} instead`;
    }
  }
  // another round (a drink with the meal)
  if (met && !talked && rng.chance(chance)) {
    const again = offers(s, FARE, price).find((o) => afford(o) && kindOf(o) === 'drink');
    if (again) {
      buy(again);
      talked = `${keeperName} poured them another`;
    }
  }
  if (keeper) {
    if (spent) gainSkill(keeper, 'social', SALE_XP);
    if (talked) gainSkill(keeper, 'social', UPSELL_XP);
  }
  if (met) addRenown(tavern, RENOWN_WIN / 2 + (t.req ?? 0) / 20);
  else {
    addRenown(tavern, -RENOWN_LOSS / 2);
    asked(tavern, wantKey(want));
  }
  if (spent > 0) {
    s.coins = (s.coins ?? 0) + spent;
    earn(s, 'tavern', spent);
  }
  const text = met
    ? `${who} wanted ${wantText(want)}: had the ${had.join(' and the ')}${talked ? `. ${talked}` : ''} (${spent} coins).`
    : `${who} wanted ${wantText(want)}, found nothing to their taste, and left hungry.`;
  log(s, tavern, text);
  if (keeper) remember(s, keeper, met ? `Served ${t.name} the ${t.kind}: ${had.join(' and ')} (${spent} coins)${talked ? ', and talked them into more' : ''}` : `Had nothing ${t.name} wanted (${wantText(want)})`);
  if (first && spent > 0) notify(s, `The ${BUILDING_BY_ID[tavern.def].name} served its first guest: ${text}`, true);
  lodge(s, tavern, t, spent, rng);
}

/** Come the evening, a guest may take a bed for the night (the best free one they can pay for), and stays till morning. */
function lodge(s: GameState, tavern: Building, t: Traveller, spent: number, rng: Rng): void {
  const hour = calendar(s.tick).hour;
  if ((hour < LODGING.evening && hour >= LODGING.morning) || !rng.chance(LODGING.chance)) return;
  const who = `${t.name} the ${t.kind}`;
  const taken = new Set((s.travellers ?? []).filter((o) => o !== t && o.bed).map((o) => `${o.bed!.x},${o.bed!.y}`));
  const free = bedsOf(tavern).filter((p) => !taken.has(`${p.x},${p.y}`));
  const price = (p: ShopPiece) => Math.round(LODGING.price * PURSE_SCALE[s.era] * (1 + pieceAppeal(p) * LODGING.perComfort) * priceRate(s));
  const bed = free.sort((a, b) => pieceAppeal(b) - pieceAppeal(a)).find((p) => price(p) <= t.purse - spent);
  if (!bed) {
    asked(tavern, 'bed');
    addRenown(tavern, -RENOWN_LOSS / 4);
    log(s, tavern, free.length ? `${who} couldn't afford a bed for the night and walked on in the dark.` : `${who} wanted a bed for the night, but there was none to be had.`);
    return;
  }
  const pay = price(bed);
  t.bed = { x: bed.x, y: bed.y };
  // (they stay till morning)
  let until = s.tick + TICKS_PER_HOUR;
  while (calendar(until).hour !== LODGING.morning) until += TICKS_PER_HOUR;
  t.until = until;
  s.coins = (s.coins ?? 0) + pay;
  earn(s, 'tavern', pay);
  addRenown(tavern, RENOWN_WIN / 4);
  log(s, tavern, `${who} took the ${pieceName({ item: ITEM_BY_ID[bed.item], q: bed.q ?? COMMON })} for the night (${pay} coins).`);
}

/** The town buys what it wants from a customer (as far as its coins go, keeping a reserve unless it's essential). */
function buyFrom(s: GameState, shop: Building, t: Traveller, town: ShopTown, who: string): void {
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
    earn(s, 'goods', -paid);
    log(s, shop, `Bought ${list(bought)} from ${who} (${paid} coins).`);
    notify(s, `Bought ${list(bought)} from a passing ${t.kind} for ${paid} coins.`);
  }
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

/** A line in a venue's log (newest last). */
export function log(s: GameState, b: Building, text: string): void {
  const l = ((b.shop ??= { pieces: [] }).log ??= []);
  l.push({ tick: s.tick, text });
  if (l.length > SHOP_LOG) l.splice(0, l.length - SHOP_LOG);
}

const list = (st: Stock) =>
  MATERIALS.filter((m) => st[m])
    .map((m) => `${st[m]} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

/** Every tier, for display: whether the shop draws it yet. */
export const customerTiers = (s: GameState, b: Building) => CUSTOMER_TIERS.map((c) => ({ ...c, drawn: attractiveness(s, b) >= c.from }));
