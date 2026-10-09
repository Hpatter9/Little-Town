// Trade caravans and horses (Milestone 2). With a Market Stall built, a caravan stops by every couple of
// days with a handful of barter deals: goods (and now and then a horse) for your surplus, or your surplus
// for goods. Horses live in the stable, heal there, and go on expeditions to carry more and walk faster.

import { BUILDING_BY_ID } from '../data/buildings';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import {
  BUY_RATE,
  CARAVAN_EVERY,
  caravanGoods,
  OFFER_SCALE,
  CARAVAN_STAY_HOURS,
  FACTION_CARAVAN,
  FACTION_GOODS,
  HORSE_HEAL,
  HORSE_HP,
  HORSE_NAMES,
  HORSE_WORTH,
  OFFER_WORTH,
  SELL_MARKUP,
} from '../data/trade';
import type { Rng } from '../rng';
import { noteFlow, priceOf } from './prices';
import { buildingCentreX, depositNear, storages, totalCapacity, totalStock } from './buildings';
import { MERCHANT_PER_LEVEL } from '../data/operators';
import { operatorSkill } from './operators';
import { addStock, ERA_MULTIPLIER, notify, poolSize, type Caravan, type GameState, type Horse, type Offer } from './state';
import { TICKS_PER_HOUR } from './time';
import { biomeOf } from '../data/biomes';
import { ORIGIN_DEFS, ORIGINS, type OriginId } from '../data/origins';
import { FOOD_VALUE } from '../data/people';

const market = (s: GameState) => s.buildings.find((b) => b.def === 'market' && b.status === 'done');

/** Horses the stables can keep. */
export const stalls = (s: GameState) => s.buildings.reduce((n, b) => n + (b.status === 'done' ? (BUILDING_BY_ID[b.def]?.stalls ?? 0) : 0), 0);
/** Horses the town owns, home and away. */
export const horsesOwned = (s: GameState) => s.horses.length + s.expeditions.reduce((n, e) => n + (e.horses?.length ?? 0), 0);

/** Every tick: caravans come and go; once an hour horses heal. */
export function updateTrade(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR === 0) for (const h of s.horses) h.hp = Math.min(HORSE_HP, h.hp + HORSE_HEAL);
  const c = s.caravan;
  if (c) {
    if (s.tick >= c.leavesTick || !market(s)) {
      s.caravan = null;
      notify(s, 'The trade caravan has moved on.');
      scheduleCaravan(s, rng);
      return;
    }
    if (s.tick % TICKS_PER_HOUR === 0) townTrades(s, rng);
    return;
  }
  const m = market(s);
  if (!m) return;
  if (s.nextCaravanTick === 0) scheduleCaravan(s, rng); // first time there's a market
  if (s.tick < s.nextCaravanTick) return;
  // caravans stay (and come) on the era's clock
  const stay = CARAVAN_STAY_HOURS * ERA_MULTIPLIER[s.era];
  // (most caravans are another people's, with their own goods besides the era's: data/trade.ts FACTION_GOODS)
  const faction = rng.chance(FACTION_CARAVAN) ? rng.pick(ORIGINS.filter((o) => o !== (s.origin ?? 'settlers') && FACTION_GOODS[o])) : undefined;
  s.caravan = { x: buildingCentreX(m), leavesTick: s.tick + Math.round(stay * TICKS_PER_HOUR), arrived: s.tick, offers: makeOffers(s, rng, faction), faction };
  notify(s, `${faction ? `A caravan of ${ORIGIN_DEFS[faction].name}` : 'A trade caravan'} has arrived at the market. It stays ${Math.round(stay)} hours: see the Trade tab.`, true);
}

function scheduleCaravan(s: GameState, rng: Rng): void {
  s.nextCaravanTick = s.tick + Math.round((rng.int(CARAVAN_EVERY[0], CARAVAN_EVERY[1]) * ERA_MULTIPLIER[s.era] * TICKS_PER_HOUR) / (biomeOf(s).caravans ?? 1));
}

/** A few deals: they sell goods (maybe a horse) for what you have most of, and buy your surplus. */
export function makeOffers(s: GameState, rng: Rng, faction?: OriginId): Offer[] {
  const stock = totalStock(s);
  // a merchant haggles: better prices both ways
  const haggle = operatorSkill(s, 'market') * MERCHANT_PER_LEVEL;
  const markup = Math.max(1, SELL_MARKUP - haggle);
  const rate = Math.min(0.95, BUY_RATE + haggle);
  // what the town has most of, by worth (not the totem)
  const plenty = MATERIALS.filter((m) => m !== 'totem' && (stock[m] ?? 0) > 0).sort((a, b) => (stock[b] ?? 0) * priceOf(s, b) - (stock[a] ?? 0) * priceOf(s, a));
  const payWith = (worth: number): Stock => {
    const m = plenty[rng.int(0, Math.min(2, Math.max(0, plenty.length - 1)))] ?? 'wood';
    return { [m]: Math.max(1, Math.ceil(worth / priceOf(s, m))) };
  };
  const offers: Offer[] = [];
  const theirs = faction ? FACTION_GOODS[faction] ?? [] : [];
  const all = [...new Set([...caravanGoods(s.era), ...theirs])];
  const scale = OFFER_SCALE[s.era] ?? 1;
  // (another people's caravan always has one of its own goods on the blanket, then the era's)
  const goods = [...caravanGoods(s.era)];
  if (theirs.length) {
    const g = rng.pick(theirs);
    const worth = rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale;
    const n = Math.max(1, Math.round(worth / priceOf(s, g)));
    offers.push({ id: s.nextId++, gives: { [g]: n }, horse: false, wants: payWith(n * priceOf(s, g) * markup), done: false });
  }
  for (let i = 0; i < (theirs.length ? 2 : 3); i++) {
    const g = goods.splice(rng.int(0, goods.length - 1), 1)[0];
    const worth = rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale;
    const n = Math.max(1, Math.round(worth / priceOf(s, g)));
    offers.push({ id: s.nextId++, gives: { [g]: n }, horse: false, wants: payWith(n * priceOf(s, g) * markup), done: false });
  }
  if (stalls(s) > 0) offers.push({ id: s.nextId++, gives: {}, horse: true, wants: payWith(HORSE_WORTH * markup), done: false });
  // they buy what you have too much of
  for (const m of plenty.slice(0, 2)) {
    const n = Math.max(1, Math.round((rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale) / priceOf(s, m)));
    const back = all.filter((g) => g !== m)[rng.int(0, all.length - 2)];
    offers.push({ id: s.nextId++, gives: { [back]: Math.max(1, Math.floor((n * priceOf(s, m) * rate) / priceOf(s, back))) }, horse: false, wants: { [m]: n }, done: false });
  }
  return offers;
}

export interface TradeCheck {
  ok: boolean;
  reason?: string;
}

export function canTrade(s: GameState, offerId: number): TradeCheck {
  const o = s.caravan?.offers.find((q) => q.id === offerId);
  if (!o) return { ok: false, reason: 'No such offer' };
  if (o.done) return { ok: false, reason: 'Already traded' };
  const stock = totalStock(s);
  const short = (Object.entries(o.wants) as [Material, number][]).filter(([m, n]) => (stock[m] ?? 0) < n);
  if (short.length) return { ok: false, reason: `Not enough ${short.map(([m]) => MATERIAL_NAMES[m].toLowerCase()).join(', ')}` };
  if (o.horse && horsesOwned(s) >= stalls(s)) return { ok: false, reason: 'No free stall in the stable' };
  // what they give has to fit (what you give makes some room; a horse needs none, even with storage overfull)
  const room = totalCapacity(s) - poolSize(stock) + poolSize(o.wants);
  if (poolSize(o.gives) > 0 && poolSize(o.gives) > room) return { ok: false, reason: 'No room in storage for it' };
  return { ok: true };
}

export function trade(s: GameState, offerId: number, rng: Rng): TradeCheck {
  const check = canTrade(s, offerId);
  if (!check.ok) return check;
  const c = s.caravan as Caravan;
  const o = c.offers.find((q) => q.id === offerId)!;
  for (const [m, n] of Object.entries(o.wants) as [Material, number][]) {
    take(s, m, n);
    noteFlow(s, m, n);
  }
  if (poolSize(o.gives)) depositNear(s, c.x, o.gives);
  for (const [m, n] of Object.entries(o.gives) as [Material, number][]) noteFlow(s, m, -n);
  if (o.horse) {
    const h = newHorse(s, rng);
    s.horses.push(h);
    notify(s, `Bought a horse, ${h.name}.`, true);
  } else notify(s, `Traded with the caravan: ${list(o.wants)} for ${list(o.gives)}.`);
  o.done = true;
  return { ok: true };
}

function take(s: GameState, m: Material, n: number): void {
  let left = n;
  for (const st of storages(s)) {
    const k = Math.min(left, st.store[m] ?? 0);
    if (k > 0) {
      addStock(st.store, m, -k);
      left -= k;
    }
  }
}

export function newHorse(s: GameState, rng: Rng): Horse {
  const taken = [...s.horses, ...s.expeditions.flatMap((e) => e.horses ?? [])].map((h) => h.name);
  const free = HORSE_NAMES.filter((n) => !taken.includes(n));
  return { id: s.nextId++, name: rng.pick(free.length ? free : HORSE_NAMES), hp: HORSE_HP, coat: rng.int(0, 7) };
}

const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

/* ------------------------------------------------------------ the town's own dealing */

/** Below this many of a material the town is short of it, and a caravan's offer of it is welcome. */
export const SHORT_OF = 10;
/** The town trades away only what leaves it this many (food: `FOOD_SPARE`), and at least twice what it gives. */
export const SPARE_KEEP = 30;
export const FOOD_SPARE = 60;
/** The most the town pays over a good's worth when it's short of it. */
export const DEAR_BUY = 1.8;

/** Whether a deal is one the town would take for itself: it wants what it gets, and can spare what it gives. */
export function goodDeal(s: GameState, o: Offer): boolean {
  if (o.done || !canTrade(s, o.id).ok) return false;
  const stock = totalStock(s);
  const spare = (Object.entries(o.wants) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) - n >= Math.max(FOOD_VALUE[m] ? FOOD_SPARE : SPARE_KEEP, n * 2));
  if (!spare) return false;
  if (o.horse) return horsesOwned(s) < stalls(s);
  const give = (Object.entries(o.wants) as [Material, number][]).reduce((n, [m, k]) => n + priceOf(s, m) * k, 0);
  const get = (Object.entries(o.gives) as [Material, number][]).reduce((n, [m, k]) => n + priceOf(s, m) * k, 0);
  const wanted = (Object.keys(o.gives) as Material[]).some((m) => (stock[m] ?? 0) < SHORT_OF);
  return wanted && give <= get * DEAR_BUY;
}

/** Once the caravan has been at the market half its stay (the player's pick first), the town takes the best deal it
 *  wants, one an hour, while it runs itself. */
function townTrades(s: GameState, rng: Rng): void {
  const c = s.caravan;
  if (!c || s.autopilot === false) return;
  const arrived = c.arrived ?? s.tick;
  if (s.tick - arrived < (c.leavesTick - arrived) / 2) return;
  const o = c.offers.find((q) => goodDeal(s, q));
  if (!o) return;
  if (trade(s, o.id, rng).ok) notify(s, `The town took a deal at the market: ${o.horse ? 'a horse' : list(o.gives)} for ${list(o.wants)}.`, true);
}