// What mattered while the player was away, for the one plain card the phone shows on their return (the owner's ask:
// no recaps or time-lapse, only the important things). Noted before the catch-up (`awayBefore`), watched while it runs
// (`awayWatch`: raids end one after another, and only the last recap stays on the state), and put into a few lines
// after (`awaySummary`). Reads the state only: nothing here changes the town.

import { ERA_NAMES } from '../data/eras';
import { ITEM_BY_ID } from '../data/items';
import { PLACE_DEFS } from '../data/places';
import type { RaidRecap } from './raidRecap';
import type { GameState } from './state';

export interface AwayBefore {
  tick: number;
  era: GameState['era'];
  people: Set<number>;
  fallen: Set<unknown>;
  places: Set<number>;
  uniques: number;
  raids: RaidRecap[];
  lastRecap: RaidRecap | undefined;
}

export type AwayTone = 'bad' | 'good' | 'ask' | 'news';
export interface AwayLine {
  tone: AwayTone;
  text: string;
}

export function awayBefore(s: GameState): AwayBefore {
  return {
    tick: s.tick,
    era: s.era,
    people: new Set(s.people.map((p) => p.id)),
    fallen: new Set(s.fallen ?? []),
    places: new Set((s.places ?? []).filter((p) => p.found != null).map((p) => p.id)),
    uniques: s.uniques?.length ?? 0,
    raids: [],
    lastRecap: s.raidRecap,
  };
}

/** Called now and then during the catch-up: a raid that ended since is kept. */
export function awayWatch(s: GameState, b: AwayBefore): void {
  const r = s.raidRecap;
  if (r && r !== b.lastRecap && !b.raids.includes(r)) b.raids.push(r);
  b.lastRecap = r;
}

const names = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const MOST_NAMED = 4;
const named = (xs: string[]) => (xs.length > MOST_NAMED ? `${names(xs.slice(0, MOST_NAMED - 1))} and ${xs.length - MOST_NAMED + 1} more` : names(xs));

/** The important things since `b`, most serious first; empty when nothing important happened. */
export function awaySummary(s: GameState, b: AwayBefore): AwayLine[] {
  awayWatch(s, b);
  const out: AwayLine[] = [];
  const now = new Set(s.people.map((p) => p.id));
  // the dead (from the annals, with how), and anyone else gone from the town
  const dead = (s.fallen ?? []).filter((f) => !b.fallen.has(f) && b.people.has(f.id));
  for (const f of dead.slice(0, MOST_NAMED)) out.push({ tone: 'bad', text: `${f.name} died ${f.cause}.` });
  if (dead.length > MOST_NAMED) out.push({ tone: 'bad', text: `${dead.length - MOST_NAMED} more died.` });
  const deadIds = new Set(dead.map((f) => f.id));
  const left = [...b.people].filter((id) => !now.has(id) && !deadIds.has(id)).length;
  if (left) out.push({ tone: 'bad', text: `${left === 1 ? 'One' : left} left the town.` });
  // raids and how they ended
  for (const r of b.raids) {
    const how = r.outcome === 'pillaged' ? 'got in and took what they came for' : r.outcome === 'victory' ? 'were beaten off' : 'were driven off';
    out.push({ tone: r.outcome === 'pillaged' ? 'bad' : 'good', text: `${r.name} raided: they ${how}${r.killed ? ` (${r.killed} felled)` : ''}.` });
  }
  // births and newcomers
  const fresh = s.people.filter((p) => !b.people.has(p.id));
  const born = fresh.filter((p) => p.bornTick != null && p.bornTick >= b.tick).map((p) => p.name);
  const came = fresh.filter((p) => !(p.bornTick != null && p.bornTick >= b.tick)).map((p) => p.name);
  if (born.length) out.push({ tone: 'good', text: `Born: ${named(born)}.` });
  if (came.length) out.push({ tone: 'good', text: `Joined the town: ${named(came)}.` });
  // a new age, treasures, places found
  if (s.era !== b.era) out.push({ tone: 'good', text: `The town reached the ${ERA_NAMES[s.era]}.` });
  for (const u of (s.uniques ?? []).slice(b.uniques)) out.push({ tone: 'good', text: `Won ${ITEM_BY_ID[u]?.name ?? 'a treasure'}.` });
  const found = (s.places ?? []).filter((p) => p.found != null && !b.places.has(p.id));
  const kinds = new Map<string, number>();
  for (const p of found) kinds.set(PLACE_DEFS[p.kind]?.name ?? 'a place', (kinds.get(PLACE_DEFS[p.kind]?.name ?? 'a place') ?? 0) + 1);
  if (found.length) out.push({ tone: 'news', text: `Found: ${names([...kinds].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)))}.` });
  // what waits on the player
  const asks = s.prompts.length;
  if (asks) out.push({ tone: 'ask', text: asks === 1 ? `A question waits: ${s.prompts[0].title}.` : `${asks} questions wait for you.` });
  return out;
}
