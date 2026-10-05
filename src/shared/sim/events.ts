// Choice events (EVENTS.md; CLAUDE.md, "Choices that wait for you"). Now and then something happens that stops and
// asks the player: a stranger at the gate, a comet, a quarrel. Each is a prompt with two or three answers and a
// default the town takes if nobody answers in time, so it never stalls. While the town is being caught up after time
// away the town stops at the question (holdForEvent, from offline.ts): paused, so at most one comes while you're away,
// and it waits for the player to come back and answer, which sets the town going again.
// The events are data (data/events.ts); what each answer does is a list of effects, applied here.

import { EVENTS, EVENT_BY_ID, type EventDef, type EventEffect } from '../data/events';
import type { EventOption } from '../data/eventKit';
import { MATERIALS, MATERIAL_NAMES, type Material } from '../data/materials';
import { ITEM_BY_ID } from '../data/items';
import { SKILL_NAMES, xpToNext } from '../data/skills';
import { TRAIT_BY_ID } from '../data/people';
import { ARRIVING_TYPES, FOOD_VALUE } from '../data/people';
import { TOPIC_BY_ID, TOPICS } from '../data/research';
import { BUILDING_BY_ID } from '../data/buildings';
import { isSeat } from '../data/seats';
import { demolish, placeBlueprint } from './buildings';
import { findSpot } from './planner';
import { newHorse } from './trade';
import { addItems } from './crafting';
import { gainSkill } from './townsfolk';
import { adjust } from './social';
import { setFire } from './fire';
import { minorWound } from './injuries';
import { canQueue } from './research';
import type { Rng } from '../rng';
import { depositNear, storages } from './buildings';
import { sicken } from './doom';
import { killPerson } from './health';
import { revealOccult } from './occult';
import { equipAll } from './crafting';
import { townFull, addStock, campX, campXY, earn, makePerson, maxHp, notify, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';
import { assignBeds, campEdge, joinOrigin } from './townsfolk';
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
    const out: string[] = [];
    if (l.effects) apply(s, l.effects, rng, l.who, out);
    else {
      const e = EVENT_BY_ID[l.event]?.options[l.option]?.effects[l.index];
      if (e && 'later' in e) apply(s, e.effects, rng, l.who, out);
    }
    tell(s, EVENT_BY_ID[l.event]?.title, out);
  }
  // (a follow-up waits for nothing but the open question)
  if (!s.event && s.eventNext) {
    const next = EVENT_BY_ID[s.eventNext];
    s.eventNext = undefined;
    if (next && grownUps(s).length) return startEvent(s, next, rng);
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
    title: `${def.fateful ? '⚡ ' : ''}${fill(s, def.title, who)}`,
    text: fill(s, def.text, who) + coinsLine(s, def),
    options: def.options.map((o) => fill(s, o.label, who) + costOf(s, o)),
    defaultOption: def.options.findIndex((o) => o.default),
    expiresTick: s.tick + hours(EVENT_HOURS),
  });
  s.event = { def: def.id, prompt: id, who: who?.id };
  if (def.fateful) s.lastFateful = s.tick;
  s.eventLog = [...(s.eventLog ?? []), def.id].slice(-NO_REPEAT);
  s.nextEventTick = s.tick + hours(rng.int(EVENT_GAP_HOURS[0], EVENT_GAP_HOURS[1]));
  notify(s, fill(s, def.title, who), true);
}

/** What an answer costs the treasury, said on its button: " (20 coins)", " (about 35 coins)". */
export function costOf(s: GameState, o: EventOption): string {
  let paid = 0;
  let share = 0;
  for (const e of o.effects) {
    if ('coins' in e && e.coins < 0) paid += -e.coins;
    if ('take' in e && e.take === 'coins') share += e.share;
  }
  const n = paid + Math.floor((s.coins ?? 0) * share);
  if (!paid && !share) return '';
  return share ? ` (about ${n} coins)` : ` (${n} coins)`;
}

/** Said under an event that asks for coins: what the treasury holds (the owner's ask: to know what there is to pay with). */
export function coinsLine(s: GameState, def: EventDef): string {
  const asks = def.options.some((o) => o.effects.some((e) => ('coins' in e && e.coins < 0) || ('take' in e && e.take === 'coins')));
  return asks ? ` (The treasury holds ${s.coins ?? 0} coins.)` : '';
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
  const out: string[] = [];
  apply(
    s,
    o.effects.filter((e) => !('later' in e)),
    rng,
    ev.who,
    out,
  );
  if (o.effects.some((e) => 'later' in e)) out.push('more to come');
  tell(s, def.title, out, o.label);
}

/** What came of an answer, said in one line under its title, so every choice is seen to do something. */
function tell(s: GameState, title: string | undefined, out: string[], choice?: string): void {
  if (!out.length) return;
  notify(s, `${title ?? 'What came of it'}: ${out.join(', ')}.`, true);
  // (kept a while for the feed's card: the question answered, and what came of it)
  s.eventOutcome = { title: title ?? 'What came of it', choice: choice ? fill(s, choice, undefined) : null, text: out.join(', '), tick: s.tick };
}

const span = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : h >= 20 ? 'a day' : `${Math.round(h)} hours`);
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const LEVER_NAMES: Record<string, string> = { work: 'work', build: 'building', crops: 'crops', forage: 'foraging', research: 'study', craft: 'crafting', travellers: 'travellers', prices: 'prices', fight: 'fighting', guard: 'the watch' };
const stockLine = (st: Record<string, number | undefined>) =>
  Object.entries(st)
    .filter(([, n]) => n)
    .map(([m, n]) => `+${n} ${(MATERIAL_NAMES[m as Material] ?? m).toLowerCase()}`)
    .join(', ');

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

function apply(s: GameState, effects: readonly EventEffect[], rng: Rng, whoId: number | undefined, out: string[] = []): void {
  const who = s.people.find((p) => p.id === whoId);
  const say = (x: string) => out.push(x);
  for (const e of effects) {
    if ('note' in e) notify(s, fill(s, e.note, who), true);
    else if ('mood' in e) {
      (s.marks ??= []).push({ lever: 'morale', value: e.mood, until: s.tick + hours(e.hours), text: fill(s, e.text, who) });
      say(`morale ${signed(e.mood)} for ${span(e.hours)}`);
    } else if ('mod' in e) {
      (s.marks ??= []).push({ lever: e.mod, value: e.mult, until: s.tick + hours(e.hours), text: fill(s, e.text, who) });
      const pc = Math.round(Math.abs(e.mult - 1) * 100);
      const better = e.mod === 'prices' ? e.mult < 1 : e.mult > 1;
      say(`${LEVER_NAMES[e.mod] ?? e.mod} ${pc}% ${better ? 'better' : 'worse'} for ${span(e.hours)}`);
    } else if ('gain' in e) {
      depositNear(s, campX(s), { ...e.gain });
      say(stockLine(e.gain));
    } else if ('take' in e) {
      const n = take(s, e.take, e.share);
      if (n) say(`${e.take === 'coins' ? `${n} coins` : e.take === 'food' ? `${n} food` : `${n} goods from the stores`} gone`);
    } else if ('coins' in e) {
      const n = Math.max(-(s.coins ?? 0), e.coins);
      s.coins = (s.coins ?? 0) + n;
      earn(s, 'events', n);
      if (n) say(`${signed(n)} coins`);
    } else if ('renown' in e) {
      for (const b of s.buildings) if (b.shop) b.shop.renown = Math.max(0, (b.shop.renown ?? 0) + e.renown);
      say(`the shop's renown ${signed(e.renown)}`);
    } else if ('reputation' in e) {
      s.reputation = Math.max(0, s.reputation + e.reputation);
      say(`reputation ${signed(e.reputation)}`);
    } else if ('skill' in e) {
      const on = e.on === 'all' ? grownUps(s) : e.on === 'founder' ? s.people.filter((p) => p.id === s.mainId) : [target(s, e.on === 'random' ? 'random' : 'who', whoId, rng, false)].filter((p): p is Person => !!p);
      for (const p of on) {
        const sk = p.skills[e.skill];
        let xp = 0;
        for (let i = 0; i < e.levels; i++) xp += xpToNext(sk.level + i);
        gainSkill(p, e.skill, Math.max(0, xp - sk.xp));
      }
      if (on.length) say(`${on.length > 1 ? 'everyone' : on[0].name} ${signed(e.levels)} ${SKILL_NAMES[e.skill]}`);
    } else if ('bond' in e) {
      const a = target(s, 'who', whoId, rng, false);
      const others = grownUps(s).filter((p) => p !== a);
      const b = e.with === 'random' || !a || a.id === s.mainId ? (others.length ? rng.pick(others) : undefined) : s.people.find((p) => p.id === s.mainId);
      if (a && b && a !== b) {
        adjust(s, a.id, b.id, e.bond);
        say(`${a.name} and ${b.name} ${e.bond > 0 ? 'closer' : 'at odds'}`);
      }
    } else if ('trait' in e) {
      const p = target(s, 'who', whoId, rng, false);
      const t = TRAIT_BY_ID[e.trait];
      if (p && t && !p.traits.includes(t.id)) {
        p.traits = p.traits.filter((x) => !t.excludes?.includes(x));
        p.traits.push(t.id);
        say(`${p.name} is now ${t.name}`);
      }
    } else if ('item' in e) {
      if (ITEM_BY_ID[e.item]) {
        addItems(s, e.item, e.count);
        equipAll(s);
        say(`${e.count > 1 ? `${e.count} ` : 'a '}${ITEM_BY_ID[e.item].name.toLowerCase()}`);
      }
    } else if ('horse' in e) {
      for (let i = 0; i < e.horse; i++) s.horses.push(newHorse(s, rng));
      say(`${e.horse === 1 ? 'a horse' : `${e.horse} horses`} for the stable`);
    } else if ('build' in e) {
      const def = BUILDING_BY_ID[e.build];
      const at = def ? findSpot(s, def) : null;
      if (def && at && placeBlueprint(s, def.id, at.x, at.y).ok) {
        const b = s.buildings[s.buildings.length - 1];
        b.delivered = { ...def.cost };
        say(`a ${def.name.toLowerCase()} to build, its makings on site`);
      } else if (def) {
        depositNear(s, campX(s), { ...def.cost });
        say(`the makings of a ${def.name.toLowerCase()}: ${stockLine(def.cost)}`);
      }
    } else if ('join' in e) for (let i = 0; i < e.join; i++) newcomer(s, rng, e.type);
    else if ('leave' in e) {
      const p = target(s, e.leave, whoId, rng);
      // (the founder is never sent away: a lone founder exiled once left an empty town with no end to it)
      if (p && p.id === s.mainId) notify(s, `${p.name} stays: the town cannot do without them.`);
      else if (p) {
        s.people = s.people.filter((q) => q !== p);
        assignBeds(s);
        notify(s, `${p.name} left the town.`, true);
      }
    } else if ('kill' in e) {
      const p = target(s, e.kill, whoId, rng);
      if (p && rng.chance(e.chance ?? 1)) killPerson(s, p, fill(s, e.cause, who));
    } else if ('wound' in e) {
      const hurt = e.wound === 'all' ? grownUps(s) : [target(s, e.wound, whoId, rng, false)].filter((p): p is Person => !!p);
      for (const p of hurt) {
        p.hp = Math.max(1, p.hp - e.hp);
        minorWound(s, p, e.hp, rng); // (a wound to show for it: sim/injuries.ts)
      }
    } else if ('sick' in e) {
      const pool = grownUps(s);
      for (let i = 0; i < e.sick && pool.length; i++) sicken(s, pool.splice(Math.floor(rng.next() * pool.length), 1)[0], rng);
    } else if ('raid' in e) {
      if (!s.raid) s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + hours(e.raid));
      say(`raiders within ${span(e.raid)}`);
    } else if ('calm' in e) {
      s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + hours(e.calm));
      say(`no raid for ${span(e.calm)}`);
    }
    else if ('research' in e) {
      const topic = s.research.queue[0];
      const t = topic ? TOPIC_BY_ID[topic] : undefined;
      if (t) {
        s.research.progress[topic] = Math.min(0.99, (s.research.progress[topic] ?? 0) + e.research / t.seconds);
        say(`study of ${t.name} ${e.research > 0 ? 'forward' : 'set back'}`);
      }
    } else if ('occult' in e) revealOccult(s, e.occult);
    else if ('chance' in e) apply(s, rng.chance(e.chance) ? e.then : (e.else ?? []), rng, whoId, out);
    // the fateful events' (data/fatefulEvents.ts)
    else if ('burn' in e) {
      const can = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && !isSeat(b.def));
      for (let i = 0; i < e.burn && can.length; i++) setFire(s, can.splice(Math.floor(rng.next() * can.length), 1)[0], true);
    } else if ('ruin' in e) {
      const can = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !isSeat(b.def) && !b.room);
      for (let i = 0; i < e.ruin && can.length; i++) {
        const b = can.splice(Math.floor(rng.next() * can.length), 1)[0];
        notify(s, `The ${BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? b.def} is brought down.`, true);
        demolish(s, b.id);
      }
    } else if ('exodus' in e) {
      const pool = grownUps(s).filter((p) => p.id !== s.mainId && p.away === null);
      const n = Math.round(pool.length * e.exodus);
      const gone: Person[] = [];
      for (let i = 0; i < n && pool.length; i++) gone.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
      if (gone.length) {
        s.people = s.people.filter((p) => !gone.includes(p));
        assignBeds(s);
        notify(s, `${gone.length} left the town: ${gone.map((p) => p.name).join(', ')}.`, true);
      }
    } else if ('sickShare' in e) {
      const pool = grownUps(s);
      const n = Math.round(pool.length * e.sickShare);
      for (let i = 0; i < n && pool.length; i++) sicken(s, pool.splice(Math.floor(rng.next() * pool.length), 1)[0], rng);
    } else if ('learn' in e) {
      for (let i = 0; i < e.learn; i++) {
        const r = s.research;
        const id = r.queue[0] ?? TOPICS.find((t) => !r.done.includes(t.id) && canQueue(r, t.id, s.era, s.origin).ok)?.id;
        if (!id) break;
        delete r.progress[id];
        r.queue = r.queue.filter((q) => q !== id);
        r.done.push(id);
        notify(s, `Learned outright: ${TOPIC_BY_ID[id]?.name ?? id}.`, true);
      }
    } else if ('heal' in e) {
      for (const p of s.people) {
        p.hp = maxHp(p);
        if (p.downed) p.downed = null;
      }
      notify(s, 'Everyone is whole again.', true);
    } else if ('herdLoss' in e) {
      for (const b of s.buildings) if (b.herd) b.herd.head = 0;
    } else if ('busy' in e) {
      const pool = grownUps(s).filter((p) => p.away === null && !p.guard);
      const n = Math.max(1, Math.round(pool.length * e.share));
      const ids = [...pool].sort((a, b) => a.id - b.id).filter((_, i) => i < n).map((p) => p.id);
      const at = e.at === 'camp' ? campXY(s) : campEdge(s, rng.chance(0.5) ? 1 : -1);
      s.busy = { until: s.tick + hours(e.busy), ids, text: e.text, x: at.x, y: at.y, anim: e.anim ?? 'chop' };
      notify(s, `${ids.length === grownUps(s).length ? 'The whole town' : `${ids.length} of the town`} ${ids.length === 1 ? 'is' : 'are'} at it for the next ${e.busy} hours: ${e.text.toLowerCase()}.`, true);
    } else if ('follow' in e) s.eventNext = e.follow;
    // (a later met inside a chance: kept with its effects)
    else if ('later' in e) (s.eventLater ??= []).push({ tick: s.tick + hours(e.later), event: '', option: 0, index: 0, who: whoId, effects: e.effects });
  }
}

/** Take a share of the town's food, its stores, or its coins. */
function take(s: GameState, what: 'food' | 'stores' | 'coins', share: number): number {
  if (what === 'coins') {
    const n = Math.floor((s.coins ?? 0) * share);
    s.coins = (s.coins ?? 0) - n;
    earn(s, 'events', -n);
    return n;
  }
  let gone = 0;
  const foods = new Set(Object.keys(FOOD_VALUE));
  for (const b of storages(s)) {
    for (const m of MATERIALS) {
      if (what === 'food' && !foods.has(m)) continue;
      const n = Math.floor((b.store[m] ?? 0) * share);
      if (n > 0) {
        addStock(b.store, m as Material, -n);
        gone += n;
      }
    }
  }
  return gone;
}

/** Someone takes up the town's offer and joins (a bed is found if there's one). */
function newcomer(s: GameState, rng: Rng, type?: string): void {
  if (townFull(s)) {
    notify(s, 'Someone would have stayed, but the town is as big as you want it: they go on their way.');
    return;
  }
  const p = makePerson(rng, s.nextId++, type ?? rng.weighted(ARRIVING_TYPES), campXY(s), s.people.map((q) => q.name));
  s.people.push(p);
  joinOrigin(s, p, rng);
  assignBeds(s);
  equipAll(s);
  notify(s, `${p.name} joined the town.`, true);
}

