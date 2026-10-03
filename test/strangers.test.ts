import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIFESPANS } from '../src/shared/data/lifespans';
import { THIRST_BITES } from '../src/shared/data/monsters';
import { Rng } from '../src/shared/rng';
import { lifespanOf } from '../src/shared/sim/ageing';
import { answerThirst, THIRST_OPTIONS, updateMonsters } from '../src/shared/sim/monsters';
import { makeStranger, oneOf, strangerOrigin, welcomes } from '../src/shared/sim/strangers';
import { newGame, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_HOUR } from '../src/shared/sim/time';

test('a stranger of another people brings their look and their span; a vampire stranger comes in hiding', () => {
  const s = newGame('strangers');
  const p = s.people[0];
  makeStranger(s, p, 'dwarves');
  assert.equal(p.origin, 'dwarves');
  assert.equal(p.look.height, 0.86);
  assert.equal(lifespanOf(s, p), LIFESPANS.dwarves);
  assert.equal(oneOf('dwarves'), 'a dwarf');
  const q: Person = { ...p, id: 9, look: { ...p.look } };
  makeStranger(s, q, 'vampire');
  assert.equal(q.monster, 'vampire');
  const m: Person = { ...p, id: 10, look: { ...p.look } };
  makeStranger(s, m, 'merfolk');
  assert.equal(m.look.ears, 'elf');
  // never the town's own people
  const rng = new Rng(5);
  for (let i = 0; i < 50; i++) assert.notEqual(strangerOrigin(s, rng), 'settlers');
});

test('the Deep Hold keeps to its own; settlers welcome anyone', () => {
  const d = newGame('hold', { origin: 'dwarves' });
  assert.ok(!welcomes(d, 'fae') && welcomes(d, 'dwarves') && welcomes(d, null));
  const s = newGame('open');
  assert.ok(welcomes(s, 'fae') && welcomes(s, 'vampire'));
});

test('a hidden vampire feeds the quiet way first; bites stir the town, and a tithe ends them', () => {
  const s = newGame('thirst');
  const v: Person = { ...s.people[0], id: 20, name: 'Pale', look: { ...s.people[0].look }, monster: 'vampire', order: 'hide', lastFed: -1e9 } as Person;
  s.people.push(v);
  const others = [1, 2, 3].map((i) => ({ ...s.people[0], id: 30 + i, name: `Sleeper ${i}`, look: { ...s.people[0].look }, monster: null, hp: 100, activity: 'sleep' }) as Person);
  s.people.push(...others);
  const at2 = (d: number) => d * 24 * TICKS_PER_HOUR + (2 + 24 - START_HOUR) * TICKS_PER_HOUR;
  const rng = new Rng(2);
  const nobody = () => {};
  // a prisoner: nobody in town is bitten
  s.prisoners.push({ id: 1, name: 'Captive', kind: 'bandit', since: 0 } as never);
  s.tick = at2(1);
  updateMonsters(s, rng, nobody);
  assert.ok(others.every((p) => p.hp === 100), 'the prisoner fed them');
  assert.equal(s.bites ?? 0, 0);
  s.prisoners.length = 0;
  // no quiet way left: townsfolk are bitten, and after enough the town speaks of it
  let day = 4;
  while ((s.bites ?? 0) < THIRST_BITES && day < 30) {
    v.lastFed = -1e9;
    s.tick = at2(day++);
    updateMonsters(s, rng, nobody);
  }
  assert.ok(others.some((p) => p.hp < 100), 'someone woke pale');
  assert.ok(s.prompts.some((q) => q.kind === 'thirst'), 'the town speaks of it');
  // the tithe: fed cleanly from then on
  answerThirst(s, THIRST_OPTIONS[0]);
  assert.ok(s.tithe);
  const before = others.map((p) => p.hp);
  v.lastFed = -1e9;
  s.tick = at2(day + 1);
  updateMonsters(s, rng, nobody);
  assert.deepEqual(others.map((p) => p.hp), before, 'nobody bitten under the tithe');
  assert.ok(v.lastFed > 0, 'and the vampire is fed');
});
