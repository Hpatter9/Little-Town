import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TERRAIN } from '../src/shared/data/terrain';
import { WALK_SPEED } from '../src/shared/sim/people';
import { Sim } from '../src/shared/sim/sim';
import { cellPx, isWild, nearestWild, plainGame, poolOf } from './helpers';
import { totalCapacity, totalStock } from '../src/shared/sim/buildings';
import { campXY, CARRY_CAPACITY, dist, newGame, poolSize, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { cellAt, groundAt, isMarked, WILD } from '../src/shared/sim/land';

const main = (s: GameState) => s.people.find((p) => p.id === s.mainId)!;
const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};

test('new game: one main character at camp, a little food, pools on wild cells only', () => {
  const s = newGame('start');
  assert.equal(s.people.length, 1);
  assert.ok(dist(main(s), campXY(s)) < 64);
  assert.deepEqual(totalStock(s), { berries: 8 });
  assert.equal(totalCapacity(s), 30, 'the starting campfire is a small cache');
  for (let i = 0; i < s.land.w * s.land.h; i++) {
    const c = cellAt(s.land, i);
    assert.equal(poolSize(poolOf(s, i)) > 0, WILD.includes(groundAt(s.land, c.x, c.y)), `cell ${i}`);
  }
});

test('idle main character wanders around camp without leaving it', () => {
  const sim = new Sim({ ...newGame('wander'), autopilot: false }); // (the town's planner would set them to work)
  let far = 0;
  for (let i = 0; i < 600 * TICK_HZ; i++) {
    sim.step();
    const p = main(sim.state);
    const c = campXY(sim.state);
    far = Math.max(far, Math.abs(p.x - c.x), Math.abs(p.y - c.y));
  }
  assert.ok(far > 0, 'moved');
  assert.ok(far <= 5 * 32, `stayed near camp (max ${far}px)`);
});

test('a marked forest cell is gathered until it clears', () => {
  const sim = new Sim(plainGame('forest'));
  const s = sim.state;
  const cell = nearestWild(s, 'forest');
  const pool = { ...poolOf(s, cell) };
  const startLevel = main(s).skills.gathering.level;
  sim.command({ type: 'toggleGather', cell });
  run(sim, 30 * 60);
  assert.equal(isWild(s, cell), false);
  assert.equal(isMarked(s.land, cell), false);
  // (berries may have been eaten over 30 hours, so check the rest)
  assert.equal(totalStock(s).wood, pool.wood, 'every unit was hauled into storage');
  assert.equal(totalStock(s).fiber, pool.fiber);
  assert.deepEqual(main(s).carrying, {});
  assert.ok((totalStock(s).wood ?? 0) >= TERRAIN.forest.pool.wood![0]);
  assert.ok(main(s).skills.gathering.level > startLevel || main(s).skills.gathering.xp > 0, 'gained xp');
});

test('gathering takes about walk time + units x seconds / skill speed', () => {
  const sim = new Sim(plainGame('timing'));
  const s = sim.state;
  const cell = nearestWild(s, 'rock');
  const units = poolSize(poolOf(s, cell));
  sim.command({ type: 'toggleGather', cell });
  let ticks = 0;
  while (isWild(s, cell) && ticks < 3600 * TICK_HZ) {
    sim.step();
    ticks++;
  }
  // (the way there winds round the camp's buildings: allow half as much again)
  const walk = (dist(cellPx(s, cell), campXY(s)) * 1.5) / WALK_SPEED;
  const haulTrips = Math.ceil(units / CARRY_CAPACITY); // each full load is walked back to the campfire
  const maxWork = units * TERRAIN.rock.secondsPerUnit;
  const seconds = ticks / TICK_HZ;
  assert.ok(seconds < walk * (1 + 2 * haulTrips) + 8 + maxWork, `took ${seconds}s`);
  assert.ok(seconds > maxWork / 5, `took ${seconds}s, faster than skill allows`);
});

test('unmarking a cell stops the work; marking a clear cell does nothing', () => {
  const sim = new Sim({ ...newGame('unmark'), autopilot: false }); // (the town's planner marks land itself)
  const s = sim.state;
  const cell = nearestWild(s, 'forest');
  sim.command({ type: 'toggleGather', cell });
  run(sim, 60);
  const left = poolSize(poolOf(s, cell));
  sim.command({ type: 'toggleGather', cell });
  run(sim, 120);
  assert.equal(poolSize(poolOf(s, cell)), left);
  assert.notEqual(main(s).task?.type, 'gather');
  const clear = s.land.camp.y * s.land.w + s.land.camp.x;
  sim.command({ type: 'toggleGather', cell: clear });
  sim.step();
  assert.equal(isMarked(s.land, clear), false);
});

test('the nearest marked cell is worked first, then the next', () => {
  const sim = new Sim({ ...newGame('order'), autopilot: false }); // (the town's planner would set them to research)
  const s = sim.state;
  const left = nearestWild(s, undefined, -1);
  const right = nearestWild(s, undefined, 1);
  const full = { left: poolSize(poolOf(s, left)), right: poolSize(poolOf(s, right)) };
  sim.command({ type: 'toggleGather', cell: left });
  sim.command({ type: 'toggleGather', cell: right });
  const firstWorked = () => (poolSize(poolOf(s, left)) < full.left ? left : poolSize(poolOf(s, right)) < full.right ? right : -1);
  let first = -1;
  for (let i = 0; i < 3600 * TICK_HZ && first < 0; i++) {
    sim.step();
    first = firstWorked();
  }
  const p0 = newGame('order').people[0];
  const expected = dist(cellPx(s, left), p0) <= dist(cellPx(s, right), p0) ? left : right;
  assert.equal(first, expected);
  run(sim, 3600);
  assert.equal(isWild(s, left), false);
  assert.equal(isWild(s, right), false);
});

test('same seed and commands give identical results', () => {
  const play = () => {
    const sim = new Sim(newGame('replay'));
    run(sim, 20);
    sim.command({ type: 'toggleGather', cell: nearestWild(sim.state, 'forest') });
    run(sim, 300);
    sim.command({ type: 'toggleGather', cell: nearestWild(sim.state, 'rock') });
    run(sim, 600);
    return sim.state;
  };
  assert.deepEqual(play(), play());
});
