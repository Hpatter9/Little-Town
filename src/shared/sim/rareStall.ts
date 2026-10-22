// The traders' stall (the owner's ask: shops sell the rare inputs too). Silver, gems, heartwood, thick pelts and pearls
// came only with caravans; now the market's traders keep a few for sale, at a high price. What they hold depends on the
// age (gems from the Industrial age) and the town's trade links (powers it trades with, the trade house's tier), is
// fixed for the season on a side stream, and is gone once bought: it comes back the next season. The player buys for
// the town (the treasury pays) or for the founder (the founder's own purse pays); either way it goes into the stores.
// Only a town with a shop or market stall has a stall at all.

import { RARE_INPUTS } from '../data/chains';
import { ERAS } from '../data/eras';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { realm } from './factions';
import { founderOf } from './founder';
import { buildingDoor, depositNear, storageFree, storages } from './buildings';
import { marketStall, tierOf } from './markets';
import { priceOf } from './prices';
import { notify, remember, type GameState } from './state';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from './time';

/** What the traders ask over a good's market price (they're rare, and the trader must live). */
export const RARE_MARKUP = 3;
/** The most of one rare input in a purchase. */
export const RARE_MOST = 3;

/** The first age a trader has each (a stall brings only what the age has to offer). */
const FROM: Record<string, number> = { silver: 1, heartwood: 1, thick_pelt: 1, gems: 2, pearls: 1 };
/** Plain stock a season at a stall with no trade links, and what each link adds (a half unit). Pearls and gems come
 *  only by trade. */
const BASE: Record<string, number> = { silver: 2, heartwood: 2, thick_pelt: 1, gems: 0, pearls: 0 };
const PER_LINK = 0.5;

const seasonOf = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY / DAYS_PER_SEASON);

/** Powers the town trades with (a treaty of trade, alliance or vassalage). */
export const tradeLinks = (s: GameState): number => realm(s).filter((f) => f.known && f.id !== 'brotherhood' && (f.stance === 'trade' || f.stance === 'alliance' || f.stance === 'vassal')).length;

/** How much of one rare input the traders hold this season, before any was bought. */
export function stallCap(s: GameState, m: Material): number {
  const era = ERAS.indexOf(s.era);
  if (era < (FROM[m] ?? 99) || !marketStall(s)) return 0;
  const links = tradeLinks(s);
  const house = s.market ? tierOf(s.market.standing).level : 0;
  const base = (BASE[m] ?? 0) + (era > 1 ? 1 : 0) * (BASE[m] ? 1 : 0) + links * PER_LINK + house * PER_LINK;
  if (base <= 0) return 0;
  const rng = new Rng(hashSeed(`${s.seed}:rarestall:${seasonOf(s)}:${m}`));
  return Math.max(0, Math.floor(base) + rng.int(-1, 1));
}

/** What a unit costs from the traders. */
export const stallPrice = (s: GameState, m: Material): number => Math.max(1, Math.round(priceOf(s, m) * RARE_MARKUP));

/** The stall's stock now: each rare input still on offer, with its price. */
export interface StallLine { m: Material; name: string; left: number; price: number }
export function stallView(s: GameState): StallLine[] {
  const sold = s.rareSold?.n === seasonOf(s) ? s.rareSold.sold : {};
  return RARE_INPUTS.map((m) => ({ m, name: MATERIAL_NAMES[m], left: Math.max(0, stallCap(s, m) - (sold[m] ?? 0)), price: stallPrice(s, m) })).filter((l) => l.left > 0);
}

/** Buy some of a rare input from the traders: `who` is the treasury ('town') or the founder's purse ('founder'). */
export function buyRare(s: GameState, m: Material, n: number, who: 'town' | 'founder'): boolean {
  if (!RARE_INPUTS.includes(m) || !Number.isInteger(n) || n < 1 || n > RARE_MOST) return false;
  const line = stallView(s).find((l) => l.m === m);
  const stall = marketStall(s);
  if (!line || !stall || n > line.left) return false;
  const f = founderOf(s);
  const cost = line.price * n;
  if (who === 'founder' ? !f || (f.coins ?? 0) < cost : (s.coins ?? 0) < cost) return false;
  if (storages(s).reduce((k, b) => k + storageFree(s, b), 0) < n) return false;
  if (who === 'founder') f!.coins = (f!.coins ?? 0) - cost;
  else s.coins = (s.coins ?? 0) - cost;
  depositNear(s, buildingDoor(stall), { [m]: n });
  const sold = s.rareSold?.n === seasonOf(s) ? s.rareSold : (s.rareSold = { n: seasonOf(s), sold: {} });
  sold.sold[m] = (sold.sold[m] ?? 0) + n;
  const what = `${n} ${MATERIAL_NAMES[m].toLowerCase()}`;
  if (who === 'founder') remember(s, f!, `Bought ${what} from the traders (${cost} coins)`);
  notify(s, `${who === 'founder' ? f!.name : 'The town'} bought ${what} from the traders for ${cost} coins.`);
  return true;
}
