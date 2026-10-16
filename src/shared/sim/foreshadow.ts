// Foreshadowing (the owner's aim: the player puts the phone down knowing something is about to happen). A look at what
// the town already has coming or brewing, put as a few short hints in the town's voice: campfires seen with a raid near,
// a party due home, a couple clearing a corner for a cradle, something stirring in the depths, an envoy on the road, the
// season turning, the festival coming, a cough going round, the stores thin, a caravan's dust. Each has a horizon (game
// hours) and how sure it is (`sure`, 0..1): a true hint is now and then left unsaid, and some hints are false alarms
// (campfires with no raid coming, riders who never come), so the player can't be certain. The text holds no numbers.
// Reads the state only, and keeps nothing: the rolls are a side stream by the day (`${seed}:foreshadow:<day>:<key>`),
// so a hint holds all day and the town's own stream is untouched. Off with the autopilot, like the other new systems.

import { Rng, hashSeed } from '../rng';
import { DEPTH_BY_N } from '../data/underdark';
import { FACTION_BY_ID } from '../data/factions';
import { FESTIVAL_DAY, FESTIVAL_HOUR, festivalFor } from '../data/festivals';
import { FOOD_VALUE } from '../data/people';
import { MARRY, MAX_CHILDREN } from '../data/social';
import { totalStock } from './buildings';
import { destinationOf } from './expeditions';
import { tireless, type GameState, type Person } from './state';
import { calendar, DAYS_PER_SEASON, SEASONS, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export type HintKind = 'raid' | 'party' | 'birth' | 'wedding' | 'trial' | 'dweller' | 'envoy' | 'season' | 'festival' | 'sickness' | 'stores' | 'caravan';

export interface Hint {
  /** Stable while the thing it's about lasts (the news bubble counts it as new once). */
  key: string;
  kind: HintKind;
  text: string;
  /** Game hours until it's due (0: now). */
  hours: number;
  /** How likely it is to come true, 0..1 (a false alarm is low). Never shown as a number. */
  sure: number;
  /** A false alarm: nothing is behind it (the tests read it; the player never sees it). */
  false?: boolean;
}

/** The most hints at once (the nearest first). */
export const HINTS_MOST = 4;
/** How far ahead the scouts see a raid, a party's dust, a caravan (game hours). */
export const RAID_SEEN_HOURS = 12;
export const PARTY_SEEN_HOURS = 24;
export const CARAVAN_SEEN_HOURS = 12;
/** A true hint is spoken on this share of days (some go unsaid). */
export const VOICED = 0.85;
/** The chance, a day, of a false alarm: campfires with no raid coming (only while the next raid is far off). */
export const FALSE_RAID = 0.12;
export const FALSE_RAID_CLEAR_HOURS = 36;
/** The chance, a day, of a couple's hopes being spoken of, and of the riders of a known power being seen. */
export const BIRTH_TALK = 0.35;
export const ENVOY_TALK = 0.3;
/** The stores are thin below this many days of food. */
export const STORES_LOW_DAYS = 3;

const DIRS = ['north', 'east', 'south', 'west', 'north-east', 'south-east', 'south-west', 'north-west'] as const;

/** Words for a horizon, no numbers. */
export function whenWords(hours: number): string {
  if (hours < 2) return 'any moment now';
  if (hours < 8) return 'before long';
  if (hours < 20) return 'by tomorrow';
  if (hours < 48) return 'in a day or two';
  return 'before many days are out';
}

const dayOf = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY);
/** The day's roll for one hint (the side stream). */
const rollFor = (s: GameState, key: string) => new Rng(hashSeed(`${s.seed}:foreshadow:${dayOf(s)}:${key}`));
const home = (s: GameState) => s.people.filter((p) => p.away === null);
const byId = (s: GameState, id: number | null | undefined) => (id == null ? undefined : s.people.find((p) => p.id === id));
const opinionOf = (s: GameState, a: number, b: number) => s.relations[a < b ? `${a}-${b}` : `${b}-${a}`] ?? 0;

/** Every hint there is to give now, true ones voiced or not (the tests read this); `foreshadow` is what's said. */
export function hintCandidates(s: GameState): (Hint & { voiced: boolean })[] {
  if (s.autopilot === false || s.gameOver) return [];
  const out: (Hint & { voiced: boolean })[] = [];
  const add = (h: Hint, voiced = rollFor(s, h.key).next() < VOICED || h.sure >= 1) => out.push({ ...h, voiced });
  const cal = calendar(s.tick);
  const hoursTo = (tick: number) => Math.max(0, (tick - s.tick) / TICKS_PER_HOUR);

  // a raid near: campfires seen (and now and then campfires with nobody behind them)
  if (!s.raid) {
    const h = hoursTo(s.nextRaidTick);
    const r = rollFor(s, 'raid');
    const dir = r.pick(DIRS);
    const lines = [`Scouts saw campfires to the ${dir}.`, `Smoke on the ${dir} hills at dusk: someone is camped out there.`, `The dogs won't settle, and keep looking ${dir}.`];
    if (s.nextRaidTick > s.tick && h <= RAID_SEEN_HOURS) add({ key: `raid:${s.nextRaidTick}`, kind: 'raid', text: r.pick(lines), hours: h, sure: 0.8 });
    else if (h > FALSE_RAID_CLEAR_HOURS && r.chance(FALSE_RAID)) add({ key: `raid:false:${dayOf(s)}`, kind: 'raid', text: r.pick(lines), hours: RAID_SEEN_HOURS, sure: 0.2, false: true }, true);
  }

  // a party on its way home
  for (const e of s.expeditions) {
    if (e.phase !== 'back' || e.battle) continue;
    const h = Math.max(0, e.backTicks - e.elapsed) / TICKS_PER_HOUR;
    if (h > PARTY_SEEN_HOURS) continue;
    const lead = byId(s, e.leader ?? e.members[0]);
    add({ key: `party:${e.id}`, kind: 'party', text: `${lead ? `${lead.name}'s party` : 'The party'} should be home ${whenWords(h)}.`, hours: h, sure: 0.9 });
  }

  // couples: a wedding talked of, a cradle hoped for, a wedding feast tonight
  if (s.feastDue?.kind === 'wedding') add({ key: `feast:${s.feastDue.text}`, kind: 'wedding', text: 'The wedding feast is tonight.', hours: Math.max(0, 18 - cal.hour), sure: 1 });
  if (s.research.done.includes('family_life')) {
    const couples: [Person, Person][] = [];
    for (const a of home(s)) {
      const b = byId(s, a.partner);
      if (b && a.id < b.id && b.away === null && !tireless(a) && !tireless(b)) couples.push([a, b]);
    }
    const talk = couples.filter(([a, b]) => !a.married && opinionOf(s, a.id, b.id) >= MARRY - 10);
    if (talk.length) {
      const [a, b] = rollFor(s, 'wedding').pick(talk);
      add({ key: `wedding:${a.id}-${b.id}`, kind: 'wedding', text: `${a.name} and ${b.name} are talking of a wedding.`, hours: 48, sure: 0.5 });
    }
    const hoping = couples.filter(([a, b]) => a.married && s.people.filter((k) => k.parents?.includes(a.id) && k.parents.includes(b.id)).length < MAX_CHILDREN);
    const r = rollFor(s, 'birth');
    if (hoping.length && r.chance(BIRTH_TALK)) {
      const [a, b] = r.pick(hoping);
      add({ key: `birth:${a.id}-${b.id}:${dayOf(s)}`, kind: 'birth', text: `${a.name} and ${b.name} have cleared a corner for a cradle.`, hours: 48, sure: 0.4 }, true);
    }
  }

  // a trial waiting on the town's judgement
  const trial = s.politics?.trial;
  const accused = trial && byId(s, trial.who);
  if (accused) add({ key: `trial:${trial.prompt}`, kind: 'trial', text: `${accused.name} waits to be judged.`, hours: 0, sure: 1 });

  // a dweller below, not yet slain
  const u = s.underdark;
  for (let n = 1; n <= (u?.depth ?? 0); n++) {
    const d = DEPTH_BY_N[n];
    const ds = u?.deeps?.[n - 1];
    if (!d || !ds || ds.slain !== undefined) continue;
    add({ key: `dweller:${n}`, kind: 'dweller', text: `The ground hums at night: something in ${d.name} is stirring.`, hours: 48, sure: 0.6 });
    break; // (the shallowest is enough)
  }

  // an envoy on the road, or a known power's riders seen
  if (s.envoyRider && !s.envoyRider.leaving) add({ key: `envoy:${s.envoyRider.faction}`, kind: 'envoy', text: `${s.envoyRider.name} is on the road to the town.`, hours: 1, sure: 1 });
  else {
    const known = (s.factions ?? []).filter((f) => f.known && !f.host && s.tick - (f.lastEnvoy ?? -1e12) >= 2 * TICKS_PER_DAY);
    const r = rollFor(s, 'envoy');
    if (known.length && r.chance(ENVOY_TALK)) {
      const f = r.pick(known);
      add({ key: `envoy:${f.id}:${dayOf(s)}`, kind: 'envoy', text: `Riders in the colours of ${(FACTION_BY_ID[f.id]?.name ?? 'a far power').replace(/^The /, 'the ')} were seen on the road.`, hours: 24, sure: 0.4 }, true);
    }
  }

  // the season turning, the festival coming
  if (cal.dayOfSeason === DAYS_PER_SEASON) {
    const next = SEASONS[(SEASONS.indexOf(cal.season) + 1) % SEASONS.length];
    const line = { spring: 'The thaw is in the air: spring is close.', summer: 'The days are lengthening toward summer.', autumn: 'The first leaves are turning: autumn is close.', winter: 'Frost on the morning water: winter is coming.' }[next];
    add({ key: `season:${next}:${dayOf(s)}`, kind: 'season', text: line, hours: 24 - cal.hour, sure: 1 });
  }
  const fest = festivalFor(s.origin, cal.season);
  const toFest = FESTIVAL_DAY - cal.dayOfSeason;
  if (fest && (toFest === 1 || toFest === 2 || (toFest === 0 && cal.hour < FESTIVAL_HOUR)))
    add({ key: `festival:${fest.id}:${cal.year}`, kind: 'festival', text: toFest === 0 ? `${fest.name} is this evening.` : toFest === 1 ? `${fest.name} is tomorrow.` : `${fest.name} is the day after tomorrow.`, hours: toFest * 24 + FESTIVAL_HOUR - cal.hour, sure: 1 });

  // a sickness going round
  const sick = home(s).filter((p) => p.sick && p.sick.until > s.tick).length;
  if (sick >= 2) add({ key: `sick:${dayOf(s)}`, kind: 'sickness', text: 'A cough is going round the houses.', hours: 24, sure: 0.7 });

  // the stores thin
  const eaters = home(s).filter((p) => !tireless(p)).length;
  if (eaters) {
    const stock = totalStock(s);
    const food = Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as keyof typeof stock] ?? 0) * (v ?? 0), 0);
    const days = food / eaters;
    if (days < STORES_LOW_DAYS) add({ key: `stores:${dayOf(s)}`, kind: 'stores', text: days < 1 ? 'The granary echoes: there is almost nothing left.' : 'The stores are running thin.', hours: days * 24, sure: 1 });
  }

  // a caravan's dust on the road
  const market = s.buildings.some((b) => b.def === 'market' && b.status === 'done');
  const toCaravan = hoursTo(s.nextCaravanTick);
  if (market && !s.caravan && s.nextCaravanTick > s.tick && toCaravan <= CARAVAN_SEEN_HOURS)
    add({ key: `caravan:${s.nextCaravanTick}`, kind: 'caravan', text: 'Dust on the road: a caravan may be near.', hours: toCaravan, sure: 0.8 });

  return out;
}

/** The hints spoken now: the nearest few, no number in them. */
export function foreshadow(s: GameState): Hint[] {
  return hintCandidates(s)
    .filter((h) => h.voiced)
    .sort((a, b) => a.hours - b.hours || b.sure - a.sure)
    .slice(0, HINTS_MOST)
    .map(({ voiced: _, ...h }) => h);
}

/** The most open threads on the "While you were away" card. */
export const THREADS_MOST = 3;

/** What's still hanging as the player comes back (the away card's last lines): a party still out, a host on the march,
 *  a trial waiting, a child of the ascended growing, a dweller below unslain; then the nearest hints. A line or three. */
export function openThreads(s: GameState): string[] {
  if (s.autopilot === false || s.gameOver) return [];
  const out: string[] = [];
  const kinds = new Set<string>();
  const party = s.expeditions.find((e) => e.phase !== 'back');
  if (party) {
    const lead = byId(s, party.leader ?? party.members[0]);
    const where = destinationOf(s, party.dest)?.name;
    out.push(`${lead ? `${lead.name}'s party` : 'A party'} is still out${where ? ` at ${where}` : ''}.`);
  }
  const host = (s.factions ?? []).find((f) => f.host);
  if (host) out.push(`${(FACTION_BY_ID[host.id]?.name ?? 'A power').replace(/^the /, 'The ')}'s host is on the march.`);
  const heir = s.people.find((p) => p.bornTick != null && p.parents?.length === 2 && p.parents.every((id) => byId(s, id)?.ascended));
  if (heir) out.push(`${heir.name}, a child of the ascended, is growing.`);
  else if (s.mythicOmen) out.push('The old powers are stirring: the next to take a calling may be touched.');
  for (const h of foreshadow(s)) {
    if (kinds.has(h.kind) || (h.kind === 'party' && party)) continue;
    kinds.add(h.kind);
    out.push(h.text);
  }
  return out.slice(0, THREADS_MOST);
}
