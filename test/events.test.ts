import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, EVENT_BY_ID } from '../src/shared/data/events';
import { Rng } from '../src/shared/rng';
import { EVENT_HOURS, answerEvent, startEvent } from '../src/shared/sim/events';
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

test('the events: a hundred, each with two or three answers and exactly one default', () => {
  assert.equal(EVENTS.length, 100);
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
      // (anything that comes later: up to three days on)
      for (let t = 0; t < 3 * TICKS_PER_DAY && !s.gameOver && (s.eventLater?.length ?? 0) > 0; t++) sim.step();
      sim.step();
      assert.equal(s.event, undefined, `${def.id}/${o}: answered`);
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
