// The story of each unique (the owner: "I want to know all about it. Like who made it, what makes it unique, and who's
// using it"). Noted where the thing already happens: forged (sim/crafting.ts `finishPiece`), dropped by a boss
// (sim/bosses.ts `dropLoot`, the party that slew it from sim/expeditions.ts), a quest's relic (sim/quests.ts), a saga's
// prize (sim/sagas.ts); raiders felled with it (sim/raidRecap.ts `credit`), bosses brought down by its bearer, and its
// end (sim/health.ts `killPerson`). Who bears it is read once a game hour (`uniquesHourly`). No draws, and nothing in
// the sim reads any of it: the item card (panel/itemCard.ts) shows it. Kept on the optional `GameState.uniqueLog`; a
// unique found before there was a log has none ("Forged before the chronicles").
import type { GameState, Person } from './state';
import { calendar } from './time';

/** One who bore it, and the day they took it up. */
export interface UniqueBearer {
  id: number;
  name: string;
  day: number;
}

export interface UniqueRecord {
  /** How it came to the town (left out: before there was a log). */
  how?: 'forged' | 'found' | 'quest' | 'saga';
  /** The day it came (1-based, as the calendar counts; 0: not known, it came before the log). */
  day: number;
  /** Who made it, or the party that won it. */
  by?: { id: number; name: string }[];
  /** Where: the station it was made at, the boss it was taken from, the place a quest was won, the saga. */
  where?: string;
  /** Its piece as made (data/quality.ts `piece`: grade and +N), forged ones only. */
  qn?: number;
  /** Everyone who has borne it, in turn. */
  bearers?: UniqueBearer[];
  /** Raiders felled with it in hand. */
  felled?: number;
  /** The bosses its bearer brought down (names, in order). */
  bosses?: string[];
  /** Gone from the town: when, how ("lost on the road"), and with whom. */
  gone?: { day: number; how: string; with?: string };
}

const dayNow = (s: GameState): number => calendar(s.tick).day;
const on = (s: GameState): boolean => s.autopilot !== false;
const logOf = (s: GameState) => (s.uniqueLog ??= {});

/** A unique has come to the town: note how, who and where (once; only in a town run by its autopilot). */
export function noteUnique(s: GameState, id: string, how: UniqueRecord['how'], a: { by?: Person[]; where?: string; qn?: number } = {}): void {
  if (!on(s) || logOf(s)[id]?.how) return;
  const r: UniqueRecord = { how, day: dayNow(s) };
  if (a.by?.length) r.by = a.by.map((p) => ({ id: p.id, name: p.name }));
  if (a.where) r.where = a.where;
  if (a.qn !== undefined) r.qn = a.qn;
  logOf(s)[id] = r;
}

/** The party that won the uniques found since `had` (a boss slain on a trip: sim/expeditions.ts). */
export function noteFinders(s: GameState, had: number, party: Person[]): void {
  if (!on(s) || !party.length) return;
  for (const id of (s.uniques ?? []).slice(had)) {
    const r = s.uniqueLog?.[id];
    if (r && !r.by) r.by = party.map((p) => ({ id: p.id, name: p.name }));
  }
}

/** The uniques someone has on them (any slot). */
const uniquesOn = (s: GameState, p: Person): string[] => Object.values(p.gear).filter((id): id is string => !!id && (s.uniques ?? []).includes(id));

/** Raiders felled with a unique in hand (and a boss among them: its name). */
export function noteFelled(s: GameState, p: Person | undefined, kills: number, boss?: string): void {
  if (!on(s) || !p) return;
  for (const id of uniquesOn(s, p)) {
    const r = (logOf(s)[id] ??= { day: 0 });
    if (kills > 0) r.felled = (r.felled ?? 0) + kills;
    if (boss) (r.bosses ??= []).push(boss);
  }
}

/** A boss brought down by a party: each of them bearing a unique adds it to that unique's deeds. */
export function noteBossFelled(s: GameState, party: Person[], boss: string): void {
  for (const p of party) noteFelled(s, p, 0, boss);
}

/** Someone bearing a unique has died: at home it goes back to the armoury, on the road it is lost with them. */
export function noteBearerDied(s: GameState, p: Person): void {
  if (!on(s)) return;
  for (const id of uniquesOn(s, p)) {
    const r = (logOf(s)[id] ??= { day: 0 });
    if (p.away !== null) r.gone = { day: dayNow(s), how: 'lost on the road', with: p.name };
  }
}

/** Once a game hour: whoever holds each unique now joins its bearers if they're new to it, and one no longer
 *  anywhere in the town is marked gone. */
export function uniquesHourly(s: GameState): void {
  if (!on(s) || !s.uniques?.length) return;
  const holder = new Map<string, Person>();
  for (const p of s.people) for (const id of uniquesOn(s, p)) holder.set(id, p);
  for (const id of s.uniques) {
    const p = holder.get(id);
    const r = s.uniqueLog?.[id];
    if (p) {
      const rec = (logOf(s)[id] ??= { day: 0 });
      const list = (rec.bearers ??= []);
      if (list[list.length - 1]?.id !== p.id) list.push({ id: p.id, name: p.name, day: dayNow(s) });
      delete rec.gone;
    } else if ((s.items[id] ?? 0) > 0) {
      if (r?.gone) delete r.gone; // (back in the armoury)
    } else if (r && !r.gone) r.gone = { day: dayNow(s), how: 'gone from the town', with: r.bearers?.[r.bearers.length - 1]?.name };
  }
}

/** A unique as the menus see it: who has it now (any slot), where it is, its piece, and its story when one is kept. */
export interface UniqueView {
  id: string;
  /** Who bears it now (null: nobody). */
  holder: string | null;
  holderId?: number;
  /** Where it is: in someone's hand (`hand`, `away` on a trip), in the town's stores (`armoury`), or `gone`. */
  at: 'hand' | 'away' | 'armoury' | 'gone';
  /** Its piece (data/quality.ts) as it is now: on the bearer, or the best in the stores. */
  qn?: number;
  story?: UniqueRecord;
}

export function uniqueViews(s: GameState): UniqueView[] {
  return (s.uniques ?? []).map((id) => {
    let p: Person | undefined;
    let slot: string | undefined;
    for (const q of s.people) {
      const hit = Object.entries(q.gear).find(([, g]) => g === id);
      if (hit) {
        p = q;
        slot = hit[0];
        break;
      }
    }
    const qn = p && slot ? p.gearQ?.[slot as keyof typeof p.gear] : s.itemQ?.[id]?.[0];
    const at: UniqueView['at'] = p ? (p.away !== null ? 'away' : 'hand') : (s.items[id] ?? 0) > 0 ? 'armoury' : 'gone';
    return { id, holder: p?.name ?? null, ...(p ? { holderId: p.id } : {}), at, ...(qn !== undefined ? { qn } : {}), ...(s.uniqueLog?.[id] ? { story: s.uniqueLog[id] } : {}) };
  });
}
