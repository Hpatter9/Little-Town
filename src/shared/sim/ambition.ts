// Life goals and businesses (PLAN.md step 3; data/ambitions.ts). Everyone grown has an ambition, decided once from
// their nature and best skill. Keepers and the would-be rich save to buy a business (`buyBusinesses`, hourly); its
// takings then go to its owner's purse (`takeSale`), who pays for its upkeep (`payForVenue`) and, when they don't keep
// it themselves, pays the keeper's cut. An adventurer back from enough trips with a fat purse settles down
// (`retireHome`).

import { ADVENTURER_WANTED, AMBITIONS, BUSINESS_DAYS, NATURE_AMBITION, OWNER_KEEP, PERSON_SELLS_AT, RETIRE_COINS, RETIRE_TRIPS, type AmbitionId } from '../data/ambitions';
import { BUILDING_BY_ID } from '../data/buildings';
import { KEEPER_CUT } from '../data/economy';
import { natureOf } from '../data/natures';
import { PURSE_SCALE } from '../data/shop';
import { SKILLS } from '../data/skills';
import { giveCoins, moneyTown, payFromTreasury } from './economy';
import { landPrice, materialsPrice } from './property';
import { earn, notify, remember, type Building, type GameState, type LedgerLine, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

const ORDER: readonly AmbitionId[] = ['farmer', 'crafter', 'keeper', 'adventurer', 'scholar', 'guard', 'homebody', 'wealthy'];

/** Someone's ambition: kept once decided; else from their nature's lean, their best skill, and their id. */
export function ambitionOf(p: Person): AmbitionId {
  if (p.ambition) return p.ambition;
  const lean = NATURE_AMBITION[natureOf(p).id];
  const best = [...SKILLS].sort((a, b) => p.skills[b].level - p.skills[a].level)[0];
  const bySkill = ORDER.find((a) => AMBITIONS[a].skill === best);
  const roll = ((p.id * 2654435761) >>> 0) % 10;
  if (roll < 4 && lean) return lean;
  if (roll < 8 && bySkill) return bySkill;
  return ORDER[roll % ORDER.length];
}
/** Decide it for good once they're grown (an hourly pass). */
export function settleAmbitions(s: GameState): void {
  for (const p of s.people) {
    if (p.ambition || p.bornTick != null) continue;
    // (no adventurer in town: this one takes to the road, never the founder)
    const none = !s.people.some((q) => q.ambition === 'adventurer' && q.bornTick == null);
    p.ambition = ADVENTURER_WANTED && none && p.id !== s.mainId ? 'adventurer' : ambitionOf(p);
  }
}

/* ------------------------------------------------------------ businesses */

/** A venue's takings, today and yesterday (kept on `b.shop.takings`). */
export function bookTakings(s: GameState, b: Building, n: number): void {
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const t = ((b.shop ??= { pieces: [] }).takings ??= { day, today: 0, yesterday: 0 });
  if (t.day !== day) {
    t.yesterday = t.day === day - 1 ? t.today : 0;
    t.today = 0;
    t.day = day;
  }
  t.today += n;
}
const dailyTakings = (s: GameState, b: Building) => {
  const t = b.shop?.takings;
  if (!t) return 0;
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  return Math.max(t.day === day ? t.yesterday : t.day === day - 1 ? t.today : 0, t.day === day ? t.today : 0);
};

/** What a business is worth: its makings and plot, and BUSINESS_DAYS of its takings (a person's sells for more). */
export function businessPrice(s: GameState, b: Building): number {
  const def = BUILDING_BY_ID[b.def];
  const base = landPrice(s, def) + materialsPrice(def) + dailyTakings(s, b) * BUSINESS_DAYS;
  return Math.round(b.owner === undefined ? base : base * PERSON_SELLS_AT);
}

/** A sale at a venue: to its owner's purse (the treasury's when it's the town's), the keeper's cut out of it. */
export function takeSale(s: GameState, b: Building, spent: number, keeper: Person | undefined, line: LedgerLine, who: string): void {
  if (spent <= 0) return;
  bookTakings(s, b, spent);
  const owner = b.owner === undefined ? undefined : s.people.find((p) => p.id === b.owner);
  const name = BUILDING_BY_ID[b.def].name;
  const cut = keeper && keeper !== owner ? Math.round(spent * KEEPER_CUT) : 0;
  if (owner) {
    giveCoins(s, owner, spent - cut, `${name}'s takings: ${who} (${spent - cut} coins)`);
    if (cut && keeper) giveCoins(s, keeper, cut, `Kept the ${name} for ${owner.name}: a cut of ${who}'s ${spent} coins`);
    return;
  }
  s.coins = (s.coins ?? 0) + spent;
  earn(s, line, spent);
  if (cut && keeper) payFromTreasury(s, keeper, cut, 'wages', `Kept the ${name}: a cut of ${who}'s ${spent} coins`);
}

/** What a venue's purse can spend on it now: the owner's coins above their keep, else the treasury's. */
export function venuePurse(s: GameState, b: Building, treasurySpare: number): number {
  const owner = b.owner === undefined ? undefined : s.people.find((p) => p.id === b.owner);
  if (!owner) return treasurySpare;
  return (owner.coins ?? 0) - OWNER_KEEP * PURSE_SCALE[s.era];
}
/** Pay for something for a venue: from its owner's purse, else the treasury. False if it can't. */
export function payForVenue(s: GameState, b: Building, price: number): boolean {
  const owner = b.owner === undefined ? undefined : s.people.find((p) => p.id === b.owner);
  if (owner) {
    if ((owner.coins ?? 0) < price) return false;
    owner.coins = (owner.coins ?? 0) - price;
    return true;
  }
  if ((s.coins ?? 0) < price) return false;
  s.coins = (s.coins ?? 0) - price;
  earn(s, 'venues', -price);
  return true;
}

const VENUE = (b: Building) => b.status === 'done' && !!BUILDING_BY_ID[b.def]?.floor;
/** Once an hour: someone who wants a business and can pay buys one (a keeper first, then the would-be rich): the
 *  best they can afford, from the treasury or from an owner who isn't a keeper at heart. They keep it themselves when
 *  they're free (its operator), else the keeper stays on as their hired hand. */
export function buyBusinesses(s: GameState): void {
  if (!moneyTown(s)) return;
  const buyers = s.people
    .filter((p) => p.bornTick == null && p.away === null && !p.downed && (ambitionOf(p) === 'keeper' || ambitionOf(p) === 'wealthy'))
    .filter((p) => !s.buildings.some((b) => b.owner === p.id && VENUE(b)))
    .sort((a, b) => (ambitionOf(a) === 'keeper' ? 0 : 1) - (ambitionOf(b) === 'keeper' ? 0 : 1) || (b.coins ?? 0) - (a.coins ?? 0));
  for (const p of buyers) {
    const forSale = s.buildings
      .filter((b) => VENUE(b) && b.owner !== p.id)
      .filter((b) => {
        const seller = b.owner === undefined ? undefined : s.people.find((q) => q.id === b.owner);
        return !seller || ambitionOf(seller) !== 'keeper';
      })
      .filter((b) => businessPrice(s, b) <= (p.coins ?? 0))
      .sort((a, b) => businessPrice(s, b) - businessPrice(s, a));
    const b = forSale[0];
    if (!b) continue;
    const price = businessPrice(s, b);
    const seller = b.owner === undefined ? undefined : s.people.find((q) => q.id === b.owner);
    p.coins = (p.coins ?? 0) - price;
    if (seller) giveCoins(s, seller, price, `Sold the ${BUILDING_BY_ID[b.def].name} to ${p.name} (${price} coins)`);
    else {
      s.coins = (s.coins ?? 0) + price;
      earn(s, 'rent', price);
    }
    b.owner = p.id;
    // (they keep it themselves unless they hold another post)
    if (!s.buildings.some((q) => q !== b && q.operator === p.id)) {
      b.operator = p.id;
      b.operatorChosen = true;
    }
    remember(s, p, `Bought the ${BUILDING_BY_ID[b.def].name} (${price} coins)`);
    notify(s, `${p.name} bought the ${BUILDING_BY_ID[b.def].name} from ${seller ? seller.name : 'the town'} for ${price} coins.`, true);
    return; // (one sale an hour)
  }
}

/** Someone's trips counted when they come home; an adventurer rich and seasoned enough settles down to keep a shop. */
export function homeFromTrip(s: GameState, p: Person): void {
  p.trips = (p.trips ?? 0) + 1;
  if (ambitionOf(p) === 'adventurer' && p.trips >= RETIRE_TRIPS && (p.coins ?? 0) >= RETIRE_COINS * PURSE_SCALE[s.era]) {
    p.ambition = 'keeper';
    notify(s, `${p.name} has had enough of the road: with ${p.coins} coins put by, they mean to buy a shop.`, true);
  }
}

/** Hourly: ambitions settled, businesses bought. */
export function ambitionHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  settleAmbitions(s);
  buyBusinesses(s);
}
