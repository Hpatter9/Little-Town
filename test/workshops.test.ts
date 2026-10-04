import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID, BUILDINGS } from '../src/shared/data/buildings';
import { ITEM_BY_ID, ITEMS, STATIONS } from '../src/shared/data/items';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { WORKSHOP_BUILDINGS, WORKSHOP_ITEMS, WORKSHOP_STATIONS, WORKSHOP_TOPICS } from '../src/shared/data/workshops';
import { isUnlocked, totalStock, unlockInfo } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { plainGame, priorities, row } from './helpers';

const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function craftTown(seed: string): Sim {
  const sim = new Sim(plainGame(seed));
  const s = sim.state;
  s.cheats.unlockAll = true;
  s.people[0].priorities = priorities({ craft: 1 });
  s.people[0].autoPriorities = false;
  return sim;
}
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 3600) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
  return t / TICK_HZ;
};

test('every workshop is a station with recipes of its own, hung on a topic that exists', () => {
  assert.ok(WORKSHOP_BUILDINGS.length >= 30, `${WORKSHOP_BUILDINGS.length} buildings`);
  assert.ok(WORKSHOP_ITEMS.length >= 60, `${WORKSHOP_ITEMS.length} recipes`);
  for (const b of WORKSHOP_BUILDINGS) {
    assert.ok(BUILDING_BY_ID[b.id] === b, `${b.id} is in BUILDINGS`);
    assert.equal(BUILDINGS.filter((d) => d.id === b.id).length, 1, `${b.id} once`);
    assert.ok(b.research && TOPIC_BY_ID[b.research], `${b.id}: ${b.research} is a topic`);
  }
  for (const id of WORKSHOP_STATIONS) {
    assert.ok(STATIONS.includes(id), `${id} is a station`);
    assert.ok(ITEMS.some((i) => i.station === id), `${id} has a recipe`);
  }
  for (const i of WORKSHOP_ITEMS) {
    assert.ok(ITEM_BY_ID[i.id] === i, `${i.id} is in ITEMS`);
    assert.ok(BUILDING_BY_ID[i.station], `${i.id}: ${i.station} is a building`);
    for (const r of i.research) assert.ok(TOPIC_BY_ID[r], `${i.id}: ${r} is a topic`);
    if (i.ware) assert.ok(i.research.includes('barter'), `${i.id} needs Barter`);
    if (i.fare) assert.ok(i.research.includes('hospitality'), `${i.id} needs Hospitality`);
  }
  for (const t of WORKSHOP_TOPICS) {
    assert.ok(TOPIC_BY_ID[t.id] === t, `${t.id} is a topic`);
    for (const p of t.prereqs) assert.ok(TOPIC_BY_ID[p], `${t.id}: ${p}`);
    assert.ok(BUILDINGS.some((b) => b.research === t.id), `${t.id} opens a building`);
  }
});

test("a people's own workshop is theirs alone, from the Medieval age", () => {
  const own = WORKSHOP_BUILDINGS.filter((b) => b.origin);
  assert.equal(own.length, 11);
  for (const def of own) {
    const theirs = newGame(`own-${def.id}`, { origin: def.origin });
    theirs.research.done.push('barter');
    assert.equal(isUnlocked(unlockInfo(theirs), def), false, `${def.id}: not before the Medieval age`);
    theirs.era = 'medieval';
    assert.equal(isUnlocked(unlockInfo(theirs), def), true, `${def.id}: the ${def.origin}'s own`);
    const others = newGame(`other-${def.id}`, { origin: def.origin === 'settlers' ? 'knights' : 'settlers' });
    others.research.done.push('barter');
    others.era = 'medieval';
    assert.equal(isUnlocked(unlockInfo(others), def), false, `${def.id}: never another people's`);
  }
});

test('a ware is made at its workshop, and a smokehouse turns meat into more dried meat', () => {
  const sim = craftTown('brew');
  const s = sim.state;
  addBuilding(s, 'brewery', campfire(s).tile + 4);
  campfire(s).store = { grain: 6 };
  sim.command({ type: 'queueCraft', item: 'cask_ale' });
  runUntil(sim, () => (s.items.cask_ale ?? 0) > 0);
  assert.equal(s.items.cask_ale, 1);
  assert.deepEqual(totalStock(s), {});

  const sim2 = craftTown('smoke');
  const t = sim2.state;
  addBuilding(t, 'smokehouse', campfire(t).tile + 4);
  campfire(t).store = { meat: 3, wood: 1 };
  sim2.command({ type: 'queueCraft', item: 'smoked_meat' });
  runUntil(sim2, () => (totalStock(t).dried_meat ?? 0) > 0);
  assert.equal(totalStock(t).dried_meat, 4);
});
