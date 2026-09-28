import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { knockDown } from '../src/shared/sim/health';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

const notes = (s: { notices: { text: string }[] }) => s.notices.map((n) => n.text);

test('a new town is told it runs itself (once), and the founder downed gives no bleeding note', () => {
  const s = newGame('advice');
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(notes(s).filter((t) => t.startsWith('The town runs itself')).length, 1);
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(notes(s).filter((t) => t.startsWith('The town runs itself')).length, 1, 'only once');
  knockDown(s, s.people[0]); // (the founder never bleeds: no wounded note for them)
  sim.step();
  assert.ok(!notes(s).some((t) => t.includes('bleeds out')));
});

test('a town left to itself researches, marks land and plans a building within the first hours', () => {
  const s = newGame('left-alone');
  const sim = new Sim(s);
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  assert.ok(s.research.queue.length + s.research.done.length > 0, 'it picked research');
  assert.ok(s.tiles.some((t) => t.designated) || s.buildings.length > 1, 'it set to gathering or building');
  assert.ok(s.plan, 'its plan is there for the panels');
});
