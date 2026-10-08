import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL } from '../src/shared/sim/land';
import { roadSafety, sheltered, spawnRoamer, startSkirmish } from '../src/shared/sim/roamers';
import { Sim } from '../src/shared/sim/sim';
import { campXY, makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { snapshot } from '../src/shared/sim/snapshot';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { campPx, plainGame } from './helpers';

function addPerson(s: GameState, type = 'hunter'): Person {
  const p = makePerson(new Rng(s.nextId * 31), s.nextId++, type, campPx(s), s.people.map((q) => q.name));
  p.traits = [];
  p.needs = { food: 1, rest: 1 };
  s.people.push(p);
  return p;
}

const hourOf = (s: { tick: number }) => calendar(s.tick).hour;

test('a band comes out on the land beyond the town, and travellers come less while it roams', () => {
  const s = plainGame('roam-spawn');
  const before = roadSafety(s);
  const r = spawnRoamer(s, 'beasts')!;
  assert.ok(r, 'a band');
  const c = campXY(s);
  assert.ok(Math.hypot(r.x - c.x, r.y - c.y) > 4 * CELL, 'out beyond the town');
  assert.ok(roadSafety(s) < before, 'the roads less safe');
});

test('someone out in the open is run down, and the fight is on: they stand and fight until it ends', () => {
  const sim = new Sim(plainGame('roam-catch'));
  const s = sim.state;
  const r = spawnRoamer(s, 'beasts')!;
  const p = s.people[0];
  p.x = r.x + 3 * CELL;
  p.y = r.y;
  p.task = { type: 'idle' } as Person['task'];
  for (let t = 0; t < 600 && p.skirmish === undefined; t++) sim.step();
  assert.ok(p.skirmish !== undefined, 'caught');
  const k = s.skirmishes!.find((q) => q.id === p.skirmish)!;
  assert.ok(k.e.battle, 'an FF fight');
  // (it can be watched, as a party's fight)
  sim.command({ type: 'watch', expedition: k.id });
  sim.step();
  assert.equal(s.watching, k.id);
  assert.ok(snapshot(s).watch?.battle, 'the fight screen has it');
  for (let t = 0; t < 20000 && k.ended === undefined; t++) sim.step();
  assert.ok(k.ended !== undefined, 'it ended');
  assert.equal(p.skirmish, undefined);
  assert.ok(k.e.result, 'a victory (or defeat) window');
});

test('the camp is a shelter by day but not by night, until a wall stands all round', () => {
  const s = plainGame('roam-shelter');
  const c = campXY(s);
  while (hourOf(s) !== 12) s.tick += TICKS_PER_HOUR;
  assert.equal(sheltered(s, c.x, c.y), true, 'by day the camp is kept off');
  while (hourOf(s) !== 23) s.tick += TICKS_PER_HOUR;
  assert.equal(sheltered(s, c.x, c.y), false, 'by night they come right in');
});

test('helpers near by join the fight, guards first', () => {
  const s = plainGame('roam-help');
  const r = spawnRoamer(s, 'bandits')!;
  const a = s.people[0];
  const b = addPerson(s, 'hunter');
  const far = addPerson(s, 'hunter');
  for (const p of [a, b, far]) p.hp = maxHp(p);
  a.x = r.x + 10;
  a.y = r.y;
  b.x = r.x + 2 * CELL;
  b.y = r.y;
  b.guard = true;
  far.x = r.x + 30 * CELL;
  far.y = r.y;
  const k = startSkirmish(s, r, a);
  assert.deepEqual(k.e.members, [a.id, b.id]);
  assert.equal(far.skirmish, undefined);
});

test('a guard on watch goes after a band near the town and takes it on', () => {
  const sim = new Sim(plainGame('roam-guard'));
  const s = sim.state;
  const g = s.people[0];
  g.guard = true;
  g.priorities.defend = 1;
  g.hp = maxHp(g);
  // (on shift: guards keep watch by turns, by their id)
  while (!((g.id % 2 === 0) === (hourOf(s) >= 6 && hourOf(s) < 18))) s.tick += TICKS_PER_HOUR;
  const r = spawnRoamer(s, 'beasts')!;
  for (let t = 0; t < 6000 && g.skirmish === undefined && !s.skirmishes?.length; t++) sim.step();
  assert.ok(s.skirmishes?.some((k) => k.e.members.includes(g.id) && k.roamer === r.id), 'the guard took it on');
});
