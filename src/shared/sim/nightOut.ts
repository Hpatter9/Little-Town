// The evening at the tavern (the owner's ask: townsfolk go there for a drink to let off steam at the end of the
// day). At TAVERN_HOUR, with a tavern open, whoever is free and has the coins goes: the keeper stays behind the bar,
// a guard on watch at their post, the hurt in bed, children at home, the dead and machines never, and each nature
// more or less often. They walk there (people.ts: the `drink` task), spend the evening inside (seen in the tavern's
// window, drawn as the map dresses them) and go home at `until`. On coming in each buys the best drink they can
// afford, for a little less than a stranger pays, from the house (the owner's purse, the keeper's cut: takeSale),
// and it lifts their spirits; with nothing on tap the company still counts for half.

import { lawOn } from './politics';
import { BUILDING_BY_ID } from '../data/buildings';
import { SAVINGS_KEEP } from '../data/economy';
import { natureOf, type NatureId } from '../data/natures';
import { FARE } from '../data/shop';
import { takeSale } from './ambition';
import { attending } from './ceremonies';
import { busyNow } from './people';
import { holderOf } from './operators';
import { onShift } from './people';
import { farePrice, log, offers, pieceName, takeOffer, venueOpen } from './shop';
import { isChild } from './social';
import { notify, remember, tireless, type GameState, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { LOCAL_PRICE, TAVERN_NIGHT } from './wages';

/** How long the evening lasts (hours), and how many the tavern takes in at once. */
export const DRINK_HOURS = 2;
export const DRINKERS_MOST = 12;
/** How likely each nature is to go out of an evening (the rest stay home). */
const DRINK_LEAN: Partial<Record<NatureId, number>> = {
  jolly: 0.95, cheerful: 0.85, bold: 0.85, restless: 0.85, gloomy: 0.7, kind: 0.7, curious: 0.7, grumpy: 0.6,
  greedy: 0.55, proud: 0.6, dreamy: 0.6, shy: 0.4, stern: 0.4, pious: 0.35,
};
const LEAN_ELSE = 0.7;

/** The evening under way: the tavern, who went, when they go home, and who has been served. */
export interface NightOut {
  tavern: number;
  ids: number[];
  until: number;
  served: number[];
}

/** A roll of their own by the day (the sim's clock has no rng here). */
function roll(seed: string, day: number, id: number): number {
  let h = 2166136261;
  for (const ch of `${seed}|${day}|${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Whether they're out at the tavern now (the task holds while this does). */
export const drinking = (s: GameState, p: Person): boolean =>
  !!s.nightOut && s.tick < s.nightOut.until && s.nightOut.ids.includes(p.id) && p.away === null && !p.downed && !s.raid;

/** Of an evening (TAVERN_HOUR, from wages.ts): who goes to the tavern tonight. */
export function nightOut(s: GameState): void {
  const tavern = venueOpen(s, 'tavern');
  if (!tavern || lawOn(s, 'curfew')) return; // (a curfew keeps everyone home: sim/politics.ts)
  const keeper = holderOf(s, tavern);
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const goers = s.people
    .filter(
      (p) =>
        p.away === null && !isChild(p) && !p.downed && !tireless(p) && !p.sick && p !== keeper && !(p.guard && onShift(s, p)) &&
        p.needs.rest > 0.2 && (p.coins ?? 0) > SAVINGS_KEEP + 1 && !attending(s, p) && !busyNow(s, p),
    )
    .map((p) => ({ p, r: roll(s.seed, day, p.id) / (DRINK_LEAN[natureOf(p).id] ?? LEAN_ELSE) }))
    .filter(({ r }) => r < 1)
    .sort((a, b) => a.r - b.r)
    .slice(0, DRINKERS_MOST)
    .map(({ p }) => p);
  if (!goers.length) return;
  s.nightOut = { tavern: tavern.id, ids: goers.map((p) => p.id), until: s.tick + DRINK_HOURS * TICKS_PER_HOUR, served: [] };
  const name = BUILDING_BY_ID[tavern.def].name;
  notify(s, goers.length === 1 ? `${goers[0].name} is off to the ${name} to let off steam.` : `${goers.length} of the townsfolk are off to the ${name} to let off steam after the day's work.`);
}

/** Someone just in at the tavern's door: a drink bought and their spirits lifted (once an evening). */
export function drinkAt(s: GameState, p: Person): void {
  const n = s.nightOut;
  if (!n || n.served.includes(p.id)) return;
  n.served.push(p.id);
  const tavern = s.buildings.find((b) => b.id === n.tavern);
  if (!tavern) return;
  const name = BUILDING_BY_ID[tavern.def].name;
  // (people keep a little back: data/economy.ts SAVINGS_KEEP, so they can save for land)
  const menu = offers(s, FARE, (i, q) => Math.max(1, Math.round(farePrice(s, i, q) * LOCAL_PRICE))).filter((o) => o.price <= (p.coins ?? 0) - SAVINGS_KEEP);
  const pick = menu.filter((o) => o.item.fare!.kind === 'drink').at(-1) ?? menu.at(-1);
  if (pick && takeOffer(s, pick)) {
    p.coins = (p.coins ?? 0) - pick.price;
    takeSale(s, tavern, pick.price, holderOf(s, tavern), 'tavern', p.name);
    p.morale = Math.min(100, p.morale + TAVERN_NIGHT);
    remember(s, p, `An evening at the ${name}: ${pieceName(pick)} (${pick.price} coins)`);
    log(s, tavern, `${p.name} came in for ${pieceName(pick)} (${pick.price} coins).`);
  } else {
    p.morale = Math.min(100, p.morale + TAVERN_NIGHT / 2);
    remember(s, p, `An evening at the ${name}, with nothing on tap`);
    log(s, tavern, `${p.name} came in, and found nothing on tap.`);
  }
}
