import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainGame } from './helpers';
import { townWhy } from '../src/shared/sim/whyLines';
import { queueCraft } from '../src/shared/sim/crafting';
import { serialize } from '../src/shared/sim/save';

test('no picks, no lines', () => {
  const s = plainGame('why-none');
  s.plan = null as never;
  assert.equal(townWhy(s), undefined);
});

test('the planner\'s build and research picks read as plain sentences', () => {
  const s = plainGame('why-lines');
  s.plan = { build: { def: 'campfire', why: 'food stores run out in 3 days' }, research: { id: 'fire_keeping', why: 'it opens new things to build and make' }, gathering: [], waiting: [] };
  const w = townWhy(s)!;
  assert.match(w.build!, /^Building a campfire because food stores run out in 3 days\.$/);
  assert.match(w.research ?? '', /^Studying .+ because it opens new things to build and make\.$|^$/);
});

test('a craft order is explained from what it is', () => {
  const s = plainGame('why-craft');
  s.research.done.push('fire_keeping');
  queueCraft(s, 'lumber');
  const w = townWhy(s);
  if (s.crafting.length) assert.match(w!.craft!, /^Making .+ because .+\.$/);
});

test('the lines are derived: nothing about them is saved', () => {
  const s = plainGame('why-save');
  s.plan = { build: { def: 'campfire', why: 'x' }, research: null, gathering: [], waiting: [] };
  const before = serialize(s, 0);
  townWhy(s);
  assert.equal(serialize(s, 0), before);
  assert.ok(!('why' in s));
});
