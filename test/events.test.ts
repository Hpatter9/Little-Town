import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, EVENT_BY_ID } from '../src/shared/data/events';
import { Rng } from '../src/shared/rng';
import { EVENT_HOURS, answerEvent, maybeEvent, startEvent } from '../src/shared/sim/events';
import { catchUp } from '../src/shared/sim/offline';
import { markMult } from '../src/shared/sim/origin';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { mood } from '../src/shared/sim/townsfolk';

/** A town a few days on (made once: each test works on a copy). */
let grown: string | null = null;
function town(): GameState {
  if (!grown) {
    const sim = new Sim(newGame('events-town'));
    sim.state.nextEventTick = Number.MAX_SAFE_INTEGER; // (no events of its own while it grows)
    for (let t = 0; t < 3 * TICKS_PER_DAY; t++) sim.step();
    grown = JSON.stringify(sim.state);
  }
  return JSON.parse(grown);
}

test('the events: five hundred and the fateful ones, each with two or three answers and exactly one default', () => {
  assert.equal(EVENTS.length, 526); // (500, the 25 fateful ones, and the fire's follow-up)
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  for (const e of EVENTS) {
    assert.ok(e.options.length >= 2 && e.options.length <= 3, e.id);
    assert.equal(e.options.filter((o) => o.default).length, 1, `${e.id}: one default`);
  }
});

test('every answer to every event can be given, and what comes of it later happens too', () => {
  for (const def of EVENTS) {
    for (let o = 0; o < def.options.length; o++) {
      const sim = new Sim(town());
      const s = sim.state;
      s.nextEventTick = Number.MAX_SAFE_INTEGER;
      startEvent(s, def, new Rng(o + 1));
      const prompt = s.prompts.find((p) => p.kind === 'event')!;
      assert.ok(prompt, def.id);
      assert.ok(!/\{who\}|\{founder\}/.test(prompt.title + prompt.text + prompt.options.join()), `${def.id}: names filled in`);
      sim.command({ type: 'answerPrompt', prompt: prompt.id, option: o });
      sim.step();
      s.nextEventTick = Number.MAX_SAFE_INTEGER; // (no other event while it plays out)
      // (anything that comes later: up to three days on; the clock jumps hour to hour rather than the town running
      // all that while, which made this the slowest test by far)
      const rng = new Rng(o + 7);
      const end = s.tick + 3 * TICKS_PER_DAY;
      while (!s.gameOver && (s.eventLater?.length ?? 0) > 0 && s.tick < end) {
        const next = Math.min(...s.eventLater!.map((l) => l.tick));
        s.tick = Math.max(s.tick + 1, Math.ceil(next / TICKS_PER_HOUR) * TICKS_PER_HOUR);
        maybeEvent(s, rng);
        s.nextEventTick = Number.MAX_SAFE_INTEGER;
      }
      sim.step();
      assert.ok(!s.event || s.event.def !== def.id, `${def.id}/${o}: answered (a follow-up may be asked next)`);
      assert.ok(!(s.eventLater ?? []).length || s.gameOver, `${def.id}/${o}: later effects done`);
    }
  }
});

test('events come up in a town left alone, and nobody answering takes the default', () => {
  const sim = new Sim(town());
  const s = sim.state;
  s.nextEventTick = s.tick + 1;
  for (let t = 0; t < 2 * TICKS_PER_HOUR && !s.event; t++) sim.step();
  assert.ok(s.event, 'an event is asked');
  const def = EVENT_BY_ID[s.event!.def];
  const prompt = s.prompts.find((p) => p.kind === 'event')!;
  for (let t = 0; t < (EVENT_HOURS + 1) * TICKS_PER_HOUR && s.event; t++) sim.step();
  assert.equal(s.event, undefined, 'answered by default');
  assert.ok(!s.prompts.some((p) => p.id === prompt.id));
  assert.ok(s.eventLog!.includes(def.id));
});

test('an answer can leave a lasting mark: a lever pushed, or everyone\'s spirits', () => {
  const s = town();
  startEvent(s, EVENT_BY_ID.mercenaries, new Rng(1));
  s.coins = 100;
  answerEvent(s, 0, new Rng(1));
  assert.ok(markMult(s, 'fight') > 1, 'mercenaries fight for the town');
  const t = town();
  startEvent(t, EVENT_BY_ID.bard, new Rng(1));
  answerEvent(t, 0, new Rng(1));
  assert.ok(mood(t, t.people[0]).reasons.some((r) => r.text === 'A bard by the fire'));
});

test('while you are away, a question waits for you (its clock is held)', () => {
  const sim = new Sim(town());
  const s = sim.state;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  startEvent(s, EVENT_BY_ID.comet, new Rng(2));
  catchUp(sim, 3600_000);
  assert.ok(s.event, 'still waiting');
  assert.ok(s.prompts.some((p) => p.kind === 'event'));
});

test('away, a choice event pauses the town: at most one comes, and answering it sets the town going', () => {
  const sim = new Sim(town());
  const s = sim.state;
  s.nextEventTick = s.tick + 2 * TICKS_PER_HOUR;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER; // (no raid to reach the gate first)
  const start = s.tick;
  const { ticks } = catchUp(sim, 3 * 3600_000);
  assert.ok(s.event?.held, 'an event came and holds the town');
  assert.ok(s.paused, 'paused');
  assert.ok(ticks < 3 * TICKS_PER_HOUR && s.tick > start, 'it stopped where the event came');
  assert.equal(s.prompts.filter((p) => p.kind === 'event').length, 1, 'just the one');
  const at = s.tick;
  catchUp(sim, 3600_000);
  assert.equal(s.tick, at, 'still waiting next time');
  const p = s.prompts.find((q) => q.kind === 'event')!;
  sim.command({ type: 'answerPrompt', prompt: p.id, option: p.defaultOption });
  sim.step();
  assert.ok(!s.event && !s.paused, 'answered: the town runs on');
});

test('the phone alert for a choice event is sent, and nothing past it', async () => {
  const { plan } = await import('../src/shared/alerts');
  const { DEFAULT_ALERTS } = await import('../src/shared/ipc');
  const s = town();
  s.nextEventTick = s.tick + 2 * TICKS_PER_HOUR;
  s.nextRaidTick = s.tick + 6 * TICKS_PER_HOUR;
  const p = plan({ ...DEFAULT_ALERTS, enabled: true, topic: 't' }, s, 1_000_000);
  assert.equal(p.at(-1)?.event.kind, 'event', 'the event is the last alert');
  assert.ok(!p.some((x) => x.event.kind === 'raid'), 'the raid after it never comes while away');
});

test('the fateful events: rare, no sooner than their gap, and their effects bite (fire, ruin, exodus, learning, healing)', async () => {
  const { FATEFUL_EVENTS, FATEFUL_GAP_DAYS } = await import('../src/shared/data/fatefulEvents');
  const { TICKS_PER_DAY } = await import('../src/shared/sim/time');
  assert.ok(FATEFUL_EVENTS.length >= 20);
  for (const e of FATEFUL_EVENTS) assert.ok(e.fateful && (e.weight ?? 0) > 1, e.id);
  // not before day 3, and once one has come, not again for the gap
  const s = town();
  s.tick = TICKS_PER_DAY;
  assert.ok(!FATEFUL_EVENTS.some((e) => !e.when || e.when(s)), 'none on day 1');
  s.tick = 4 * TICKS_PER_DAY;
  assert.ok(FATEFUL_EVENTS.some((e) => e.when!(s)), 'some by day 4');
  s.lastFateful = s.tick - TICKS_PER_HOUR;
  assert.ok(!FATEFUL_EVENTS.some((e) => e.when!(s)), 'none right after one');
  s.lastFateful = s.tick - (FATEFUL_GAP_DAYS + 1) * TICKS_PER_DAY;
  assert.ok(FATEFUL_EVENTS.some((e) => e.when!(s)), 'again after the gap');
  // the effects: an exodus empties a share of the town, a fire sets roofs alight, a lesson is learned
  const t = town();
  for (let i = 0; i < 9; i++) t.people.push({ ...t.people[0], id: t.nextId++, name: `Hand ${i}` });
  const rng = new Rng(3);
  const before = t.people.length;
  startEvent(t, EVENT_BY_ID.secession, rng);
  answerEvent(t, 0, rng);
  assert.ok(t.people.length < before - 1, `an exodus: ${before} to ${t.people.length}`);
  assert.ok(t.people.some((p) => p.id === t.mainId), 'the founder stays');
  const done = t.research.done.length;
  startEvent(t, EVENT_BY_ID.lost_library, rng);
  answerEvent(t, 0, rng);
  assert.equal(t.research.done.length, done + 2, 'two topics learned outright');
  t.people[0].hp = 3;
  startEvent(t, EVENT_BY_ID.miracle, rng);
  answerEvent(t, 0, rng);
  assert.ok(t.people[0].hp > 3, 'healed');
});

test('events with weight: the fireline holds the town to it for a day; a fire let burn may come back as a worse choice', async () => {
  const { busyNow } = await import('../src/shared/sim/people');
  const sim = new Sim(town());
  const s = sim.state;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER; // (a raid's alarm rightly calls them off the line: none while we watch)
  const rng = new Rng(5);
  startEvent(s, EVENT_BY_ID.great_fire, rng);
  answerEvent(s, 0, rng); // (cut a fireline)
  assert.ok(s.busy && s.busy.until - s.tick === 24 * TICKS_PER_HOUR, 'a day of it');
  for (let t = 0; t < TICKS_PER_HOUR; t++) sim.step();
  const held = s.people.filter((p) => busyNow(s, p));
  assert.ok(held.length >= 1, 'people held to it');
  assert.ok(held.every((p) => p.task?.type === 'toil' || p.task?.type === 'eat' || p.task?.type === 'extinguish' || p.task?.type === 'tend'), held.map((p) => p.task?.type).join());
  for (let t = 0; t < 24 * TICKS_PER_HOUR; t++) sim.step();
  assert.ok(!s.people.some((p) => busyNow(s, p)), 'free again after the day');
  // let it burn: over a few seeds, sometimes it fizzles, sometimes the follow-up is put to the player
  let followed = 0;
  let fizzled = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const t2 = town();
    t2.nextEventTick = Number.MAX_SAFE_INTEGER;
    const r = new Rng(seed);
    startEvent(t2, EVENT_BY_ID.great_fire, r);
    answerEvent(t2, 2, r);
    // (the hours go by: what was left to burn comes back, or not)
    const from = Math.ceil(t2.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
    for (let h = 0; h <= 8; h++) {
      t2.tick = from + h * TICKS_PER_HOUR;
      maybeEvent(t2, r);
    }
    if (t2.event?.def === 'fire_spreads') followed++;
    else fizzled++;
  }
  assert.ok(followed >= 1 && fizzled >= 1, `followed ${followed}, fizzled ${fizzled}`);
});

test('an event that asks for coins says what the treasury holds, and what each answer costs', () => {
  const s = town();
  s.coins = 140;
  startEvent(s, EVENT_BY_ID.tribute, new Rng(1));
  const p = s.prompts.find((q) => q.kind === 'event')!;
  assert.match(p.text, /treasury holds 140 coins/);
  assert.match(p.options[0], /about 70 coins/);
});
