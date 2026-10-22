import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { PARK_WAIT_TICKS, POPUP_MOST_TICKS, holdOf } from '../src/shared/sim/popups';
import { startRaid } from '../src/shared/sim/raids';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const ask = (s: GameState, id = 50) =>
  s.prompts.push({ id, kind: 'event', expedition: null, title: 'A question', text: '', options: ['Yes', 'No'], defaultOption: 0, expiresTick: s.tick + 100000 });

test('a question up stops the town; answering lets it run on', () => {
  const s = plainGame('pop-event');
  const sim = new Sim(s);
  ask(s);
  assert.equal(holdOf(s), 'popup');
  const tick = s.tick;
  for (let i = 0; i < 20; i++) sim.step(holdOf(s));
  assert.equal(s.tick, tick, 'the clock stood still');
  s.prompts = [];
  assert.equal(holdOf(s), null);
  sim.step(holdOf(s));
  assert.equal(s.tick, tick + 1);
});

test('a question that stays unanswered too long no longer holds the town', () => {
  const s = plainGame('pop-stuck');
  const sim = new Sim(s);
  ask(s);
  for (let i = 0; i < POPUP_MOST_TICKS + 2; i++) sim.step(holdOf(s));
  assert.equal(holdOf(s), null);
});

test("the raid's own question and the gate's don't hold the town", () => {
  const s = plainGame('pop-raid');
  s.prompts.push({ id: 1, kind: 'raid', expedition: null, title: '', text: '', options: ['a'], defaultOption: 0, expiresTick: 9e9 });
  assert.equal(holdOf(s), null);
});

test('a raid battle on screen plays while the town holds: the people do not move or tire', () => {
  const s = plainGame('pop-fight');
  s.battles = true;
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  s.people[s.people.length - 1].downed = { bleedUntil: null }; // (not in the fight: the town's own business)
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 5 && !fightOnScreen(s); i++) sim.step();
  assert.ok(fightOnScreen(s));
  assert.equal(holdOf(s), 'fight');
  const defenders = new Set(s.raid!.battle!.units.map((u) => u.person));
  const idle = s.people.filter((p) => !defenders.has(p.id));
  assert.ok(idle.length, 'someone is not in the fight');
  const food = idle.map((p) => p.needs.food);
  const at = idle.map((p) => `${p.x},${p.y}`);
  const phase = s.raid!.battle!.phase;
  for (let i = 0; i < 600 && s.raid?.battle?.phase === phase; i++) sim.step('fight');
  assert.notEqual(s.raid?.battle?.phase, phase, 'the fight moved on');
  assert.deepEqual(idle.map((p) => p.needs.food), food);
  assert.deepEqual(idle.map((p) => `${p.x},${p.y}`), at);
});

const ask2 = (s: GameState, id: number, extra: Partial<GameState['prompts'][number]> = {}) =>
  s.prompts.push({ id, kind: 'strangers', expedition: null, title: 'Strangers', text: '', options: ['Share', 'Pass'], defaultOption: 1, expiresTick: s.tick + 100 * TICKS_PER_HOUR, ...extra });

test('a question closed unanswered no longer holds the town, and settles itself after the wait', () => {
  const s = plainGame('pop-park');
  const sim = new Sim(s);
  ask2(s, 7);
  assert.equal(holdOf(s), 'popup');
  sim.command({ type: 'parkPrompt', prompt: 7 });
  sim.step(holdOf(s));
  assert.equal(holdOf(s), null, 'the town goes on');
  const t0 = s.tick;
  sim.step(holdOf(s));
  assert.equal(s.tick, t0 + 1);
  assert.ok(s.prompts.length === 1, 'it waits');
  assert.ok(s.prompts[0].expiresTick <= t0 + PARK_WAIT_TICKS, 'its wait was cut to the park wait');
  for (let i = 0; i < PARK_WAIT_TICKS + 5 && s.prompts.length; i++) sim.step(holdOf(s));
  assert.equal(s.prompts.length, 0, 'it settled on its default');
});

test('a waiting question opens again and holds the town while it is up', () => {
  const s = plainGame('pop-reopen');
  const sim = new Sim(s);
  ask2(s, 8);
  sim.command({ type: 'parkPrompt', prompt: 8 });
  sim.step(null);
  sim.command({ type: 'openPrompt', prompt: 8 });
  sim.step(null);
  assert.equal(holdOf(s), 'popup');
});

test('a choice that holds the town stays held when closed, and never times out', () => {
  const s = plainGame('pop-pinned');
  const sim = new Sim(s);
  ask2(s, 9, { waits: true, expiresTick: s.tick + 5 });
  sim.command({ type: 'parkPrompt', prompt: 9 });
  const t0 = s.tick;
  for (let i = 0; i < 50; i++) sim.step(holdOf(s));
  assert.equal(holdOf(s), 'popup');
  assert.equal(s.tick, t0);
  assert.equal(s.prompts.length, 1);
  // (and it is answered from the button's card)
  sim.command({ type: 'answerPrompt', prompt: 9, option: 0 });
  sim.step(holdOf(s));
  assert.equal(holdOf(s), null);
});

test("a debrief, the raid's question and the gate's cannot be parked", () => {
  const s = plainGame('pop-nopark');
  const sim = new Sim(s);
  ask2(s, 1, { kind: 'debrief' });
  ask2(s, 2, { kind: 'raid' });
  sim.command({ type: 'parkPrompt', prompt: 1 });
  sim.command({ type: 'parkPrompt', prompt: 2 });
  sim.step(null);
  assert.ok(s.prompts.every((p) => !p.parked));
});
