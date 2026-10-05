// The townsfolk's own coins. Once the town has a shop (and so money), people earn by their work (sim/economy.ts: what
// they bring in, build, study, make and sell) and keep a purse. The townsfolk spend it: on their own gear, bought from what the shop has in stock
// (for less than strangers pay), the best upgrade each can afford, fighters first for weapons and armour; and, with a
// tavern, on a drink or a meal of an evening, which cheers them. What they pay goes back to the town. Before there's a
// shop, gear is still shared out from the common store for free (see crafting.ts equipAll).

import { ITEM_BY_ID, SLOTS, type ItemDef, type Slot } from '../data/items';
import { COMMON, gradeOf } from '../data/quality';
import { canWear } from './classes';
import { FARE, PURSE_SCALE } from '../data/shop';
import { addItems, gearScore } from './crafting';
import { farePrice, itemPrice, log, offers, pieceName, SALE_GEAR, takeOffer, venueOpen, type Offer } from './shop';
import { moneyTown } from './economy';
import { SAVINGS_KEEP } from '../data/economy';
import { isChild } from './social';
import { earn, notify, remember, type GameState, type Person } from './state';
import { BUILDING_BY_ID } from '../data/buildings';
import { calendar, TICKS_PER_HOUR } from './time';

/** What a day's pay for work might come to, a head (times the era's scale): the treasury keeps about this back. */
export const PAY_A_HEAD = 2;
/** The most of its purse the town lets a day's pay for work take. */
export const WAGE_SHARE = 0.5;
/** The hour the townsfolk go to the tavern, and the lift a night there gives their morale. */
export const TAVERN_HOUR = 20;
export const TAVERN_NIGHT = 4;
/** Townsfolk pay this share of what a stranger would, and get this share back for what they hand in. */
export const LOCAL_PRICE = 0.6;
export const TRADE_IN = 0.3;
/** Buys of this quality (Rare) or better make the news. */
const RARE = 3;
/** A piece has to be at least this much better than what they wear to be worth buying. */
const WORTH_BUYING = 1.1;

export { moneyTown } from './economy';
const earners = (s: GameState) => s.people.filter((p) => !isChild(p));
/** What a day's pay for work might come to (the treasury's reserve against it). */
export const wageBill = (s: GameState) => Math.round(earners(s).length * PAY_A_HEAD * PURSE_SCALE[s.era]);

/** What a townsperson pays for a piece from the shop. */
export const localPrice = (i: ItemDef, q: number) => Math.max(1, Math.round(itemPrice(i, q) * LOCAL_PRICE));

/** Every tick: wages on payday; once an hour, the townsfolk shop for gear. */
export function updateWages(s: GameState): void {
  if (!moneyTown(s)) return;
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const hour = calendar(s.tick).hour;
  if (hour === TAVERN_HOUR) nightOut(s);
  buyGear(s);
}

/** Of an evening, whoever has the coins goes to the tavern for the best they can afford (a drink, most often), for a
 *  little less than a stranger pays. It lifts their spirits. */
export function nightOut(s: GameState): void {
  const tavern = venueOpen(s, 'tavern');
  if (!tavern) return;
  let guests = 0;
  let takings = 0;
  // (people keep a little back: data/economy.ts SAVINGS_KEEP, so they can save for land)
  for (const p of s.people.filter((q) => q.away === null && !isChild(q) && !q.downed && (q.coins ?? 0) > SAVINGS_KEEP)) {
    const menu = offers(s, FARE, (i, q) => Math.max(1, Math.round(farePrice(s, i, q) * LOCAL_PRICE))).filter((o) => o.price <= (p.coins ?? 0) - SAVINGS_KEEP);
    const pick = menu.filter((o) => o.item.fare!.kind === 'drink').at(-1) ?? menu.at(-1);
    if (!pick || !takeOffer(s, pick)) continue;
    p.coins = (p.coins ?? 0) - pick.price;
    s.coins = (s.coins ?? 0) + pick.price;
    earn(s, 'townsfolk', pick.price);
    p.morale = Math.min(100, p.morale + TAVERN_NIGHT);
    remember(s, p, `Spent the evening at the ${BUILDING_BY_ID[tavern.def].name}: ${pieceName(pick)} (${pick.price} coins)`);
    guests++;
    takings += pick.price;
  }
  if (guests) log(s, tavern, `Evening: ${guests === 1 ? 'one of the townsfolk' : `${guests} of the townsfolk`} came in to eat and drink (${takings} coins).`);
}

/** Fighting gear goes to fighters first; the rest in turn. */
const fightSkill = (s: GameState, p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level) + (p.id === s.mainId ? 0.5 : 0) + (p.priorities.defend ? 3 : 0);

/** Each grown-up at home buys the best upgrade they can afford for each slot, if there's one worth having. */
export function buyGear(s: GameState): void {
  for (const slot of SLOTS) {
    const combat = slot === 'weapon' || slot === 'offhand' || slot === 'head' || slot === 'body';
    const buyers = s.people.filter((p) => p.away === null && !isChild(p) && !p.downed).sort((a, b) => (combat ? fightSkill(s, b) - fightSkill(s, a) : a.id - b.id));
    for (const p of buyers) {
      const worn = p.gear[slot] ? ITEM_BY_ID[p.gear[slot]!] : undefined;
      const now = worn ? gearScore(worn, p.gearQ?.[slot]) : 0;
      const pick = offers(s, SALE_GEAR.filter((i) => i.slot === slot && canWear(p, i)), localPrice)
        .filter((o) => o.price <= (p.coins ?? 0) - SAVINGS_KEEP && gearScore(o.item, o.q) > Math.max(0.01, now * WORTH_BUYING))
        .sort((a, b) => gearScore(b.item, b.q) - gearScore(a.item, a.q))[0];
      if (pick) buyPiece(s, p, slot, pick);
    }
  }
}

/** A townsperson buys a piece and puts it on; what they wore goes back to the shop, for a little. */
function buyPiece(s: GameState, p: Person, slot: Slot, o: Offer): void {
  if (!takeOffer(s, o)) return;
  p.coins = (p.coins ?? 0) - o.price;
  s.coins = (s.coins ?? 0) + o.price;
  earn(s, 'townsfolk', o.price);
  const old = p.gear[slot];
  if (old) {
    const q = p.gearQ?.[slot] ?? COMMON;
    addItems(s, old, 1, q);
    const back = Math.min(s.coins, Math.round(localPrice(ITEM_BY_ID[old], q) * TRADE_IN));
    p.coins += back;
    s.coins -= back;
    earn(s, 'townsfolk', -back);
  }
  p.gear[slot] = o.item.id;
  (p.gearQ ??= {})[slot] = o.q;
  remember(s, p, `Bought a ${pieceName(o)} at the shop for ${o.price} coins`);
  if (gradeOf(o.q) >= RARE) notify(s, `${p.name} bought a ${pieceName(o)} for ${o.price} coins.`);
}
