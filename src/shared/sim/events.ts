// Choice events (EVENTS.md; CLAUDE.md, "Choices that wait for you"). Now and then something happens that stops and
// asks the player: a stranger at the gate, a comet, a quarrel. Each is a prompt with two or three answers and a
// default the town takes if nobody answers in time, so it never stalls.
// The events are data (data/events.ts); what each answer does is a list of effects, applied here.

import { strangerTurn } from './specials';
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
import { Rng, hashSeed } from '../rng';
import { fateLanded, recordFate } from './fates';
import { depositNear, storages } from './buildings';
import { sicken } from './doom';
import { killPerson } from './health';
import { revealOccult } from './occult';
import { equipAll } from './crafting';
import { townFull, addStock, campX, campXY, earn, makePerson, maxHp, notify, setOutcome, type GameState, type Person } from './state';
import { TICKS_PER_HOUR, calendarOf } from './time';
import { weatherAt } from './weather';
import { seaTown } from './sea';
import { eventPicture, sceneLine } from '../data/eventScenes';
import { EVENT_MORE } from '../data/eventMore';
import { assignBeds, campEdge, joinOrigin, secretStranger } from './townsfolk';
import { isChild } from './social';
import { topicName } from '../data/originResearch';
import { alignAnswered, recommend } from './alignment';
import { shiftDread } from './calamity';
import { faithOf, godOf } from './faith';
import { DOMAINS, FAVOUR_MOST } from '../data/gods';
import { originOptions } from '../data/originOptions';
import { groveOf } from './grove';
import { courtOf } from './bargains';
import { orderOf } from './chivalry';
import { hordeOf } from './warpath';
import { packOn, packState } from './pack';
import { foundryOf } from './foundry';
import { workOf } from './greatWork';
import { frontierOf } from './frontier';
import { cellsOf } from './prisoners';
import { NAMES } from '../data/people';

/** Game hours an event waits for an answer before the default is taken (in play; it waits while you're away). */
export const EVENT_HOURS = 3;
/** The first event comes no sooner than this (game hours), and then one every so often. */
export const EVENT_GRACE_HOURS = 18;
export const EVENT_GAP_HOURS: [number, number] = [72, 120];
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
    heard = l.fate !== undefined ? [] : null;
    try {
      if (l.effects) apply(s, l.effects, l.fate !== undefined ? fateRng(s) : rng, l.who, out, l.fate);
      else {
        const e = EVENT_BY_ID[l.event] ? optionsOf(s, EVENT_BY_ID[l.event])[l.option]?.effects[l.index] : undefined;
        if (e && 'later' in e) apply(s, e.effects, l.fate !== undefined ? fateRng(s) : rng, l.who, out, l.fate);
      }
      if (l.fate !== undefined) fateLanded(s, l.fate, [...heard!, ...out]);
    } finally {
      heard = null;
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
  // (one turn in a hundred, a secret stranger comes to the gate instead: sim/specials.ts)
  if (strangerTurn(s) && secretStranger(s, rng)) {
    s.nextEventTick = s.tick + hours(rng.int(EVENT_GAP_HOURS[0], EVENT_GAP_HOURS[1]));
    return;
  }
  const seen = s.eventLog ?? [];
  const open = EVENTS.filter((e) => !seen.includes(e.id) && (!e.when || e.when(s)));
  if (!open.length) return;
  const id = rng.weighted(Object.fromEntries(open.map((e) => [e.id, e.weight ?? 1])));
  startEvent(s, EVENT_BY_ID[id], rng);
}

/** The full-screen box's telling of an event: a line setting the scene as the town is now, the event, and the
 *  longer passage written for it; its picture; and who it's about. */
function eventTelling(s: GameState, def: EventDef, who: Person | undefined): { story: string; picture: string; who?: number } {
  const c = calendarOf(s);
  const now = { hour: c.hour, season: c.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) } as const;
  const salt = def.id.length * 31 + c.day;
  const more = EVENT_MORE[def.id];
  const story = [sceneLine(now, salt), fill(s, def.text, who), more ? fill(s, more, who) : ''].filter(Boolean).join(' ') + coinsLine(s, def);
  return { story, picture: eventPicture(def.id, `${def.title} ${def.text}`, now), ...(who ? { who: who.id } : {}) };
}

/** An event's answers in this town: its own, and the extra one for the town's people at the end (data/originOptions.ts). */
export function optionsOf(s: GameState, def: EventDef): EventOption[] {
  const extra = originOptions(s.origin, def.id);
  return extra.length ? [...def.options, ...extra] : def.options;
}

/** Put an event to the player now. */
export function startEvent(s: GameState, def: EventDef, rng: Rng): void {
  const pool = grownUps(s).filter((p) => p.id !== s.mainId);
  const who = def.who ? (pool.length ? rng.pick(pool) : grownUps(s)[0]) : undefined;
  const id = s.nextId++;
  // (the town's own pick: shown on the card, and what it takes if nobody answers in time, when it runs itself)
  const options = optionsOf(s, def);
  // (the town recommends from the common answers; a people's own is the player's call)
  const rec = recommend(s, def);
  const usual = options.findIndex((o) => o.default);
  s.prompts.push({
    id,
    kind: 'event',
    expedition: null,
    title: `${def.fateful ? '⚡ ' : ''}${fill(s, def.title, who)}`,
    ...(def.fateful ? { fateful: true } : {}),
    text: fill(s, def.text, who) + coinsLine(s, def),
    options: options.map((o) => fill(s, o.label, who) + costOf(s, o)),
    defaultOption: s.autopilot !== false ? rec.option : usual,
    recommended: rec.option,
    why: rec.why,
    expiresTick: s.tick + hours(EVENT_HOURS),
    ...eventTelling(s, def, who),
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
  const asks = optionsOf(s, def).some((o) => o.effects.some((e) => ('coins' in e && e.coins < 0) || ('take' in e && e.take === 'coins')));
  return asks ? ` (The treasury holds ${s.coins ?? 0} coins.)` : '';
}

/** The player answered (or the time ran out and the default was taken). */
export function answerEvent(s: GameState, option: number, rng: Rng): void {
  const ev = s.event;
  s.event = undefined;
  if (!ev) return;
  const def = EVENT_BY_ID[ev.def];
  const o = def ? optionsOf(s, def)[option] : undefined;
  if (!o) return;
  // (a fateful answer is resolved on a stream of its own, and written down: sim/fates.ts)
  const fate = def.fateful ? s.tick : undefined;
  const dice = fate !== undefined ? fateRng(s) : rng;
  o.effects.forEach((e, i) => {
    if ('later' in e) (s.eventLater ??= []).push({ tick: s.tick + hours(e.later), event: def.id, option, index: i, who: ev.who, ...(fate !== undefined ? { fate } : {}) });
  });
  alignAnswered(s, def, option);
  const out: string[] = [];
  heard = fate !== undefined ? [] : null;
  try {
    apply(
      s,
      o.effects.filter((e) => !('later' in e)),
      dice,
      ev.who,
      out,
      fate,
    );
    if (fate !== undefined) recordFate(s, def.id, fill(s, def.remember ?? def.title, undefined), fill(s, o.label, undefined), [...heard!, ...out]);
  } finally {
    heard = null;
  }
  if (o.effects.some((e) => 'later' in e)) out.push('more to come');
  tell(s, def.title, out, o.label);
}

/** The stream a fateful choice is resolved on: its own, so the town's draws are left as they were. */
const fateRng = (s: GameState) => new Rng(hashSeed(`${s.seed}:fates:${s.tick}`));
/** Lines a fateful choice's notes and deaths say as it resolves, for the Chronicle (sim/fates.ts); null otherwise. */
let heard: string[] | null = null;

/** What came of an answer, said in one line under its title, so every choice is seen to do something. */
function tell(s: GameState, title: string | undefined, out: string[], choice?: string): void {
  if (!out.length) return;
  notify(s, `${title ?? 'What came of it'}: ${out.join(', ')}.`, true);
  // (kept a while for the feed's card: the question answered, and what came of it)
  setOutcome(s, title ?? 'What came of it', choice ? fill(s, choice, undefined) : null, out.join(', '));
}

const span = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : h >= 20 ? 'a day' : `${Math.round(h)} hours`);
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const LEVER_NAMES: Record<string, string> = { work: 'work', build: 'building', crops: 'crops', forage: 'foraging', research: 'study', craft: 'crafting', travellers: 'travellers', prices: 'prices', fight: 'fighting', guard: 'the watch' };
const stockLine = (st: Record<string, number | undefined>) =>
  Object.entries(st)
    .filter(([, n]) => n)
    .map(([m, n]) => `+${n} ${(MATERIAL_NAMES[m as Material] ?? m).toLowerCase()}`)
    .join(', ');

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

export function apply(s: GameState, effects: readonly EventEffect[], rng: Rng, whoId: number | undefined, out: string[] = [], fate?: number): void {
  const who = s.people.find((p) => p.id === whoId);
  const say = (x: string) => out.push(x);
  for (const e of effects) {
    if ('note' in e) {
      notify(s, fill(s, e.note, who), true);
      heard?.push(fill(s, e.note, who));
    }
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
      if (def && at && placeBlueprint(s, def.id, at.x, at.y, false, false, !!at.wild).ok) {
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
      if (p && rng.chance(e.chance ?? 1)) {
        killPerson(s, p, fill(s, e.cause, who));
        heard?.push(`${p.name} died ${fill(s, e.cause, who)}`);
      }
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
    } else if ('dread' in e) {
      // (the Calamity's dread, up or down: sim/calamity.ts)
      const c = s.calamity;
      if (c && c.beaten === undefined && shiftDread(s, e.dread)) {
        say(`the Calamity's dread ${signed(e.dread)}`);
      }
    }
    else if ('adopt' in e) {
      const p = newcomer(s, rng, e.adopt);
      const founder = s.people.find((q) => q.id === s.mainId);
      if (p) {
        s.heirId = p.id;
        if (founder) adjust(s, p.id, founder.id, 60);
        notify(s, `${p.name} is named heir to ${founder?.name ?? 'the founder'}: the town's leadership will pass to them.`, true);
        say(`${p.name} named heir`);
      }
    } else if ('favour' in e) {
      const f = faithOf(s);
      for (const d of e.favour === 'all' ? DOMAINS : [e.favour]) f.favour[d] = Math.max(-FAVOUR_MOST, Math.min(FAVOUR_MOST, f.favour[d] + e.by));
      say(e.favour === 'all' ? `the gods' favour ${signed(e.by)}` : `${godOf(s, e.favour)[0]}'s favour ${signed(e.by)}`);
    }
    else if ('ways' in e) ways(s, e.ways, e.by, say);
    else if ('captives' in e) {
      const room = Math.min(e.captives, Math.max(0, cellsOf(s) - s.prisoners.length));
      const taken = [...s.people, ...s.prisoners].map((p) => p.name);
      const free = NAMES.filter((x) => !taken.includes(x));
      for (let i = 0; i < room; i++) s.prisoners.push({ id: s.nextId++, enemy: 'bandit', name: free.length ? free.splice(Math.floor(rng.next() * free.length), 1)[0] : rng.pick(NAMES), conviction: 0, since: s.tick, hungry: false });
      say(room ? `${room} taken to the cells` : 'no cell free to hold them');
    }
    else if ('research' in e) {
      const topic = s.research.queue[0];
      const t = topic ? TOPIC_BY_ID[topic] : undefined;
      if (t) {
        s.research.progress[topic] = Math.min(0.99, (s.research.progress[topic] ?? 0) + e.research / t.seconds);
        say(`study of ${topicName(t.id, s.origin)} ${e.research > 0 ? 'forward' : 'set back'}`);
      }
    } else if ('occult' in e) revealOccult(s, e.occult);
    else if ('chance' in e) apply(s, rng.chance(e.chance) ? e.then : (e.else ?? []), rng, whoId, out, fate);
    // the fateful events' (data/fatefulEvents.ts)
    else if ('burn' in e) {
      const can = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && !isSeat(b.def));
      for (let i = 0; i < e.burn && can.length; i++) setFire(s, can.splice(Math.floor(rng.next() * can.length), 1)[0], true);
    } else if ('ruin' in e) {
      const can = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !isSeat(b.def) && !b.room);
      for (let i = 0; i < e.ruin && can.length; i++) {
        const b = can.splice(Math.floor(rng.next() * can.length), 1)[0];
        notify(s, `The ${BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? b.def} is brought down.`, true);
        demolish(s, b.id, 'felled');
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
        notify(s, `Learned outright: ${topicName(id, s.origin)}.`, true);
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
    else if ('later' in e) (s.eventLater ??= []).push({ tick: s.tick + hours(e.later), event: '', option: 0, index: 0, who: whoId, effects: e.effects, ...(fate !== undefined ? { fate } : {}) });
  }
}

/** A people's own measure moved (data/originOptions.ts); nothing happens in a town of another people. */
function ways(s: GameState, key: 'grove' | 'court' | 'honour' | 'fury' | 'renown' | 'power' | 'work' | 'wagons', by: number, say: (x: string) => void): void {
  const clamp = (n: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
  const g = key === 'grove' ? groveOf(s) : null;
  const c = key === 'court' ? courtOf(s) : null;
  const o = key === 'honour' ? orderOf(s) : null;
  const h = key === 'fury' ? hordeOf(s) : null;
  const f = key === 'power' ? foundryOf(s) : null;
  const w = key === 'work' ? workOf(s) : null;
  const fr = key === 'wagons' ? frontierOf(s) : null;
  if (g) { g.favour = clamp(g.favour + by); say(`the grove's favour ${signed(by)}`); }
  else if (c) { c.favour = clamp(c.favour + by); say(`the Court's favour ${signed(by)}`); }
  else if (o) { o.honour = clamp(o.honour + by); say(`the Order's honour ${signed(by)}`); }
  else if (h) { h.fury = clamp(h.fury + by, 0, 100); say(`the horde's fury ${signed(by)}`); }
  else if (key === 'renown' && packOn(s)) { const p = packState(s); p.renown = Math.max(0, p.renown + by); say(`the pack's renown ${signed(by)}`); }
  else if (f) { f.power = clamp(f.power + by, 0, 100); say(`the colony's power ${signed(by)}`); }
  else if (w) { w.progress = Math.max(0, w.progress + by); say(`the Great Work ${signed(by)}`); }
  else if (fr) { fr.wagons = Math.min(3, Math.max(0, (fr.wagons ?? 0) + by)); say('a wagon of settlers on the road'); }
}

/** Take a share of the town's food, its stores, or its coins. */
export function take(s: GameState, what: 'food' | 'stores' | 'coins', share: number): number {
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
function newcomer(s: GameState, rng: Rng, type?: string): Person | undefined {
  if (townFull(s)) {
    notify(s, 'Someone would have stayed, but the town is as big as you want it: they go on their way.');
    return undefined;
  }
  const p = makePerson(rng, s.nextId++, type ?? rng.weighted(ARRIVING_TYPES), campXY(s), s.people.map((q) => q.name), s.origin ?? 'settlers');
  s.people.push(p);
  joinOrigin(s, p, rng);
  assignBeds(s);
  equipAll(s);
  notify(s, `${p.name} joined the town.`, true);
  return p;
}

