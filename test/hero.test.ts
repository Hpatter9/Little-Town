import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events';
import { DEFAULT_ALERTS } from '../src/shared/ipc';
import { plan } from '../src/shared/alerts';
import { Rng } from '../src/shared/rng';
import { answerEvent, startEvent } from '../src/shared/sim/events';
import { forecast } from '../src/shared/sim/forecast';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('the player can follow a townsperson (and stop); only the living can be followed', () => {
  const sim = new Sim(plainGame('follow'));
  const s = sim.state;
  const p = s.people[0];
  sim.command({ type: 'follow', person: p.id });
  sim.step();
  assert.equal(snapshot(s).hero, p.id);
  sim.command({ type: 'follow', person: 9999 });
  sim.step();
  assert.equal(snapshot(s).hero, null);
  sim.command({ type: 'follow', person: p.id });
  sim.command({ type: 'follow', person: null });
  sim.step();
  assert.equal(snapshot(s).hero, null);
});

test("the one you follow: their big moments are foreseen, and come as phone alerts", () => {
  const s = plainGame('hero-alert');
  s.people.push(makePerson(new Rng(3), s.nextId++, 'wanderer', s.people[0].x, s.people.map((p) => p.name)));
  startEvent(s, EVENT_BY_ID.talking_animal, new Rng(1));
  s.hero = s.event!.who;
  const hero = s.people.find((p) => p.id === s.hero)!;
  answerEvent(s, 0, new Rng(1)); // (they follow the fox: in a few hours, something happens to them)
  const events = forecast(s, TICKS_PER_DAY);
  const moment = events.find((e) => e.kind === 'hero');
  assert.ok(moment, 'a big moment foreseen');
  assert.equal(moment!.title, hero.name);
  const on = { ...DEFAULT_ALERTS, enabled: true, topic: 'test-topic' };
  assert.ok(plan(on, s, 1_000_000).some((x) => x.event.kind === 'hero'), 'an alert for it');
  assert.ok(!plan({ ...on, hero: false }, s, 1_000_000).some((x) => x.event.kind === 'hero'), 'unless turned off');
});
