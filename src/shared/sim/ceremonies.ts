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
  WEDDING_FEAST_MARK,
} from '../data/ceremonies';
import { FRIEND } from '../data/social';
import { PURSE_SCALE } from '../data/shop';
import { TREASURY_KEEP } from '../data/economy';
import { buildingDoor, buildingCentre, storages, totalStock } from './buildings';
import { isChild, opinion } from './social';
import { addStock, campXY, earn, notify, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { takeSale } from './ambition';

export type GatheringKind = 'funeral' | 'great_funeral' | 'wedding' | 'feast';

/** A death in town (or on the road): remembered for the next funeral, with who was close to them. Called before the
 *  dead are struck from the relations table. */
export function mournFor(s: GameState, dead: Person): void {
  if (isChild(dead) && !dead.parents?.length) return;
  const close = s.people
    .filter((p) => p !== dead && (p.partner === dead.id || opinion(s, p.id, dead.id) >= FRIEND || p.parents?.includes(dead.id) || dead.parents?.includes(p.id)))
    .map((p) => p.id);
  (s.funeralsDue ??= []).push({ name: dead.name, close, tick: s.tick });
}

/** A wedding: feasted that evening. */
export function weddingFeast(s: GameState, a: Person, b: Person): void {
  s.feastDue = { kind: 'wedding', text: `the wedding of ${a.name} and ${b.name}` };
}

/** A raid driven off: the town feasts the victory, if it can. */
export function victoryFeast(s: GameState): void {
  if (!s.feastDue) s.feastDue = { kind: 'feast', text: 'the victory feast' };
}

/** Days of food in store for everyone. */
function foodDays(s: GameState): number {
  const stock = totalStock(s);
  const food = Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0);
  return food / Math.max(1, s.people.length);
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

/** Begin a gathering: who, where, for how long. */
function gather(s: GameState, kind: GatheringKind, ids: number[], hours: number, text: string, at: { x: number; y: number }): void {
  s.gathering = { kind, ids, until: s.tick + hours * TICKS_PER_HOUR, text, x: at.x, y: at.y };
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
    gather(s, great ? 'great_funeral' : 'funeral', ids, great ? GREAT_FUNERAL_HOURS : FUNERAL_HOURS, great ? `The great funeral for ${list}` : `At the funeral of ${list}`, at);
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
  if (foodDays(s) - FEAST_FOOD * all.length / Math.max(1, s.people.length) < FEAST_FOOD_DAYS && feast.kind !== 'wedding') {
    notify(s, `No feast for ${feast.text}: the stores can't spare it.`);
    return;
  }
  eatFeast(s, all.length);
  const tavern = tavernOf(s);
  const at = tavern ? buildingDoor(tavern) : campXY(s);
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
  gather(s, feast.kind, all.map((p) => p.id), FEAST_HOURS, feast.kind === 'wedding' ? `Feasting ${feast.text}` : `At ${feast.text}`, at);
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
  } else mark(g.kind === 'wedding' ? WEDDING_FEAST_MARK : FEAST_MARK, g.text.replace(/^(At|Feasting) /, '').replace(/^the /, 'The '));
}

/** At a gathering now (they stop work and stand together). */
export const attending = (s: GameState, p: Person) => !!s.gathering && s.tick < s.gathering.until && s.gathering.ids.includes(p.id) && p.away === null && !p.downed && !s.raid;
