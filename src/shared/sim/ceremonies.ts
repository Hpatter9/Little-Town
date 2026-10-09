// Life's ceremonies (PLAN.md step 7, data/ceremonies.ts). A death in town is mourned at the next evening's funeral:
// those who were close (the partner, kin, friends) gather at the graveyard (or the fire) and their grief is eased; a
// day of many deaths (a raid, a fire) is mourned by the whole town at a great funeral. A wedding is feasted that
// evening, and the town feasts at midsummer and after a raid driven off, when the stores can spare it. While a
// gathering lasts, those at it stop work (`chooseTask` in people.ts: the `attend` task) and stand together.

import { FOOD_VALUE } from '../data/people';
import type { Material } from '../data/materials';
import {
  FEAST_COIN,
  FEAST_FOOD,
  FEAST_FOOD_DAYS,
  FEAST_GAP_HOURS,
  FEAST_HOURS,
  FEAST_MARK,
  FUNERAL_EASE,
  FUNERAL_HOURS,
  FUNERAL_MARK,
  GATHER_HOUR,
  GREAT_FUNERAL_DEATHS,
  GREAT_FUNERAL_HOURS,
  GREAT_FUNERAL_MARK,
  MIDSUMMER_DAY,
  PROCESSION_GAP,
  PROCESSION_LEAST,
  PROCESSION_MOST,
  PROCESSION_PACE,
  RITE_HOURS,
  RITE_SHARE,
  WEDDING_FEAST_MARK,
} from '../data/ceremonies';
import { natureOf } from '../data/natures';
import { FRIEND } from '../data/social';
import { PURSE_SCALE } from '../data/shop';
import { TREASURY_KEEP } from '../data/economy';
import { buildingDoor, buildingCentre, storages, totalStock } from './buildings';
import { isChild, opinion } from './social';
import { addStock, eatersOf, foodDaysFor, tireless, campXY, earn, notify, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { takeSale } from './ambition';

export type GatheringKind = 'funeral' | 'great_funeral' | 'wedding' | 'feast' | 'rite';

/** A death in town (or on the road): remembered for the next funeral, with who was close to them. Called before the
 *  dead are struck from the relations table. */
export function mournFor(s: GameState, dead: Person): void {
  if (isChild(dead) && !dead.parents?.length) return;
  const close = s.people
    .filter((p) => p !== dead && (p.partner === dead.id || opinion(s, p.id, dead.id) >= FRIEND || p.parents?.includes(dead.id) || dead.parents?.includes(p.id)))
    .map((p) => p.id);
  // (the coffin is carried from their home's door, else from where they fell)
  const home = dead.bed !== null ? s.buildings.find((b) => b.id === dead.bed && b.status === 'done') : undefined;
  const from = home ? buildingDoor(home) : { x: dead.x, y: dead.y };
  (s.funeralsDue ??= []).push({ name: dead.name, close, tick: s.tick, x: from.x, y: from.y });
}

/** A wedding: feasted that evening, the couple leading the wedding party from their door. */
export function weddingFeast(s: GameState, a: Person, b: Person): void {
  const home = [a, b].map((p) => (p.bed !== null ? s.buildings.find((q) => q.id === p.bed && q.status === 'done') : undefined)).find((q) => q);
  const from = home ? buildingDoor(home) : { x: a.x, y: a.y };
  s.feastDue = { kind: 'wedding', text: `the wedding of ${a.name} and ${b.name}`, x: from.x, y: from.y, lead: [a.id, b.id] };
}

/** A raid driven off: the town feasts the victory, if it can. */
export function victoryFeast(s: GameState): void {
  if (!s.feastDue) s.feastDue = { kind: 'feast', text: 'the victory feast' };
}

/** Days of food in store for everyone. */
function foodDays(s: GameState): number {
  const stock = totalStock(s);
  const food = Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0);
  return foodDaysFor(s, food);
}

/** Eat a feast's worth of food from the stores (the plainest first). */
function eatFeast(s: GameState, heads: number): void {
  let need = heads * FEAST_FOOD;
  for (const m of Object.keys(FOOD_VALUE) as Material[]) {
    for (const st of storages(s)) {
      while (need > 0 && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        need -= FOOD_VALUE[m]!;
      }
    }
  }
}

const here = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed);
const tavernOf = (s: GameState) => s.buildings.find((b) => b.status === 'done' && (b.def === 'fireside_inn' || b.def === 'tavern'));
const graveyardOf = (s: GameState) => s.buildings.find((b) => b.status === 'done' && b.def === 'graveyard');

/** Begin a gathering: who, where, for how long; with `from`, it begins as a procession from there (the head walking at
 *  PROCESSION_PACE), the gathering's time counted from when it arrives. */
function gather(s: GameState, kind: GatheringKind, ids: number[], hours: number, text: string, at: { x: number; y: number }, from?: { x: number; y: number }): void {
  const far = from ? Math.hypot(at.x - from.x, at.y - from.y) : 0;
  const walkTicks = far >= PROCESSION_LEAST ? Math.min(PROCESSION_MOST * TICKS_PER_HOUR, Math.ceil(far / PROCESSION_PACE)) : 0;
  s.gathering = { kind, ids, until: s.tick + walkTicks + hours * TICKS_PER_HOUR, text, x: at.x, y: at.y, from: s.tick };
  if (walkTicks && from) s.gathering.walk = { x: from.x, y: from.y, until: s.tick + walkTicks };
}

/** Put these first in a gathering (the bearers or the couple at the head of the line, by their place). */
const leading = (ids: number[], lead: number[]) => [...lead.filter((id) => ids.includes(id)), ...ids.filter((id) => !lead.includes(id))];

/** A rite day at the temple (sim/faith.ts): the faithful walk from the fire to its door in a procession and kneel there
 *  a while. Only when nothing else is gathering. */
export function holdRite(s: GameState, temple: { x: number; y: number }, day: number): void {
  if (s.gathering || s.raid || s.autopilot === false) return;
  const ids = here(s)
    .filter((p) => !isChild(p) && !p.guard && !tireless(p) && (natureOf(p).id === 'pious' || riteRoll(s.seed, day, p.id) < RITE_SHARE))
    .map((p) => p.id);
  if (!ids.length) return;
  gather(s, 'rite', ids, RITE_HOURS, 'At the rite at the temple', temple, campXY(s));
}

/** A roll of their own by the day (the sim's clock has no rng here). */
function riteRoll(seed: string, day: number, id: number): number {
  let h = 2166136261;
  for (const ch of `${seed}|rite|${day}|${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Once an hour: at the evening hour, a funeral for the dead since the last, else a feast that's due. */
export function ceremoniesHourly(s: GameState): void {
  // (the town's own life: not in the tests' plain towns, with the autopilot off)
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  if (s.gathering && s.tick >= s.gathering.until) endGathering(s);
  const cal = calendar(s.tick);
  // (midsummer: a feast is due once a year, on its day)
  if (cal.season === 'summer' && cal.dayOfSeason === MIDSUMMER_DAY && cal.hour === 6 && !s.feastDue) s.feastDue = { kind: 'feast', text: 'the midsummer feast' };
  if (cal.hour !== GATHER_HOUR || s.gathering || s.raid) return;
  const due = s.funeralsDue ?? [];
  if (due.length) {
    s.funeralsDue = [];
    const great = due.length >= GREAT_FUNERAL_DEATHS;
    const names = due.map((d) => d.name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    const grave = graveyardOf(s);
    const at = grave ? buildingCentre(grave) : campXY(s);
    const close = [...new Set(due.flatMap((d) => d.close))].filter((id) => here(s).some((p) => p.id === id));
    // (nobody was close to them: the town buries them all the same)
    const ids = great || !close.length ? here(s).map((p) => p.id) : close;
    if (!ids.length) return;
    // (the coffin carried from the last one's home to the graveyard, the mourners behind it: a procession)
    const last = due.at(-1)!;
    gather(s, great ? 'great_funeral' : 'funeral', ids, great ? GREAT_FUNERAL_HOURS : FUNERAL_HOURS, great ? `The great funeral for ${list}` : `At the funeral of ${list}`, at, grave && last.x !== undefined && last.y !== undefined ? { x: last.x, y: last.y } : undefined);
    const where = grave ? 'at the graveyard' : 'by the fire';
    notify(s, great ? `The whole town gathers ${where} to bury its dead: ${list}.` : !close.length ? `The town gathers ${where} to lay ${list} to rest.` : `${ids.length === 1 ? 'One who loved them gathers' : `${ids.length} who loved them gather`} ${where} to lay ${list} to rest.`, true);
    return;
  }
  const feast = s.feastDue;
  if (!feast) return;
  s.feastDue = undefined;
  if (s.lastFeast != null && s.tick - s.lastFeast < FEAST_GAP_HOURS * TICKS_PER_HOUR && feast.kind !== 'wedding') return;
  const all = here(s).filter((p) => !p.guard || feast.kind === 'wedding');
  // (a feast the stores can't spare is put off: a wedding is still kept, with what there is)
  // (only the living eat at it: the dead dance, and eat nothing)
  const mouths = all.filter((p) => !tireless(p)).length;
  if (mouths && foodDays(s) - (FEAST_FOOD * mouths) / Math.max(1, eatersOf(s)) < FEAST_FOOD_DAYS && feast.kind !== 'wedding') {
    notify(s, `No feast for ${feast.text}: the stores can't spare it.`);
    return;
  }
  eatFeast(s, mouths);
  const tavern = tavernOf(s);
  // (before the tavern, out on the open ground below its door, so the dancers' ring doesn't run into it)
  const door = tavern ? buildingDoor(tavern) : null;
  const at = door ? { x: door.x, y: door.y + Math.min(120, 34 + all.length * 5) * 0.7 + 24 } : campXY(s);
  // (held at a tavern someone owns, the treasury pays the house: the tavern's owner profits)
  if (tavern && tavern.owner !== undefined) {
    const n = Math.min(Math.round(FEAST_COIN * PURSE_SCALE[s.era] * all.length), Math.max(0, (s.coins ?? 0) - TREASURY_KEEP));
    if (n > 0) {
      s.coins = (s.coins ?? 0) - n;
      earn(s, 'events', -n);
      takeSale(s, tavern, n, s.people.find((p) => p.id === tavern.operator), 'tavern', 'the feast');
    }
  }
  s.lastFeast = s.tick;
  // (a wedding party walks from the couple's door to the feast, the couple at its head)
  const walk = feast.kind === 'wedding' && feast.x !== undefined && feast.y !== undefined ? { x: feast.x, y: feast.y } : undefined;
  gather(s, feast.kind, leading(all.map((p) => p.id), feast.lead ?? []), FEAST_HOURS, feast.kind === 'wedding' ? `Feasting ${feast.text}` : `At ${feast.text}`, at, walk);
  notify(s, `The town gathers ${tavern ? 'at the tavern' : 'round the fire'} for ${feast.text}.`, true);
}

/** A gathering is over: what it leaves behind. */
function endGathering(s: GameState): void {
  const g = s.gathering!;
  s.gathering = undefined;
  const came = s.people.filter((p) => g.ids.includes(p.id));
  const mark = (v: [number, number], text: string) => (s.marks ??= []).push({ lever: 'morale', value: v[0], until: s.tick + v[1] * TICKS_PER_HOUR, text });
  if (g.kind === 'funeral' || g.kind === 'great_funeral') {
    // (those who came are eased in their grief)
    for (const p of came) if (p.grief && s.tick < p.grief.until) p.grief = { ...p.grief, value: Math.round(p.grief.value * FUNERAL_EASE) };
    mark(g.kind === 'great_funeral' ? GREAT_FUNERAL_MARK : FUNERAL_MARK, g.kind === 'great_funeral' ? 'We buried our dead together' : 'Laid to rest');
  } else if (g.kind !== 'rite') mark(g.kind === 'wedding' ? WEDDING_FEAST_MARK : FEAST_MARK, g.text.replace(/^(At|Feasting) /, '').replace(/^the /, 'The '));
}

/** A feast (not a funeral): the town dances. */
export const festive = (g: NonNullable<GameState['gathering']>) => g.kind === 'feast' || g.kind === 'wedding';
/** What the guests do once there: dance at a feast, kneel in prayer at a rite, mourn at a funeral. */
export const guestActivity = (g: NonNullable<GameState['gathering']>) => (festive(g) ? 'dance' : g.kind === 'rite' ? 'pray' : 'mourn');
/** At a feast every other guest joins the ring dance round the spot, which turns this many radians a tick (a turn in
 *  about 40 s); the rest dance where they stand. */
export const RING_SPIN = (Math.PI * 2) / 400;
/** Whether a guest (by their place in the gathering) dances in the turning ring. */
export const inRing = (i: number) => i % 2 === 0;

/** How far from the spot the ring stands (px): a feast's ring grows with the guests, so the dancers have room. */
export function gatheringRadius(g: NonNullable<GameState['gathering']>): number {
  const n = g.ids.length;
  return festive(g) ? Math.min(120, 34 + n * 5) : Math.min(90, 26 + n * 3.5);
}

/** Still on the way: the procession hasn't reached the spot. */
export const processing = (g: NonNullable<GameState['gathering']>, tick: number) => !!g.walk && tick < g.walk.until;

/** Where the head of a procession is now (the coffin, the couple). */
export function processionHead(g: NonNullable<GameState['gathering']>, tick: number): { x: number; y: number } {
  const w = g.walk!;
  const k = Math.max(0, Math.min(1, (tick - (g.from ?? tick)) / Math.max(1, w.until - (g.from ?? tick))));
  return { x: w.x + (g.x - w.x) * k, y: w.y + (g.y - w.y) * k };
}

/** Where a guest stands (or dances) at a gathering: a ring round the spot, the ring dancers' places turning with the
 *  time; and which way they face (dir, as `Person.dir`). On the way, their place in the procession: the first two side
 *  by side at its head (the bearers, the couple), the rest in a column behind, along the way back to where it set out. */
export function gatheringPlace(g: NonNullable<GameState['gathering']>, i: number, tick: number): { x: number; y: number; dir: 1 | -1 } {
  if (processing(g, tick)) {
    const w = g.walk!;
    const head = processionHead(g, tick);
    const len = Math.max(1, Math.hypot(g.x - w.x, g.y - w.y));
    const [ux, uy] = [(g.x - w.x) / len, (g.y - w.y) / len];
    const dir: 1 | -1 = ux >= 0 ? 1 : -1;
    if (i < 2) return { x: head.x - uy * (i ? -9 : 9), y: head.y + ux * (i ? -9 : 9) * 0.7, dir };
    const back = (i - 1) * PROCESSION_GAP;
    return { x: head.x - ux * back + ((i % 2) - 0.5) * 6, y: head.y - uy * back, dir };
  }
  const n = Math.max(1, g.ids.length);
  const r = gatheringRadius(g);
  const turning = festive(g) && inRing(i);
  const a = (i / n) * Math.PI * 2 + (turning ? (tick - (g.from ?? tick)) * RING_SPIN : 0);
  // (a ring dancer faces the way the ring turns; the rest face the middle)
  const dir: 1 | -1 = turning ? (-Math.sin(a) > 0 ? 1 : -1) : Math.cos(a) > 0 ? -1 : 1;
  return { x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r * 0.7, dir };
}

/** At a gathering now (they stop work and stand together). */
export const attending = (s: GameState, p: Person) => !!s.gathering && s.tick < s.gathering.until && s.gathering.ids.includes(p.id) && p.away === null && !p.downed && !s.raid;
