// A real trade economy (the owner's pick of the content updates, the ninth; numbers in data/markets.ts). Once a market
// stall or a trading post stands the town's goods have prices (sim/prices.ts `priceOf`), which move every morning with supply (what the
// town has sold and bought lately), with war (arms and food dearer), with the season, and with booms, shortages, gluts
// and crashes that come and go. The town's **trade house** sends its own wagons down routes to the powers'
// strongholds (data/factions.ts STRONGHOLD_SPOTS): goods the town can spare that fetch more there (a power pays well
// for what it wants, more the further it is), coins to buy what the town is short of or what is cheap there, home
// again with the difference. Profit raises the house's standing (Peddlers to a Merchant Power: more routes, bigger
// wagons, better haggling); a wagon may be robbed on the road or seized at war. Short of a stake, the house borrows from
// the moneylenders; a loan unpaid when it falls due (or called in after a run of losses) breaks the house: it goes
// bust, the treasury and stores are seized for the debt and the routes close for a while. All of it is the town's own
// (the autopilot on); the player may close a route (the `tradeRoute` command).

import { FACTION_BY_ID, STRONGHOLD_SPOTS } from '../data/factions';
import { eventPicture } from '../data/eventScenes';
import {
  ARMS,
  BAD_SEASON,
  BUST_DAYS,
  BUST_HOURS,
  BUST_MORALE,
  BUY_MARGIN,
  DISTANCE_PREMIUM,
  FLOW_LEAST,
  FLOW_MOST,
  FLOW_WORTH,
  FOOD_KEEP,
  GOODS_KEEP,
  goodKind,
  HARVEST_FOOD,
  HOURS_PER_100,
  HOUSE_TIERS,
  LOAN_DAYS,
  LOAN_INTEREST,
  LOG_MOST,
  LOSSES_CALL,
  MAKES_PRICE,
  MARKET_HOUR,
  PARTNER_GOODWILL,
  POWER_MORALE,
  PRICE_DRIFT,
  PRICE_LEAST,
  PRICE_MOST,
  PRICE_NOISE,
  ROBBED,
  ROBBED_PER_DISTANCE,
  ROBBED_TAKE,
  SEND_HOUR,
  SEND_MARGIN,
  SHORT,
  STAKE_LEAST,
  STAKE_MOST,
  STAKE_SHARE,
  SWING_DAILY,
  SWING_DAYS,
  SWING_MULT,
  SWING_WHY,
  SWINGS_MOST,
  TOLL,
  WANTS_COUNT,
  WANTS_PRICE,
  WAR_ARMS,
  WAR_FOOD,
  WINTER_FOOD,
  type HouseTier,
  type SwingKind,
} from '../data/markets';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { isShop } from '../data/shop';
import { caravanGoods, FACTION_GOODS, OFFER_SCALE, WORTH } from '../data/trade';
import { TREASURY_KEEP } from '../data/economy';
import { MAP_HOME, MAP_SIZE } from '../data/worldMap';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, depositNear, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { realm } from './factions';
import { noteFlow, priceIndex, priceOf } from './prices';
import { seaTown } from './sea';
import { earn, notify, type Faction, type GameState, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { guardsOf } from './treasury';
import { weatherAt } from './weather';

export interface Swing {
  m: Material;
  kind: SwingKind;
  mult: number;
  until: number;
  why: string;
}

export interface Wagon {
  id: number;
  to: string;
  /** What it carries out, the coins staked, and what the lot was worth at home when it set out. */
  out: Stock;
  stake: number;
  cost: number;
  start: number;
  arrive: number;
  home: number;
  /** Sold there: the purse it carries home and the goods bought. */
  sold: boolean;
  purse: number;
  back: Stock;
}

export interface TradeRoute {
  runs: number;
  profit: number;
  /** Closed by the player. */
  closed?: boolean;
}

export interface MarketState {
  /** The price index of each good, and yesterday's (for the arrows). */
  price: Partial<Record<Material, number>>;
  yesterday: Partial<Record<Material, number>>;
  /** Coins' worth sold (+) and bought (−) lately, halved each morning. */
  flow: Partial<Record<Material, number>>;
  swings: Swing[];
  /** The trade house: its standing (profit less losses), its runs and losing streak, its loan, and when it went bust. */
  standing: number;
  best: number;
  runs: number;
  profit: number;
  losses: number;
  loan?: { owed: number; due: number; from: string };
  bustUntil?: number;
  busts: number;
  routes: Record<string, TradeRoute>;
  wagons: Wagon[];
  log: string[];
}

const scale = (s: GameState) => OFFER_SCALE[s.era] ?? 1;
const nameOf = (m: Material) => MATERIAL_NAMES[m].toLowerCase();
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** A power's name in the middle of a sentence: "the Deep Hold". */
const mid = (id: string) => (FACTION_BY_ID[id]?.name ?? id).replace(/^The /, 'the ');
const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${nameOf(m)}`)
    .join(', ') || 'nothing';
const worthAt = (s: GameState, st: Stock) => (Object.entries(st) as [Material, number][]).reduce((t, [m, n]) => t + priceOf(s, m) * n, 0);

/** Where the trade house keeps its yard: the market stall, else the general shop (the trading post and what it grows
 *  into: a town trades before it has a stall). */
export const marketStall = (s: GameState) => s.buildings.find((b) => b.def === 'market' && b.status === 'done') ?? s.buildings.find((b) => b.status === 'done' && isShop(b.def));

export function tierOf(standing: number): { tier: HouseTier; level: number } {
  let level = 0;
  for (let i = 0; i < HOUSE_TIERS.length; i++) if (standing >= HOUSE_TIERS[i].at) level = i;
  return { tier: HOUSE_TIERS[level], level };
}

/** The market, once a stall stands (null before). */
export function marketOf(s: GameState): MarketState | null {
  if (s.market) return s.market;
  if (!marketStall(s)) return null;
  s.market = { price: {}, yesterday: {}, flow: {}, swings: [], standing: 0, best: 0, runs: 0, profit: 0, losses: 0, busts: 0, routes: {}, wagons: [], log: [] };
  log(s, s.market, 'The town\'s goods have a price now, and it has a trade house: a few peddlers with a cart.');
  return s.market;
}

function log(s: GameState, mk: MarketState, text: string): void {
  mk.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (mk.log.length > LOG_MOST) mk.log.length = LOG_MOST;
}

/* ------------------------------------------------------------ the powers' markets */

const spotOf = (id: string) => STRONGHOLD_SPOTS[id];
export const distanceTo = (id: string) => {
  const p = spotOf(id);
  return p ? Math.hypot(p.x - MAP_HOME.x, p.y - MAP_HOME.y) : 0;
};
/** Hours a wagon takes each way. */
export const roadHours = (id: string) => Math.max(4, Math.round((distanceTo(id) / 100) * HOURS_PER_100));

/** What a power makes (cheap there) and what it wants (dear there): three goods by the seed. */
export function makesOf(f: Faction): Material[] {
  const d = FACTION_BY_ID[f.id];
  return d?.origin ? [...(FACTION_GOODS[d.origin] ?? [])] : f.id === 'brotherhood' ? ['iron', 'leather', 'hide'] : [];
}
export function wantsOf(s: GameState, f: Faction): Material[] {
  const makes = makesOf(f);
  const pool = [...new Set<Material>(['wood', 'stone', 'hide', 'meat', 'grain', 'herbs', 'bone', 'clay', 'fiber', ...caravanGoods(s.era)])].filter((m) => !makes.includes(m));
  const rng = new Rng(hashSeed(`${s.seed}:wants:${f.id}`));
  const out: Material[] = [];
  while (out.length < WANTS_COUNT && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

const haggleOf = (mk: MarketState) => tierOf(mk.standing).tier.haggle;
const treaty = (f: Faction) => f.stance === 'trade' || f.stance === 'alliance' || f.stance === 'vassal';

/** What a unit of a good fetches at a power's market (its want, the road's length, the toll, the house's haggling). */
export function sellPrice(s: GameState, f: Faction, m: Material): number {
  const mk = s.market;
  const k = wantsOf(s, f).includes(m) ? WANTS_PRICE : makesOf(f).includes(m) ? MAKES_PRICE : 1;
  return priceOf(s, m) * k * (1 + (DISTANCE_PREMIUM * distanceTo(f.id)) / MAP_SIZE) * (treaty(f) ? 1 : 1 - TOLL) * (1 + (mk ? haggleOf(mk) : 0));
}
/** What a unit costs to buy there: its own goods cheap, the rest a little over the town's price. */
export function buyPrice(s: GameState, f: Faction, m: Material): number {
  const mk = s.market;
  return priceOf(s, m) * (makesOf(f).includes(m) ? MAKES_PRICE : 1.15) * (1 - (mk ? haggleOf(mk) : 0));
}

/** Powers the house can trade with (known, standing, not at war, with a road on the map), and why any can't. */
export function routeState(s: GameState, f: Faction): { open: boolean; why: string | null } {
  const mk = s.market;
  if (f.stance === 'destroyed') return { open: false, why: 'Razed' };
  if (f.stance === 'war') return { open: false, why: 'At war: the road is shut' };
  if (!spotOf(f.id)) return { open: false, why: 'No road' };
  if (mk?.routes[f.id]?.closed) return { open: false, why: 'Closed by your order' };
  if (mk?.bustUntil && s.tick < mk.bustUntil) return { open: false, why: 'The house is bust' };
  return { open: true, why: null };
}
const partners = (s: GameState) => realm(s).filter((f) => f.known && f.id !== 'brotherhood' && f.stance !== 'destroyed');

/* ------------------------------------------------------------ the day */

/** Hourly from sim.ts. */
export function marketsHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const mk = marketOf(s);
  if (!mk) return;
  wagonsOnTheRoad(s, mk);
  const hour = calendar(s.tick).hour;
  if (hour === MARKET_HOUR) {
    movePrices(s, mk);
    swings(s, mk);
    loans(s, mk);
    standingTells(s, mk);
  }
  if (hour === SEND_HOUR) sendWagons(s, mk);
}

const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:market:${s.tick}:${salt}`));

function warsOf(s: GameState): number {
  const atWar = (s.factions ?? []).filter((f) => f.stance === 'war').length;
  return atWar + (s.feuds?.length ?? 0) / 2;
}

/** Each morning every price drifts toward its target: supply, war, the season and any swing on it. */
export function movePrices(s: GameState, mk: MarketState): void {
  const wars = warsOf(s);
  const season = calendar(s.tick).season;
  const rng = roll(s, 'prices');
  mk.yesterday = { ...mk.price };
  for (const m of MATERIALS) {
    if (m === 'totem') continue;
    const flow = mk.flow[m] ?? 0;
    let target = Math.max(FLOW_LEAST, Math.min(FLOW_MOST, 1 - flow / FLOW_WORTH));
    if (ARMS.includes(m)) target *= 1 + WAR_ARMS * wars;
    if (FOOD_VALUE[m]) target *= (1 + WAR_FOOD * wars) * (season === 'winter' ? WINTER_FOOD : season === 'autumn' ? HARVEST_FOOD : 1);
    for (const w of mk.swings) if (w.m === m) target *= w.mult;
    const now = priceIndex(s, m);
    const next = now + (target - now) * PRICE_DRIFT + (rng.next() - 0.5) * 2 * PRICE_NOISE;
    mk.price[m] = Math.round(Math.max(PRICE_LEAST, Math.min(PRICE_MOST, next)) * 1000) / 1000;
    if (flow) mk.flow[m] = Math.abs(flow) < 1 ? 0 : flow / 2;
  }
}

/** The goods the town's market deals in: the age's, the land's and the powers' own. */
function dealtIn(s: GameState): Material[] {
  const fs = partners(s);
  return [...new Set<Material>(['wood', 'stone', 'hide', 'meat', 'grain', 'herbs', 'cloth', 'bread', ...caravanGoods(s.era), ...fs.flatMap(makesOf)])].filter((m) => m !== 'totem');
}

/** Swings end, and now and then one begins: a boom, a shortage, a glut or a crash, with the news of why. */
export function swings(s: GameState, mk: MarketState): Swing | null {
  for (const w of [...mk.swings])
    if (s.tick >= w.until) {
      mk.swings.splice(mk.swings.indexOf(w), 1);
      log(s, mk, `The ${w.kind} in ${nameOf(w.m)} is over.`);
    }
  if (mk.swings.length >= SWINGS_MOST) return null;
  const rng = roll(s, 'swing');
  if (!rng.chance(SWING_DAILY)) return null;
  const bad = calendar(s.tick).season === 'winter' || warsOf(s) > 0;
  const kind = rng.weighted<SwingKind>({ boom: 3, shortage: bad ? 3 * BAD_SEASON : 3, glut: 3, crash: 1 });
  const goods = dealtIn(s).filter((m) => !mk.swings.some((w) => w.m === m) && (kind !== 'shortage' || !bad || FOOD_VALUE[m] || rng.chance(0.4)));
  const food = goods.filter((m) => FOOD_VALUE[m]);
  const m = kind === 'shortage' && bad && food.length ? rng.pick(food) : rng.pick(goods);
  if (!m) return null;
  const [lo, hi] = SWING_MULT[kind];
  const days = rng.int(SWING_DAYS[0], SWING_DAYS[1]);
  const place = partners(s).length ? rng.pick(partners(s).map((f) => FACTION_BY_ID[f.id]?.name ?? f.id)) : 'the south';
  const whys = SWING_WHY[kind][goodKind(m)] ?? SWING_WHY[kind].any;
  const pat = rng.pick(whys);
  // ("the mines of the Deep Hold", but "The Deep Hold is arming")
  const why = pat.replace('{place}', pat.startsWith('{place}') ? place : place.replace(/^The /, 'the '));
  const w: Swing = { m, kind, mult: Math.round((lo + rng.next() * (hi - lo)) * 100) / 100, until: s.tick + days * TICKS_PER_DAY, why };
  mk.swings.push(w);
  const up = w.mult > 1;
  const line = `${cap(kind === 'boom' ? 'a boom' : kind === 'shortage' ? 'a shortage' : kind === 'glut' ? 'a glut' : 'a crash')} in ${nameOf(m)}: ${why}. Prices will ${up ? 'climb' : 'fall'} for some days.`;
  log(s, mk, line);
  notify(s, `Market news: ${line.charAt(0).toLowerCase()}${line.slice(1)}`);
  return w;
}

/* ------------------------------------------------------------ the wagons */

/** Send a wagon down each open route the house can run (the best margins first). */
export function sendWagons(s: GameState, mk: MarketState): Wagon[] {
  const { tier } = tierOf(mk.standing);
  const busy = new Set(mk.wagons.map((w) => w.to));
  const routes = partners(s)
    .filter((f) => routeState(s, f).open && !busy.has(f.id))
    .map((f) => ({ f, best: Math.max(0, ...dealtIn(s).map((m) => sellPrice(s, f, m) / priceOf(s, m))) }))
    .sort((a, b) => b.best - a.best || a.f.id.localeCompare(b.f.id));
  const sent: Wagon[] = [];
  for (const { f } of routes) {
    if (mk.wagons.length >= tier.routes) break;
    const w = loadWagon(s, mk, f, tier);
    if (w) sent.push(w);
  }
  return sent;
}

function loadWagon(s: GameState, mk: MarketState, f: Faction, tier: HouseTier): Wagon | null {
  const stock = totalStock(s);
  const room = Math.round(tier.load * scale(s));
  // the goods it carries: what the town can spare that fetches most more there
  const goods = (Object.keys(stock) as Material[])
    .filter((m) => m !== 'totem' && WORTH[m] && (stock[m] ?? 0) > (FOOD_VALUE[m] ? FOOD_KEEP : GOODS_KEEP))
    .map((m) => ({ m, k: sellPrice(s, f, m) / priceOf(s, m) }))
    .filter((g) => g.k >= SEND_MARGIN)
    .sort((a, b) => b.k - a.k || a.m.localeCompare(b.m));
  const out: Stock = {};
  let n = 0;
  for (const { m } of goods) {
    if (n >= room) break;
    const k = Math.min(room - n, (stock[m] ?? 0) - (FOOD_VALUE[m] ? FOOD_KEEP : GOODS_KEEP));
    if (k > 0) {
      out[m] = k;
      n += k;
    }
  }
  let stake = Math.max(0, Math.min(Math.round(STAKE_MOST * scale(s)), Math.floor(((s.coins ?? 0) - TREASURY_KEEP) * STAKE_SHARE)));
  // too little to be worth the road: the moneylenders fill the purse, if they'll lend
  if (worthAt(s, out) + stake < STAKE_LEAST) {
    if (tier.loan <= 0 || mk.loan) return null;
    const lent = Math.round(tier.loan * scale(s));
    const from = mid(f.id);
    mk.loan = { owed: Math.round(lent * (1 + LOAN_INTEREST)), due: s.tick + LOAN_DAYS * TICKS_PER_DAY, from };
    s.coins = (s.coins ?? 0) + lent;
    earn(s, 'trade', lent);
    stake += lent;
    log(s, mk, `Borrowed ${lent} coins from the moneylenders of ${from} to fill a wagon: ${mk.loan.owed} owed within ${LOAN_DAYS} days.`);
    notify(s, `The trade house borrowed ${lent} coins from the moneylenders of ${from}. ${mk.loan.owed} must be paid back within ${LOAN_DAYS} days, or the house goes bust.`);
  }
  for (const [m, k] of Object.entries(out) as [Material, number][]) out[m] = takeFromStorage(s, m, k);
  stake = Math.min(stake, Math.max(0, s.coins ?? 0));
  s.coins = (s.coins ?? 0) - stake;
  earn(s, 'trade', -stake);
  const h = roadHours(f.id) * TICKS_PER_HOUR;
  const w: Wagon = { id: s.nextId++, to: f.id, out, stake, cost: Math.round(worthAt(s, out) + stake), start: s.tick, arrive: s.tick + h, home: s.tick + 2 * h, sold: false, purse: 0, back: {} };
  mk.wagons.push(w);
  const what = n ? `${list(out)}${stake ? ` and ${stake} coins to buy with` : ''}` : `${stake} coins to buy with`;
  log(s, mk, `A wagon set out for ${mid(f.id)} with ${what}.`);
  return w;
}

/** Wagons reach their market and sell, or come home. */
export function wagonsOnTheRoad(s: GameState, mk: MarketState): void {
  for (const w of [...mk.wagons]) {
    const f = (s.factions ?? []).find((q) => q.id === w.to);
    const name = mid(w.to);
    if (!w.sold && s.tick >= w.arrive) {
      if (!f || f.stance === 'war' || f.stance === 'destroyed') {
        mk.wagons.splice(mk.wagons.indexOf(w), 1);
        settle(s, mk, w, 0, `The wagon sent to ${name} was seized${f?.stance === 'war' ? ': we are at war with them' : ''}. Everything on it is lost.`);
        continue;
      }
      sellThere(s, mk, f, w);
    }
    if (w.sold && s.tick >= w.home) {
      mk.wagons.splice(mk.wagons.indexOf(w), 1);
      comeHome(s, mk, w, name);
    }
  }
}

/** A wagon on the road taken (the Corsairs: sim/risingPowers.ts): everything on it lost. Returns what it carried. */
export function seizeWagon(s: GameState, mk: MarketState, w: Wagon, by: string): string {
  mk.wagons.splice(mk.wagons.indexOf(w), 1);
  const what = w.sold ? list(w.back) : list(w.out);
  settle(s, mk, w, 0, `The wagon ${w.sold ? 'coming home from' : 'bound for'} ${mid(w.to)} was taken on the road by ${by}. Everything on it is lost.`);
  return what;
}

function sellThere(s: GameState, mk: MarketState, f: Faction, w: Wagon): void {
  let purse = w.stake;
  for (const [m, n] of Object.entries(w.out) as [Material, number][]) {
    purse += n * sellPrice(s, f, m);
    noteFlow(s, m, n); // (what the town sells abroad: plenty of it, and its price falls)
  }
  // buy what the town is short of, else what is cheap there: up to most of the purse, keeping coins to come home
  const stock = totalStock(s);
  const cands = [...new Set<Material>([...makesOf(f), ...caravanGoods(s.era)])]
    .filter((m) => m !== 'totem' && WORTH[m])
    .map((m) => ({ m, short: (stock[m] ?? 0) < SHORT, cheap: priceOf(s, m) / buyPrice(s, f, m) }))
    .filter((c) => c.short || c.cheap >= BUY_MARGIN)
    .sort((a, b) => Number(b.short) - Number(a.short) || b.cheap - a.cheap || a.m.localeCompare(b.m));
  let budget = purse * 0.6;
  const room = Math.round(tierOf(mk.standing).tier.load * scale(s));
  let n = 0;
  for (const c of cands.slice(0, 3)) {
    const unit = buyPrice(s, f, c.m);
    const k = Math.min(Math.floor(budget / Math.max(0.1, unit)), Math.ceil((room - n) / 2), c.short ? SHORT * 2 : room);
    if (k <= 0) continue;
    w.back[c.m] = k;
    budget -= k * unit;
    purse -= k * unit;
    n += k;
    noteFlow(s, c.m, -k);
  }
  w.purse = Math.max(0, Math.round(purse));
  w.sold = true;
  const sold = Object.values(w.out).some((k) => (k ?? 0) > 0);
  log(s, mk, `The wagon at ${mid(f.id)} ${sold ? `sold ${list(w.out)}${n ? `, and bought ${list(w.back)}` : ''}` : n ? `bought ${list(w.back)}` : 'found nothing worth buying'}.`);
}

function comeHome(s: GameState, mk: MarketState, w: Wagon, name: string): void {
  // robbed on the way home: more on a long road, less with guards or an ally to ride with them
  const allied = (s.factions ?? []).some((f) => f.stance === 'alliance');
  const odds = (ROBBED + (ROBBED_PER_DISTANCE * distanceTo(w.to)) / MAP_SIZE) * (guardsOf(s).length >= 2 || allied ? 0.5 : 1);
  let robbed = false;
  if (new Rng(hashSeed(`${s.seed}:wagon:${w.id}`)).chance(odds)) {
    robbed = true;
    w.purse = Math.round(w.purse * (1 - ROBBED_TAKE));
    for (const m of Object.keys(w.back) as Material[]) w.back[m] = Math.floor((w.back[m] ?? 0) * (1 - ROBBED_TAKE));
  }
  const stall = marketStall(s);
  const left = stall ? depositNear(s, buildingCentre(stall), w.back) : w.back;
  // (what won't fit is sold off at the stall)
  let purse = w.purse;
  for (const [m, k] of Object.entries(left) as [Material, number][]) {
    purse += Math.round(k * priceOf(s, m) * 0.75);
    w.back[m] = (w.back[m] ?? 0) - k;
  }
  s.coins = (s.coins ?? 0) + purse;
  earn(s, 'trade', purse);
  const got = Math.round(purse + worthAt(s, w.back));
  settle(s, mk, w, got, `The wagon came home from ${name}${robbed ? ', robbed on the road,' : ''} with ${purse} coins${Object.values(w.back).some((n) => (n ?? 0) > 0) ? ` and ${list(w.back)}` : ''}`);
}

/** A run done: its profit to the route and the house's standing. */
function settle(s: GameState, mk: MarketState, w: Wagon, got: number, line: string): void {
  const profit = got - w.cost;
  const r = (mk.routes[w.to] ??= { runs: 0, profit: 0 });
  r.runs++;
  r.profit += profit;
  mk.runs++;
  mk.profit += profit;
  mk.standing = Math.max(0, mk.standing + profit);
  mk.losses = profit < 0 ? mk.losses + 1 : 0;
  const text = got ? `${line}: ${profit >= 0 ? `a profit of ${profit}` : `a loss of ${-profit}`}.` : line;
  log(s, mk, text);
  notify(s, `Trade: ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
}

/* ------------------------------------------------------------ loans and standing */

/** Each morning: a loan is paid back when the treasury can; due and unpaid, or called in after a run of losses, the
 *  house goes bust. */
export function loans(s: GameState, mk: MarketState): void {
  const l = mk.loan;
  if (!l) return;
  if ((s.coins ?? 0) >= l.owed + TREASURY_KEEP) {
    s.coins = (s.coins ?? 0) - l.owed;
    earn(s, 'trade', -l.owed);
    log(s, mk, `Paid back the moneylenders of ${l.from}: ${l.owed} coins.`);
    notify(s, `The trade house paid back its loan (${l.owed} coins).`);
    mk.loan = undefined;
    return;
  }
  if (s.tick >= l.due || mk.losses >= LOSSES_CALL) goBust(s, mk);
}

/** The house is broken: the debt taken out of the treasury, then out of the stores, dearest first. */
export function goBust(s: GameState, mk: MarketState): void {
  const l = mk.loan;
  if (!l) return;
  let left = l.owed;
  const paid = Math.min(Math.max(0, s.coins ?? 0), left);
  s.coins = (s.coins ?? 0) - paid;
  earn(s, 'trade', -paid);
  left -= paid;
  const seized: Stock = {};
  const stock = totalStock(s);
  for (const m of (Object.keys(stock) as Material[]).filter((q) => q !== 'totem' && (stock[q] ?? 0) > 0).sort((a, b) => priceOf(s, b) - priceOf(s, a))) {
    if (left <= 0) break;
    const k = Math.min(stock[m] ?? 0, Math.ceil(left / Math.max(0.5, priceOf(s, m))));
    const got = takeFromStorage(s, m, k);
    if (got > 0) {
      seized[m] = got;
      left -= got * priceOf(s, m);
    }
  }
  mk.loan = undefined;
  mk.standing = 0;
  mk.losses = 0;
  mk.busts++;
  mk.bustUntil = s.tick + BUST_DAYS * TICKS_PER_DAY;
  (s.marks ??= []).push({ lever: 'morale', value: BUST_MORALE, until: s.tick + BUST_HOURS * TICKS_PER_HOUR, text: 'The trade house went bust' });
  const took = list(seized);
  const story = `The moneylenders of ${l.from} came for their ${l.owed} coins, and the trade house could not pay. They took ${paid} coins from the treasury${took !== 'nothing' ? ` and carted off ${took} from the stores` : ''}. The wagons stand idle in the yard; no merchant will deal with us for ${BUST_DAYS} days, and the house must begin again as peddlers.`;
  log(s, mk, `Gone bust: the moneylenders of ${l.from} seized ${paid} coins${took !== 'nothing' ? ` and ${took}` : ''}.`);
  tell(s, 'The trade house goes bust', story, 'bankrupt debt ruin');
}

const TIER_TELLS = ['', 'The peddlers have become traders: two routes, and the moneylenders will deal with us.', 'A merchant house now, with three routes and its own seal.', 'The trade league: four routes, and our name is known in every market of the realm.'];

/** Each morning: a new tier told, and a merchant power's sway with its partners. */
function standingTells(s: GameState, mk: MarketState): void {
  const { tier, level } = tierOf(mk.standing);
  if (level > mk.best) {
    mk.best = level;
    if (level === HOUSE_TIERS.length - 1) {
      (s.marks ??= []).push({ lever: 'morale', value: POWER_MORALE, until: s.tick + 3 * TICKS_PER_DAY, text: 'We are a merchant power' });
      tell(s, 'A merchant power', `The ledgers do not lie: ${mk.runs} wagons sent and ${mk.profit} coins made. The town's trade house is a merchant power now, with ${tier.routes} routes across the realm. Lords who once ignored us send their stewards to haggle, and our partners keep the roads open for us.`, 'merchant wealth market gold');
    } else {
      log(s, mk, TIER_TELLS[level] ?? `The house is now ${tier.name}.`);
      notify(s, `The trade house is now ${tier.name}: ${TIER_TELLS[level]}`, true);
    }
  }
  if (level === HOUSE_TIERS.length - 1)
    for (const f of s.factions ?? []) if (f.known && treaty(f)) f.attitude = Math.min(100, Math.round(f.attitude + PARTNER_GOODWILL));
}

function tell(s: GameState, title: string, story: string, words: string): void {
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: story.split('. ')[0] + '.',
    story,
    picture: eventPicture(`market:${title}`, words, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: ['So be it'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${title}.`, true);
}

/** Open or close a route (the player's `tradeRoute` command). */
export function setRoute(s: GameState, to: string, open: boolean): boolean {
  const mk = marketOf(s);
  if (!mk || !FACTION_BY_ID[to]) return false;
  const r = (mk.routes[to] ??= { runs: 0, profit: 0 });
  r.closed = !open || undefined;
  return true;
}

/* ------------------------------------------------------------ the view */

export interface MarketView {
  prices: { m: Material; name: string; price: number; worth: number; change: number; swing: SwingKind | null; stock: number }[];
  swings: { name: string; kind: SwingKind; mult: number; why: string; days: number }[];
  house: { tier: string; level: number; standing: number; next: string | null; nextAt: number | null; routes: number; load: number; haggle: number; runs: number; profit: number; busts: number; bustDays: number | null; loan: { owed: number; days: number; from: string } | null };
  routes: { to: string; name: string; stance: string; open: boolean; why: string | null; closed: boolean; hours: number; runs: number; profit: number; makes: string[]; wants: string[]; wagon: { phase: 'out' | 'there' | 'home'; hours: number; carrying: string; coins: number } | null }[];
  log: string[];
}

export function marketView(s: GameState): MarketView | null {
  const mk = s.market;
  if (!mk) return null;
  const stock = totalStock(s);
  const { tier, level } = tierOf(mk.standing);
  const next = HOUSE_TIERS[level + 1];
  const shown = [...new Set<Material>([...dealtIn(s), ...mk.swings.map((w) => w.m), ...(Object.keys(stock) as Material[]).filter((m) => (stock[m] ?? 0) > 0 && m !== 'totem')])];
  const prices = shown
    .map((m) => {
      const now = priceIndex(s, m);
      const was = mk.yesterday[m] ?? 1;
      return { m, name: MATERIAL_NAMES[m], price: Math.round(priceOf(s, m) * 10) / 10, worth: WORTH[m] ?? 1, change: Math.round(((now - was) / was) * 100), swing: mk.swings.find((w) => w.m === m)?.kind ?? null, stock: stock[m] ?? 0 };
    })
    .sort((a, b) => Number(!!b.swing) - Number(!!a.swing) || Math.abs(b.price / b.worth - 1) - Math.abs(a.price / a.worth - 1) || a.name.localeCompare(b.name));
  const days = (t: number) => Math.max(0, Math.ceil((t - s.tick) / TICKS_PER_DAY));
  const hours = (t: number) => Math.max(0, Math.ceil((t - s.tick) / TICKS_PER_HOUR));
  return {
    prices,
    swings: mk.swings.map((w) => ({ name: MATERIAL_NAMES[w.m], kind: w.kind, mult: w.mult, why: w.why, days: days(w.until) })),
    house: {
      tier: tier.name,
      level,
      standing: Math.round(mk.standing),
      next: next?.name ?? null,
      nextAt: next?.at ?? null,
      routes: tier.routes,
      load: Math.round(tier.load * scale(s)),
      haggle: tier.haggle,
      runs: mk.runs,
      profit: Math.round(mk.profit),
      busts: mk.busts,
      bustDays: mk.bustUntil && s.tick < mk.bustUntil ? days(mk.bustUntil) : null,
      loan: mk.loan ? { owed: mk.loan.owed, days: days(mk.loan.due), from: mk.loan.from } : null,
    },
    routes: partners(s).map((f) => {
      const st = routeState(s, f);
      const r = mk.routes[f.id];
      const w = mk.wagons.find((q) => q.to === f.id);
      return {
        to: f.id,
        name: FACTION_BY_ID[f.id]?.name ?? f.id,
        stance: f.stance,
        open: st.open,
        why: st.why,
        closed: !!r?.closed,
        hours: roadHours(f.id),
        runs: r?.runs ?? 0,
        profit: Math.round(r?.profit ?? 0),
        makes: makesOf(f).map(nameOf),
        wants: wantsOf(s, f).map(nameOf),
        wagon: w ? { phase: s.tick < w.arrive ? 'out' : w.sold && s.tick < w.home ? 'home' : 'there', hours: hours(s.tick < w.arrive ? w.arrive : w.home), carrying: list(s.tick < w.arrive ? w.out : w.back), coins: s.tick < w.arrive ? w.stake : w.purse } : null,
      };
    }),
    log: mk.log,
  };
}

/** The house's wagons on the world map (sim/worldLife.ts worldView). */
export function wagonsOnMap(s: GameState): { from: { x: number; y: number }; to: { x: number; y: number }; t: number; label: string }[] {
  const mk = s.market;
  if (!mk) return [];
  const out: { from: { x: number; y: number }; to: { x: number; y: number }; t: number; label: string }[] = [];
  for (const w of mk.wagons) {
    const to = spotOf(w.to);
    if (!to) continue;
    const t = s.tick < w.arrive ? (s.tick - w.start) / Math.max(1, w.arrive - w.start) : 1 - (s.tick - w.arrive) / Math.max(1, w.home - w.arrive);
    const name = mid(w.to);
    out.push({ from: MAP_HOME, to, t: Math.max(0, Math.min(1, t)), label: s.tick < w.arrive ? `Our wagon to ${name}: ${list(w.out)}` : `Our wagon home from ${name}: ${w.purse} coins${Object.keys(w.back).length ? `, ${list(w.back)}` : ''}` });
  }
  return out;
}

/** The open routes, drawn faintly on the world map. */
export function routesOnMap(s: GameState): { to: { x: number; y: number }; name: string }[] {
  if (!s.market) return [];
  return partners(s)
    .filter((f) => routeState(s, f).open && spotOf(f.id))
    .map((f) => ({ to: spotOf(f.id)!, name: FACTION_BY_ID[f.id]?.name ?? f.id }));
}
