// House intrigue (data/intrigue.ts has the numbers and words; the owner's ask on the ruling house from 0.96.0:
// "They can own more of the town and make more money, maybe start a mafia, try and take over the council with bribes,
// blackmail, murder"). `s.intrigue` (`IntrigueState`) holds it, and `intrigueHourly` (from sim.ts; off with the
// autopilot, and on a side stream of its own, `${seed}:intrigue:${tick}`) does the work once a day in the small hours.
//  - Houses own the town. A house is a family line (sim/dynasty.ts `housesOf`). Rent and a till's takings paid to one
//    of its members send a tithe to the family chest (`houseCut`, from property.ts `collectRent` and ambition.ts
//    `takeSale`); a house with coin to spare buys the town's homes, shops, workshops and fields, or a debtor's, and what
//    it owns pays it. Its purse is part of its strength (dynasty.ts `strengthOf`).
//  - A mafia (`Mafia`): a rich house with a hard member turns to crime as a family business: protection from the shops,
//    a till skimmed, caravans smuggled, a few hired knives. Shopkeepers pay or have "accidents". The watch finds it out
//    now and then, and a house member goes to trial, which is a scandal.
//  - The council (`Hold`): the four blocs' speakers are its seats. A house bribes, blackmails or frightens a speaker
//    (`swingVote`, from politics.ts `callVote`: a held speaker votes as the house wants, and counts for `SEAT_VOTES`),
//    or has a rival speaker or a rival heir murdered, as an accident or pinned on somebody else (`Plot`). Schemes come
//    to light: trials, exile, feuds (dynasty.ts `startFeud`) and revenge.
//  - Never the founder: nobody in `s.mainId`'s place is a target, a culprit, a patsy or a hired knife, and `slay` (the one
//    place intrigue kills) refuses them, so a scheme can never change who leads the town.
// What is hidden shows as whispers (`Whisper`); what comes to light is told in the news and the year's chronicle, and
// the Families tab shows each house's holdings, wealth and known crimes (`intrigueView`).

import { BUILDING_BY_ID } from '../data/buildings';
import { TREASURY_KEEP } from '../data/economy';
import { PURSE_SCALE, venueOfDef } from '../data/shop';
import { WORKSHOP_BUILDINGS } from '../data/workshops';
import {
  ACCIDENT_BEAT, ACCIDENT_DEADLY, ACCIDENT_HP, ACCIDENT_SHARE, ACCIDENTS, ARREST_DEADLY, BANISH_AT, BLACKMAIL_FIGHTS, BLACKMAIL_FOLDS, BLACKMAIL_LONGER, BREAK_UP, BRIBE_COST, BRIBE_TAKERS, BUY_SPARE,
  CORNERED_KILLS, EXPOSE_BASE, EXPOSE_GUARD, EXPOSE_HARSH, EXPOSE_HEAT, FEAR_BEAT, FEAR_BOWS, FORCED_DEBT, FORCED_PRICE, FRAME_CHANCE, HARD_NATURES, HEAT_COOL, HEAT_PER_ACCIDENT, HEAT_PER_TAKE,
  HOLD_DAYS, HOUSE_TITHE, INTRIGUE_FROM_DAY, INTRIGUE_HOUR, INTRIGUE_PEOPLE, KILLINGS, KNIFE_FALLS, KNIFE_NAMES, LAND_RENT, LIE_LOW_DAYS, LOG_MOST, MAFIA_CHANCE, MAFIA_FROM_DAY, MAFIA_MOST, MAFIA_PURSE, METHOD_WEIGHT,
  type Method, MURDER_GUARD, MURDER_SUCCESS, MUSCLE_MOST, MUSCLE_WAGE, OWN_SHARE_MOST, PROTECTION_CALL, PROTECTION_LEAST, PROTECTION_SHARE, REFUSE_CHANCE, REFUSE_NATURES, REVENGE_CHANCE, REVENGE_DAYS,
  RING_HATES, SCHEME_CHANCE, SCHEME_GAP_DAYS, SCHEME_PURSE, SEAT_VOTES, SHAME_DAYS, SHAME_MORALE, SMUGGLE_SHARE, TAVERN_SHARE, TILL_SKIM, TOWN_SELLS_AT, UNCOVER_BASE, UNCOVER_FRAMED, UNCOVER_GUARD,
  WAR_CHEST, WEALTH_PER_STRENGTH, WEALTH_STRENGTH_MOST, WHISPER_CHANCE, WHISPER_DAYS, WHISPER_MOST,
} from '../data/intrigue';
import { CRIMINAL_NATURES, POOR_COINS, type BlocId, type CrimeKind } from '../data/politics';
import { COUPLE } from '../data/social';
import { natureOf } from '../data/natures';
import { hashSeed, Rng } from '../rng';
import { businessPrice } from './ambition';
import { defOf } from './buildings';
import { headOfHouse, houseName, housesOf, rootOf, startFeud, type Houses } from './dynasty';
import { giveCoins } from './economy';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { blackSheep } from './lineage';
import { blocOf, lawOn, politicsOf, stanceOn, trial } from './politics';
import { landPrice, materialsPrice } from './property';
import { enemiesOf, isChild, opinion } from './social';
import { earn, notify, remember, type Building, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds } from './townsfolk';

export type HoldHow = 'bribe' | 'blackmail' | 'fear';
/** A councillor (a bloc's speaker) in a house's pocket: they vote as it wants until `until`. */
export interface Hold {
  who: number;
  house: number;
  how: HoldHow;
  since: number;
  until: number;
  /** The house member who ran it. */
  by: number;
}
/** A killing, hidden or not. */
export interface Plot {
  id: number;
  house: number;
  /** Who ordered it (may be dead by now). */
  culprit: number;
  victim: number;
  victimName: string;
  victimHouse: number;
  day: number;
  how: 'accident' | 'killing' | 'revenge';
  patsy?: number;
  patsyName?: string;
  uncovered?: number;
}
export interface Crime {
  day: number;
  kind: 'mafia' | 'murder' | 'bribery' | 'blackmail' | 'fear' | 'revenge';
  text: string;
  known: boolean;
}
export interface Mafia {
  since: number;
  boss: number;
  muscle: number[];
  heat: number;
  lowUntil?: number;
  /** Those it has leaned on (person ids). */
  victims: number[];
}
export interface HouseBook {
  purse: number;
  /** All the coin the house has drawn from its holdings. */
  drawn: number;
  /** The part of a coin owed to the chest from the last tithe. */
  carry?: number;
  mafia?: Mafia;
  crimes: Crime[];
  lastScheme?: number;
  /** A wrong to be paid back: the house it means to strike, the plot, and the day it strikes. */
  avenge?: { house: number; plot: number; day: number };
}
export interface Whisper {
  tick: number;
  text: string;
  house: number;
}
export interface Secret {
  about: number;
  what: string;
  day: number;
}
export interface IntrigueState {
  /** Who belongs to which house (a person to their house's root), kept for the sim's sums between dawns. */
  of: Record<number, number>;
  books: Record<number, HouseBook>;
  holds: Hold[];
  plots: Plot[];
  secrets: Secret[];
  whispers: Whisper[];
  /** Trials waiting for the court to be free. */
  trials: { who: number; crime: CrimeKind; what: string; victim?: number }[];
  sway?: Record<number, number>;
  nextPlot: number;
  log: { tick: number; day: number; text: string }[];
}

export const intrigueOf = (s: GameState): IntrigueState => (s.intrigue ??= { of: {}, books: {}, holds: [], plots: [], secrets: [], whispers: [], trials: [], nextPlot: 1, log: [] });

const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const off = (s: GameState) => s.autopilot === false;
const scale = (s: GameState) => PURSE_SCALE[s.era];
const grownAtHome = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p));
const living = (s: GameState, id: number) => s.people.find((p) => p.id === id);
const guardsAt = (s: GameState) => s.people.filter((p) => p.guard && p.away === null).length;

/** Something told: a key one goes in the house log (and so the year's chronicle), a small one is only news. */
function note(s: GameState, text: string, key = true): void {
  if (key) {
    const st = intrigueOf(s);
    st.log.push({ tick: s.tick, day: day(s), text });
    if (st.log.length > LOG_MOST) st.log.splice(0, st.log.length - LOG_MOST);
  }
  notify(s, text, key);
}

/** A rumour: the town talks of something hidden, and not always of the house it is about. */
function whisper(s: GameState, rng: Rng, house: number, text: string, chance = WHISPER_CHANCE): void {
  if (!rng.chance(chance)) return;
  const st = intrigueOf(s);
  st.whispers.push({ tick: s.tick, text, house });
  if (st.whispers.length > WHISPER_MOST) st.whispers.splice(0, st.whispers.length - WHISPER_MOST);
  notify(s, text, false);
}

/** The one place intrigue kills. The founder is never killed by a scheme. */
function slay(s: GameState, p: Person | undefined, cause: string): boolean {
  if (!p || p.id === s.mainId || !s.people.includes(p)) return false;
  killPerson(s, p, cause);
  return true;
}

/* ------------------------------------------------------------ the books */

const bookOf = (s: GameState, root: number): HouseBook | undefined => s.intrigue?.books[root];

/** A tithe of what a landlord or a keeper takes in goes to the family chest. Returns what was taken (the caller pays the
 *  rest). The founder's own takings are their own. */
export function houseCut(s: GameState, owner: Person, n: number): number {
  const st = s.intrigue;
  if (!st || off(s) || owner.id === s.mainId || n < 1) return 0;
  const root = st.of[owner.id];
  const book = root === undefined ? undefined : st.books[root];
  if (!book) return 0;
  // (the fraction of a coin is carried to the next payment, so a one-coin rent still adds up)
  book.carry = (book.carry ?? 0) + n * HOUSE_TITHE;
  const cut = Math.min(n, Math.floor(book.carry));
  if (cut <= 0) return 0;
  book.carry -= cut;
  book.purse += cut;
  book.drawn += cut;
  return cut;
}

/** The buildings a house owns (through its members). */
export function ownedByHouse(s: GameState, root: number): Building[] {
  const of = s.intrigue?.of ?? {};
  return s.buildings.filter((b) => b.owner !== undefined && of[b.owner] === root && b.status === 'done');
}

const WORKS = new Set(WORKSHOP_BUILDINGS.map((d) => d.id));
type Kind = 'homes' | 'shops' | 'works' | 'fields';
function kindOf(b: Building): Kind | null {
  if (b.crop) return 'fields';
  if (venueOfDef(b.def)) return 'shops';
  if (WORKS.has(b.def)) return 'works';
  if (BUILDING_BY_ID[b.def]?.housing) return 'homes';
  return null;
}

/** How many of each kind a house holds. */
export function holdingsOf(s: GameState, root: number): Record<Kind, number> {
  const out: Record<Kind, number> = { homes: 0, shops: 0, works: 0, fields: 0 };
  for (const b of ownedByHouse(s, root)) {
    const k = kindOf(b);
    if (k) out[k]++;
  }
  return out;
}

/** A house's wealth: its purse and its members' coins. */
export function wealthOf(s: GameState, root: number): number {
  const st = s.intrigue;
  if (!st) return 0;
  let t = st.books[root]?.purse ?? 0;
  for (const p of s.people) if (st.of[p.id] === root) t += p.coins ?? 0;
  return Math.round(t);
}

/** What the purse adds to a house's strength (dynasty.ts `strengthOf`). */
export const wealthStrength = (s: GameState, root: number): number => Math.min(WEALTH_STRENGTH_MOST, (s.intrigue?.books[root]?.purse ?? 0) / WEALTH_PER_STRENGTH);

function refreshBooks(s: GameState, h: Houses): void {
  const st = intrigueOf(s);
  const of: Record<number, number> = {};
  const live = new Set<number>();
  for (const p of s.people) {
    if (!h.of.has(p.id)) continue;
    const r = rootOf(h, p.id);
    of[p.id] = r;
    live.add(r);
  }
  st.of = of;
  for (const r of live) st.books[r] ??= { purse: 0, drawn: 0, crimes: [] };
  // a house that has died out leaves its chest to the town
  for (const k of Object.keys(st.books)) {
    const r = Number(k);
    if (live.has(r)) continue;
    const b = st.books[r];
    if (b.purse > 0) {
      s.coins = (s.coins ?? 0) + Math.round(b.purse);
      earn(s, 'realm', Math.round(b.purse));
    }
    delete st.books[r];
  }
  st.holds = st.holds.filter((hd) => st.books[hd.house] && living(s, hd.who) && s.tick < hd.until);
  st.whispers = st.whispers.filter((w) => s.tick - w.tick < WHISPER_DAYS * TICKS_PER_DAY);
  st.secrets = st.secrets.filter((x) => living(s, x.about));
  st.plots = st.plots.filter((p) => !p.uncovered || day(s) - p.uncovered < 30).slice(-24);
}

/* ------------------------------------------------------------ secrets */

/** An undetected crime is a secret its culprit's neighbours may come to know (politics.ts `crime`). */
export function hideCrime(s: GameState, culprit: Person, what: string): void {
  if (off(s)) return;
  const st = intrigueOf(s);
  st.secrets.push({ about: culprit.id, what: `${what}, and nobody knows`, day: day(s) });
  if (st.secrets.length > 20) st.secrets.shift();
}

/** What could be held over someone: a crime nobody saw, money they owe and hide, a bond kept from their partner. These are
 *  the same facts their diaries are written from (sim/diary.ts `diaryFacts`). */
export function secretsAbout(s: GameState, p: Person): string[] {
  const out = (s.intrigue?.secrets ?? []).filter((x) => x.about === p.id).map((x) => x.what);
  if ((p.debt ?? 0) > 40) out.push('owes far more than they let on');
  if (p.partner != null && s.people.some((q) => q.id !== p.id && q.id !== p.partner && !isChild(q) && opinion(s, p.id, q.id) >= COUPLE)) out.push('has a lover their partner does not know of');
  return out;
}

/* ------------------------------------------------------------ the seats */

/** A bloc's speaker: its best-spoken member. The four speakers are the council's seats. */
export function speakers(s: GameState): Partial<Record<BlocId, Person>> {
  const out: Partial<Record<BlocId, Person>> = {};
  for (const p of grownAtHome(s)) {
    const b = blocOf(s, p);
    if (!b) continue;
    const cur = out[b];
    if (!cur || (p.skills.social?.level ?? 0) > (cur.skills.social?.level ?? 0) || ((p.skills.social?.level ?? 0) === (cur.skills.social?.level ?? 0) && p.id < cur.id)) out[b] = p;
  }
  return out;
}

/** How many of the council's seats a house holds: its own speakers, and the speakers in its pocket. */
export function seatsOf(s: GameState, root: number): number {
  const st = s.intrigue;
  if (!st) return 0;
  let n = 0;
  for (const p of Object.values(speakers(s))) if (p && (st.of[p.id] === root || st.holds.some((hd) => hd.who === p.id && hd.house === root))) n++;
  return n;
}

/** What a house wants of a proposal: +1 for, -1 against, 0 neither. A ring wants the laws that bind it gone and the tax
 *  low; the rest follow the head's bloc. */
function housePosition(s: GameState, root: number, prop: { law?: string; repeal?: boolean; tax?: string }): number {
  const book = bookOf(s, root);
  if (prop.law && RING_HATES.includes(prop.law) && book?.mafia) return prop.repeal ? 1 : -1;
  if (prop.tax) return prop.tax === 'low' ? 1 : -1;
  const h = housesOf(s);
  const head = headOfHouse(s, h, root);
  const bloc = head ? blocOf(s, head) : null;
  return bloc ? stanceOn(bloc, prop as never) : 0;
}

/** The council's vote with the pockets counted (politics.ts `callVote`): a held speaker's own vote goes, and the house's
 *  position counts `SEAT_VOTES` in its place. */
export function swingVote(s: GameState, prop: { law?: string; repeal?: boolean; tax?: string }, yes: number, no: number): { yes: number; no: number } {
  const st = s.intrigue;
  if (!st || off(s) || !st.holds.length) return { yes, no };
  const seats = speakers(s);
  for (const hd of st.holds) {
    if (s.tick >= hd.until) continue;
    const p = living(s, hd.who);
    const bloc = p ? blocOf(s, p) : null;
    if (!p || !bloc || seats[bloc] !== p) continue;
    const own = stanceOn(bloc, prop as never);
    if (own > 0) yes--;
    else if (own < 0) no--;
    const want = housePosition(s, hd.house, prop);
    if (want > 0) yes += SEAT_VOTES;
    else if (want < 0) no += SEAT_VOTES;
  }
  return { yes: Math.max(0, yes), no: Math.max(0, no) };
}

/* ------------------------------------------------------------ holdings */

function stewardOf(s: GameState, h: Houses, root: number): Person | undefined {
  return s.people
    .filter((p) => rootOf(h, p.id) === root && !isChild(p) && p.away === null && p.id !== s.mainId)
    .sort((a, b) => s.buildings.filter((x) => x.owner === a.id).length - s.buildings.filter((x) => x.owner === b.id).length || a.id - b.id)[0];
}

const RANK: Record<Kind, number> = { shops: 0, homes: 1, works: 2, fields: 3 };

/** A house with coin to spare buys what the town sells (its homes, shops, workshops and fields) or a debtor's. */
function buyProperty(s: GameState, h: Houses, root: number, book: HouseBook): void {
  const owned = ownedByHouse(s, root).length;
  const sellable = s.buildings.filter((b) => b.status === 'done' && kindOf(b)).length;
  if (owned >= Math.max(2, sellable * OWN_SHARE_MOST)) return;
  const st = intrigueOf(s);
  const reserve = bossOf(s, h, root) ? WAR_CHEST * scale(s) : 0; // (a house with a hard hand saves for its schemes first)
  let best: { b: Building; kind: Kind; price: number; seller: Person | undefined } | undefined;
  for (const b of s.buildings) {
    if (b.status !== 'done' || b.overgrown || b.room || b.ring !== undefined) continue;
    const kind = kindOf(b);
    if (!kind) continue;
    const seller = b.owner === undefined ? undefined : living(s, b.owner);
    if (b.owner !== undefined && !seller) continue;
    let price: number;
    if (seller) {
      if (st.of[seller.id] === root || seller.id === s.mainId || (seller.debt ?? 0) < FORCED_DEBT) continue;
      price = Math.round((kind === 'shops' ? businessPrice(s, b) : landPrice(s, defOf(b)) + materialsPrice(defOf(b))) * FORCED_PRICE);
    } else {
      price = Math.round((kind === 'shops' ? businessPrice(s, b) : landPrice(s, defOf(b)) + materialsPrice(defOf(b))) * TOWN_SELLS_AT);
    }
    if (price * BUY_SPARE > book.purse - reserve) continue;
    if (!best || RANK[kind] < RANK[best.kind] || (RANK[kind] === RANK[best.kind] && (price > best.price || (price === best.price && b.id < best.b.id)))) best = { b, kind, price, seller };
  }
  const buyer = best && stewardOf(s, h, root);
  if (!best || !buyer) return;
  book.purse -= best.price;
  if (best.seller) {
    const paid = Math.min(best.price, best.seller.debt ?? 0);
    best.seller.debt = (best.seller.debt ?? 0) - paid;
    giveCoins(s, best.seller, best.price - paid, `Sold the ${BUILDING_BY_ID[best.b.def]?.name.toLowerCase()} to the ${houseName(s, root)} to clear what they owed`);
  } else {
    s.coins = (s.coins ?? 0) + best.price;
    earn(s, 'rent', best.price);
  }
  best.b.owner = buyer.id;
  remember(s, buyer, `The ${houseName(s, root)} bought the ${BUILDING_BY_ID[best.b.def]?.name.toLowerCase()} (${best.price} coins)`);
  note(s, `The ${houseName(s, root)} buys the ${BUILDING_BY_ID[best.b.def]?.name.toLowerCase()}${best.seller ? ` from ${best.seller.name}, who owed too much to keep it` : ' from the town'} (${best.price} coins).`, false);
}

/** The town pays a house for the use of the fields and workshops it owns, out of the treasury's spare coin. */
function landRent(s: GameState, root: number, book: HouseBook): void {
  const n = ownedByHouse(s, root).filter((b) => b.crop || WORKS.has(b.def)).length * LAND_RENT * scale(s);
  const paid = Math.min(n, Math.max(0, (s.coins ?? 0) - TREASURY_KEEP * scale(s)));
  if (paid <= 0) return;
  s.coins = (s.coins ?? 0) - paid;
  earn(s, 'realm', -paid);
  book.purse += paid;
  book.drawn += paid;
}

/* ------------------------------------------------------------ crimes known and hidden */

function addCrime(book: HouseBook, c: Crime): Crime {
  book.crimes.push(c);
  if (book.crimes.length > 12) book.crimes.shift();
  return c;
}

/** The court takes a case when it is free (politics.ts `trial`). */
function queueTrial(s: GameState, who: Person | undefined, crime: CrimeKind, what: string, victim?: Person): void {
  if (!who || who.id === s.mainId) return;
  const st = intrigueOf(s);
  if (st.trials.some((t) => t.who === who.id)) return;
  st.trials.push({ who: who.id, crime, what, victim: victim?.id });
}

function drainTrials(s: GameState): void {
  const st = intrigueOf(s);
  const pol = politicsOf(s);
  while (st.trials.length) {
    const t = st.trials[0];
    const p = living(s, t.who);
    if (!p || p.id === s.mainId) {
      st.trials.shift();
      continue;
    }
    if (pol.trial || s.raid || p.away !== null) break;
    st.trials.shift();
    trial(s, p, t.crime, t.what, t.victim === undefined ? undefined : living(s, t.victim));
    break;
  }
}

/** Run a house head out of town when its known crimes pile up (the founder is never run out). */
function banishIfEnough(s: GameState, h: Houses, root: number, book: HouseBook): void {
  if (book.crimes.filter((c) => c.known).length < BANISH_AT) return;
  const head = headOfHouse(s, h, root);
  const p = head && head.id !== s.mainId ? head : stewardOf(s, h, root);
  if (!p) return;
  // (their land and purse go to their heir: sim/lineage.ts)
  const owned = s.buildings.filter((b) => b.owner === p.id);
  for (const b of owned) b.owner = undefined;
  s.people = s.people.filter((q) => q !== p);
  assignBeds(s);
  book.crimes = book.crimes.slice(-1);
  book.mafia = undefined;
  note(s, `${p.name}, head of the ${houseName(s, root)}, is driven out of the town for good: the council has had enough of that house's dealings.`);
}

/** A crime of a house comes to light: the book, the news, the shame, a trial for whoever did it. */
function expose(s: GameState, h: Houses, root: number, book: HouseBook, crime: Crime | undefined, text: string, accused: Person | undefined, charge: CrimeKind, what: string): void {
  if (crime) crime.known = true;
  note(s, text);
  (s.marks ??= []).push({ lever: 'morale', value: SHAME_MORALE, until: s.tick + SHAME_DAYS * TICKS_PER_DAY, text: `The ${houseName(s, root)} is shamed` });
  queueTrial(s, accused, charge, what);
  banishIfEnough(s, h, root, book);
}

/* ------------------------------------------------------------ the mafia */

const hardness = (p: Person) => (HARD_NATURES.includes(natureOf(p).id) ? 2 : 0) + (CRIMINAL_NATURES.includes(natureOf(p).id) ? 1 : 0) + (p.skills.social?.level ?? 0) / 10;

function bossOf(s: GameState, h: Houses, root: number): Person | undefined {
  return s.people
    .filter((p) => rootOf(h, p.id) === root && !isChild(p) && p.away === null && !p.downed && p.id !== s.mainId && !p.guard && HARD_NATURES.includes(natureOf(p).id))
    .sort((a, b) => hardness(b) - hardness(a) || a.id - b.id)[0];
}

function hireMuscle(s: GameState, h: Houses, root: number, m: Mafia): void {
  m.muscle = m.muscle.filter((id) => living(s, id));
  if (m.muscle.length >= MUSCLE_MOST) return;
  const pool = s.people
    .filter((p) => rootOf(h, p.id) !== root && !isChild(p) && p.away === null && !p.guard && !p.downed && p.id !== s.mainId && !m.muscle.includes(p.id) && ((p.coins ?? 0) < POOR_COINS || p.morale < 45 || CRIMINAL_NATURES.includes(natureOf(p).id)))
    .sort((a, b) => hardness(b) - hardness(a) || a.id - b.id);
  if (pool[0]) m.muscle.push(pool[0].id);
}

function foundMafia(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook): void {
  if (book.mafia || day(s) < MAFIA_FROM_DAY || book.purse < MAFIA_PURSE * scale(s)) return;
  if (Object.values(intrigueOf(s).books).filter((b) => b.mafia).length >= MAFIA_MOST) return;
  const boss = bossOf(s, h, root);
  if (!boss || !rng.chance(MAFIA_CHANCE)) return;
  book.mafia = { since: day(s), boss: boss.id, muscle: [], heat: 0, victims: [] };
  hireMuscle(s, h, root, book.mafia);
  addCrime(book, { day: day(s), kind: 'mafia', text: `${boss.name} runs the house's protection racket`, known: false });
  whisper(s, rng, root, rng.chance(0.5) ? `They say the shopkeepers have begun paying somebody for "peace", and none will say who.` : `Folk whisper that the ${houseName(s, root)} has hard men on its books now.`, 0.85);
}

function mafiaDay(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook): void {
  const m = book.mafia;
  if (!m) return;
  const boss = living(s, m.boss) ?? bossOf(s, h, root);
  if (!boss) {
    book.mafia = undefined;
    return;
  }
  m.boss = boss.id;
  m.heat = Math.max(0, m.heat - HEAT_COOL);
  // the wages of the hired knives
  const sc = scale(s);
  m.muscle = m.muscle.filter((id) => living(s, id));
  for (const id of [...m.muscle]) {
    const p = living(s, id)!;
    if (book.purse >= MUSCLE_WAGE * sc) {
      book.purse -= MUSCLE_WAGE * sc;
      giveCoins(s, p, MUSCLE_WAGE * sc);
    } else m.muscle = m.muscle.filter((x) => x !== id);
  }
  if (book.purse >= 10 * sc) hireMuscle(s, h, root, m);
  if (m.lowUntil !== undefined && s.tick < m.lowUntil) return;
  // protection, and a cut of the tavern
  for (const b of s.buildings) {
    if (b.status !== 'done' || !venueOfDef(b.def) || !rng.chance(PROTECTION_CALL)) continue;
    const t = b.shop?.takings;
    const takings = t ? (t.day === Math.floor(s.tick / TICKS_PER_DAY) ? t.yesterday : t.day === Math.floor(s.tick / TICKS_PER_DAY) - 1 ? t.today : 0) : 0;
    if (takings <= 0) continue;
    const tavern = venueOfDef(b.def) === 'tavern';
    const owner = b.owner === undefined ? undefined : living(s, b.owner);
    if (b.owner !== undefined && !owner) continue;
    if (!owner) {
      const n = Math.round(takings * TILL_SKIM);
      if (n >= 1 && (s.coins ?? 0) >= n) {
        s.coins = (s.coins ?? 0) - n;
        earn(s, 'tavern', -n);
        book.purse += n;
        book.drawn += n;
        m.heat += HEAT_PER_TAKE / 2;
      }
      continue;
    }
    if (owner.id === s.mainId || rootOf(h, owner.id) === root) continue;
    const fee = Math.max(PROTECTION_LEAST * sc, Math.round(takings * (tavern ? TAVERN_SHARE : PROTECTION_SHARE)));
    const refuses = (owner.coins ?? 0) < fee || rng.chance(REFUSE_NATURES.includes(natureOf(owner).id) ? REFUSE_CHANCE : 0.08);
    if (!refuses) {
      owner.coins = (owner.coins ?? 0) - fee;
      book.purse += fee;
      book.drawn += fee;
      m.heat += HEAT_PER_TAKE;
      if (!m.victims.includes(owner.id)) m.victims.push(owner.id);
      if (m.victims.length > 8) m.victims.shift();
      remember(s, owner, `Paid ${fee} coins to a man who called about "peace and quiet"`);
      continue;
    }
    // an accident
    m.heat += HEAT_PER_ACCIDENT;
    const how = rng.int(0, 2);
    if (how === 0 && b.hp !== undefined) {
      b.hp = Math.max(1, b.hp * ACCIDENT_HP);
      whisper(s, rng, root, `The ${(BUILDING_BY_ID[b.def]?.name ?? 'shop').toLowerCase()} had its windows broken in the night, and ${owner.name} says only that it was boys.`, 0.5);
    } else {
      const hp = Math.round(owner.hp * ACCIDENT_BEAT);
      owner.hp = Math.max(1, owner.hp - hp);
      minorWound(s, owner, hp, rng);
      if (rng.chance(ACCIDENT_DEADLY) && slay(s, owner, ACCIDENTS[rng.int(0, ACCIDENTS.length - 1)])) {
        whisper(s, rng, root, `People say ${owner.name} should have paid, and say it quietly.`, 0.8);
        continue;
      }
      whisper(s, rng, root, `${owner.name} has a black eye and no story to explain it.`, 0.5);
    }
  }
  // smuggling with the caravans
  const trade = s.ledger?.yesterday?.trade ?? 0;
  const cut = Math.floor(trade * SMUGGLE_SHARE);
  if (cut >= 1 && (s.coins ?? 0) >= cut && m.muscle.length) {
    s.coins = (s.coins ?? 0) - cut;
    earn(s, 'trade', -cut);
    book.purse += cut;
    book.drawn += cut;
    m.heat += HEAT_PER_TAKE;
    if (rng.chance(0.05)) whisper(s, rng, root, 'The caravan-master swears there were more crates in the wagon than reached the market.', 0.5);
  }
  // the watch finds out
  const chance = EXPOSE_BASE + m.heat * EXPOSE_HEAT + guardsAt(s) * EXPOSE_GUARD + (lawOn(s, 'harsh_law') ? EXPOSE_HARSH : 0);
  if (rng.chance(chance)) exposeMafia(s, h, rng, root, book, m, boss);
}

function exposeMafia(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook, m: Mafia, boss: Person): void {
  const crime = book.crimes.find((c) => c.kind === 'mafia' && !c.known);
  const knife = m.muscle.length ? living(s, m.muscle[0]) : undefined;
  const accused = knife && rng.chance(0.5) ? knife : boss;
  expose(s, h, root, book, crime, `The watch has broken a protection racket: it was run for the ${houseName(s, root)}. ${accused.name} is taken.`, accused, 'theft', `ran a protection racket for the ${houseName(s, root)}`);
  if (accused !== boss && rng.chance(KNIFE_NAMES)) queueTrial(s, boss, 'theft', `ran a protection racket, as ${accused.name} told the court`);
  // an arrest that goes wrong
  if (rng.chance(ARREST_DEADLY)) {
    const fell = guardsAt(s) > 0 || !!knife;
    if (fell && slay(s, boss, 'resisting the watch')) m.boss = -1;
  }
  // those who paid, and now say so, have a grudge
  let feuds = 0;
  for (const id of m.victims) {
    const v = living(s, id);
    const vr = v ? rootOf(h, v.id) : undefined;
    if (vr === undefined || vr === root || !h.of.has(v!.id) || feuds >= 2) continue;
    startFeud(s, vr, root, `${v!.name} was made to pay for "protection"`, 35);
    feuds++;
  }
  if (rng.chance(BREAK_UP)) {
    book.mafia = undefined;
    note(s, `The ring is broken up. The ${houseName(s, root)} has a name now that it will not lose quickly.`, false);
  } else {
    m.lowUntil = s.tick + LIE_LOW_DAYS * TICKS_PER_DAY;
    m.heat = 0;
  }
}

/* ------------------------------------------------------------ the schemes */

function schemerOf(s: GameState, h: Houses, root: number): Person | undefined {
  return s.people
    .filter((p) => rootOf(h, p.id) === root && !isChild(p) && p.away === null && !p.downed && p.id !== s.mainId && !p.guard)
    .sort((a, b) => hardness(b) - hardness(a) || a.id - b.id)[0];
}

const heldBy = (st: IntrigueState, id: number) => st.holds.some((hd) => hd.who === id);

/** A house takes a hold of a councillor, or gets what it is looking for in some other way. */
function scheme(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook): void {
  const st = intrigueOf(s);
  const schemer = schemerOf(s, h, root);
  if (!schemer) return;
  book.lastScheme = s.tick;
  const sc = scale(s);
  const seats = Object.values(speakers(s)).filter((p): p is Person => !!p && p.id !== s.mainId && rootOf(h, p.id) !== root && !heldBy(st, p.id));
  const hard = HARD_NATURES.includes(natureOf(schemer).id) || !!book.mafia;
  const feudHot = (s.dynasty?.feuds ?? []).some((f) => !f.ended && (f.a === root || f.b === root) && f.heat >= 50);
  const can: Partial<Record<Method, number>> = {};
  const target = seats.length ? seats[rng.int(0, seats.length - 1)] : undefined;
  if (target) {
    if (book.purse >= BRIBE_COST * sc) can.bribe = METHOD_WEIGHT.bribe;
    if (secretsAbout(s, target).length) can.blackmail = METHOD_WEIGHT.blackmail;
    if (book.mafia && book.mafia.muscle.some((id) => living(s, id))) can.fear = METHOD_WEIGHT.fear;
  }
  const recentKill = st.plots.some((p) => p.house === root && day(s) - p.day < 10);
  if (hard && (book.mafia || feudHot) && !recentKill) can.murder = METHOD_WEIGHT.murder * (book.mafia ? 1.5 : 1);
  const methods = Object.keys(can) as Method[];
  if (!methods.length) return;
  const method = methods.length === 1 ? methods[0] : rng.weighted(can as Record<Method, number>);
  if (method === 'bribe') return bribe(s, h, rng, root, book, schemer, target!);
  if (method === 'blackmail') return blackmail(s, h, rng, root, book, schemer, target!);
  if (method === 'fear') return frighten(s, h, rng, root, book, schemer, target!);
  const victim = murderTarget(s, h, rng, root, target);
  if (victim) houseMurder(s, h, rng, root, book, schemer, victim, 'plot');
}

function holdOn(s: GameState, root: number, book: HouseBook, target: Person, by: Person, how: HoldHow, days: number): void {
  const st = intrigueOf(s);
  st.holds.push({ who: target.id, house: root, how, since: s.tick, until: s.tick + days * TICKS_PER_DAY, by: by.id });
  const kind = how === 'bribe' ? 'bribery' : how === 'blackmail' ? 'blackmail' : 'fear';
  addCrime(book, { day: day(s), kind, text: `${target.name} of the council is in the house's pocket by ${how === 'fear' ? 'fear' : how}`, known: false });
}

function bribe(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook, schemer: Person, target: Person): void {
  const cost = BRIBE_COST * scale(s);
  const take = Math.min(0.9, Math.max(0.08, (BRIBE_TAKERS[natureOf(target).id] ?? 1) / 3 + ((target.debt ?? 0) > 10 ? 0.2 : 0) + ((target.coins ?? 0) < POOR_COINS ? 0.15 : 0)));
  if (rng.chance(take)) {
    book.purse -= cost;
    giveCoins(s, target, cost, `Took a purse from ${schemer.name} "for the trouble of attending"`);
    holdOn(s, root, book, target, schemer, 'bribe', HOLD_DAYS);
    whisper(s, rng, root, `${target.name} has been spending freely, and the council has begun voting oddly.`);
    return;
  }
  // an honest councillor says so aloud, mostly
  if (!rng.chance(0.7)) return;
  const crime = addCrime(book, { day: day(s), kind: 'bribery', text: `${schemer.name} offered ${target.name} of the council a purse`, known: false });
  expose(s, h, root, book, crime, `${target.name} of the council throws a purse back at ${schemer.name} of the ${houseName(s, root)} and tells the whole square what it was for.`, schemer, 'theft', `tried to buy a seat on the council for the ${houseName(s, root)}`);
  if (h.of.has(target.id) && rootOf(h, target.id) !== root) startFeud(s, rootOf(h, target.id), root, `${schemer.name} tried to buy ${target.name}`, 25);
}

function blackmail(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook, schemer: Person, target: Person): void {
  const secrets = secretsAbout(s, target);
  const what = secrets[0];
  const folds = BLACKMAIL_FOLDS.includes(natureOf(target).id) ? 0.85 : 1 - BLACKMAIL_FIGHTS - 0.25;
  if (rng.chance(folds)) {
    const pay = Math.min(target.coins ?? 0, rng.int(5, 15) * scale(s));
    if (pay > 0) {
      target.coins = (target.coins ?? 0) - pay;
      book.purse += pay;
      book.drawn += pay;
    }
    holdOn(s, root, book, target, schemer, 'blackmail', Math.round(HOLD_DAYS * BLACKMAIL_LONGER));
    whisper(s, rng, root, `${target.name} has gone quiet and grey of late. Something is on their mind that they won't share.`);
    return;
  }
  // they fight back: the secret is aired, and the blackmailer is named
  const st = intrigueOf(s);
  st.secrets = st.secrets.filter((x) => !(x.about === target.id && x.what === what));
  if (h.of.has(target.id)) blackSheep(s, target, what);
  target.sore = { until: s.tick + 3 * TICKS_PER_DAY, value: -10, text: 'Their secret is out' };
  const crime = addCrime(book, { day: day(s), kind: 'blackmail', text: `${schemer.name} tried to blackmail ${target.name}`, known: false });
  if (rng.chance(CORNERED_KILLS) && slay(s, schemer, 'in a quarrel nobody will explain')) {
    whisper(s, rng, root, `${schemer.name} was last seen going to call on ${target.name}.`, 0.9);
    return;
  }
  expose(s, h, root, book, crime, `${target.name} will not be blackmailed. Their secret is out (${what}), and so is the name of ${schemer.name} of the ${houseName(s, root)}, who held it over them.`, schemer, 'theft', `tried to blackmail a councillor for the ${houseName(s, root)}`);
  if (h.of.has(target.id) && rootOf(h, target.id) !== root) startFeud(s, rootOf(h, target.id), root, `${schemer.name} held ${target.name}'s secret over them`, 30);
}

function frighten(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook, schemer: Person, target: Person): void {
  const bows = FEAR_BOWS.includes(natureOf(target).id) ? 0.8 : 0.35;
  if (rng.chance(bows)) {
    holdOn(s, root, book, target, schemer, 'fear', HOLD_DAYS);
    whisper(s, rng, root, `${target.name} walks home before dark now, and looks over their shoulder.`);
    return;
  }
  const hp = Math.round(target.hp * FEAR_BEAT);
  target.hp = Math.max(1, target.hp - hp);
  minorWound(s, target, hp, rng);
  if (book.mafia) book.mafia.heat += HEAT_PER_ACCIDENT;
  if (!rng.chance(0.2)) {
    whisper(s, rng, root, `${target.name} was set on in the lane last night, and says they saw nobody.`, 0.7);
    return;
  }
  const crime = addCrime(book, { day: day(s), kind: 'fear', text: `Hired men beat ${target.name} of the council`, known: false });
  const knife = book.mafia?.muscle.map((id) => living(s, id)).find(Boolean);
  expose(s, h, root, book, crime, `${target.name} of the council was beaten in the lane, and names the men: they draw their pay from the ${houseName(s, root)}.`, knife ?? schemer, 'assault', `beat ${target.name} of the council for the ${houseName(s, root)}`);
  if (h.of.has(target.id) && rootOf(h, target.id) !== root) startFeud(s, rootOf(h, target.id), root, `hired men beat ${target.name}`, 40);
}

/** Who a house wants dead: the ruling house's heir (a crisis for the seat), or a rival speaker. Never the founder. */
function murderTarget(s: GameState, h: Houses, rng: Rng, root: number, seat: Person | undefined): Person | undefined {
  const r = s.dynasty?.ruling;
  const heir = r?.heir != null ? living(s, r.heir) : undefined;
  const ruling = r ? rootOf(h, r.anchor) : undefined;
  if (heir && heir.id !== s.mainId && ruling !== root && rootOf(h, heir.id) === ruling && heir.away === null && !heir.downed && rng.chance(0.4)) return heir;
  return seat && seat.id !== s.mainId ? seat : undefined;
}

function pickAccident(rng: Rng): string {
  return ACCIDENTS[rng.int(0, ACCIDENTS.length - 1)];
}

/** A killing ordered by a house. `how` is the plot's (revenge is done in the open: nobody pretends). */
export function houseMurder(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook, schemer: Person, victim: Person, why: 'plot' | 'revenge'): void {
  if (victim.id === s.mainId || schemer.id === s.mainId) return;
  const st = intrigueOf(s);
  const knife = book.mafia?.muscle.map((id) => living(s, id)).find((p) => p && p.away === null && !p.downed) ?? schemer;
  const victimHouse = h.of.has(victim.id) ? rootOf(h, victim.id) : -victim.id;
  const works = rng.chance(MURDER_SUCCESS - guardsAt(s) * MURDER_GUARD);
  if (!works) {
    // the knife is cut down, or taken alive
    const hp = Math.round(victim.hp * 0.3);
    victim.hp = Math.max(1, victim.hp - hp);
    minorWound(s, victim, hp, rng);
    if (rng.chance(KNIFE_FALLS) && knife.id !== s.mainId) {
      slay(s, knife, `in a failed attempt on ${victim.name}`);
      whisper(s, rng, root, `${knife.name} was found dead in the lane behind ${victim.name}'s house, and nobody will say what they were doing there.`, 0.9);
      if (rng.chance(0.3)) startFeud(s, root, h.of.has(victim.id) ? rootOf(h, victim.id) : root, `${knife.name} died on ${victim.name}'s doorstep`, 25);
      return;
    }
    const crime = addCrime(book, { day: day(s), kind: 'murder', text: `${knife.name} tried to murder ${victim.name}`, known: false });
    const names = rng.chance(KNIFE_NAMES) && knife !== schemer;
    expose(s, h, root, book, names ? crime : undefined, names ? `${knife.name} is taken with a knife at ${victim.name}'s door, and names the ${houseName(s, root)} as the hand behind them.` : `${knife.name} is taken with a knife at ${victim.name}'s door. They will not say who sent them.`, knife, 'assault', `tried to murder ${victim.name}`);
    if (names) {
      queueTrial(s, schemer, 'assault', `ordered the knife at ${victim.name}'s door`);
      if (h.of.has(victim.id)) startFeud(s, rootOf(h, victim.id), root, `${knife.name} came for ${victim.name}`, 50);
    }
    return;
  }
  const accident = why === 'plot' && rng.chance(ACCIDENT_SHARE);
  const cause = accident ? pickAccident(rng) : why === 'revenge' ? `in a killing the ${houseName(s, root)} calls justice` : KILLINGS[rng.int(0, KILLINGS.length - 1)];
  if (!slay(s, victim, cause)) return;
  const plot: Plot = { id: st.nextPlot++, house: root, culprit: schemer.id, victim: victim.id, victimName: victim.name, victimHouse, day: day(s), how: why === 'revenge' ? 'revenge' : accident ? 'accident' : 'killing' };
  st.plots.push(plot);
  const crime = addCrime(book, { day: day(s), kind: why === 'revenge' ? 'revenge' : 'murder', text: `${victim.name} died ${cause}, by the house's hand`, known: false });
  if (why === 'revenge') {
    uncover(s, h, rng, plot, crime);
    return;
  }
  if (accident) {
    whisper(s, rng, rng.chance(0.5) ? root : victimHouse, `Folk say ${victim.name}'s end was no accident, though nobody will say whose doing it was.`);
    return;
  }
  // a plain killing: someone must answer for it
  const patsy = rng.chance(FRAME_CHANCE) ? patsyFor(s, h, rng, victim, root) : undefined;
  if (patsy) {
    plot.patsy = patsy.id;
    plot.patsyName = patsy.name;
    queueTrial(s, patsy, 'murder', `murdered ${victim.name}`, victim);
    return;
  }
  if (rng.chance(0.35)) uncover(s, h, rng, plot, crime);
  else whisper(s, rng, root, `${victim.name} is dead in the lane with a knife in them, and the watch has no idea whose it was.`, 0.8);
}

/** Someone to hang it on: an enemy of the dead, else the poorest hand outside the house. Never the founder. */
function patsyFor(s: GameState, h: Houses, rng: Rng, victim: Person, root: number): Person | undefined {
  const ok = (p: Person) => p.id !== s.mainId && p.away === null && !isChild(p) && !p.guard && rootOf(h, p.id) !== root && p.id !== victim.id;
  const foes = enemiesOf(s, victim).filter(ok);
  if (foes.length) return foes[rng.int(0, foes.length - 1)];
  return s.people.filter(ok).sort((a, b) => (a.coins ?? 0) - (b.coins ?? 0) || a.id - b.id)[0];
}

/** The truth comes out, from outside this file (the tests). */
export const uncoverPlot = (s: GameState, rng: Rng, plot: Plot): void => uncover(s, housesOf(s), rng, plot, bookOf(s, plot.house)?.crimes.find((c) => c.kind === 'murder' && !c.known && c.text.startsWith(plot.victimName)));

/** The truth comes out: the killing is the house's, the wrongly accused is cleared, the house's enemy swears revenge. */
function uncover(s: GameState, h: Houses, rng: Rng, plot: Plot, crime: Crime | undefined): void {
  const st = intrigueOf(s);
  const book = bookOf(s, plot.house);
  plot.uncovered = day(s);
  if (crime) crime.known = true;
  const culprit = living(s, plot.culprit) ?? (book ? headOfHouse(s, h, plot.house) : undefined);
  const patsy = plot.patsy === undefined ? undefined : living(s, plot.patsy);
  if (patsy) {
    st.trials = st.trials.filter((t) => t.who !== patsy.id);
  }
  note(s, `The truth about ${plot.victimName}'s death comes out: ${plot.how === 'revenge' ? 'it was done in revenge' : 'it was no accident'}, and the ${houseName(s, plot.house)} was behind it.${plot.patsyName ? ` ${plot.patsyName}, whom the town blamed, is cleared.` : ''}`);
  (s.marks ??= []).push({ lever: 'morale', value: SHAME_MORALE, until: s.tick + SHAME_DAYS * TICKS_PER_DAY, text: `The ${houseName(s, plot.house)} is shamed` });
  if (culprit) queueTrial(s, culprit, 'murder', `ordered the death of ${plot.victimName}`, undefined);
  if (plot.victimHouse >= 0 && plot.victimHouse !== plot.house) {
    startFeud(s, plot.victimHouse, plot.house, `${plot.victimName} was murdered for the ${houseName(s, plot.house)}`, 60);
    const vb = bookOf(s, plot.victimHouse);
    if (vb && !vb.avenge && plot.how !== 'revenge' && rng.chance(REVENGE_CHANCE)) {
      vb.avenge = { house: plot.house, plot: plot.id, day: day(s) + rng.int(REVENGE_DAYS[0], REVENGE_DAYS[1]) };
      note(s, `The ${houseName(s, plot.victimHouse)} wears black for ${plot.victimName}, and does not look as if it means to forgive.`, false);
    }
  }
  if (book) banishIfEnough(s, h, plot.house, book);
}

/** A house wronged by a proven murder strikes back, in the open. */
function revengeDay(s: GameState, h: Houses, rng: Rng, root: number, book: HouseBook): void {
  const a = book.avenge;
  if (!a || day(s) < a.day) return;
  book.avenge = undefined;
  const avenger = schemerOf(s, h, root);
  const culprit = living(s, intrigueOf(s).plots.find((p) => p.id === a.plot)?.culprit ?? -1);
  const target = culprit && culprit.id !== s.mainId && culprit.away === null ? culprit : (() => {
    const head = headOfHouse(s, h, a.house);
    return head && head.id !== s.mainId ? head : schemerOf(s, h, a.house);
  })();
  if (!avenger || !target) return;
  houseMurder(s, h, rng, root, book, avenger, target, 'revenge');
}

function plotsDay(s: GameState, h: Houses, rng: Rng): void {
  const st = intrigueOf(s);
  const guards = guardsAt(s);
  for (const plot of [...st.plots]) {
    if (plot.uncovered || plot.how === 'revenge') continue;
    const patsyGone = plot.patsy !== undefined && !living(s, plot.patsy);
    if (!rng.chance(UNCOVER_BASE + guards * UNCOVER_GUARD + (patsyGone ? UNCOVER_FRAMED : 0))) continue;
    const book = bookOf(s, plot.house);
    if (!book) continue;
    uncover(s, h, rng, plot, book.crimes.find((c) => (c.kind === 'murder') && !c.known && c.text.startsWith(plot.victimName)));
  }
  // a hold may be found out
  for (const hd of [...st.holds]) {
    if (!rng.chance(0.012 + guards * 0.004)) continue;
    const book = bookOf(s, hd.house);
    const p = living(s, hd.who);
    const by = living(s, hd.by);
    if (!book || !p) continue;
    st.holds = st.holds.filter((x) => x !== hd);
    const crime = book.crimes.find((c) => c.kind === (hd.how === 'bribe' ? 'bribery' : hd.how) && !c.known && c.text.startsWith(p.name));
    const what = hd.how === 'bribe' ? 'bought' : hd.how === 'blackmail' ? 'blackmailed' : 'threatened';
    expose(s, h, hd.house, book, crime, `It comes out that ${p.name} of the council has been ${hd.how === 'bribe' ? 'bought' : hd.how === 'blackmail' ? 'blackmailed' : 'frightened'} by the ${houseName(s, hd.house)}: the votes were never their own.`, by, hd.how === 'fear' ? 'assault' : 'theft', `${what} ${p.name} of the council for the ${houseName(s, hd.house)}`);
    p.sore = { until: s.tick + 2 * TICKS_PER_DAY, value: -6, text: hd.how === 'bribe' ? 'Shamed before the town' : 'Their hand was forced' };
  }
}

/** Telling the town when a house has the council in its hand (it hears it as a whisper; the book keeps it). */
function swayDay(s: GameState, rng: Rng): void {
  const st = intrigueOf(s);
  const seats = Object.values(speakers(s)).filter(Boolean).length;
  if (seats < 3) return;
  st.sway ??= {};
  for (const root of Object.keys(st.books).map(Number)) {
    const n = seatsOf(s, root);
    if (n * 2 > seats && st.holds.some((hd) => hd.house === root)) {
      if (st.sway[root] === undefined) {
        st.sway[root] = day(s);
        whisper(s, rng, root, `It is noticed that the council votes as one these days, and that it is the ${houseName(s, root)}'s way it votes.`, 1);
      }
    } else if (st.sway[root] !== undefined) delete st.sway[root];
  }
}

/* ------------------------------------------------------------ the day */

/** Once a day in the small hours: the books, the buying, the ring, the schemes and what comes to light. */
export function intrigueHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || off(s) || s.gameOver || calendar(s.tick).hour !== INTRIGUE_HOUR) return;
  if (grownAtHome(s).length < INTRIGUE_PEOPLE) return;
  const rng = new Rng(hashSeed(`${s.seed}:intrigue:${s.tick}`));
  const h = housesOf(s);
  refreshBooks(s, h);
  drainTrials(s);
  if (day(s) < INTRIGUE_FROM_DAY) return;
  const st = intrigueOf(s);
  const roots = Object.keys(st.books).map(Number).sort((a, b) => (st.books[b].purse - st.books[a].purse) || a - b);
  for (const root of roots) {
    const book = st.books[root];
    landRent(s, root, book);
    buyProperty(s, h, root, book);
    foundMafia(s, h, rng, root, book);
    mafiaDay(s, h, rng, root, book);
    revengeDay(s, h, rng, root, book);
  }
  plotsDay(s, h, rng);
  // schemes: at most two new ones a day
  let started = 0;
  for (const root of roots) {
    const book = st.books[root];
    if (started >= 2) break;
    if (book.lastScheme !== undefined && s.tick - book.lastScheme < SCHEME_GAP_DAYS * TICKS_PER_DAY) continue;
    if (book.purse < SCHEME_PURSE * scale(s) && !book.mafia) continue;
    if (!rng.chance(SCHEME_CHANCE)) continue;
    const before = book.lastScheme;
    scheme(s, h, rng, root, book);
    if (book.lastScheme !== before) started++;
  }
  swayDay(s, rng);
  drainTrials(s);
}

/* ------------------------------------------------------------ the views */

export interface IntrigueView {
  houses: {
    root: number;
    name: string;
    purse: number;
    wealth: number;
    holdings: Record<Kind, number>;
    seats: number;
    ruling: boolean;
    drawn: number;
    /** A ring, once it is known (else null). */
    ring: string | null;
    crimes: string[];
    /** What the town suspects of the house, when it has reason to. */
    rumour: string | null;
  }[];
  whispers: { day: number; text: string }[];
  log: { day: number; text: string }[];
}

export function intrigueView(s: GameState): IntrigueView | null {
  const st = s.intrigue;
  if (!st || off(s)) return null;
  const ruling = s.dynasty?.ruling ? s.dynasty.ruling.anchor : undefined;
  const h = ruling !== undefined || Object.keys(st.books).length ? housesOf(s) : undefined;
  const rr = h && ruling !== undefined ? rootOf(h, ruling) : undefined;
  const houses = Object.keys(st.books)
    .map(Number)
    .map((root) => {
      const book = st.books[root];
      const holdings = holdingsOf(s, root);
      const known = book.crimes.filter((c) => c.known);
      const suspect = st.whispers.find((w) => w.house === root);
      return {
        root,
        name: houseName(s, root),
        purse: Math.round(book.purse),
        wealth: wealthOf(s, root),
        holdings,
        seats: seatsOf(s, root),
        ruling: rr === root,
        drawn: Math.round(book.drawn),
        ring: known.some((c) => c.kind === 'mafia') ? (book.mafia ? 'a protection ring, still at work' : 'a protection ring, broken up') : null,
        crimes: known.map((c) => `Day ${c.day}: ${c.text}`),
        rumour: known.length || !suspect ? null : suspect.text,
      };
    })
    .filter((x) => x.wealth >= 10 || x.holdings.homes + x.holdings.shops + x.holdings.works + x.holdings.fields > 0 || x.crimes.length || x.rumour)
    .sort((a, b) => b.wealth - a.wealth || a.root - b.root)
    .slice(0, 6);
  if (!houses.length && !st.whispers.length) return null;
  return {
    houses,
    whispers: st.whispers.slice(-4).map((w) => ({ day: Math.floor(w.tick / TICKS_PER_DAY) + 1, text: w.text })),
    log: st.log.slice(-8).map((e) => ({ day: e.day, text: e.text })),
  };
}

/** The year's intrigue, for the chronicle. */
export function intrigueYearLines(s: GameState, since: number): string[] {
  const st = s.intrigue;
  if (!st || off(s)) return [];
  const lines = st.log.filter((e) => e.tick >= since).map((e) => e.text);
  return lines.length > 4 ? [...lines.slice(0, 2), ...lines.slice(-2)] : lines;
}

