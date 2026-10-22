// The town's calendar (the owner's aim: something to look forward to): the coming days and what the town already knows
// of them. The season's festival (sim/festivals.ts), the first day of the next season, the weekly rite for the gods
// (sim/faith.ts), the caravan expected at the market (sim/trade.ts), the Guild's hunts closing (sim/hunts.ts), and omens:
// a seer in the town (a priest, a shaman, a witch, a druid, a timekeeper; the Fate-touched above all, data/mythic.ts)
// now and then marks a day with a vague omen that may or may not come true, and the favourites' name-days
// (sim/favourites.ts `nameDays`). Other systems may add their own dates with `addCalendarSource`. Reads the state
// only: the omens are a side stream by the season (`${seed}:omen:<season>:<seer>`), so they hold all season and the
// town's own rolls are untouched.

import { Rng, hashSeed } from '../rng';
import { FESTIVAL_DAY, festivalFor } from '../data/festivals';
import { FAITH_HOUR, RITE_EVERY_DAYS, WORSHIP } from '../data/gods';
import { QUARRY_BY_ID } from '../data/hunts';
import { MYTHIC_CALLINGS, mythicNodes } from '../data/mythic';
import { nameDays } from './favourites';
import type { GameState, Person } from './state';
import { DAYS_PER_SEASON, SEASONS, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR, type Season, calendarOf } from './time';

export type CalendarKind = 'festival' | 'season' | 'rite' | 'caravan' | 'hunt' | 'omen' | 'name-day' | 'other';

export interface CalendarEntry {
  /** The day (as the top bar counts them: Day 1 is the first). */
  day: number;
  kind: CalendarKind;
  text: string;
  /** A guess, not a date the town keeps (an omen): it may not come true. */
  guess?: boolean;
}

export interface CalendarDay {
  day: number;
  season: Season;
  dayOfSeason: number;
  today: boolean;
  entries: CalendarEntry[];
}

/** How many days the strip shows, today first (a season's length). */
export const CALENDAR_DAYS = DAYS_PER_SEASON;
/** The callings that read omens (a seer's chance a season), and the Fate-touched's surer hand. */
export const SEER_CLASSES = ['white_mage', 'shaman', 'witch', 'druid', 'chronomancer'] as const;
export const OMEN_CHANCE = 0.5;
export const FATE_OMEN_CHANCE = 0.9;
/** At most this many omens a season, however many seers. */
export const OMENS_MOST = 2;

/** A source of dates from another system: the entries it knows of from day `from` to `to` (inclusive). */
export type CalendarSource = (s: GameState, from: number, to: number) => CalendarEntry[];
const SOURCES = new Map<string, CalendarSource>();
/** Another system's dates on the calendar (by an id, so adding it again replaces it). */
export function addCalendarSource(id: string, source: CalendarSource): void {
  SOURCES.set(id, source);
}

const OMENS: readonly { text: (who: string) => string; tone: 'ill' | 'fair' }[] = [
  { text: (w) => `${w} saw ravens circling the well: ill luck`, tone: 'ill' },
  { text: (w) => `${w} dreamt of a red moon: blood will be spilt`, tone: 'ill' },
  { text: (w) => `${w} found a cracked egg on the step: a loss`, tone: 'ill' },
  { text: (w) => `${w} heard bells where there are none: a stranger comes`, tone: 'fair' },
  { text: (w) => `${w} read a fair wind in the smoke: good fortune`, tone: 'fair' },
  { text: (w) => `${w} saw a white hart at the edge of the wood: a blessing`, tone: 'fair' },
  { text: (w) => `${w} says the bees are restless: news from afar`, tone: 'fair' },
  { text: (w) => `${w} cast the bones and would not say what they showed`, tone: 'ill' },
];

const FATE_ROADS = new Set((MYTHIC_CALLINGS.find((t) => t.base.id === 'fate_touched') ? mythicNodes(MYTHIC_CALLINGS.find((t) => t.base.id === 'fate_touched')!) : []).map(([id]) => id));
export const fateTouched = (p: Person) => !!p.road && FATE_ROADS.has(p.road);
const seerOf = (p: Person) => fateTouched(p) || (!!p.cls && (SEER_CLASSES as readonly string[]).includes(p.cls));

/** The day index (from 0) of a tick, as `calendar` counts it. */
const dayIdx = (tick: number) => Math.floor((tick + START_HOUR * TICKS_PER_HOUR) / TICKS_PER_DAY);
const seasonOfIdx = (idx: number) => Math.floor(idx / DAYS_PER_SEASON);

/** The omens the town's seers read for a season (by its index from the first): a day of it each, vague. */
export function omensFor(s: GameState, seasonIdx: number): CalendarEntry[] {
  if (s.autopilot === false) return [];
  const seers = s.people.filter((p) => p.away === null && seerOf(p)).sort((a, b) => Number(fateTouched(b)) - Number(fateTouched(a)) || a.id - b.id);
  const out: CalendarEntry[] = [];
  for (const p of seers) {
    if (out.length >= OMENS_MOST) break;
    const r = new Rng(hashSeed(`${s.seed}:omen:${seasonIdx}:${p.id}`));
    if (!r.chance(fateTouched(p) ? FATE_OMEN_CHANCE : OMEN_CHANCE)) continue;
    const day = seasonIdx * DAYS_PER_SEASON + r.int(1, DAYS_PER_SEASON - 1) + 1;
    if (out.some((o) => o.day === day)) continue;
    out.push({ day, kind: 'omen', text: `${r.pick(OMENS).text(p.name)}.`, guess: true });
  }
  return out;
}

/** What the town knows of the coming days, today first. */
export function upcoming(s: GameState, days = CALENDAR_DAYS): CalendarDay[] {
  const today = dayIdx(s.tick);
  const last = today + days - 1;
  const entries: CalendarEntry[] = [];
  const cal = calendarOf(s);
  const auto = s.autopilot !== false;
  const names = nameDays(s);
  for (let idx = today; idx < today + days; idx++) {
    const season = SEASONS[seasonOfIdx(idx) % SEASONS.length];
    const ofSeason = (idx % DAYS_PER_SEASON) + 1;
    // the first day of a season, and its festival (kept only with the autopilot)
    if (ofSeason === 1 && idx > today) entries.push({ day: idx + 1, kind: 'season', text: `The first day of ${season}` });
    // the favourites' name-days (sim/favourites.ts)
    for (const n of names) if (n.season === season && n.day === ofSeason) entries.push({ day: idx + 1, kind: 'name-day', text: `${n.name}'s name-day` });
    if (auto && ofSeason === FESTIVAL_DAY && !(idx === today && s.festival?.phase === 'done')) entries.push({ day: idx + 1, kind: 'festival', text: festivalFor(s.origin, season).name });
  }
  // the weekly rite, wherever there's a shrine to keep it at
  const worship = s.buildings.some((b) => b.status === 'done' && WORSHIP[b.def]);
  if (auto && worship) {
    const faithDay = Math.floor(s.tick / TICKS_PER_DAY);
    let next = (s.faith?.lastRite ?? -RITE_EVERY_DAYS) + RITE_EVERY_DAYS;
    if (next < faithDay || (next === faithDay && cal.hour >= FAITH_HOUR)) next = faithDay + (cal.hour >= FAITH_HOUR ? 1 : 0);
    for (let d = next; d <= last; d += RITE_EVERY_DAYS) entries.push({ day: d + 1, kind: 'rite', text: 'The rite for the gods' });
  }
  // the caravan expected at the market
  if (s.buildings.some((b) => b.def === 'market' && b.status === 'done') && !s.caravan && s.nextCaravanTick > s.tick) entries.push({ day: dayIdx(s.nextCaravanTick) + 1, kind: 'caravan', text: 'A caravan is expected at the market' });
  // the Guild's hunts: an offer lapsing, or an accepted hunt's time running out
  for (const h of s.hunts ?? []) {
    const name = QUARRY_BY_ID[h.quarry]?.name ?? 'a monster';
    entries.push({ day: dayIdx(h.until) + 1, kind: 'hunt', text: h.accepted !== undefined ? `The hunt for ${name} must be done` : `The Guild's offer on ${name} lapses` });
  }
  // the seers' omens, this season and the next
  for (const si of new Set([seasonOfIdx(today), seasonOfIdx(last)])) entries.push(...omensFor(s, si));
  // what other systems add
  for (const src of SOURCES.values()) entries.push(...src(s, today + 1, last + 1));
  const out: CalendarDay[] = [];
  for (let idx = today; idx < today + days; idx++) {
    const day = idx + 1;
    out.push({
      day,
      season: SEASONS[seasonOfIdx(idx) % SEASONS.length],
      dayOfSeason: (idx % DAYS_PER_SEASON) + 1,
      today: idx === today,
      entries: entries.filter((e) => e.day === day),
    });
  }
  return out;
}
