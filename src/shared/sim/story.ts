// The founder's story (step 4 of playing the founder). A chapter is written at each big moment: the founding, a trip the
// founder led, a shop bought, a marriage, a child, a death in the family, a raid survived, a title earned and the
// founder's death. Each is two to four short lines built from what happened (`writeChapter`), kept in `s.story`, and
// told once in the event box too. When the founder dies the old story closes (its last chapter) and the heir's begins;
// the Story tab keeps both. Written only with the autopilot on, so the tests' plainGame stays quiet.

import { DEBRIEF_HOURS } from '../data/muster';
import { isChild } from './social';
import type { Fallen } from './annals';
import { notify, type GameState, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

export type ChapterKind = 'founding' | 'quest' | 'shop' | 'marriage' | 'child' | 'family' | 'raid' | 'title' | 'death' | 'heir';

export interface Chapter {
  /** Whose story: the founder's person id and name at the time. */
  who: number;
  name: string;
  kind: ChapterKind;
  title: string;
  /** Two to four short lines. */
  lines: string[];
  day: number;
  tick: number;
}

/** What the last look found about the founder's family and titles, so only what is new becomes a chapter. */
export interface StorySeen {
  who: number;
  partner: number | null;
  kin: Record<number, string>;
  kids: number[];
  titles: number;
}

export interface Story {
  chapters: Chapter[];
  seen?: StorySeen;
}

/** Chapters kept (the oldest go first). */
export const CHAPTERS_MOST = 120;

const storyOn = (s: GameState) => s.autopilot !== false;
const town = (s: GameState) => s.townName ?? 'the new town';
const founder = (s: GameState): Person | undefined => s.people.find((p) => p.id === s.mainId);
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Write a chapter about someone (the founder unless `about` says otherwise), and tell it in the event box. */
export function writeChapter(s: GameState, kind: ChapterKind, title: string, lines: string[], about?: { id: number; name: string }, quiet = false): void {
  if (!storyOn(s)) return;
  const f = about ?? founder(s);
  if (!f) return;
  const story = (s.story ??= { chapters: [] });
  story.chapters.push({ who: f.id, name: f.name, kind, title, lines: lines.slice(0, 4), day: calendar(s.tick).day, tick: s.tick });
  if (story.chapters.length > CHAPTERS_MOST) story.chapters.splice(0, story.chapters.length - CHAPTERS_MOST);
  if (quiet) return; // (the game over card tells the last one)
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title: `${f.name}'s story: ${title}`,
    text: lines[0] ?? title,
    story: lines.join(' '),
    who: f.id,
    options: ['Read on'],
    defaultOption: 0,
    expiresTick: s.tick + DEBRIEF_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
}

/** A person's kin as the founder has them now: the partner, the children, the parents. */
function kinOf(s: GameState, f: Person): { partner: number | null; kin: Record<number, string>; kids: number[] } {
  const kin: Record<number, string> = {};
  const kids: number[] = [];
  for (const q of s.people) {
    if (q.id === f.id) continue;
    const child = (q.parents ?? []).includes(f.id);
    if (q.id === f.partner || child || (f.parents ?? []).includes(q.id)) kin[q.id] = q.name;
    if (child) kids.push(q.id);
  }
  return { partner: f.partner ?? null, kin, kids };
}

const seenNow = (s: GameState, f: Person): StorySeen => ({ who: f.id, ...kinOf(s, f), titles: f.titles?.length ?? 0 });

/** Hourly: the founding, then whatever is new about the founder's family and titles. */
export function storyHourly(s: GameState): void {
  if (!storyOn(s) || s.tick % TICKS_PER_HOUR !== 0) return;
  const f = founder(s);
  if (!f) return;
  const story = (s.story ??= { chapters: [] });
  if (!story.chapters.length) {
    const others = s.people.filter((p) => p.id !== f.id && !isChild(p)).length;
    writeChapter(s, 'founding', 'The founding', [
      `${f.name} founded ${town(s)} and became its first leader.`,
      others ? `${others === 1 ? 'One other' : `${others} others`} came with them to raise the first shelters.` : 'They came alone, with a plan and little else.',
      'Everything still lay ahead.',
    ]);
    story.seen = seenNow(s, f);
    return;
  }
  const was = story.seen;
  const now = seenNow(s, f);
  story.seen = now;
  if (!was || was.who !== f.id) return; // (a new founder: their record starts from here)
  const byId = (id: number) => s.people.find((p) => p.id === id);
  if (now.partner !== null && now.partner !== was.partner) {
    const mate = byId(now.partner);
    if (mate) writeChapter(s, 'marriage', 'A marriage', [`${f.name} and ${mate.name} became a couple.`, `${mate.name} stands beside them in ${town(s)}.`]);
  }
  for (const id of now.kids) {
    if (was.kids.includes(id)) continue;
    const kid = byId(id);
    if (kid) writeChapter(s, 'child', 'A child', [`${kid.name} was born to ${f.name}${f.partner != null && byId(f.partner) ? ` and ${byId(f.partner)!.name}` : ''}.`, `The house in ${town(s)} grows fuller.`]);
  }
  for (const id of Object.keys(was.kin).map(Number)) {
    if (now.kin[id] !== undefined) continue;
    const gone = (s.fallen ?? []).find((q: Fallen) => q.id === id);
    if (!gone) continue; // (left rather than died)
    writeChapter(s, 'family', `${was.kin[id]} is dead`, [`${was.kin[id]} died ${gone.cause}.`, `${f.name} grieves, and ${town(s)} goes on.`]);
  }
  if (now.titles > was.titles) {
    const title = f.titles![f.titles!.length - 1];
    writeChapter(s, 'title', 'A title earned', [`${f.name} is now called ${f.name} ${title}.`, f.titleWhy?.[title] ?? 'It was earned by what they did, not what they said.']);
  }
}

/** A trip the founder was on has come home (sim/muster.ts `debrief`): led, won or lost. */
export function storyTrip(s: GameState, place: string, led: boolean, cleared: boolean, lost: string[], haul: string[]): void {
  const f = founder(s);
  if (!f) return;
  const lines = [`${f.name} ${led ? 'led' : 'joined'} the party to ${place}.`];
  if (cleared) lines.push(`${place} was cleared, and the party came home with the win.`);
  else lines.push(lost.length ? 'It went badly, and they came home without the win.' : 'They came home without finishing it.');
  if (lost.length) lines.push(`${joinNames(lost)} did not come back.`);
  else if (haul.length) lines.push(`They brought home ${joinNames(haul.slice(0, 3))}.`);
  writeChapter(s, 'quest', cleared ? 'A quest won' : 'A quest lost', lines);
}

/** The founder bought a shop. */
export function storyShop(s: GameState, shop: string, price: number): void {
  const f = founder(s);
  if (f) writeChapter(s, 'shop', 'A shop bought', [`${f.name} bought the ${shop} for ${price} coins.`, 'Now the takings, and the troubles, are theirs.']);
}

/** A raid is over and the founder lived through it. */
export function storyRaid(s: GameState, name: string, outcome: string): void {
  const f = founder(s);
  if (!f || f.downed) return;
  writeChapter(s, 'raid', 'A raid survived', [`The ${name} came for ${town(s)}, and ${f.name} was there.`, outcome, `${town(s)} is still standing.`]);
}

/** The founder has died (`heir` takes up the leadership; none: the game is over). The old story closes, the heir's begins. */
export function storyDeath(s: GameState, dead: Person, cause: string, heir: Person | undefined): void {
  writeChapter(
    s,
    'death',
    heir ? 'The founder dies' : 'The end',
    [`${dead.name} died ${cause}.`, heir ? `${heir.name} takes up the leadership of ${town(s)}.` : `There was no heir, and the people of ${town(s)} scattered.`],
    dead,
    !heir,
  );
  if (!heir) return;
  writeChapter(s, 'heir', 'A new leader', [`${heir.name} leads ${town(s)} now.`, `${dead.name}'s story is closed, and ${heir.name}'s begins.`], heir);
  const story = (s.story ??= { chapters: [] });
  story.seen = seenNow(s, heir);
  notify(s, `${heir.name}'s story begins.`);
}

/* ------------------------------------------------------------ seen */

export interface StoryBookView {
  who: number;
  name: string;
  /** The book is closed: the founder died. */
  closed: boolean;
  /** Newest first. */
  chapters: { kind: ChapterKind; title: string; lines: string[]; day: number }[];
}

/** The Story tab: one book a founder, the current one first. */
export function storyView(s: GameState): StoryBookView[] {
  const books: StoryBookView[] = [];
  for (const c of [...(s.story?.chapters ?? [])].reverse()) {
    let b = books.find((x) => x.who === c.who);
    if (!b) books.push((b = { who: c.who, name: c.name, closed: false, chapters: [] }));
    if (c.kind === 'death') b.closed = true;
    b.chapters.push({ kind: c.kind, title: c.title, lines: c.lines, day: c.day });
  }
  // (the open book first, then the closed ones, the latest closed first)
  return books.sort((a, b) => Number(a.closed) - Number(b.closed));
}
