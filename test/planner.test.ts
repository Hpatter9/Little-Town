import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { housingCapacity } from '../src/shared/sim/townsfolk';
import { runPlanner, PLAN_TICKS, STALL_HOURS } from '../src/shared/sim/planner';
import { camp, plainGame, row } from './helpers';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

test('a town left entirely alone grows: people, homes, fields, research, and no game over', () => {
  const sim = new Sim(newGame('ant-farm-test'));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  assert.equal(s.gameOver, null);
  assert.ok(s.people.length >= 3, `people ${s.people.length}`);
  assert.ok(housingCapacity(s) >= 2, 'it built homes');
  assert.ok(s.buildings.some((b) => b.crop), 'it planted fields');
  assert.ok(s.research.done.length >= 10, `research ${s.research.done.length}`);
});

test('the same town left alone twice turns out the same (the planner uses no chance)', () => {
  const run = () => {
    const sim = new Sim(newGame('ant-farm-same'));
    for (let t = 0; t < 2 * TICKS_PER_DAY; t++) sim.step();
    return JSON.stringify([sim.state.buildings.map((b) => [b.def, b.tile]), sim.state.research.done]);
  };
  assert.equal(run(), run());
});

test("it never orders what it can't make: nothing made from an item it hasn't got, nothing it has no makings for", () => {
  const sim = new Sim(newGame('ant-farm-craft'));
  const s = sim.state;
  for (let t = 0; t < 6 * TICKS_PER_DAY; t++) {
    sim.step();
    if (s.tick % PLAN_TICKS !== 0) continue;
    for (const o of s.crafting) {
      const def = ITEM_BY_ID[o.item];
      if (o.itemsTaken) continue;
      for (const [id, n] of Object.entries(def.items ?? {})) assert.ok((s.items[id] ?? 0) >= n || o.progress > 0, `${o.item} needs ${id}`);
    }
  }
});

test('full stores: surplus wood and stone are cleared out, food never is', () => {
  const s = newGame('ant-farm-room');
  const fire = s.buildings[0];
  fire.store = { wood: 200, stone: 200, berries: 25 };
  s.tick = PLAN_TICKS * 10;
  runPlanner(s);
  assert.ok((fire.store.wood ?? 0) < 200 && (fire.store.stone ?? 0) < 200, JSON.stringify(fire.store));
  assert.equal(fire.store.berries, 25);
});

test('its direction steers it: set on defence, it studies fighting or healing first', () => {
  const pick = (direction: 'growth' | 'defense') => {
    const s = newGame('ant-farm-dir');
    s.direction = direction;
    s.research.done.push('flint_knapping', 'foraging', 'basic_shelter', 'fire_keeping');
    s.tick = PLAN_TICKS;
    runPlanner(s);
    return s.research.queue.map((id) => TOPIC_BY_ID[id].branch);
  };
  assert.ok(['military', 'medicine'].includes(pick('defense')[0]), pick('defense')[0]);
  assert.notEqual(pick('growth')[0], 'military');
});

test('autopilot off: the planner leaves the town alone', () => {
  const s = { ...newGame('ant-farm-off'), autopilot: false };
  s.tick = PLAN_TICKS;
  runPlanner(s);
  assert.equal(s.research.queue.length, 0);
  assert.equal(s.land.marked.length, 0);
});

test('a blueprint stuck for want of what nobody has is set aside, its slot freed and its materials back', () => {
  const s = plainGame('stalled');
  s.autopilot = true;
  const bp = { id: s.nextId++, def: 'barracks', tile: camp(s).x + 1, row: row(s), status: 'blueprint' as const, delivered: { stone: 5 }, progress: 0, store: {} };
  s.buildings.push(bp);
  s.tick = PLAN_TICKS * 10;
  runPlanner(s);
  assert.ok(s.buildings.includes(bp), 'not at first');
  s.tick += STALL_HOURS * TICKS_PER_HOUR + PLAN_TICKS;
  s.tick -= s.tick % PLAN_TICKS;
  runPlanner(s);
  assert.ok(!s.buildings.includes(bp), 'set aside');
  assert.ok(s.plan?.shelved?.barracks !== undefined);
  assert.ok(s.plan?.waiting.some((w) => w.includes('Barracks')));
});
