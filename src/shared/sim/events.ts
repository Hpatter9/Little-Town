// Choice events (EVENTS.md; CLAUDE.md, "Choices that wait for you"). Now and then something happens that stops and
// asks the player: a stranger at the gate, a comet, a quarrel. Each is a prompt with two or three answers and a
// default the town takes if nobody answers in time, so it never stalls. While the town is being caught up after time
// away the town stops at the question (holdForEvent, from offline.ts): paused, so at most one comes while you're away,
// and it waits for the player to come back and answer, which sets the town going again.
// The events are data (data/events.ts); what each answer does is a list of effects, applied here.

import { EVENTS, EVENT_BY_ID, type EventDef, type EventEffect } from '../data/events';
import { MATERIALS, type Material } from '../data/materials';
import { ARRIVING_TYPES, FOOD_VALUE } from '../data/people';
import { TOPIC_BY_ID } from '../data/research';
import type { Rng } from '../rng';
import { depositNear, storages } from './buildings';
import { sicken } from './doom';
import { killPerson } from './health';
import { revealOccult } from './occult';
import { equipAll } from './crafting';
import { addStock, campX, earn, makePerson, notify, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';
import { assignBeds, joinOrigin } from './townsfolk';
import { isChild } from './social';

/** Game hours an event waits for an answer before the default is taken (in play; it waits while you're away). */
export const EVENT_HOURS = 3;
/** The first event comes no sooner than this (game hours), and then one every so often. */
export const EVENT_GRACE_HOURS = 18;
export const EVENT_GAP_HOURS: [number, number] = [16, 30];
/** An event isn't drawn again until this many others have come. */
const NO_REPEAT = 25;

const hours = (h: number) => Math.round(h * TICKS_PER_HOUR);
const grownUps = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !isChild(p));

/** Once an hour, maybe an event (one at a time). */
export function maybeEvent(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  // (lasting marks and later effects run on, event or not)
  if (s.marks?.length) s.marks = s.marks.filter((m) => m.until > s.tick);
  for (const l of [...(s.eventLater ?? [])]) {
    if (l.tick > s.tick) continue;
    s.eventLater = s.eventLater!.filter((q) => q !== l);
    const e = EVENT_BY_ID[l.event]?.options[l.option]?.effects[l.index];
    if (e && 'later' in e) apply(s, e.effects, rng, l.who);
  }
  if (s.event || s.tick < (s.nextEventTick ?? hours(EVENT_GRACE_HOURS)) || !grownUps(s).length) return;
  const seen = s.eventLog ?? [];
  const open = EVENTS.filter((e) => !seen.includes(e.id) && (!e.when || e.when(s)));
  if (!open.length) return;
  const id = rng.weighted(Object.fromEntries(open.map((e) => [e.id, e.weight ?? 1])));
  startEvent(s, EVENT_BY_ID[id], rng);
}

/** Put an event to the player now. */
export function startEvent(s: GameState, def: EventDef, rng: Rng): void {
  const pool = grownUps(s).filter((p) => p.id !== s.mainId);
  const who = def.who ? (pool.length ? rng.pick(pool) : grownUps(s)[0]) : undefined;
  const id = s.nextId++;
  s.prompts.push({
    id,
    kind: 'event',
    expedition: null,
    title: fill(s, def.title, who),
    text: fill(s, def.text, who),
    options: def.options.map((o) => fill(s, o.label, who)),
    defaultOption: def.options.findIndex((o) => o.default),
    expiresTick: s.tick + hours(EVENT_HOURS),
  });
  s.event = { def: def.id, prompt: id, who: who?.id };
  s.eventLog = [...(s.eventLog ?? []), def.id].slice(-NO_REPEAT);
  s.nextEventTick = s.tick + hours(rng.int(EVENT_GAP_HOURS[0], EVENT_GAP_HOURS[1]));
  notify(s, fill(s, def.title, who), true);
}

/** The player answered (or the time ran out and the default was taken). */
export function answerEvent(s: GameState, option: number, rng: Rng): void {
  const ev = s.event;
  s.event = undefined;
  if (!ev) return;
  if (ev.held) s.paused = false; // (it stopped the town while you were away: answered, the town runs on)
  const def = EVENT_BY_ID[ev.def];
  const o = def?.options[option];
  if (!o) return;
  o.effects.forEach((e, i) => {
    if ('later' in e) (s.eventLater ??= []).push({ tick: s.tick + hours(e.later), event: def.id, option, index: i, who: ev.who });
  });
  apply(
    s,
    o.effects.filter((e) => !('later' in e)),
    rng,
    ev.who,
  );
}

/** While the town is caught up after time away, a choice event stops it: the town pauses and waits for the player.
 *  Returns true when it has. */
export function holdForEvent(s: GameState): boolean {
  if (!s.event || !s.prompts.some((p) => p.id === s.event!.prompt)) return false;
  s.event.held = true;
  s.paused = true;
  holdEventClock(s);
  return true;
}

/** While the town is caught up after time away, open questions wait for the player (their clock is held). */
export function holdEventClock(s: GameState): void {
  for (const p of s.prompts) if (p.kind === 'event') p.expiresTick = Math.max(p.expiresTick, s.tick + hours(EVENT_HOURS));
}

function fill(s: GameState, text: string, who: Person | undefined): string {
  const founder = s.people.find((p) => p.id === s.mainId);
  return text.replace(/\{who\}/g, who?.name ?? 'someone').replace(/\{founder\}/g, founder?.name ?? 'the founder');
}

function target(s: GameState, which: 'who' | 'random', whoId: number | undefined, rng: Rng, spareFounder = true): Person | undefined {
  if (which === 'who') {
    const p = s.people.find((q) => q.id === whoId && q.away === null);
    if (p) return p;
  }
  const pool = grownUps(s).filter((p) => !spareFounder || p.id !== s.mainId);
  return pool.length ? rng.pick(pool) : undefined;
}

function apply(s: GameState, effects: readonly EventEffect[], rng: Rng, whoId: number | undefined): void {
  const who = s.people.find((p) => p.id === whoId);
  for (const e of effects) {
    if ('note' in e) notify(s, fill(s, e.note, who), true);
    else if ('mood' in e) (s.marks ??= []).push({ lever: 'morale', value: e.mood, until: s.tick + hours(e.hours), text: fill(s, e.text, who) });
    else if ('mod' in e) (s.marks ??= []).push({ lever: e.mod, value: e.mult, until: s.tick + hours(e.hours), text: fill(s, e.text, who) });
    else if ('gain' in e) depositNear(s, campX(s), { ...e.gain });
    else if ('take' in e) take(s, e.take, e.share);
    else if ('coins' in e) {
      const n = Math.max(-(s.coins ?? 0), e.coins);
      s.coins = (s.coins ?? 0) + n;
      earn(s, 'events', n);
    } else if ('renown' in e) {
      for (const b of s.buildings) if (b.shop) b.shop.renown = Math.max(0, (b.shop.renown ?? 0) + e.renown);
    } else if ('reputation' in e) s.reputation = Math.max(0, s.reputation + e.reputation);
    else if ('join' in e) for (let i = 0; i < e.join; i++) newcomer(s, rng, e.type);
    else if ('leave' in e) {
      const p = target(s, e.leave, whoId, rng);
      if (p) {
        s.people = s.people.filter((q) => q !== p);
        assignBeds(s);
        notify(s, `${p.name} left the town.`, true);
      }
    } else if ('kill' in e) {
      const p = target(s, e.kill, whoId, rng);
      if (p && rng.chance(e.chance ?? 1)) killPerson(s, p, fill(s, e.cause, who));
    } else if ('wound' in e) {
      const hurt = e.wound === 'all' ? grownUps(s) : [target(s, e.wound, whoId, rng, false)].filter((p): p is Person => !!p);
      for (const p of hurt) p.hp = Math.max(1, p.hp - e.hp);
    } else if ('sick' in e) {
      const pool = grownUps(s);
      for (let i = 0; i < e.sick && pool.length; i++) sicken(s, pool.splice(Math.floor(rng.next() * pool.length), 1)[0], rng);
    } else if ('raid' in e) {
      if (!s.raid) s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + hours(e.raid));
    } else if ('calm' in e) s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + hours(e.calm));
    else if ('research' in e) {
      const topic = s.research.queue[0];
      const t = topic ? TOPIC_BY_ID[topic] : undefined;
      if (t) s.research.progress[topic] = Math.min(0.99, (s.research.progress[topic] ?? 0) + e.research / t.seconds);
    } else if ('occult' in e) revealOccult(s, e.occult);
    else if ('chance' in e) apply(s, rng.chance(e.chance) ? e.then : (e.else ?? []), rng, whoId);
  }
}

/** Take a share of the town's food, its stores, or its coins. */
function take(s: GameState, what: 'food' | 'stores' | 'coins', share: number): void {
  if (what === 'coins') {
    const n = Math.floor((s.coins ?? 0) * share);
    s.coins = (s.coins ?? 0) - n;
    earn(s, 'events', -n);
    return;
  }
  const foods = new Set(Object.keys(FOOD_VALUE));
  for (const b of storages(s)) {
    for (const m of MATERIALS) {
      if (what === 'food' && !foods.has(m)) continue;
      const n = Math.floor((b.store[m] ?? 0) * share);
      if (n > 0) addStock(b.store, m as Material, -n);
    }
  }
}

/** Someone takes up the town's offer and joins (a bed is found if there's one). */
function newcomer(s: GameState, rng: Rng, type?: string): void {
  const p = makePerson(rng, s.nextId++, type ?? rng.weighted(ARRIVING_TYPES), campX(s), s.people.map((q) => q.name));
  s.people.push(p);
  joinOrigin(s, p, rng);
  assignBeds(s);
  equipAll(s);
  notify(s, `${p.name} joined the town.`, true);
}

