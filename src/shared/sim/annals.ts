// The town's annals (the owner's ask: a year-end chronicle and a hall of heroes). Who fell, and how (`s.fallen`,
// `recordFallen` from `killPerson`); the raiders each townsperson has felled (`Person.felled`, from the raid recap's
// tally); and once a year, at midwinter (`CHRONICLE_HOUR` on `CHRONICLE_DAY` of winter), the chronicle of the year past
// (`writeChronicle`): a full-screen card with a picture, the year told in a few lines, kept in `s.chronicles`. The year
// is reckoned from what the town looked like at the last chronicle, or its founding (`s.yearStart`), and from the raids
// tallied as they end (`s.yearRaids`).

import { ERA_NAMES } from '../data/eras';
import { callingName } from '../data/founderClasses';
import { levelOf, stageOf } from '../data/levels';
import { BUILDING_BY_ID } from '../data/buildings';
import { TOPIC_BY_ID } from '../data/research';
import { eventPicture } from '../data/eventScenes';
import { calendar, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { seaTown } from './sea';
import { notify, type GameState, type Person, type Prompt } from './state';
import { honour } from './memorials';

/** Midwinter: the second day of winter, of an evening. */
export const CHRONICLE_DAY = 2;
export const CHRONICLE_HOUR = 19;
/** How long the chronicle's card waits to be read (game hours). */
const CHRONICLE_HOURS = 24;
/** The fallen kept in the hall (the oldest drop off). */
export const FALLEN_MOST = 200;
/** Chronicles kept. */
export const CHRONICLES_MOST = 40;

export interface Fallen {
  id: number;
  name: string;
  /** The day they died, and how ("at the hands of the bandits", "of old age, full of days"). */
  day: number;
  cause: string;
  level: number;
  calling: string | null;
  titles: string[];
  felled: number;
  trips: number;
  founder: boolean;
}

export interface Chronicle {
  year: number;
  day: number;
  title: string;
  lines: string[];
}

/** What the town was at the start of the year being reckoned. */
export interface YearStart {
  tick: number;
  year: number;
  people: number[];
  felled: Record<number, number>;
  research: number;
  built: number[];
  sagas: number;
  uniques: number;
  era: string;
}

/** Remember someone who has died, for the hall of heroes and the year's chronicle. */
export function recordFallen(s: GameState, p: Person, cause: string): void {
  const f: Fallen = {
    id: p.id,
    name: p.name,
    day: calendar(s.tick).day,
    cause,
    level: levelOf(p),
    calling: callingName(p, stageOf(p)),
    titles: [...(p.titles ?? [])],
    felled: p.felled ?? 0,
    trips: p.trips ?? 0,
    founder: p.id === s.mainId,
  };
  (s.fallen ??= []).push(f);
  honour(s, p, f); // (the famous are honoured with a statue in the square: sim/memorials.ts)
  if (s.fallen.length > FALLEN_MOST) s.fallen.splice(0, s.fallen.length - FALLEN_MOST);
}

/** A raid has ended: tally it for the year. */
export function tallyRaid(s: GameState, outcome: 'victory' | 'driven' | 'pillaged'): void {
  const y = (s.yearRaids ??= { came: 0, won: 0, pillaged: 0 });
  y.came++;
  if (outcome === 'pillaged') y.pillaged++;
  else y.won++;
}

const doneBuildings = (s: GameState) => s.buildings.filter((b) => b.status === 'done').map((b) => b.id);

function startYear(s: GameState): void {
  s.yearStart = {
    tick: s.tick,
    year: calendar(s.tick).year,
    people: s.people.map((p) => p.id),
    felled: Object.fromEntries(s.people.map((p) => [p.id, p.felled ?? 0])),
    research: s.research.done.length,
    built: doneBuildings(s),
    sagas: (s.sagasDone ?? []).length,
    uniques: (s.uniques ?? []).length,
    era: s.era,
  };
  s.yearRaids = { came: 0, won: 0, pillaged: 0 };
}

/** Hourly: start the reckoning if there is none, and at midwinter write the chronicle of the year past. */
export function annalsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  if (!s.yearStart) return startYear(s);
  const cal = calendar(s.tick);
  if (cal.season !== 'winter' || cal.dayOfSeason !== CHRONICLE_DAY || cal.hour !== CHRONICLE_HOUR) return;
  if ((s.chronicles ?? []).some((c) => c.year === cal.year)) return;
  writeChronicle(s);
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const some = (xs: string[], most: number) => (xs.length > most ? `${list(xs.slice(0, most))} and ${xs.length - most} more` : list(xs));

/** The chronicle of the year past: written into `s.chronicles` and put to the player as a card with a picture. */
export function writeChronicle(s: GameState): Chronicle {
  const y = s.yearStart!;
  const cal = calendar(s.tick);
  const lines: string[] = [];
  const was = new Set(y.people);
  const now = s.people;
  const fresh = now.filter((p) => !was.has(p.id));
  const born = fresh.filter((p) => (p.parents ?? []).length > 0).map((p) => p.name);
  const came = fresh.filter((p) => !(p.parents ?? []).length).map((p) => p.name);
  const lost = (s.fallen ?? []).filter((f) => f.day >= calendar(y.tick).day);
  lines.push(`The town began the year ${y.people.length} strong and ends it ${now.length}.`);
  if (born.length) lines.push(`${born.length === 1 ? 'A child was' : `${born.length} children were`} born: ${some(born, 4)}.`);
  if (came.length) lines.push(`${some(came, 4)} came to live among us.`);
  if (lost.length) lines.push(`We lost ${lost.length === 1 ? 'one' : lost.length}: ${some(lost.map((f) => `${f.name}, ${f.cause}`), 3)}.`);
  else lines.push('Nobody was lost this year.');
  const r = s.yearRaids ?? { came: 0, won: 0, pillaged: 0 };
  if (r.came) lines.push(`${r.came === 1 ? 'One raid came' : `${r.came} raids came`}: ${r.won} driven off${r.pillaged ? `, ${r.pillaged} got away with what they came for` : ''}.`);
  else lines.push('No raider came to the gate.');
  // the year's champion: who felled the most raiders since the last chronicle
  const champ = now.map((p) => ({ p, n: (p.felled ?? 0) - (y.felled[p.id] ?? 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  if (champ) lines.push(`The year's champion was ${champ.p.name}, who felled ${champ.n === 1 ? 'a raider' : `${champ.n} raiders`}.`);
  const learned = s.research.done.slice(y.research);
  if (learned.length) lines.push(`We learned ${learned.length === 1 ? `one thing, ${topicName(learned[0])}` : `${learned.length} things, among them ${list(learned.slice(-3).map(topicName))}`}.`);
  const built = doneBuildings(s).filter((id) => !y.built.includes(id));
  const kinds = [...new Set(built.map((id) => BUILDING_BY_ID[s.buildings.find((b) => b.id === id)!.def]?.name).filter(Boolean))] as string[];
  if (built.length) lines.push(`${built.length === 1 ? 'One building rose' : `${built.length} buildings rose`}${kinds.length ? `: ${some(kinds.map((k) => k.toLowerCase()), 4)}` : ''}.`);
  if (s.era !== y.era) lines.push(`The town came into the ${ERA_NAMES[s.era]}.`);
  const sagas = (s.sagasDone ?? []).slice(y.sagas);
  if (sagas.length) lines.push(`${sagas.length === 1 ? 'A tale was' : `${sagas.length} tales were`} brought to an end.`);
  const uniques = (s.uniques ?? []).length - y.uniques;
  if (uniques > 0) lines.push(`${uniques === 1 ? 'A treasure of legend was' : `${uniques} treasures of legend were`} won.`);
  lines.push(lost.length > (r.came ? 2 : 1) ? 'It was a hard year. May the next be kinder.' : born.length + came.length > lost.length ? 'The town grows. May the next year be as kind.' : 'The fires are banked for winter, and the town waits on the spring.');
  const c: Chronicle = { year: cal.year, day: cal.day, title: `The chronicle of Year ${cal.year}`, lines };
  (s.chronicles ??= []).push(c);
  if (s.chronicles.length > CHRONICLES_MOST) s.chronicles.splice(0, s.chronicles.length - CHRONICLES_MOST);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief', // (read, not answered: the event box shows it and closes)
    expedition: null,
    title: c.title,
    text: lines[0],
    story: lines.join(' '),
    picture: eventPicture(`chronicle:${cal.year}`, 'town winter snow hearth', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: ['Close the book'],
    defaultOption: 0,
    expiresTick: s.tick + CHRONICLE_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${c.title} is written.`, true);
  startYear(s);
  return c;
}

const topicName = (id: string) => TOPIC_BY_ID[id]?.name ?? id;
