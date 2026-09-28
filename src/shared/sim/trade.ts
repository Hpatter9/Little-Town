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
  HORSE_HEAL,
  HORSE_HP,
  HORSE_NAMES,
  HORSE_WORTH,
  OFFER_WORTH,
  SELL_MARKUP,
  WORTH,
} from '../data/trade';
import type { Rng } from '../rng';
import { buildingCentreX, depositNear, storages, totalCapacity, totalStock } from './buildings';
import { MERCHANT_PER_LEVEL } from '../data/operators';
import { operatorSkill } from './operators';
import { addStock, ERA_MULTIPLIER, notify, poolSize, type Caravan, type GameState, type Horse, type Offer } from './state';
import { TICKS_PER_HOUR } from './time';
import { biomeOf } from '../data/biomes';

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
    }
    return;
  }
  const m = market(s);
  if (!m) return;
  if (s.nextCaravanTick === 0) scheduleCaravan(s, rng); // first time there's a market
  if (s.tick < s.nextCaravanTick) return;
  // caravans stay (and come) on the era's clock
  const stay = CARAVAN_STAY_HOURS * ERA_MULTIPLIER[s.era];
  s.caravan = { x: buildingCentreX(m), leavesTick: s.tick + Math.round(stay * TICKS_PER_HOUR), offers: makeOffers(s, rng) };
  notify(s, `A trade caravan has arrived at the market. It stays ${Math.round(stay)} hours: see the Trade tab.`, true);
}

function scheduleCaravan(s: GameState, rng: Rng): void {
  s.nextCaravanTick = s.tick + Math.round((rng.int(CARAVAN_EVERY[0], CARAVAN_EVERY[1]) * ERA_MULTIPLIER[s.era] * TICKS_PER_HOUR) / (biomeOf(s).caravans ?? 1));
}

/** A few deals: they sell goods (maybe a horse) for what you have most of, and buy your surplus. */
export function makeOffers(s: GameState, rng: Rng): Offer[] {
  const stock = totalStock(s);
  // a merchant haggles: better prices both ways
  const haggle = operatorSkill(s, 'market') * MERCHANT_PER_LEVEL;
  const markup = Math.max(1, SELL_MARKUP - haggle);
  const rate = Math.min(0.95, BUY_RATE + haggle);
  // what the town has most of, by worth (not the totem)
  const plenty = MATERIALS.filter((m) => m !== 'totem' && (stock[m] ?? 0) > 0).sort((a, b) => (stock[b] ?? 0) * WORTH[b] - (stock[a] ?? 0) * WORTH[a]);
  const payWith = (worth: number): Stock => {
    const m = plenty[rng.int(0, Math.min(2, Math.max(0, plenty.length - 1)))] ?? 'wood';
    return { [m]: Math.max(1, Math.ceil(worth / WORTH[m])) };
  };
  const offers: Offer[] = [];
  const all = caravanGoods(s.era);
  const scale = OFFER_SCALE[s.era] ?? 1;
  const goods = [...all];
  for (let i = 0; i < 3; i++) {
    const g = goods.splice(rng.int(0, goods.length - 1), 1)[0];
    const worth = rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale;
    const n = Math.max(1, Math.round(worth / WORTH[g]));
    offers.push({ id: s.nextId++, gives: { [g]: n }, horse: false, wants: payWith(n * WORTH[g] * markup), done: false });
  }
  if (stalls(s) > 0) offers.push({ id: s.nextId++, gives: {}, horse: true, wants: payWith(HORSE_WORTH * markup), done: false });
  // they buy what you have too much of
  for (const m of plenty.slice(0, 2)) {
    const n = Math.max(1, Math.round((rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale) / WORTH[m]));
    const back = all.filter((g) => g !== m)[rng.int(0, all.length - 2)];
    offers.push({ id: s.nextId++, gives: { [back]: Math.max(1, Math.floor((n * WORTH[m] * rate) / WORTH[back])) }, horse: false, wants: { [m]: n }, done: false });
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
  for (const [m, n] of Object.entries(o.wants) as [Material, number][]) take(s, m, n);
  if (poolSize(o.gives)) depositNear(s, c.x, o.gives);
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
