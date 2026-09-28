import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RECRUIT_TYPES, TRAIT_BY_ID } from '../src/shared/data/people';
import { SKILLS } from '../src/shared/data/skills';
import { totalStock } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { addStock, autoPriorities, makePerson, newGame, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { gainSkill, housingCapacity, mood, workFactor } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { plainGame, priorities } from './helpers';

const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};
const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 7200) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
  return t / TICK_HZ;
};
const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
function addPerson(s: GameState, type = 'wanderer', traits: string[] = []): Person {
  const p = makePerson(new Rng(s.nextId * 7919), s.nextId++, type, (camp(s) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = traits;
  p.needs = { food: 1, rest: 1 };
  s.people.push(p);
  return p;
}

test('recruits: skills follow their type, passions are unique, conflicting traits never combine', () => {
  const rng = new Rng(1);
  for (let i = 0; i < 300; i++) {
    const type = rng.pick(Object.keys(RECRUIT_TYPES));
    const p = makePerson(rng, i, type, 0, []);
    for (const [k, [lo, hi]] of Object.entries(RECRUIT_TYPES[type].skills)) {
      const lvl = p.skills[k as keyof typeof p.skills].level;
      assert.ok(lvl >= lo && lvl <= hi, `${type} ${k} ${lvl}`);
    }
    assert.equal(new Set(p.passions).size, p.passions.length);
    assert.ok(p.passions.length >= 1 && p.passions.length <= 3);
    assert.ok(p.traits.length >= 1 && p.traits.length <= 2);
    for (const t of p.traits) for (const x of TRAIT_BY_ID[t].excludes ?? []) assert.ok(!p.traits.includes(x), `${t} with ${x}`);
  }
});

test('wanderers only come while a bed is free; accepting adds them with a bed', () => {
  const sim = new Sim(plainGame('arrive'));
  const s = sim.state;
  run(sim, 30 * 60); // 30 game hours, no housing
  assert.equal(s.visitor, null, 'no bed, no visitors');
  addBuilding(s, 'lean_to', camp(s) - 6);
  addBuilding(s, 'lean_to', camp(s) - 4);
  const waited = runUntil(sim, () => s.visitor !== null, 200 * 60);
  assert.ok(s.visitor, `someone came (after ${waited}s)`);
  runUntil(sim, () => Math.abs(s.visitor!.person.x - s.visitor!.waitX) < 1, 600);
  sim.command({ type: 'acceptVisitor' });
  sim.step();
  assert.equal(s.people.length, 2);
  assert.equal(s.visitor, null);
  assert.ok(s.people.every((p) => p.bed !== null), 'both have beds');
  assert.equal(housingCapacity(s), 2);
});

test('visitors turned away, or kept waiting too long, walk off', () => {
  const sim = new Sim(plainGame('away'));
  const s = sim.state;
  addBuilding(s, 'lean_to', camp(s) - 6); // the founder's bed
  addBuilding(s, 'lean_to', camp(s) - 4); // a free one
  runUntil(sim, () => s.visitor !== null, 400 * 60);
  assert.ok(s.visitor);
  sim.command({ type: 'rejectVisitor' });
  runUntil(sim, () => s.visitor === null, 600);
  assert.equal(s.visitor, null);
  assert.equal(s.people.length, 1);
  runUntil(sim, () => s.visitor !== null, 400 * 60);
  assert.ok(s.visitor, 'another one came');
  const left = runUntil(sim, () => s.visitor === null, 20 * 60 * 60);
  assert.ok(left > 5 * 60, `waited about 6 game hours before leaving (${left}s)`);
  assert.ok(s.notices.some((n) => /tired of waiting/.test(n.text)));
});

test('hungry people eat from storage', () => {
  const sim = new Sim(plainGame('eat'));
  const s = sim.state;
  addStock(campfire(s).store, 'berries', 5);
  s.people[0].needs.food = 0.3;
  run(sim, 60);
  assert.ok(s.people[0].needs.food > 0.6);
  assert.equal(totalStock(s).berries, 4);
});

test('people sleep at night: in their bed if they have one, else on the ground', () => {
  const noBed = new Sim(plainGame('sleep'));
  runUntil(noBed, () => noBed.state.people[0].lastSlept !== null, 30 * 60);
  assert.equal(noBed.state.people[0].lastSlept, 'ground');

  const withBed = new Sim(plainGame('sleep'));
  addBuilding(withBed.state, 'lean_to', camp(withBed.state) - 6);
  runUntil(withBed, () => withBed.state.people[0].lastSlept !== null, 30 * 60);
  assert.equal(withBed.state.people[0].lastSlept, 'bed');
  const m = mood(withBed.state, withBed.state.people[0]);
  assert.ok(m.reasons.some((r) => r.text === 'Slept in a bed'));
});

test('morale drifts toward its target; below 15 people sulk instead of working', () => {
  const sim = new Sim(plainGame('sulk'));
  const s = sim.state;
  const p = s.people[0];
  p.morale = 5;
  p.needs = { food: 0, rest: 0.6 }; // starving, keeps morale low
  sim.command({ type: 'queueResearch', topic: 'fire_keeping' });
  run(sim, 30);
  assert.notEqual(p.task?.type, 'research', 'sulking');
  assert.equal(s.research.progress.fire_keeping ?? 0, 0);
  addStock(campfire(s).store, 'berries', 10);
  runUntil(sim, () => p.task?.type === 'research', 3 * 3600);
  assert.equal(p.task?.type, 'research', 'fed and happier, back to work');
});

test('job priorities: Off is never done; High is done first', () => {
  const sim = new Sim(plainGame('prio'));
  const s = sim.state;
  const p = s.people[0];
  sim.command({ type: 'setPriority', person: p.id, job: 'research', priority: 0 });
  sim.command({ type: 'queueResearch', topic: 'fire_keeping' });
  const forest = s.tiles.findIndex((t, i) => i > camp(s) && t.terrain === 'forest');
  sim.command({ type: 'toggleGather', tile: forest });
  run(sim, 20);
  assert.equal(p.autoPriorities, false);
  assert.equal(p.task?.type, 'gather', 'research is off');
  sim.command({ type: 'setPriority', person: p.id, job: 'research', priority: 1 });
  run(sim, 30);
  assert.equal(p.task?.type, 'research', 'research is now high');
  sim.command({ type: 'setAutoPriorities', person: p.id, on: true });
  sim.step();
  assert.deepEqual(p.priorities, autoPriorities(p.skills));
});

test('two haulers never over-deliver, and materials are conserved', () => {
  const sim = new Sim(plainGame('haul'));
  const s = sim.state;
  addPerson(s);
  addStock(campfire(s).store, 'wood', 30);
  // two stockpiles (6 wood each) for two haulers to race over
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: campfire(s).tile + 2 });
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: campfire(s).tile + 5 });
  for (let i = 0; i < 300 * TICK_HZ; i++) {
    sim.step();
    for (const b of s.buildings) for (const [m, n] of Object.entries(b.delivered)) assert.ok(n! <= 6, `${b.def} got ${n} ${m}`);
  }
  const carried = s.people.reduce((n, p) => n + (p.carrying.wood ?? 0), 0);
  assert.equal((totalStock(s).wood ?? 0) + carried + 6 + 6, 30, 'every piece of wood accounted for');
  assert.ok(s.buildings.every((b) => b.status === 'done'));
});

test('two gatherers spread over two marked tiles', () => {
  const sim = new Sim(plainGame('spread'));
  const s = sim.state;
  const other = addPerson(s);
  other.priorities = priorities({ gather: 1 });
  const forest = s.tiles.map((t, i) => (t.terrain === 'forest' && i > camp(s) ? i : -1)).filter((i) => i >= 0).slice(0, 2);
  for (const tile of forest) sim.command({ type: 'toggleGather', tile });
  run(sim, 20);
  const tiles = s.people.map((p) => (p.task?.type === 'gather' ? p.task.tile : -1));
  assert.notEqual(tiles[0], tiles[1]);
  assert.ok(tiles.every((t) => forest.includes(t)));
});

test('two researchers are faster than one, with diminishing returns', () => {
  const time = (researchers: number) => {
    const sim = new Sim(plainGame('stack'));
    const s = sim.state;
    for (let i = 1; i < researchers; i++) {
      const p = addPerson(s);
      p.skills = structuredClone(s.people[0].skills);
    }
    sim.command({ type: 'queueResearch', topic: 'flint_knapping' });
    return runUntil(sim, () => s.research.done.includes('flint_knapping'));
  };
  const one = time(1);
  const two = time(2);
  assert.ok(two < one * 0.75 && two > one * 0.5, `one ${one}s, two ${two}s`);
});

test('traits: Hard Worker works faster, Lazy slower; Quick Learner and passions learn faster', () => {
  const s = newGame('traits');
  const p = addPerson(s);
  p.morale = 50;
  p.traits = ['hard_worker'];
  assert.equal(workFactor(s, p), 1.2);
  p.traits = ['lazy'];
  assert.equal(workFactor(s, p), 0.8);
  const skill = SKILLS.find((k) => !p.passions.includes(k))!;
  p.skills[skill] = { level: 1, xp: 0 };
  p.traits = ['quick_learner'];
  gainSkill(p, skill, 10);
  assert.equal(p.skills[skill].xp, 15);
  const loved = p.passions[0];
  p.skills[loved] = { level: 1, xp: 0 };
  gainSkill(p, loved, 10);
  assert.equal(p.skills[loved].xp, 22.5, 'passion and Quick Learner stack');
});

test('with a barracks, guards on Defend High walk patrols on their shift, and off shift they work', async () => {
  const { Sim } = await import('../src/shared/sim/sim');
  const { plainGame, priorities } = await import('./helpers');
  const { calendar, TICKS_PER_HOUR } = await import('../src/shared/sim/time');
  const sim = new Sim(plainGame('patrol'));
  const s = sim.state;
  const camp = Math.floor(s.tiles.length / 2);
  s.buildings.push({ id: s.nextId++, def: 'barracks', tile: camp + 4, status: 'done', delivered: {}, progress: 1, store: {} });
  const p = s.people[0];
  p.priorities = priorities({ defend: 1 });
  p.autoPriorities = false;
  p.needs = { food: 1, rest: 1 };
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  let patrolled = 0;
  for (let t = 0; t < 24 * TICKS_PER_HOUR; t++) {
    sim.step();
    if (p.task?.type === 'patrol') {
      patrolled++;
      const h = calendar(s.tick).hour;
      assert.equal((p.id % 2 === 0) === (h >= 6 && h < 18), true, 'only on their own shift');
    }
  }
  assert.ok(patrolled > 0, 'they patrolled');
});