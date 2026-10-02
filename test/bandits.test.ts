import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { flammable, setFire } from '../src/shared/sim/fire';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type Building, type GameState, type Person, campCell } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, priorities, row, campPx } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxTicks: number) => {
  let t = 0;
  while (!done() && t < maxTicks) {
    sim.step();
    t++;
  }
  return t;
};
const camp = (s: GameState) => campCell(s).x;
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
function villager(s: GameState, x: number): Person {
  const p = makePerson(new Rng(s.nextId * 11), s.nextId++, 'wanderer', { x, y: campPx(s).y }, s.people.map((q) => q.name));
  p.traits = [];
  p.hp = maxHp(p);
  p.needs = { food: 1, rest: 1 };
  p.priorities = priorities({});
  s.people.push(p);
  return p;
}
/** Bandits in town right now, each with the given goal. */
function banditsNow(sim: Sim, goal: 'steal' | 'burn' | 'kidnap', n = 1) {
  const s = sim.state;
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 14 * n, new Rng(5));
  raid.raiders = raid.raiders.slice(0, n);
  for (const rd of raid.raiders) {
    rd.goal = goal;
    rd.x = (camp(s) + 12) * 32;
  }
  raid.arrivesTick = s.tick;
  s.prompts = [];
  raid.prompt = null;
  return raid;
}

test('fire burns a wooden building down and jumps to its neighbour, unless put out; stone does not burn', () => {
  const sim = new Sim(plainGame('fire'));
  const s = sim.state;
  s.people[0].away = -1; // nobody home to fight it
  const a = addBuilding(s, 'lean_to', camp(s) + 4);
  const b = addBuilding(s, 'lean_to', camp(s) + 6); // right next to it
  const kiln = addBuilding(s, 'kiln', camp(s) + 8);
  assert.equal(flammable(kiln), false);
  assert.equal(setFire(s, kiln), false);
  setFire(s, a);
  runUntil(sim, () => !s.buildings.includes(a), 6 * TICKS_PER_HOUR);
  assert.ok(!s.buildings.includes(a), 'burned down');
  assert.ok(b.fire !== undefined || !s.buildings.includes(b), 'the fire spread next door');
  assert.ok(s.buildings.includes(kiln));
});

test('townsfolk drop everything to put a fire out', () => {
  const sim = new Sim(plainGame('water'));
  const s = sim.state;
  const hut = addBuilding(s, 'lean_to', camp(s) + 4);
  setFire(s, hut);
  const t = runUntil(sim, () => hut.fire === undefined, TICKS_PER_HOUR);
  assert.equal(hut.fire, undefined, 'out');
  assert.ok(t < 0.5 * TICKS_PER_HOUR, `out in ${t / TICK_HZ}s`);
  assert.ok(s.buildings.includes(hut));
});

test('an arsonist sets fires; a thief takes the valuables first', () => {
  const sim = new Sim(plainGame('arson'));
  const s = sim.state;
  s.era = 'medieval';
  s.people[0].priorities.defend = 0;
  addBuilding(s, 'lean_to', camp(s) + 4);
  banditsNow(sim, 'burn');
  runUntil(sim, () => s.buildings.some((b) => b.fire !== undefined), 2 * TICKS_PER_HOUR);
  assert.ok(s.buildings.some((b) => b.fire !== undefined) || s.notices.some((n) => n.text.includes('burned down')));

  const sim2 = new Sim(plainGame('thief'));
  const s2 = sim2.state;
  s2.people[0].priorities.defend = 0;
  s2.people[0].x = (camp(s2) - 20) * 32; // (out of the thief's way: this is about what's taken)
  campfire(s2).store = { berries: 10, iron: 3, cloth: 2 };
  const raid = banditsNow(sim2, 'steal');
  runUntil(sim2, () => (raid.raiders[0].carrying.iron ?? 0) > 0, 2 * TICKS_PER_HOUR);
  assert.deepEqual(raid.raiders[0].carrying, { iron: 3, cloth: 2 });
});

test('a kidnapper carries someone off to the bandit camp; cut down on the way, they drop them', () => {
  const sim = new Sim(plainGame('kidnap'));
  const s = sim.state;
  s.people[0].priorities.defend = 0;
  s.people[0].x = (camp(s) - 20) * 32; // the founder is far off (and never taken)
  const victim = villager(s, (camp(s) + 8) * 32);
  victim.hp = 3;
  victim.priorities.defend = 1; // goes out to meet them
  const raid = banditsNow(sim, 'kidnap');
  const rd = raid.raiders[0];
  runUntil(sim, () => !!rd.captive, 2 * TICKS_PER_HOUR);
  assert.equal(rd.captive?.id, victim.id, 'grabbed');
  assert.ok(!s.people.includes(victim));
  runUntil(sim, () => rd.gone, 2 * TICKS_PER_HOUR);
  assert.deepEqual(s.captives.map((p) => p.id), [victim.id], 'held at the camp');

  // again, but the kidnapper is cut down
  const sim2 = new Sim(plainGame('saved'));
  const s2 = sim2.state;
  s2.people[0].x = (camp(s2) - 20) * 32;
  const v2 = villager(s2, (camp(s2) + 8) * 32);
  v2.hp = 3;
  v2.priorities.defend = 1;
  const r2 = banditsNow(sim2, 'kidnap');
  runUntil(sim2, () => !!r2.raiders[0].captive, 2 * TICKS_PER_HOUR);
  r2.raiders[0].hp = 0;
  r2.raiders[0].down = true;
  sim2.step();
  assert.ok(s2.people.some((p) => p.id === v2.id), 'dropped and back in town');
  assert.equal(s2.captives.length, 0);
});
