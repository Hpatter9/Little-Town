import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { skillSpeed } from '../src/shared/data/skills';
import { TOPIC_BY_ID, TOPICS } from '../src/shared/data/research';
import { totalCapacity } from '../src/shared/sim/buildings';
import { canQueue, cancelResearch, modifiers, queueResearch } from '../src/shared/sim/research';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';
import { addStock, carryCapacity, newGame, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';

const main = (s: GameState) => s.people[0];
const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 3600) => {
  let ticks = 0;
  while (!done() && ticks < maxSeconds * TICK_HZ) {
    sim.step();
    ticks++;
  }
  return ticks / TICK_HZ;
};

test('data: building research exists; prerequisites exist and come earlier (no cycles)', () => {
  for (const b of BUILDINGS) if (b.research) assert.ok(TOPIC_BY_ID[b.research], `${b.id} needs unknown topic ${b.research}`);
  TOPICS.forEach((t, i) => {
    for (const p of t.prereqs) {
      assert.ok(TOPIC_BY_ID[p], `${t.id}: unknown prereq ${p}`);
      assert.ok(TOPICS.findIndex((q) => q.id === p) < i, `${t.id}: prereq ${p} must come first`);
    }
  });
});

test('queue: prerequisites must be done or queued ahead; slots are limited', () => {
  const r = newGame('q').research;
  assert.equal(canQueue(r, 'woodcutting').ok, false, 'needs flint knapping');
  assert.equal(queueResearch(r, 'flint_knapping').ok, true);
  assert.equal(queueResearch(r, 'woodcutting').ok, true, 'prereq queued ahead is fine');
  const full = queueResearch(r, 'foraging');
  assert.equal(full.ok, false);
  assert.match(full.reason!, /full/);
  assert.equal(canQueue(r, 'flint_knapping').ok, false, 'already queued');
});

test('queue: cancelling drops dependents and keeps progress; Oral Tradition adds a slot', () => {
  const r = newGame('c').research;
  queueResearch(r, 'flint_knapping');
  queueResearch(r, 'woodcutting');
  r.progress.flint_knapping = 0.4;
  cancelResearch(r, 'flint_knapping');
  assert.deepEqual(r.queue, []);
  assert.equal(r.progress.flint_knapping, 0.4);
  assert.equal(modifiers(r).researchSlots, 2);
  r.done.push('oral_tradition');
  assert.equal(modifiers(r).researchSlots, 3);
});

test("queue: the Elder's Council needs Oral Tradition and 10 other topics", () => {
  const r = newGame('e').research;
  r.done.push('oral_tradition', 'fire_keeping', 'flint_knapping');
  assert.match(canQueue(r, 'elders_council').reason!, /10 other/);
  r.done.push(...TOPICS.map((t) => t.id).filter((id) => !r.done.includes(id) && id !== 'elders_council').slice(0, 8));
  assert.equal(canQueue(r, 'elders_council').ok, true);
});

test('research takes about seconds / speed and unlocks its buildings', () => {
  const sim = new Sim(plainGame('time'));
  const s = sim.state;
  sim.command({ type: 'queueResearch', topic: 'basic_shelter' });
  const took = runUntil(sim, () => s.research.done.includes('basic_shelter'));
  const expected = TOPIC_BY_ID.basic_shelter.seconds / skillSpeed(newGame('time').people[0].skills.research.level);
  assert.ok(took > expected * 0.9 && took < expected + 20, `took ${took}s, expected about ${expected}s`);
  assert.equal(s.notices.at(-1)?.text, 'Research complete: Basic Shelter');
  const camp = Math.floor(s.tiles.length / 2);
  sim.command({ type: 'placeBuilding', def: 'lean_to', tile: camp - 6 });
  sim.step();
  assert.ok(s.buildings.some((b) => b.def === 'lean_to'), 'lean-to can be placed now');
});

test("a Storyteller's Circle makes research faster", () => {
  const time = (withCircle: boolean) => {
    const sim = new Sim(plainGame('station'));
    const s = sim.state;
    if (withCircle) s.buildings.push({ id: 99, def: 'storytellers_circle', tile: Math.floor(s.tiles.length / 2) - 5, status: 'done', delivered: {}, progress: 1, store: {} });
    sim.command({ type: 'queueResearch', topic: 'fire_keeping' });
    return runUntil(sim, () => s.research.done.includes('fire_keeping'));
  };
  const plain = time(false);
  const circle = time(true);
  assert.ok(circle < plain * 0.75, `circle ${circle}s vs camp ${plain}s`);
});

test('construction interrupts research; research resumes where it left off', () => {
  const sim = new Sim(plainGame('interrupt'));
  const s = sim.state;
  sim.command({ type: 'queueResearch', topic: 'flint_knapping' });
  runUntil(sim, () => (s.research.progress.flint_knapping ?? 0) > 0.2);
  const before = s.research.progress.flint_knapping;
  const fire = s.buildings.find((b) => b.def === 'campfire')!;
  addStock(fire.store, 'wood', 6);
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: fire.tile + 2 });
  runUntil(sim, () => main(s).task?.type !== 'research', 5);
  assert.notEqual(main(s).task?.type, 'research', 'switched to construction');
  runUntil(sim, () => s.buildings.some((b) => b.def === 'stockpile' && b.status === 'done'));
  assert.ok(s.research.progress.flint_knapping >= before, 'progress kept');
  runUntil(sim, () => s.research.done.includes('flint_knapping'));
  assert.ok(s.research.done.includes('flint_knapping'));
});

test('research effects: carrying and storage', () => {
  const s = newGame('fx');
  assert.equal(carryCapacity(s), 10);
  assert.equal(totalCapacity(s), 30);
  s.research.done.push('pack_carrying', 'pottery');
  assert.equal(carryCapacity(s), 15);
  assert.equal(totalCapacity(s), 36);
});
