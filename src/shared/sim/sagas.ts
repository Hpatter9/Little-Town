// Sagas (data/sagas.ts; the owner's ask: long quest chains, taken on by the town itself). Every so often a saga
// begins (`sagasHourly`: at most `MAX_SAGAS` at once, `SAGA_GAP_DAYS` apart, one the town hasn't had); each run walks its
// chapters: a choice is a question of kind `saga` shown full screen with its picture (the town takes the default if
// nobody answers in `SAGA_ASK_HOURS`); a trip is a place on the Expedition Board (`saga:<run>`, type `clear`), chosen
// by the parties themselves (`PULL_SAGA`), won when the party clears it (`sagaTripHome`); a task waits for the town to
// have something done; a raid comes to the gate (`Raid.saga`, decided in `sagaRaidOver`); an end leaves the town its
// effects, a title for the hero and perhaps a unique. Everything here draws on its own seeded stream.

import { MAX_SAGAS, SAGAS, SAGA_ASK_HOURS, SAGA_BY_ID, SAGA_DAILY, SAGA_FIRST_DAY, SAGA_GAP_DAYS, SAGA_HOUR, type Chapter, type Foes, type Next, type SagaDef, type SagaEffect } from '../data/sagas';
import type { EventEffect } from '../data/eventKit';
import type { Destination } from '../data/expeditions';
import { ENEMIES } from '../data/enemies';
import { ITEM_BY_ID } from '../data/items';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { notify, type Expedition, type GameState, type Person, type Raid, type SagaRun } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { raidBudget, raidKindsFor, scheduleNextRaid, startRaid } from './raids';
import { apply } from './events';
import { isChild, adjust, opinion } from './social';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { addItems } from './crafting';
import { describeFoes } from './places';

const hours = (h: number) => Math.round(h * TICKS_PER_HOUR);
const streamOf = (s: GameState, run: SagaRun, salt: number) => Rng.from(hashSeed(s.seed), run.run, s.tick, salt);
const grownUps = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !isChild(p));
const person = (s: GameState, id: number | undefined) => (id === undefined ? undefined : s.people.find((p) => p.id === id));

export const SAGA_DEST = 'saga:';
export const isSagaDest = (id: string) => id.startsWith(SAGA_DEST);
const runOfDest = (s: GameState, id: string) => (s.sagas ?? []).find((r) => `${SAGA_DEST}${r.run}` === id);
const defOf = (r: SagaRun): SagaDef => SAGA_BY_ID[r.id];
const chapterOf = (r: SagaRun): Chapter => defOf(r).chapters[r.ch];

/** The hero: the leader of the saga's last trip won, while they live; else the founder. */
export const heroOf = (s: GameState, r: SagaRun): Person | undefined => person(s, r.hero) ?? person(s, s.mainId) ?? s.people[0];

/** A saga's words with its people in them. */
export function sagaText(s: GameState, r: SagaRun, text: string): string {
  const founder = person(s, s.mainId);
  const out = text
    .replace(/\{hero\}/g, heroOf(s, r)?.name ?? 'the hero')
    .replace(/\{founder\}/g, founder?.name ?? 'the founder')
    .replace(/\{a\}/g, person(s, r.a)?.name ?? 'one of them')
    .replace(/\{b\}/g, person(s, r.b)?.name ?? 'the other')
    .replace(/\{town\}/g, 'the town');
  return out.replace(/(^|[.!?]["”]?\s+)the town/g, '$1The town');
}

/* ------------------------------------------------------------ beginning */

/** Each morning a new saga may begin. */
export function sagasHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const r of [...(s.sagas ?? [])]) drive(s, r);
  if (s.autopilot === false || (s.nextEventTick ?? 0) >= Number.MAX_SAFE_INTEGER) return; // (a town of tests: no sagas unless begun)
  if (calendar(s.tick).hour !== SAGA_HOUR) return;
  maybeBegin(s);
}

function maybeBegin(s: GameState): void {
  const running = s.sagas ?? [];
  if (running.length >= MAX_SAGAS || s.gameOver) return;
  if (s.tick < SAGA_FIRST_DAY * TICKS_PER_DAY) return;
  // (the break runs from the end of the last one: a long saga doesn't eat into it)
  const ended = Math.max(s.lastSaga ?? -Infinity, ...(s.sagasDone ?? []).map((d) => d.tick));
  if (s.tick - ended < SAGA_GAP_DAYS * TICKS_PER_DAY) return;
  const rng = Rng.from(hashSeed(s.seed), s.tick, 0x5a6a);
  if (!rng.chance(SAGA_DAILY)) return;
  const open = sagasOpen(s);
  if (!open.length) return;
  beginSaga(s, open[rng.int(0, open.length - 1)].id);
}

/** The sagas that could begin now: not had, not under way, and right for the town. */
export function sagasOpen(s: GameState): SagaDef[] {
  const had = new Set([...(s.sagasDone ?? []).map((d) => d.id), ...(s.sagas ?? []).map((r) => r.id)]);
  return SAGAS.filter((g) => !had.has(g.id) && g.when(s) && (!g.cast || castFor(s).length === 2));
}

/** Two grown-ups at home, not the founder, the two who like each other least. */
function castFor(s: GameState): number[] {
  const pool = grownUps(s).filter((p) => p.id !== s.mainId);
  let best: [number, number] | null = null;
  let low = Infinity;
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const v = opinion(s, pool[i].id, pool[j].id);
      if (v < low) {
        low = v;
        best = [pool[i].id, pool[j].id];
      }
    }
  return best ?? [];
}

/** A saga begins (tests start one by its id). */
export function beginSaga(s: GameState, id: string): SagaRun | null {
  const def = SAGA_BY_ID[id];
  if (!def) return null;
  const run: SagaRun = { run: s.nextId++, id, ch: def.first, at: s.tick, flags: [], started: s.tick, log: [] };
  if (def.cast) {
    const [a, b] = castFor(s);
    if (a === undefined) return null;
    run.a = a;
    run.b = b;
  }
  (s.sagas ??= []).push(run);
  s.lastSaga = s.tick;
  notify(s, `A saga begins: ${def.title}. ${def.blurb}`, true);
  enter(s, run, def.first);
  return run;
}

/* ------------------------------------------------------------ chapters */

function resolve(s: GameState, r: SagaRun, next: Next): string {
  return typeof next === 'function' ? next(r.flags, s) : next;
}

function goTo(s: GameState, r: SagaRun, next: Next): void {
  const id = resolve(s, r, next);
  if (!defOf(r).chapters[id]) {
    finish(s, r, null);
    return;
  }
  enter(s, r, id);
}

function enter(s: GameState, r: SagaRun, id: string): void {
  r.ch = id;
  r.at = s.tick;
  const c = chapterOf(r);
  const def = defOf(r);
  switch (c.kind) {
    case 'choice': {
      const text = sagaText(s, r, c.text);
      s.prompts.push({
        id: s.nextId++,
        kind: 'saga',
        saga: r.run,
        expedition: null,
        title: def.title,
        text,
        story: [...r.log.slice(-1), text].join('\n\n'),
        picture: c.picture,
        who: heroOf(s, r)?.id,
        options: c.options.map((o) => sagaText(s, r, o.label)),
        defaultOption: c.default ?? 0,
        expiresTick: s.tick + hours(SAGA_ASK_HOURS),
      });
      break;
    }
    case 'trip':
      say(s, r, `${sagaText(s, r, c.text)} A party is wanted at ${c.place.replace(/^The /, 'the ')} within ${c.days} days (on the Expedition Board).`);
      break;
    case 'task':
      if (c.check(s)) goTo(s, r, c.done);
      else say(s, r, `${sagaText(s, r, c.text)} The town needs ${c.need}, within ${Math.round(c.hours / 24)} days.`);
      break;
    case 'raid':
      say(s, r, sagaText(s, r, c.text));
      if (!c.after) raidNow(s, r, c);
      break;
    case 'wait':
      if (c.text) say(s, r, sagaText(s, r, c.text));
      break;
    case 'end':
      finish(s, r, c);
      break;
  }
}

/** A line of the saga: in the Journal and its log. */
function say(s: GameState, r: SagaRun, line: string): void {
  r.log.push(line);
  notify(s, `${defOf(r).title}: ${line}`, true);
}

/** The hourly turn of a saga's chapter. */
function drive(s: GameState, r: SagaRun): void {
  const c = chapterOf(r);
  if (!c) return finish(s, r, null);
  const since = s.tick - r.at;
  switch (c.kind) {
    case 'choice':
      // (its question gone without an answer: asked again)
      if (!s.prompts.some((p) => p.kind === 'saga' && p.saga === r.run)) enter(s, r, r.ch);
      break;
    case 'trip': {
      const out = s.expeditions.some((e) => e.dest === `${SAGA_DEST}${r.run}`);
      if (!out && since >= c.days * TICKS_PER_DAY) {
        say(s, r, `Nobody went to ${c.place.replace(/^The /, 'the ')} in time.`);
        goTo(s, r, c.late ?? c.lose);
      }
      break;
    }
    case 'task':
      if (c.check(s)) goTo(s, r, c.done);
      else if (since >= hours(c.hours)) goTo(s, r, c.late);
      break;
    case 'raid':
      if (!s.raid && since >= hours(c.after ?? 0)) raidNow(s, r, c);
      break;
    case 'wait':
      if (since >= hours(c.hours)) goTo(s, r, c.next);
      break;
    case 'end':
      finish(s, r, c);
      break;
  }
}

/** The raid of a raid chapter, if the gate is free (else it waits for the one under way). */
function raidNow(s: GameState, r: SagaRun, c: Extract<Chapter, { kind: 'raid' }>): void {
  if (s.raid) return;
  const rng = streamOf(s, r, 0x7a1d);
  const open = raidKindsFor(s.era, 999).map((k) => k.id);
  const id = c.raid === 'people' ? (['bandits', 'marauders', 'gang', 'warband', 'army', 'pirates', 'rivals'].find((k) => open.includes(k)) ?? 'rivals') : c.raid;
  const kind = RAID_KIND_BY_ID[id];
  if (!kind) return goTo(s, r, c.win);
  const raid = startRaid(s, kind, Math.max(4, Math.round(raidBudget(s) * c.budget)), rng);
  raid.saga = r.run;
  if (c.boss && ENEMIES[c.boss] && raid.raiders.length) {
    const first = raid.raiders[0];
    const hp = ENEMIES[c.boss].hp;
    raid.raiders.push({ ...first, id: s.nextId++, kind: c.boss, hp, maxHp: hp, goal: 'harm', x: first.x + raid.side * 30, carrying: {} });
  }
  const prompt = s.prompts.find((q) => q.id === raid.prompt);
  if (prompt) {
    prompt.title = defOf(r).title;
    prompt.text = `${sagaText(s, r, c.text)} ${prompt.text}`;
  }
  scheduleNextRaid(s, rng);
}

/* ------------------------------------------------------------ the town's part */

/** The town answered a saga's question (or the time ran out). */
export function answerSaga(s: GameState, run: number | undefined, option: number): void {
  const r = (s.sagas ?? []).find((q) => q.run === run);
  if (!r) return;
  const c = chapterOf(r);
  if (c?.kind !== 'choice') return;
  const o = c.options[option] ?? c.options[c.default ?? 0];
  r.flags.push(...(o.set ?? []));
  const out = effects(s, r, o.effects ?? []);
  say(s, r, `${sagaText(s, r, o.label)}${out.length ? ` (${out.join(', ')})` : ''}.`);
  goTo(s, r, o.next);
}

/** A party home from a saga's place: won if they cleared it. */
export function sagaTripHome(s: GameState, e: Expedition): void {
  const r = runOfDest(s, e.dest);
  if (!r) return;
  const c = chapterOf(r);
  if (c?.kind !== 'trip') return;
  if (e.cleared) {
    r.hero = e.leader ?? e.members[0];
    say(s, r, `${person(s, r.hero)?.name ?? 'The party'} and the party won through at ${c.place.replace(/^The /, 'the ')}.`);
    goTo(s, r, c.win);
  } else if (!e.recalled) {
    say(s, r, `The party came back beaten from ${c.place.replace(/^The /, 'the ')}.`);
    goTo(s, r, c.lose);
  }
  // (recalled: the place waits on the board while there's time)
}

/** A saga's raid is over: beaten if its leader fell (else if more raiders fell than got away with anything). */
export function sagaRaidOver(s: GameState, raid: Raid): void {
  if (raid.saga === undefined) return;
  const r = (s.sagas ?? []).find((q) => q.run === raid.saga);
  if (!r) return;
  const c = chapterOf(r);
  if (c?.kind !== 'raid') return;
  const foes = raid.raiders.filter((rd) => !rd.ally);
  const boss = c.boss ? foes.find((rd) => rd.kind === c.boss) : undefined;
  const fell = foes.filter((rd) => rd.down).length;
  const robbed = foes.some((rd) => rd.gone && Object.values(rd.carrying).some((n) => (n ?? 0) > 0));
  const beaten = boss ? !!boss.down : !robbed && fell * 2 >= foes.length;
  goTo(s, r, beaten ? c.win : c.lose);
}

/* ------------------------------------------------------------ the end */

function finish(s: GameState, r: SagaRun, c: Extract<Chapter, { kind: 'end' }> | null): void {
  s.sagas = (s.sagas ?? []).filter((q) => q !== r);
  s.prompts = s.prompts.filter((p) => !(p.kind === 'saga' && p.saga === r.run));
  const def = defOf(r);
  const out = c ? effects(s, r, c.effects ?? []) : [];
  const outcome = c?.outcome ?? 'bittersweet';
  const ending = c ? sagaText(s, r, c.text) : 'The story trails off.';
  r.log.push(ending);
  notify(s, `${def.title} is ended. ${ending}${out.length ? ` (${out.join(', ')})` : ''}`, true);
  (s.sagasDone ??= []).push({ id: r.id, outcome, tick: s.tick, hero: heroOf(s, r)?.name });
}

/** A saga's effects: the events' own, and its own (the two it's about, the hero's title, a unique). */
function effects(s: GameState, r: SagaRun, list: readonly SagaEffect[]): string[] {
  const out: string[] = [];
  const rng = streamOf(s, r, 0xe5);
  const plain: EventEffect[] = [];
  const cast = (w: 'a' | 'b' | 'both') => [w !== 'b' ? person(s, r.a) : undefined, w !== 'a' ? person(s, r.b) : undefined].filter((p): p is Person => !!p);
  for (const e of list) {
    if ('castBond' in e) {
      if (r.a !== undefined && r.b !== undefined && person(s, r.a) && person(s, r.b)) adjust(s, r.a, r.b, e.castBond);
      out.push(e.castBond >= 0 ? 'they think better of each other' : 'bad blood between them');
    } else if ('castHurt' in e) {
      for (const p of cast(e.castHurt)) {
        p.hp = Math.max(1, p.hp - e.hp);
        minorWound(s, p, e.hp, rng);
      }
      out.push('blood drawn');
    } else if ('castKill' in e) {
      const p = cast(e.castKill)[0];
      if (p && rng.chance(e.chance)) killPerson(s, p, e.cause);
    } else if ('title' in e) {
      const h = heroOf(s, r);
      if (h) {
        (h.titles ??= []).push(e.title);
        out.push(`${h.name} is called ${e.title}`);
      }
    } else if ('unique' in e) {
      if (ITEM_BY_ID[e.unique] && !(s.uniques ?? []).includes(e.unique)) {
        (s.uniques ??= []).push(e.unique);
        addItems(s, e.unique, 1);
        out.push(`${ITEM_BY_ID[e.unique].name}, a unique weapon`);
      }
    } else plain.push(e as EventEffect);
  }
  if (plain.length) apply(s, plain, rng, heroOf(s, r)?.id, out);
  return out;
}

/* ------------------------------------------------------------ the board */

const foesOf = (s: GameState, f: Foes): Record<string, number> => {
  const g = typeof f === 'function' ? f(s) : f;
  return Object.fromEntries(Object.entries(g).filter(([k, n]) => ENEMIES[k] && (n ?? 0) > 0)) as Record<string, number>;
};

/** A saga's place on the Expedition Board, while it's at that chapter. */
export function sagaDestination(s: GameState, r: SagaRun): Destination | undefined {
  const c = chapterOf(r);
  if (c?.kind !== 'trip') return undefined;
  const foes = foesOf(s, c.foes);
  const left = Math.max(0, c.days * TICKS_PER_DAY - (s.tick - r.at)) / TICKS_PER_DAY;
  return {
    id: `${SAGA_DEST}${r.run}`,
    name: c.place,
    type: 'clear',
    outSeconds: c.out,
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: c.loot ?? {},
    threats: describeFoes(foes),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: foes, weight: 1 }] },
    recommendedParty: 3,
    scenery: c.scenery,
    description: `${defOf(r).title}: ${sagaText(s, r, c.text)} (${left >= 1 ? `${Math.floor(left)} days left` : 'less than a day left'})`,
  };
}

export const sagaDestinations = (s: GameState): Destination[] => (s.sagas ?? []).map((r) => sagaDestination(s, r)).filter((d): d is Destination => !!d);
export const sagaDestOf = (s: GameState, id: string): Destination | undefined => {
  const r = runOfDest(s, id);
  return r ? sagaDestination(s, r) : undefined;
};

/* ------------------------------------------------------------ seen */

export interface SagaView {
  run: number;
  title: string;
  blurb: string;
  /** Where it stands now, and what's happened. */
  now: string;
  log: string[];
  /** Its place on the board, if a trip waits. */
  dest: string | null;
}
export interface SagaDoneView {
  title: string;
  outcome: 'triumph' | 'bittersweet' | 'ruin';
  hero: string | null;
  day: number;
}

export function sagasView(s: GameState): { open: SagaView[]; done: SagaDoneView[] } {
  const open = (s.sagas ?? []).map((r) => {
    const c = chapterOf(r);
    const now =
      c?.kind === 'choice' ? 'Waiting on the town’s answer.'
      : c?.kind === 'trip' ? `A party is wanted at ${c.place.replace(/^The /, 'the ')}.`
      : c?.kind === 'task' ? `The town needs ${c.need}.`
      : c?.kind === 'raid' ? (s.raid?.saga === r.run ? 'Fighting at the gate.' : 'Trouble is coming.')
      : 'Time passes.';
    return { run: r.run, title: defOf(r).title, blurb: defOf(r).blurb, now, log: r.log.slice(-4), dest: c?.kind === 'trip' ? `${SAGA_DEST}${r.run}` : null };
  });
  const done = (s.sagasDone ?? []).map((d) => ({ title: SAGA_BY_ID[d.id]?.title ?? d.id, outcome: d.outcome, hero: d.hero ?? null, day: Math.floor(d.tick / TICKS_PER_DAY) + 1 }));
  return { open, done };
}
