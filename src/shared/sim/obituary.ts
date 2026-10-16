// Obituaries (the owner's aim: stakes you feel, a death that lands). When anyone dies, `recordFallen` (sim/annals.ts)
// keeps an obituary with them (`Fallen.obit`, written once so it never shifts): their age, how they died, one line that
// is theirs (their nature's own words for the moment, data/natures.ts `say`, picked on a side stream of the seed and
// their id, so no draw from the town's stream), who they leave behind, and what they were known for. Their look and
// kit are kept too, so the card can show their face after they are gone. Pure: reads the person and the town.

import type { DeedKind } from '../data/deeds';
import { natureOf, type Topic } from '../data/natures';
import type { ClassId } from '../data/classes';
import type { Slot } from '../data/items';
import { hashSeed, Rng } from '../rng';
import { ageYears } from './ageing';
import type { Look } from '../data/people';
import type { GameState, Person } from './state';

export interface Obituary {
  /** Their age in years, rounded. */
  age: number;
  /** Their own words, in quotes on the card. */
  line: string;
  /** Who they leave behind: "their partner Ada", "two children, Tam and Wren" (empty: nobody). */
  leaves: string[];
  /** What they were known for, a short phrase each ("raised 12 buildings", "felled 4 raiders"). */
  known: string[];
  /** For their portrait: as the map drew them. */
  look: Look;
  gear: Partial<Record<Slot, string>>;
  cls: ClassId | null;
  stage: number;
  founder: boolean;
}

/** What they would say, by how they died. */
export function topicOfCause(cause: string): Topic {
  const c = cause.toLowerCase();
  if (/old age|full of days|years/.test(c)) return 'old';
  if (/hunger|starv/.test(c)) return 'hungry';
  if (/plague|sick|fever|illness|disease/.test(c)) return 'sick';
  if (/drown|sea|river|flood/.test(c)) return 'sea';
  if (/raid|hands of|slain|killed|wounds|battle|blow|fight|bandit|war/.test(c)) return 'raid';
  return 'idle';
}

const s_ = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A deed as the obituary tells it. */
const DEED_WORDS: Record<DeedKind, (n: number) => string> = {
  defended: (n) => `standing in ${s_(n, 'raid')}`,
  built: (n) => `raising ${s_(n, 'building')}`,
  crafted: (n) => `making ${s_(n, 'piece')}`,
  healed: (n) => `tending ${s_(n, 'wounded', 'wounded')}`,
  studied: (n) => `learning ${s_(n, 'topic')}`,
  bosses: (n) => `bringing down ${s_(n, 'great foe')}`,
  delves: (n) => `clearing ${s_(n, 'dungeon')}`,
  sagas: (n) => `ending ${s_(n, 'saga')}`,
  beasts: (n) => `raising ${s_(n, 'beast')}`,
  bouts: (n) => `winning ${s_(n, 'bout')} in the arena`,
  watched: (n) => `catching ${s_(n, 'sneak')} on the watch`,
  campaigns: (n) => `fighting ${s_(n, 'campaign')}`,
};

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

/** The obituary for someone dying now (called before they are struck from the town). */
export function buildObituary(s: GameState, p: Person, cause: string, stage: number): Obituary {
  const nature = natureOf(p);
  const topic = topicOfCause(cause);
  const lines = nature.say[topic] ?? nature.say.idle ?? nature.say.greet ?? ['...'];
  const g = new Rng(hashSeed(`${s.seed}:obit:${p.id}`));
  const line = lines[Math.min(lines.length - 1, Math.floor(g.next() * lines.length))];
  const leaves: string[] = [];
  const partner = p.partner != null ? s.people.find((q) => q.id === p.partner && q !== p) : undefined;
  if (partner) leaves.push(`their partner ${partner.name}`);
  const kids = s.people.filter((q) => q !== p && (q.parents ?? []).includes(p.id)).map((q) => q.name);
  if (kids.length === 1) leaves.push(`a child, ${kids[0]}`);
  else if (kids.length > 1) leaves.push(`${NUMBER[kids.length] ?? kids.length} children, ${list(kids.slice(0, 4))}${kids.length > 4 ? ' and more' : ''}`);
  const known: string[] = [];
  if (p.id === s.mainId) known.push('leading the town');
  // (their deeds, the most done first)
  const deeds = Object.entries(p.deeds ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [DeedKind, number][];
  for (const [k, n] of deeds.slice(0, 2)) known.push(DEED_WORDS[k](n));
  if ((p.felled ?? 0) > 0) known.push(`felling ${s_(p.felled!, 'raider')}`);
  if ((p.trips ?? 0) > 0) known.push(`${s_(p.trips!, 'trip')} abroad`);
  return {
    age: Math.round(ageYears(s, p)),
    line,
    leaves,
    known: known.slice(0, 3),
    look: p.look,
    gear: { ...p.gear },
    cls: p.cls ?? null,
    stage,
    founder: !!p.fcls,
  };
}

/** The obituary told in a few lines, for a card (the fallen entry gives the name, calling, titles and cause). */
export function obituaryLines(f: { name: string; calling: string | null; titles: string[]; cause: string; day: number; obit?: Obituary }): string[] {
  const o = f.obit;
  const out: string[] = [];
  const who = [f.calling, ...f.titles.slice(-1)].filter(Boolean).join(', ');
  out.push(`${f.name}${who ? `, ${who},` : ''} died ${f.cause} on day ${f.day}${o ? `, aged ${o.age}` : ''}.`);
  if (!o) return out;
  out.push(`“${o.line}”`);
  if (o.known.length) out.push(`Known for ${list(o.known)}.`);
  out.push(o.leaves.length ? `They leave behind ${list(o.leaves)}.` : 'They leave nobody behind but the town.');
  return out;
}
