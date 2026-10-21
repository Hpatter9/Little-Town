// The founder's shops (step 3 of playing the founder). The founder can buy a town shop, tavern or stall with their own
// purse and so own several over time. For each: a stock line and a price level (data/founderShops.ts), and a
// manager hired from the town's grown-ups for a day's wage, or the founder behind the counter themselves. With neither
// the shop doesn't open. Its sales go into the shop's till (`founderSale`, from sim/ambition.ts `takeSale`) and at
// dawn the day is settled (`settleShops`): stock and the manager's wage come out, what's left goes to the founder's
// purse (taxed like any pay), and a loss, like a fire, comes out of the takings. A raid or thief hits it the same way
// through `shopLoss`.

import { BUILDING_BY_ID } from '../data/buildings';
import { MANAGER_BASE, MANAGER_MOST, MANAGER_PER_LEVEL, MANAGER_WAGE, MANAGER_WAGE_PER_LEVEL, PRICE_LEVELS, SELF_SALES, SHOP_PRICES, STOCK_LINES, type ShopPrice, type StockLine } from '../data/founderShops';
import { lineOfDef, PURSE_SCALE, venueOfDef } from '../data/shop';
import { bookTakings, businessPrice } from './ambition';
import { giveCoins } from './economy';
import { founderOf } from './founder';
import { OPERATORS } from '../data/operators';
import { storyShop } from './story';
import { isChild } from './social';
import { earn, notify, remember, type Building, type GameState, type Person } from './state';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from './time';

/** The key a shop's stock lines come under: its specialty line, else its venue. */
const kindOf = (def: string): string | undefined => lineOfDef(def) ?? venueOfDef(def);
export const stockLinesOf = (b: Building): readonly StockLine[] => STOCK_LINES[kindOf(b.def) ?? ''] ?? [];
export const stockLineOf = (b: Building): StockLine | undefined => stockLinesOf(b).find((l) => l.id === b.shop?.run?.stock) ?? stockLinesOf(b)[0];

/** A shop of the founder's own that is run (bought with `founderBuyShop`). */
export const isFounderShop = (s: GameState, b: Building): boolean => b.status === 'done' && b.owner === s.mainId && !!b.shop?.run;

/** Town shops the founder could buy: built, a venue with stock lines, and no owner. */
export function buyableShops(s: GameState): Building[] {
  return s.buildings.filter((b) => b.status === 'done' && !b.overgrown && !b.room && b.ring === undefined && b.owner === undefined && !!BUILDING_BY_ID[b.def]?.floor && stockLinesOf(b).length > 0);
}
export const shopPrice = (s: GameState, b: Building): number => businessPrice(s, b);

/** A manager's day's wage: what the shop pays for their Social skill. */
export const managerWage = (s: GameState, p: Person): number => Math.max(1, Math.round(MANAGER_WAGE * PURSE_SCALE[s.era] * (1 + p.skills.social.level * MANAGER_WAGE_PER_LEVEL)));
/** What a manager's skill does to takings (the founder at the counter does best). */
export const managerSales = (s: GameState, p: Person): number => (p.id === s.mainId ? SELF_SALES : Math.min(MANAGER_MOST, MANAGER_BASE + p.skills.social.level * MANAGER_PER_LEVEL));

/** Grown-ups who could manage a shop: not already holding a job at a building, never the founder. */
export function managerCandidates(s: GameState, b?: Building): Person[] {
  const busy = new Set(s.buildings.filter((q) => q !== b && q.operator != null && (!!OPERATORS[q.def] || q.owner === s.mainId)).map((q) => q.operator));
  return s.people.filter((p) => p.id !== s.mainId && !isChild(p) && !p.monster && !busy.has(p.id)).sort((x, y) => y.skills.social.level - x.skills.social.level || x.id - y.id);
}

const mine = (s: GameState, id: number): Building | undefined => s.buildings.find((b) => b.id === id && isFounderShop(s, b));

/** Buy a town shop from the treasury with the founder's own purse. */
export function founderBuyShop(s: GameState, id: number): boolean {
  const f = founderOf(s);
  const b = buyableShops(s).find((q) => q.id === id);
  if (!f || !b) return false;
  const price = shopPrice(s, b);
  if ((f.coins ?? 0) < price) return false;
  f.coins = (f.coins ?? 0) - price;
  s.coins = (s.coins ?? 0) + price;
  earn(s, 'venues', price);
  b.owner = f.id;
  b.operator = null; // (the town's keeper goes: a manager is hired, or the founder works the counter)
  b.operatorChosen = true;
  const sh = (b.shop ??= { pieces: [] });
  sh.run = { stock: stockLinesOf(b)[0].id, price: 'fair', till: 0 };
  const name = BUILDING_BY_ID[b.def].name;
  remember(s, f, `Bought the ${name} (${price} coins)`);
  storyShop(s, name, price);
  notify(s, `${f.name} bought the ${name} for ${price} coins. It needs a manager.`, true);
  return true;
}

export function founderShopStock(s: GameState, id: number, stock: string): boolean {
  const b = mine(s, id);
  if (!b || !stockLinesOf(b).some((l) => l.id === stock)) return false;
  b.shop!.run!.stock = stock;
  return true;
}
export function founderShopPrice(s: GameState, id: number, price: ShopPrice): boolean {
  const b = mine(s, id);
  if (!b || !SHOP_PRICES.includes(price)) return false;
  b.shop!.run!.price = price;
  return true;
}
/** Hire a manager, the founder themselves (their own id), or no one (null: the shop shuts). */
export function founderShopManager(s: GameState, id: number, person: number | null): boolean {
  const b = mine(s, id);
  const f = founderOf(s);
  if (!b || !f) return false;
  if (person === null) {
    b.operator = null;
    return true;
  }
  const p = person === f.id ? f : managerCandidates(s, b).find((q) => q.id === person);
  if (!p) return false;
  if (p === f && s.buildings.some((q) => q !== b && q.operator === f.id && (!!OPERATORS[q.def] || q.owner === s.mainId))) return false;
  b.operator = p.id;
  b.operatorChosen = true;
  if (p !== f) notify(s, `${p.name} is hired to manage the ${BUILDING_BY_ID[b.def].name} (${managerWage(s, p)} coins a day).`);
  return true;
}

/** A sale at the founder's shop, as the till takes it: the price level, stock line and manager's skill on its worth.
 *  Null when it isn't a run shop (the usual rules then). */
export function founderSale(s: GameState, b: Building, spent: number, keeper: Person | undefined): number | null {
  if (!isFounderShop(s, b)) return null;
  const run = b.shop!.run!;
  const gross = Math.round(spent * PRICE_LEVELS[run.price].sales * (stockLineOf(b)?.sales ?? 1) * (keeper ? managerSales(s, keeper) : 1));
  run.till += gross;
  bookTakings(s, b, gross);
  return gross;
}

/** The shop's till takes a loss (a fire, a raid, a thief): it comes out of the takings. */
export function shopLoss(s: GameState, b: Building, n: number): void {
  if (!isFounderShop(s, b) || n <= 0) return;
  b.shop!.run!.till -= n;
}

const seasonOf = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY / DAYS_PER_SEASON);
/** The shop's books this season. */
export function seasonOfShop(s: GameState, b: Building): { gross: number; net: number } {
  const x = b.shop?.run?.season;
  return x && x.n === seasonOf(s) ? x : { gross: 0, net: 0 };
}

/** At dawn: settle every shop of the founder's. Takings less stock and the manager's wage go to the founder (and a
 *  shortfall comes out of their purse); a manager who can't be paid leaves. A price level lifts or sours the town. */
export function settleShops(s: GameState): void {
  if (s.tick % TICKS_PER_DAY !== 0) return;
  const f = founderOf(s);
  if (!f) return;
  let mood = 0;
  for (const b of s.buildings) {
    if (!isFounderShop(s, b)) continue;
    const run = b.shop!.run!;
    const name = BUILDING_BY_ID[b.def].name;
    const gross = run.till;
    const stock = Math.max(0, Math.round(gross * (stockLineOf(b)?.cost ?? 0)));
    const mgr = b.operator != null && b.operator !== f.id ? s.people.find((p) => p.id === b.operator) : undefined;
    if (b.operator != null && b.operator !== f.id && !mgr) b.operator = null; // (gone: the shop shuts)
    let wage = mgr ? managerWage(s, mgr) : 0;
    let net = gross - stock;
    if (mgr) {
      if (net - wage < 0 && (f.coins ?? 0) < wage - Math.max(0, net)) {
        // (can't be paid: they leave)
        b.operator = null;
        notify(s, `${mgr.name} left the ${name}: ${f.name} couldn't pay them.`, true);
        wage = 0;
      } else giveCoins(s, mgr, wage, `Managed the ${name} for ${f.name}: ${wage} coins`);
    }
    net -= wage;
    if (net > 0) giveCoins(s, f, net, `The ${name}'s profit: ${net} coins`);
    else if (net < 0) f.coins = Math.max(0, (f.coins ?? 0) + net);
    const season = seasonOf(s);
    const books = run.season && run.season.n === season ? run.season : (run.season = { n: season, gross: 0, net: 0 });
    books.gross += gross;
    books.net += net;
    run.last = net;
    run.till = 0;
    if (b.operator != null) mood += PRICE_LEVELS[run.price].mood;
  }
  if (mood) for (const p of s.people) if (!isChild(p)) p.morale = Math.max(0, Math.min(100, p.morale + mood));
}
