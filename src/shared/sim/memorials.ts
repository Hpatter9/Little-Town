// The town remembers its famous dead (the owner's ask: memory written into the town). When someone famous dies (the
// founder always; else a title, `FAMOUS_FELLED` raiders felled, `FAMOUS_LEVEL`, or `FAMOUS_TRIPS` journeys: `famous`),
// they are honoured (`honour`, from the annals' `recordFallen`): their record, with their look and gear as they were,
// kept in `s.honoured` in the order they fell, for a statue in the square (sim/statues.ts raises them) and its tap card
// (`deedsOf`). Homes are named here too (`nameHomes`: data/homeNames.ts, kept on the building). Light on imports, since
// the annals (and so the deaths) reach it.

import { BUILDING_BY_ID } from '../data/buildings';
import { homeName } from '../data/homeNames';
import { FAMOUS_FELLED, FAMOUS_LEVEL, FAMOUS_TRIPS, HONOURED_MOST, STATUE } from '../data/memorials';
import type { Look } from '../data/people';
import type { Slot } from '../data/items';
import type { ClassId } from '../data/classes';
import type { MonsterKind } from '../data/monsters';
import { stageOf } from '../data/levels';
import { ageYears } from './ageing';
import { TICKS_PER_HOUR } from './time';
import type { Fallen } from './annals';
import type { GameState, Person } from './state';

/** One of the famous dead, as they were: their record in the hall and what the statue shows. */
export interface Honoured extends Fallen {
  look: Look;
  gear: Partial<Record<Slot, string>>;
  cls: ClassId | null;
  /** Their calling's stage (0 to 4), a founder's own calling, and a monster's kind (the raised dead stand in bone). */
  stage: number;
  fcls: boolean;
  monster: MonsterKind | null;
  /** When their statue was finished and the town gathered to see it (once). */
  unveiled?: number;
}

/** Is someone who has died famous enough for a statue? */
export function famous(f: Pick<Fallen, 'founder' | 'titles' | 'felled' | 'level' | 'trips'>): boolean {
  return f.founder || f.titles.length > 0 || f.felled >= FAMOUS_FELLED || f.level >= FAMOUS_LEVEL || f.trips >= FAMOUS_TRIPS;
}

/** Someone has died (their record in the hall, `f`): honour them if they were famous. */
export function honour(s: GameState, p: Person, f: Fallen): void {
  if (!famous(f)) return;
  const list = (s.honoured ??= []);
  list.push({ ...f, titles: [...f.titles], look: { ...p.look }, gear: { ...p.gear }, cls: p.cls ?? null, stage: stageOf(p), fcls: !!p.fcls, monster: p.monster ?? null });
  // (the oldest whose statue doesn't stand make way)
  while (list.length > HONOURED_MOST) {
    const i = list.findIndex((h) => !s.buildings.some((b) => b.def === STATUE && b.statue === h.id));
    list.splice(i < 0 ? 0 : i, 1);
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What they did, for the statue's card: a line each, the founding first. */
export function deedsOf(h: Pick<Fallen, 'founder' | 'titles' | 'felled' | 'level' | 'trips' | 'calling'>): string[] {
  const out: string[] = [];
  if (h.founder) out.push('Founded the town, or led it after its founder.');
  if (h.titles.length) out.push(`Known as ${h.titles.join(', ')}.`);
  if (h.felled) out.push(`Felled ${plural(h.felled, 'raider')} in the town's defence.`);
  if (h.trips) out.push(`Went out on ${plural(h.trips, 'journey')}.`);
  out.push(h.calling ? `Reached level ${h.level} as ${/^[aeiou]/i.test(h.calling) ? 'an' : 'a'} ${h.calling}.` : `Reached level ${h.level}.`);
  return out;
}

/** Hourly: every finished home without a name is named for its owner, else its eldest resident (one with nobody yet
 *  waits for them). The name stays with the house. */
export function nameHomes(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const b of s.buildings) {
    if (b.homeName || b.status !== 'done' || !BUILDING_BY_ID[b.def]?.housing) continue;
    const owner = b.owner !== undefined ? s.people.find((p) => p.id === b.owner) : undefined;
    const who = owner ?? eldest(s, s.people.filter((p) => p.bed === b.id));
    if (who) b.homeName = homeName(b.id, who.name, s.origin);
  }
}

function eldest(s: GameState, ps: Person[]): Person | undefined {
  let best: Person | undefined;
  let age = -1;
  for (const p of ps) {
    const a = ageYears(s, p);
    if (a > age || (a === age && best && p.id < best.id)) {
      age = a;
      best = p;
    }
  }
  return best;
}

/** The honoured as the renderers see them: their deeds, and the statue standing (or being built) for them. */
export interface HonouredView extends Honoured {
  deeds: string[];
  statue: number | null;
}

export function honouredView(s: GameState): HonouredView[] {
  return (s.honoured ?? []).map((h) => ({ ...h, deeds: deedsOf(h), statue: s.buildings.find((b) => b.def === STATUE && b.statue === h.id)?.id ?? null }));
}
