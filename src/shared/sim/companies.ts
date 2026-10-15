// Bonded parties (the owner's ask; data/companies.ts). A party that comes home counts toward a bond between those who
// went: the same few out and back `BOND_TRIPS` times become a company, named from the seed, their people and the place
// of their first deed. A company remembers its trips and deeds; its members go out together again (`RECRUIT_COMPANY`
// in sim/parties.ts recruit), and one who goes out with them joins while there's room. Below `BOND_LEAST` living
// members it breaks up, and is remembered a while.

import {
  BOND_LEAST,
  BOND_TRIPS,
  COMPANIES_KEPT,
  COMPANY_MOST,
  DEEDS_KEPT,
  FELLOWS_KEPT,
  NAME_ADJ,
  NAME_NOUN,
  ORIGIN_NOUN,
} from '../data/companies';
import { the } from '../data/expeditions';
import { hashSeed, Rng } from '../rng';
import { notify, type Expedition, type GameState, type Person } from './state';
import { calendar } from './time';

export interface Company {
  id: number;
  name: string;
  /** Person ids, the living and the dead (the dead are kept to be remembered). */
  members: number[];
  /** The day it formed, and the day it broke up. */
  formed: number;
  ended?: number;
  trips: number;
  /** Trips that did the job (a place cleared, a dungeon emptied, home on their feet). */
  wins: number;
  /** "Day 12: cleared the Barrow Crypt", newest last. */
  deeds: string[];
}

const day = (s: GameState) => calendar(s.tick).day;
const alive = (s: GameState, id: number) => s.people.some((p) => p.id === id);
/** The living members of a company. */
export const livingOf = (s: GameState, c: Company) => c.members.filter((id) => alive(s, id));
/** The company (not broken up) a person belongs to. */
export const companyOf = (s: GameState, id: number): Company | undefined => (s.companies ?? []).find((c) => !c.ended && c.members.includes(id));
/** Whether two people are of the same company. */
export const sameCompany = (s: GameState, a: number, b: number) => {
  const c = companyOf(s, a);
  return !!c && c.members.includes(b);
};

/** A place's name as a word for a company: "the Barrow Crypt" → "Barrow". */
function placeWord(name: string): string | null {
  const skip = new Set(['the', 'of', 'a', 'an', 'to', 'scout', 'trade', 'with', 'storm']);
  const w = name.split(/\s+/).map((x) => x.replace(/[^A-Za-z'-]/g, '')).find((x) => x && !skip.has(x.toLowerCase()) && /^[A-Z]/.test(x));
  return w && w.length <= 10 && !w.endsWith("'s") ? w : null;
}

/** The name a new company takes: by the seed, from its people's words, its leader and where it first made its name. */
export function nameCompany(s: GameState, id: number, leader: Person | undefined, place: string): string {
  const rng = new Rng(hashSeed(`${s.seed}:company:${id}`));
  const nouns = [...NAME_NOUN, ...(ORIGIN_NOUN[s.origin ?? 'settlers'] ?? []), ...(ORIGIN_NOUN[s.origin ?? 'settlers'] ?? [])];
  const noun = rng.pick(nouns);
  const word = placeWord(place);
  const taken = new Set((s.companies ?? []).map((c) => c.name));
  const tries = [
    () => `The ${rng.pick(NAME_ADJ)} ${noun}`,
    () => (word ? `The ${word} ${noun}` : null),
    () => (leader ? `${leader.name.split(' ')[0]}'s ${noun}` : null),
  ];
  const start = rng.int(0, tries.length - 1);
  for (let i = 0; i < tries.length * 3; i++) {
    const n = tries[(start + i) % tries.length]();
    if (n && !taken.has(n)) return n;
  }
  return `The ${rng.pick(NAME_ADJ)} ${noun} ${id}`;
}

/** What a trip made of a company's name, for its deeds. */
function deedOf(e: Expedition, place: string, lost: string[], done: boolean): string {
  const at = the(place);
  const verb = e.recalled ? `turned back from ${at}` : e.cleared || e.delve?.cleared ? `cleared ${at}` : done ? `went to ${at} and back` : `came back hard from ${at}`;
  return `${verb}${lost.length ? `, losing ${lost.join(' and ')}` : ''}`;
}

const keyOf = (ids: number[]) => [...ids].sort((a, b) => a - b).join(',');

/** A party is home (from comeHome in expeditions.ts): count it toward a bond, or as a company's trip. `party` are the
 *  members still living; `place` the destination's name; `done` whether it did the job (sim/parties.ts jobDone). */
export function companyHome(s: GameState, e: Expedition, party: Person[], place: string, done: boolean): void {
  const lost = e.members.filter((id) => !alive(s, id)).map((id) => (s.fallen ?? []).find((f) => f.id === id)?.name ?? s.kin?.[id]?.name ?? 'one of their own');
  const ids = party.map((p) => p.id);
  const companies = (s.companies ??= []);
  const d = day(s);
  // a company out together (at least two of its living members on the trip)
  const c = companies.find((q) => !q.ended && q.members.filter((id) => ids.includes(id)).length >= BOND_LEAST);
  if (c) {
    c.trips++;
    if (done) c.wins++;
    c.deeds.push(`Day ${d}: ${deedOf(e, place, lost, done)}`);
    if (c.deeds.length > DEEDS_KEPT) c.deeds.splice(0, c.deeds.length - DEEDS_KEPT);
    // whoever went out with them, of no company, joins while there's room
    for (const p of party) {
      if (livingOf(s, c).length >= COMPANY_MOST) break;
      if (c.members.includes(p.id) || companyOf(s, p.id)) continue;
      c.members.push(p.id);
      notify(s, `${p.name} has gone out with ${c.name} and is one of them now.`, true);
    }
  } else {
    // those of no company who went together count toward a bond
    const free = party.filter((p) => !companyOf(s, p.id));
    if (free.length >= BOND_LEAST) {
      const fellows = (s.fellows ??= {});
      const key = keyOf(free.map((p) => p.id));
      fellows[key] = (fellows[key] ?? 0) + 1;
      const keys = Object.keys(fellows);
      for (const k of keys.slice(0, Math.max(0, keys.length - FELLOWS_KEPT))) delete fellows[k];
      // (the trips they made together: this one, and any earlier one by most of them)
      if (fellows[key] >= BOND_TRIPS) {
        delete fellows[key];
        const id = (s.nextCompany = (s.nextCompany ?? 0) + 1);
        const leader = party.find((p) => p.id === e.leader) ?? free[0];
        const name = nameCompany(s, id, leader, place);
        const members = free.slice(0, COMPANY_MOST).map((p) => p.id);
        companies.push({ id, name, members, formed: d, trips: BOND_TRIPS, wins: done ? 1 : 0, deeds: [`Day ${d}: ${deedOf(e, place, lost, done)}, and named themselves`] });
        const names = free.slice(0, COMPANY_MOST).map((p) => p.name);
        notify(s, `${names.slice(0, -1).join(', ')} and ${names.at(-1)} have gone out together and come home together: they call themselves ${name}.`, true);
      }
    }
  }
  tidyCompanies(s);
}

/** Companies with too few left alive break up; the oldest broken ones are forgotten. */
export function tidyCompanies(s: GameState): void {
  const companies = s.companies;
  if (!companies) return;
  for (const c of companies) {
    if (c.ended || livingOf(s, c).length >= BOND_LEAST) continue;
    c.ended = day(s);
    notify(s, `${c.name} is no more: too few of them are left.`, true);
  }
  while (companies.length > COMPANIES_KEPT) {
    const i = companies.findIndex((c) => c.ended);
    companies.splice(i < 0 ? 0 : i, 1);
  }
}
