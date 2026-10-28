import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID, UPGRADES } from '../src/shared/data/buildings';
import { TOPICS } from '../src/shared/data/research';
import { seatId, seatOf } from '../src/shared/data/seats';
import { parseCommand } from '../src/shared/sim/commands';
import { prereqsMet, seatNeeded, seatStageNow } from '../src/shared/sim/research';
import { Sim } from '../src/shared/sim/sim';
import { addStock, newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { OFFER_WAIT_TICKS } from '../src/shared/sim/researchOffer';
import { plainGame } from './helpers';

const stoneAge = TOPICS.filter((t) => (t.era ?? 'neolithic') === 'neolithic' && !t.origin && !t.hidden).map((t) => t.id);
const ready = (done: string[]) => stoneAge.filter((id) => !done.includes(id) && TOPICS.find((t) => t.id === id)!.prereqs.every((p) => done.includes(p)));

test('the commands are checked: a topic must exist, and a move goes one way', () => {
  assert.deepEqual(parseCommand({ type: 'moveResearch', topic: 'foraging', dir: -1 }), { type: 'moveResearch', topic: 'foraging', dir: -1 });
  assert.equal(parseCommand({ type: 'moveResearch', topic: 'foraging', dir: 2 }), null);
  assert.equal(parseCommand({ type: 'moveResearch', topic: 'nothing', dir: 1 }), null);
  assert.equal(parseCommand({ type: 'queueResearch', topic: 'nothing' }), null);
});

test('picked by hand: first in the queue ahead of the town\'s own, reordered, removed and left alone', () => {
  const s = newGame('picks');
  s.autopilot = true;
  s.townResearches = true; // (the old hands-off town, which chooses for itself: a player's town waits)
  const sim = new Sim(s);
  for (let i = 0; i < OFFER_WAIT_TICKS + TICKS_PER_HOUR; i++) sim.step(); // (the town chooses from its offer)
  const r = s.research;
  const townsOwn = [...r.queue];
  assert.ok(townsOwn.length >= 1);
  const open = ready(r.done).filter((id) => !r.queue.includes(id));
  assert.ok(open.length >= 2, 'two topics to pick');
  const [a, b] = open;
  sim.command({ type: 'queueResearch', topic: a });
  sim.command({ type: 'queueResearch', topic: b });
  sim.step();
  assert.deepEqual(r.picked, [a, b]);
  assert.deepEqual(r.queue.slice(0, 2), [a, b], 'the picks lead');
  assert.ok(r.queue.length <= 2 || !r.picked!.includes(r.queue[2]), 'the town fills behind');
  // (reordered)
  sim.command({ type: 'moveResearch', topic: b, dir: -1 });
  sim.step();
  assert.deepEqual(r.queue.slice(0, 2), [b, a]);
  // (removed: the planner doesn't put it straight back while it has anything else)
  sim.command({ type: 'cancelResearch', topic: a });
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.ok(!r.queue.includes(a), 'removed stays out');
  assert.deepEqual(r.picked, [b]);
  // (a pick isn't lost to the planner, and the head is studied as the player's)
  assert.equal(r.queue[0], b);
});

test('with the queue full of the town\'s own choices, a pick makes room', () => {
  const s = plainGame('picks-full');
  const r = s.research;
  const sim = new Sim(s);
  const open = ready(r.done);
  // (the town's own: queued as the planner does)
  r.queue = open.slice(0, 1);
  sim.command({ type: 'queueResearch', topic: open[1] });
  sim.step();
  assert.equal(r.queue[0], open[1]);
  assert.ok(r.queue.length <= 1 || r.queue.includes(open[0]));
});

test('the seat must be raised before an age\'s studies; the town raises it', () => {
  const s = newGame('seat-gate', { origin: 'knights' });
  s.era = 'medieval';
  s.research.done = [...stoneAge];
  const medieval = TOPICS.find((t) => t.era === 'medieval' && !t.origin && t.prereqs.every((p) => stoneAge.includes(p)))!;
  assert.ok(medieval, 'a Medieval topic resting on the Stone Age');
  assert.equal(seatNeeded(medieval.id), 2);
  assert.equal(seatStageNow(s), 1);
  const gate = prereqsMet(s.research, medieval.id, s.era, s.origin, seatStageNow(s));
  assert.equal(gate.ok, false);
  assert.match(gate.reason!, /seat/);
  // (the player can't pick round it either)
  const sim = new Sim(s);
  sim.command({ type: 'queueResearch', topic: medieval.id });
  sim.step();
  assert.ok(!s.research.queue.includes(medieval.id));
  // (the planner rebuilds the seat, its makings to hand)
  addStock(s.buildings.find((b) => b.def === 'campfire')!.store, 'hide', 10);
  s.autopilot = true;
  for (let i = 0; i < 3 * TICKS_PER_HOUR && seatOf(s.buildings)!.def === seatId('knights', 1); i++) sim.step();
  const seat = seatOf(s.buildings)!;
  assert.equal(seat.def, UPGRADES[seatId('knights', 1)], 'rebuilt as the next stage');
  assert.equal(BUILDING_BY_ID[seat.def].seat, 2);
  // (once it stands, the age opens)
  seat.status = 'done';
  seat.progress = 1;
  assert.equal(seatStageNow(s), 2);
  assert.equal(prereqsMet(s.research, medieval.id, s.era, s.origin, seatStageNow(s)).ok, true);
});
