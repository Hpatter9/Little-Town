// Town personality and culture (the owner's ask: over months the town grows its own customs, drawn from what happened to
// it, and it shows; data/culture.ts). Once a day the town's history is read as signals (hunger, a raid won, a long
// peace, the sea...); each trait gains strength from its signal and fades by DECAY a day. At WIN a trait is taken up
// (the town holds HELD_MOST at once; a stronger newcomer displaces the weakest) and below LOSE it is let go. A held
// trait shows: its custom (a day in its season, with its dish ordered at the fire beforehand, the town lifted when it is
// kept), its sayings, song, colour and prop (the renderer reads them from `cultureView`), visitors' remarks in the
// journal, and, for some, a fashion in the children's names (`fashionName`). Off with the autopilot; its rolls come from
// a side stream of its own ('culture'), and it draws nothing from the town's stream.

import { CULTURE_FROM_DAY, DISH_FOOD_DAYS, CULTURE_TRAITS, CUSTOM_DAY, CUSTOM_HOUR, CUSTOM_MARK, DECAY, DISH_MARK, DISH_MOST, DISPLACE, FASHION_SHARE, HELD_MOST, LOSE, REMARK_DAYS, STRENGTH_MOST, TRAIT_BY_ID, WIN, dishId, type CultureSignal, type CultureTrait, type Fashion } from '../data/culture';
import { ALIGN_SAYINGS, alignTone } from '../data/alignment';
import { DOMAINS } from '../data/gods';
import type { Topic } from '../data/natures';
import { Rng, hashSeed } from '../rng';
import { eatFeast, foodDays, here } from './ceremonies';
import { reduceCraft } from './crafting';
import { godOf } from './faith';
import { isChild } from './social';
import { campXY, notify, tireless, type GameState } from './state';
import { seaTown } from './sea';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** What was last read, so each day counts only what is new. */
export interface CultureSeen {
  fallen: string;
  came: number;
  won: number;
  pillaged: number;
  research: number;
  festTick: number;
}

export interface CultureState {
  strength: Record<string, number>;
  held: string[];
  /** The tick each held trait was taken up. */
  since: Record<string, number>;
  seen: CultureSeen;
  lastRaid: number;
  /** The customs kept this year (`${year}:${trait}`), so each is kept once. */
  kept: string[];
  fashion?: Fashion;
  remarkAt: number;
  log: { tick: number; text: string }[];
}

const LOG_MOST = 20;
const OLD_AGE = 'full of days';
const HOUR_READ = 5;

export const cultureOf = (s: GameState): CultureState => (s.culture ??= { strength: {}, held: [], since: {}, seen: { fallen: '', came: 0, won: 0, pillaged: 0, research: 0, festTick: 0 }, lastRaid: s.tick, kept: [], remarkAt: s.tick, log: [] });
const say = (c: CultureState, tick: number, text: string) => {
  c.log.push({ tick, text });
  if (c.log.length > LOG_MOST) c.log.splice(0, c.log.length - LOG_MOST);
};

/** Today's reading of the town's history: how much of each signal happened since it was last read. */
export function readSignals(s: GameState): Record<CultureSignal, number> {
  const c = cultureOf(s);
  const sig = Object.fromEntries(['hunger', 'plague', 'raidWon', 'raidLost', 'peace', 'sea', 'trade', 'deaths', 'disaster', 'plenty', 'learning', 'festive', 'elders', 'justice', 'war', 'births'].map((k) => [k, 0])) as Record<CultureSignal, number>;
  const fallen = s.fallen ?? [];
  const keyOf = (f: { id: number; day: number }) => `${f.id}:${f.day}`;
  const at = c.seen.fallen ? fallen.map(keyOf).lastIndexOf(c.seen.fallen) : -1;
  const fresh = fallen.slice(at + 1);
  if (fallen.length) c.seen.fallen = keyOf(fallen[fallen.length - 1]);
  for (const f of fresh) {
    if (f.cause.includes('hunger')) sig.hunger += 3;
    else if (f.cause.includes('plague')) sig.plague += 3;
    else if (/flood|earthquake|wildfire|tornado|lightning|storm/.test(f.cause)) sig.disaster += 3;
    else if (f.cause.includes(OLD_AGE)) sig.elders += 2;
    else if (f.cause.includes('hanged')) sig.justice += 3;
    else if (/battle|liege/.test(f.cause)) sig.war += 2;
    if (!f.cause.includes(OLD_AGE)) sig.deaths += 1;
  }
  if (s.people.filter((p) => p.sick).length >= 2) sig.plague += 1;
  const y = s.yearRaids ?? { came: 0, won: 0, pillaged: 0 };
  const delta = (cur: number, prev: number) => (cur >= prev ? cur - prev : cur);
  const came = delta(y.came, c.seen.came);
  sig.raidWon += 4 * delta(y.won, c.seen.won);
  sig.raidLost += 4 * delta(y.pillaged, c.seen.pillaged);
  c.seen.came = y.came;
  c.seen.won = y.won;
  c.seen.pillaged = y.pillaged;
  if (came > 0) c.lastRaid = s.tick;
  else if (s.tick - c.lastRaid >= 6 * TICKS_PER_DAY) sig.peace = 1;
  if (seaTown(s)) sig.sea = 1;
  if ((s.ledger?.yesterday?.trade ?? 0) > 0) sig.trade = 1;
  if (foodDays(s) >= 8) sig.plenty = 1;
  const done = s.research.done.length;
  sig.learning = Math.max(0, done - c.seen.research);
  c.seen.research = done;
  const log = (s.festivalLog ?? []).filter((e) => e.tick > c.seen.festTick && e.outcome !== 'skipped' && e.outcome !== 'missed');
  sig.festive = 3 * log.length;
  c.seen.festTick = s.tick;
  sig.births = 2 * s.people.filter((p) => isChild(p) && s.tick - p.bornTick! < TICKS_PER_DAY).length;
  return sig;
}

/** One day: strengths gain and fade, traits are taken up and let go. */
export function cultureDaily(s: GameState): void {
  const c = cultureOf(s);
  const sig = readSignals(s);
  for (const t of CULTURE_TRAITS) c.strength[t.id] = Math.min(STRENGTH_MOST, (c.strength[t.id] ?? 0) * DECAY + t.weight * sig[t.signal]);
  for (const id of [...c.held]) {
    if ((c.strength[id] ?? 0) >= LOSE) continue;
    c.held.splice(c.held.indexOf(id), 1);
    delete c.since[id];
    say(c, s.tick, `The ${TRAIT_BY_ID[id].name} ways fade.`);
    notify(s, `${TRAIT_BY_ID[id].name}: the town's old ways of this are fading, and fewer keep them.`, true);
  }
  const wanting = CULTURE_TRAITS.filter((t) => !c.held.includes(t.id) && (c.strength[t.id] ?? 0) >= WIN).sort((a, b) => c.strength[b.id] - c.strength[a.id]);
  for (const t of wanting) {
    if (c.held.length >= HELD_MOST) {
      const weak = c.held.reduce((w, id) => (c.strength[id] < c.strength[w] ? id : w));
      if (c.strength[t.id] < c.strength[weak] + DISPLACE) continue;
      c.held.splice(c.held.indexOf(weak), 1);
      delete c.since[weak];
      say(c, s.tick, `${TRAIT_BY_ID[weak].name} give way to ${t.name}.`);
    }
    c.held.push(t.id);
    c.since[t.id] = s.tick;
    say(c, s.tick, `The town takes up the ways of the ${t.name}.`);
    notify(s, `The town has grown its own ways: ${t.name}. ${t.cause} ${t.custom.name} will be kept in ${t.custom.season}.`, true);
  }
  c.held.sort((a, b) => c.strength[b] - c.strength[a]);
  c.fashion = c.held.map((id) => TRAIT_BY_ID[id].fashion).find((f) => !!f);
}

const have = (s: GameState, id: string) => s.items[id] ?? 0;
const dishWant = (s: GameState) => Math.min(DISH_MOST, 2 + Math.floor(s.people.filter((p) => !isChild(p)).length / 8));

/** Each hour: a held trait's dish is ordered at the fire in its season's first days, and its custom kept on its day. */
function customsHourly(s: GameState): void {
  const c = cultureOf(s);
  const cal = calendar(s.tick);
  for (const id of c.held) {
    const t = TRAIT_BY_ID[id];
    if (t.custom.season !== cal.season) continue;
    const key = `${cal.year}:${t.id}`;
    if (c.kept.includes(key)) continue;
    const dish = dishId(t);
    if (cal.dayOfSeason < CUSTOM_DAY || (cal.dayOfSeason === CUSTOM_DAY && cal.hour < CUSTOM_HOUR)) {
      // (the dish is ordered only when the larder can spare it)
      if (cal.hour !== 6 || foodDays(s) < DISH_FOOD_DAYS) continue;
      const short = dishWant(s) - have(s, dish) - s.crafting.filter((o) => o.item === dish).reduce((n, o) => n + o.count, 0);
      if (short > 0) s.crafting.push({ id: s.nextId++, item: dish, count: short, delivered: {}, itemsTaken: false, progress: 0, made: 0 });
      continue;
    }
    if (cal.dayOfSeason > CUSTOM_DAY || cal.hour > 22) {
      c.kept.push(key); // (missed: the year went by)
      for (const o of [...s.crafting]) if (o.item === dish) reduceCraft(s, o.id, true);
      continue;
    }
    if (s.gathering || s.raid) continue;
    const all = here(s);
    if (!all.length) continue;
    const want = dishWant(s);
    const made = Math.min(want, have(s, dish));
    if (made) s.items[dish] = have(s, dish) - made;
    for (const o of [...s.crafting]) if (o.item === dish) reduceCraft(s, o.id, true);
    eatFeast(s, Math.round(all.filter((p) => !tireless(p)).length * 0.25));
    const lift = Math.round(CUSTOM_MARK[0] + DISH_MARK * (made / want));
    (s.marks ??= []).push({ lever: 'morale', value: lift, until: s.tick + CUSTOM_MARK[1] * TICKS_PER_HOUR, text: t.custom.name });
    c.kept.push(key);
    if (c.kept.length > 24) c.kept.splice(0, c.kept.length - 24);
    say(c, s.tick, `${t.custom.name} was kept${made ? `, with ${t.dish.name.toLowerCase()}` : ''}.`);
    notify(s, `${t.custom.name}: ${t.custom.text}${made ? ` ${t.dish.name} is shared.` : ''}`, true);
  }
}

/** Visitors remark on the town's ways, now and then, while a band is by. */
function remarksHourly(s: GameState): void {
  const c = cultureOf(s);
  if (!c.held.length || !(s.bands ?? []).length || s.tick - c.remarkAt < REMARK_DAYS * TICKS_PER_DAY) return;
  const rng = new Rng(hashSeed(`${s.seed}:culture:${s.tick}`));
  c.remarkAt = s.tick;
  notify(s, TRAIT_BY_ID[rng.pick(c.held)].remark, true);
}

/** From sim.ts, every tick: the daily reading, the customs, the remarks. */
export function cultureHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  const cal = calendar(s.tick);
  // (a town has no ways of its own in its first days: culture comes of months of history)
  if (cal.day < CULTURE_FROM_DAY) return;
  if (cal.hour === HOUR_READ) cultureDaily(s);
  if (!s.culture?.held.length) return;
  customsHourly(s);
  remarksHourly(s);
}

/** A child's name, leaning to the town's fashion (the fallen's names, a hero's, a god's) when it has one: the name the
 *  town's own stream picked stands unless the fashion has a free name to give. Uses a side stream. */
export function fashionName(s: GameState, base: string, taken: readonly string[]): string {
  const f = s.culture?.fashion;
  if (!f || s.autopilot === false) return base;
  const rng = new Rng(hashSeed(`${s.seed}:culture-name:${s.tick}`));
  if (!rng.chance(FASHION_SHARE)) return base;
  const fallen = s.fallen ?? [];
  const pool = f === 'fallen' ? fallen.slice(-30).map((x) => x.name) : f === 'heroes' ? fallen.filter((x) => x.titles.length || x.felled >= 3 || x.founder).map((x) => x.name) : DOMAINS.map((d) => godOf(s, d)[0]);
  const free = [...new Set(pool.map((n) => n.split(' ')[0]))].filter((n) => n && !taken.includes(n));
  return free.length ? rng.pick(free) : base;
}

/* ------------------------------------------------------------ what the menus and the map see */

export interface CultureTraitRow {
  id: string;
  name: string;
  cause: string;
  strength: number;
  custom: string;
  customText: string;
  season: string;
  dish: string;
  dishText: string;
  saying: string;
  prop: string;
  sign: string;
  since: number;
}

export interface CultureView {
  held: CultureTraitRow[];
  /** Rising: strength 0..WIN, not yet held. */
  rising: { id: string; name: string; strength: number }[];
  fashion: Fashion | null;
  /** The sign above the tavern door. */
  tavern: string | null;
  log: { tick: number; text: string }[];
  /** For the map: the sayings by topic, the pennant colour, the prop kit, the festival song's mode and lead. */
  sayings: Partial<Record<Topic, string[]>>;
  colour: number | null;
  kit: CultureTrait['kit'] | null;
  song: CultureTrait['song'] | null;
  /** Where the prop stands (by the camp). */
  at: { x: number; y: number } | null;
}

export function cultureView(s: GameState): CultureView {
  const c = s.culture;
  const held = (c?.held ?? []).map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  const sayings: Partial<Record<Topic, string[]>> = {};
  for (const t of held) for (const [k, v] of Object.entries(t.saying)) (sayings[k as Topic] ??= []).push(...v!);
  // (a town of the light or the dark says so now and then: data/alignment.ts)
  const tone = alignTone(s.align?.score ?? 0);
  if (tone) for (const [k, v] of Object.entries(ALIGN_SAYINGS[tone])) (sayings[k as Topic] ??= []).push(...v!);
  const lead = held[0];
  return {
    held: held.map((t) => ({ id: t.id, name: t.name, cause: t.cause, strength: Math.round(c!.strength[t.id] ?? 0), custom: t.custom.name, customText: t.custom.text, season: t.custom.season, dish: t.dish.name, dishText: t.dish.text, saying: Object.values(t.saying)[0]?.[0] ?? '', prop: t.prop, sign: t.sign, since: c!.since[t.id] ?? 0 })),
    rising: CULTURE_TRAITS.filter((t) => !c?.held.includes(t.id) && (c?.strength[t.id] ?? 0) >= 3).map((t) => ({ id: t.id, name: t.name, strength: Math.round(c!.strength[t.id]) })).sort((a, b) => b.strength - a.strength).slice(0, 4),
    fashion: c?.fashion ?? null,
    tavern: lead ? lead.sign : null,
    log: (c?.log ?? []).slice(-8),
    sayings,
    colour: lead?.colour ?? null,
    kit: lead?.kit ?? null,
    song: lead?.song ?? null,
    at: lead ? campXY(s) : null,
  };
}
