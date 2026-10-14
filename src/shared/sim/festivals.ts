// Seasonal festivals (data/festivals.ts): each season the town keeps its people's festival by itself. From
// PREP_DAYS before its day the town makes ready: its food and ware are ordered at the fire (sim/crafting.ts; the
// planner gathers their makings like any order's) and the spot is dressed. On the day travellers come in for it, and at
// FESTIVAL_HOUR the town gathers round the fire (a gathering of kind `festival`, sim/ceremonies.ts: everyone dances)
// with what it made: the food is shared, the wares sold to the visitors. Over, it leaves the spirits lifted, a boon for a
// few days and its god pleased, the more the readier it was. If the stores can't spare the food it is skipped, and the
// town and its god are sore. Off with the autopilot, like the events; the visitors' rolls are a side stream of its own.

import { FESTIVAL_DAY, FESTIVAL_FAVOUR, FESTIVAL_FOOD, FESTIVAL_FOOD_DAYS, FESTIVAL_HOUR, FESTIVAL_HOURS, FESTIVAL_LATEST, FESTIVAL_MARK, BOON_HOURS, FOOD_LEAST, MAKE_MOST, PER_PEOPLE, PREP_DAYS, SKIPPED_FAVOUR, SKIPPED_MARK, VISIT_MULT, VISIT_PEOPLE, WARE_LEAST, WARE_PRICE, FESTIVALS, FESTIVAL_BY_ID, festivalFor, foodId, wareId, type FestivalDef } from '../data/festivals';
import { FAVOUR_MOST } from '../data/gods';
import { PURSE_SCALE } from '../data/shop';
import { Rng, hashSeed } from '../rng';
import { eatFeast, foodDays, gather, here } from './ceremonies';
import { queueCraft, reduceCraft } from './crafting';
import { faithOf, godOf } from './faith';
import { isChild } from './social';
import { spawnBand } from './bands';
import { campXY, earn, eatersOf, notify, tireless, type GameState } from './state';
import { calendar, DAYS_PER_SEASON, SEASONS, TICKS_PER_HOUR, type Season } from './time';

export type FestivalPhase = 'prep' | 'day' | 'held' | 'done';
export type FestivalOutcome = 'held' | 'poor' | 'skipped' | 'missed';

/** The season's festival: being made ready, held, or over. */
export interface FestivalRun {
  id: string;
  /** Its year and season (`${year}:${season}`): one a season. */
  key: string;
  phase: FestivalPhase;
  since: number;
  /** How many of its food and ware the town wants made. */
  foodWant: number;
  wareWant: number;
  /** Visitors have come for it. */
  visitors?: boolean;
  /** How ready it was when held (0..1: the share of its food and ware made). */
  ready?: number;
}

export interface FestivalLogEntry {
  id: string;
  year: number;
  outcome: FestivalOutcome;
  ready: number;
  coins: number;
  tick: number;
}

const LOG_MOST = 16;

/** The town's festival this season. */
export const thisFestival = (s: GameState): FestivalDef => festivalFor(s.origin, calendar(s.tick).season);
const keyOf = (s: GameState) => {
  const c = calendar(s.tick);
  return `${c.year}:${c.season}`;
};

/** Making ready, or the day itself (the festival-only events come then). */
export const festivalSoon = (s: GameState) => !!s.festival && (s.festival.phase === 'prep' || s.festival.phase === 'day') && s.festival.key === keyOf(s);

/** How many of each to make: a few, more in a bigger town. */
function wants(s: GameState): [number, number] {
  const n = s.people.filter((p) => !isChild(p)).length;
  const more = Math.floor(n / PER_PEOPLE);
  return [Math.min(MAKE_MOST, FOOD_LEAST + more), Math.min(MAKE_MOST, WARE_LEAST + more)];
}

const have = (s: GameState, id: string) => s.items[id] ?? 0;
const ordered = (s: GameState, id: string) => s.crafting.filter((o) => o.item === id).reduce((n, o) => n + o.count, 0);

/** Order what's still wanted at the fire (as many as are short, made and ordered counted). */
function orderMakings(s: GameState, f: FestivalDef, run: FestivalRun): void {
  for (const [id, want] of [[foodId(f), run.foodWant], [wareId(f), run.wareWant]] as [string, number][]) {
    for (let k = have(s, id) + ordered(s, id); k < want; k++) if (!queueCraft(s, id).ok) break;
  }
}

/** Drop the orders still waiting (the festival is over or skipped): what was brought for them goes back to the stores. */
function dropOrders(s: GameState, f: FestivalDef): void {
  for (const o of [...s.crafting]) if (o.item === foodId(f) || o.item === wareId(f)) reduceCraft(s, o.id, true);
}

function log(s: GameState, f: FestivalDef, outcome: FestivalOutcome, ready: number, coins: number): void {
  const year = calendar(s.tick).year;
  const l = (s.festivalLog ??= []);
  l.push({ id: f.id, year, outcome, ready, coins, tick: s.tick });
  if (l.length > LOG_MOST) l.splice(0, l.length - LOG_MOST);
}

const mark = (s: GameState, lever: string, value: number, hours: number, text: string) => (s.marks ??= []).push({ lever, value, until: s.tick + hours * TICKS_PER_HOUR, text });
function favour(s: GameState, f: FestivalDef, by: number): void {
  const fav = faithOf(s).favour;
  fav[f.god] = Math.max(-FAVOUR_MOST, Math.min(FAVOUR_MOST, Math.round((fav[f.god] ?? 0) + by)));
}

/** Once an hour (from sim.ts): the making ready, the visitors, the festival itself. */
export function festivalsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  const cal = calendar(s.tick);
  const f = thisFestival(s);
  const key = keyOf(s);
  let run = s.festival;
  // (a festival of a season gone by that never came to its end: it was missed)
  if (run && run.key !== key) {
    const old = FESTIVAL_BY_ID[run.id];
    if (old && (run.phase === 'prep' || run.phase === 'day')) {
      dropOrders(s, old);
      log(s, old, 'missed', 0, 0);
    }
    s.festival = run = undefined;
  }
  const day = cal.dayOfSeason;
  if (!run) {
    if (day < FESTIVAL_DAY - PREP_DAYS || day > FESTIVAL_DAY || cal.hour < 6) return;
    const [foodWant, wareWant] = wants(s);
    run = s.festival = { id: f.id, key, phase: 'prep', since: s.tick, foodWant, wareWant };
    orderMakings(s, f, run);
    notify(s, day === FESTIVAL_DAY ? `${f.name} is today: the town hurries to make ready.` : `${f.name} comes in ${FESTIVAL_DAY - day} days. The town makes ready: ${f.food.name.toLowerCase()} and ${f.ware.name.toLowerCase()} at the fire, and the spot dressed.`, true);
    return;
  }
  if (run.phase === 'held' || run.phase === 'done') return;
  // (each morning, what's still short is ordered again: an order dropped for want of its makings)
  if (cal.hour === 6) orderMakings(s, f, run);
  if (day < FESTIVAL_DAY) return;
  if (day > FESTIVAL_DAY) return missed(s, f, run, 'the day went by');
  run.phase = 'day';
  // (visitors come in for it in the morning, and the roads are busy till it's over)
  if (!run.visitors && cal.hour >= 9) {
    run.visitors = true;
    mark(s, 'travellers', VISIT_MULT, 24 - cal.hour, `Travellers come for ${f.name}`);
    if (s.people.filter((p) => !isChild(p)).length >= VISIT_PEOPLE && !s.raid) {
      const rng = new Rng(hashSeed(`${s.seed}:festivals:${s.tick}`));
      spawnBand(s, rng, 'travellers', rng.chance(0.5) ? -1 : 1, `{n} travellers come into town for ${f.name}.`);
    }
  }
  if (cal.hour < FESTIVAL_HOUR) return;
  if (cal.hour > FESTIVAL_LATEST) return missed(s, f, run, s.raid ? 'raiders kept the town from it' : 'the day ran out');
  if (s.gathering || s.raid) return;
  hold(s, f, run);
}

function missed(s: GameState, f: FestivalDef, run: FestivalRun, why: string): void {
  run.phase = 'done';
  dropOrders(s, f);
  log(s, f, 'missed', 0, 0);
  notify(s, `${f.name} was missed this year: ${why}.`, true);
}

/** The festival is held, or skipped for want of food. */
function hold(s: GameState, f: FestivalDef, run: FestivalRun): void {
  const all = here(s);
  const mouths = all.filter((p) => !tireless(p)).length;
  if (mouths && foodDays(s) - (FESTIVAL_FOOD * mouths) / Math.max(1, eatersOf(s)) < FESTIVAL_FOOD_DAYS) {
    run.phase = 'done';
    dropOrders(s, f);
    mark(s, 'morale', SKIPPED_MARK[0], SKIPPED_MARK[1], `No ${f.name} this year`);
    favour(s, f, -SKIPPED_FAVOUR);
    log(s, f, 'skipped', 0, 0);
    notify(s, `${f.name} is skipped: the stores can't spare the food. The town is sore, and the gods have noticed.`, true);
    return;
  }
  if (!all.length) return;
  eatFeast(s, mouths);
  // (what was made is set out: the food shared, the wares sold to whoever came)
  const food = Math.min(run.foodWant, have(s, foodId(f)));
  const ware = Math.min(run.wareWant, have(s, wareId(f)));
  if (food) s.items[foodId(f)] = have(s, foodId(f)) - food;
  if (ware) s.items[wareId(f)] = have(s, wareId(f)) - ware;
  const ready = (food / Math.max(1, run.foodWant) + ware / Math.max(1, run.wareWant)) / 2;
  const coins = Math.round(ware * WARE_PRICE * PURSE_SCALE[s.era] * (run.visitors ? 1 : 0.5));
  if (coins) {
    s.coins = (s.coins ?? 0) + coins;
    earn(s, 'events', coins);
  }
  dropOrders(s, f);
  run.phase = 'held';
  run.ready = ready;
  const at = campXY(s);
  gather(s, 'festival', all.map((p) => p.id), FESTIVAL_HOURS, f.doing, at);
  s.gathering!.festival = f.id;
  log(s, f, ready >= 0.5 ? 'held' : 'poor', ready, coins);
  notify(s, ready >= 1 ? `${f.name}! The town gathers round the fire with ${f.food.name.toLowerCase()} and ${f.ware.name.toLowerCase()}${coins ? `; the visitors pay ${coins} coins for the wares` : ''}.` : ready > 0 ? `${f.name}, with what the town could make ready${coins ? `; the visitors pay ${coins} coins` : ''}.` : `${f.name}, kept plainly: nothing was made ready in time.`, true);
}

/** The festival is over (from ceremonies.ts `endGathering`): what it leaves. */
export function festivalOver(s: GameState, g: NonNullable<GameState['gathering']>): void {
  const f = FESTIVAL_BY_ID[g.festival ?? ''] ?? thisFestival(s);
  const run = s.festival?.id === f.id ? s.festival : undefined;
  const ready = run?.ready ?? 0;
  const k = 0.5 + 0.5 * ready;
  mark(s, 'morale', Math.round(FESTIVAL_MARK[0] * k), FESTIVAL_MARK[1], f.name);
  mark(s, f.boon.lever, 1 + (f.boon.mult - 1) * k, BOON_HOURS, f.boon.text);
  favour(s, f, FESTIVAL_FAVOUR * k);
  if (run) run.phase = 'done';
  notify(s, `${f.name} is over. ${f.boon.text}.`);
}

/* ------------------------------------------------------------ what the menus see */

export interface FestivalCalendarRow {
  id: string;
  name: string;
  season: Season;
  day: number;
  lore: string;
  food: string;
  ware: string;
  god: string;
  boon: string;
  song: string;
  /** How it went last time it came, if it has. */
  last?: { outcome: FestivalOutcome; year: number; coins: number };
}

export interface FestivalsView {
  calendar: FestivalCalendarRow[];
  /** The next (or the one under way): days till it, its phase, and what's made of what's wanted. */
  next: { id: string; name: string; days: number; phase: FestivalPhase | 'coming'; food: [number, number]; ware: [number, number]; prepIn: number };
  /** Under way now (the map dresses for it from the making ready; the music plays its song at the gathering). */
  on: { id: string; phase: FestivalPhase; x: number; y: number } | null;
}

/** For the snapshot: the year's calendar and what's next. */
export function festivalsView(s: GameState): FestivalsView {
  const cal = calendar(s.tick);
  const origin = s.origin ?? 'settlers';
  const lastOf = (id: string) => [...(s.festivalLog ?? [])].reverse().find((e) => e.id === id);
  const rows = FESTIVALS.filter((f) => f.origin === origin).map((f): FestivalCalendarRow => {
    const l = lastOf(f.id);
    return { id: f.id, name: f.name, season: f.season, day: FESTIVAL_DAY, lore: f.lore, food: f.food.name, ware: f.ware.name, god: godOf(s, f.god).join(', '), boon: f.boon.text, song: f.song.name, last: l ? { outcome: l.outcome, year: l.year, coins: l.coins } : undefined };
  });
  const run = s.festival && s.festival.key === keyOf(s) ? s.festival : undefined;
  // (the next: this season's, unless it's done, then the next season's)
  const si = SEASONS.indexOf(cal.season);
  const passed = !!run && (run.phase === 'held' || run.phase === 'done') || cal.dayOfSeason > FESTIVAL_DAY;
  const f = passed ? festivalFor(origin, SEASONS[(si + 1) % SEASONS.length]) : thisFestival(s);
  const toDay = passed ? DAYS_PER_SEASON - cal.dayOfSeason + FESTIVAL_DAY : FESTIVAL_DAY - cal.dayOfSeason;
  const [fw, ww] = run && !passed ? [run.foodWant, run.wareWant] : wants(s);
  return {
    calendar: rows,
    next: {
      id: f.id,
      name: f.name,
      days: toDay,
      phase: run && !passed ? run.phase : 'coming',
      food: [Math.min(fw, have(s, foodId(f))), fw],
      ware: [Math.min(ww, have(s, wareId(f))), ww],
      prepIn: Math.max(0, toDay - PREP_DAYS),
    },
    on: run && run.phase !== 'done' ? { id: run.id, phase: run.phase, ...campXY(s) } : s.gathering?.kind === 'festival' && s.gathering.festival ? { id: s.gathering.festival, phase: 'held', x: s.gathering.x, y: s.gathering.y } : null,
  };
}

/** For previews (`__festival` on the phone page): the season's festival made ready now, or held now. */
export function previewFestival(s: GameState, now: 'prep' | 'hold' = 'hold'): void {
  const f = thisFestival(s);
  const [foodWant, wareWant] = wants(s);
  const run: FestivalRun = (s.festival = { id: f.id, key: keyOf(s), phase: 'prep', since: s.tick, foodWant, wareWant });
  if (now === 'prep') return orderMakings(s, f, run);
  s.items[foodId(f)] = foodWant;
  s.items[wareId(f)] = wareWant;
  run.visitors = true;
  s.gathering = undefined;
  // (food enough for it, so the preview shows the festival held)
  const st = s.buildings.find((b) => b.def === 'stockpile' && b.status === 'done') ?? s.buildings.find((b) => b.store);
  if (st) st.store = { ...st.store, berries: (st.store?.berries ?? 0) + 40 };
  hold(s, f, run);
}
