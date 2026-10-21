import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPICS } from '../src/shared/data/research';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

const unique = (a: string[]) => new Set(a).size === a.length;

test('adding a topic that is already queued does nothing', () => {
  const s = newGame('dupes');
  s.autopilot = true;
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  const r = s.research;
  const open = TOPICS.filter((t) => !t.origin && !t.hidden && !r.done.includes(t.id) && t.prereqs.every((p) => r.done.includes(p))).map((t) => t.id);
  for (const id of open.slice(0, 6)) {
    for (let k = 0; k < 3; k++) sim.command({ type: 'queueResearch', topic: id });
    sim.step();
    assert.ok(unique(r.queue), `queue has no repeats after picking ${id}: ${r.queue}`);
    assert.ok(unique(r.picked ?? []), `picks have no repeats: ${r.picked}`);
  }
  const before = [JSON.stringify(r.queue), JSON.stringify(r.picked)];
  for (const id of r.queue.slice()) sim.command({ type: 'queueResearch', topic: id });
  sim.step();
  assert.deepEqual([JSON.stringify(r.queue), JSON.stringify(r.picked)], before);
});

test('a repeated topic in the queue or the picks is tidied away when the queue is next ordered', () => {
  const s = newGame('dupes2');
  s.autopilot = true;
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  const r = s.research;
  sim.command({ type: 'studyOffer', topic: r.offer![0] });
  sim.step();
  const [a] = r.queue;
  r.queue.push(a);
  r.picked = [a, a];
  sim.command({ type: 'queueResearch', topic: TOPICS.find((t) => !r.done.includes(t.id) && !r.queue.includes(t.id) && !t.origin && !t.hidden && t.prereqs.every((p) => r.done.includes(p)))!.id });
  sim.step();
  assert.ok(unique(r.queue) && unique(r.picked ?? []));
});
