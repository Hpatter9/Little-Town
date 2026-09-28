import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TERRAIN } from '../src/shared/data/terrain';
import { WALK_SPEED } from '../src/shared/sim/people';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';
import { totalCapacity, totalStock } from '../src/shared/sim/buildings';
import { campX, CARRY_CAPACITY, newGame, poolSize, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';

const nearest = (s: GameState, kind: string) => {
  const camp = Math.floor(s.tiles.length / 2);
  let best = -1;
  s.tiles.forEach((t, i) => {
    if (t.terrain === kind && (best < 0 || Math.abs(i - camp) < Math.abs(best - camp))) best = i;
  });
  return best;
};
const main = (s: GameState) => s.people.find((p) => p.id === s.mainId)!;
const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};

test('new game: one main character at camp, a little food, pools on wild tiles only', () => {
  const s = newGame('start');
  assert.equal(s.people.length, 1);
  assert.ok(Math.abs(main(s).x - campX(s)) < 64);
  assert.deepEqual(totalStock(s), { berries: 8 });
  assert.equal(totalCapacity(s), 30, 'the starting campfire is a small cache');
  for (const t of s.tiles) assert.equal(poolSize(t.pool) > 0, t.terrain !== 'clear');
});

test('idle main character wanders around camp without leaving it', () => {
  const sim = new Sim({ ...newGame('wander'), autopilot: false }); // (the town's planner would set them to work)
  let far = 0;
  for (let i = 0; i < 600 * TICK_HZ; i++) {
    sim.step();
    far = Math.max(far, Math.abs(main(sim.state).x - campX(sim.state)));
  }
  assert.ok(far > 0, 'moved');
  assert.ok(far <= 4 * 32, `stayed near camp (max ${far}px)`);
});

test('a marked forest tile is gathered until it clears', () => {
  const sim = new Sim(plainGame('forest'));
  const s = sim.state;
  const tile = nearest(s, 'forest');
  const pool = { ...s.tiles[tile].pool };
  const startLevel = main(s).skills.gathering.level;
  sim.command({ type: 'toggleGather', tile });
  run(sim, 30 * 60);
  assert.equal(s.tiles[tile].terrain, 'clear');
  assert.equal(s.tiles[tile].designated, false);
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
  const tile = nearest(s, 'rock');
  sim.command({ type: 'toggleGather', tile });
  let ticks = 0;
  while (s.tiles[tile].terrain !== 'clear' && ticks < 3600 * TICK_HZ) {
    sim.step();
    ticks++;
  }
  const units = poolSize(newGame('timing').tiles[tile].pool);
  const walk = Math.abs((tile + 0.5) * 32 - campX(s)) / WALK_SPEED;
  const haulTrips = Math.ceil(units / CARRY_CAPACITY); // each full load is walked back to the campfire
  const maxWork = units * TERRAIN.rock.secondsPerUnit;
  const seconds = ticks / TICK_HZ;
  assert.ok(seconds < walk * (1 + 2 * haulTrips) + 8 + maxWork, `took ${seconds}s`);
  assert.ok(seconds > maxWork / 5, `took ${seconds}s, faster than skill allows`);
});

test('unmarking a tile stops the work; marking a clear tile does nothing', () => {
  const sim = new Sim({ ...newGame('unmark'), autopilot: false }); // (the town's planner marks land itself)
  const s = sim.state;
  const tile = nearest(s, 'forest');
  sim.command({ type: 'toggleGather', tile });
  run(sim, 60);
  const left = poolSize(s.tiles[tile].pool);
  sim.command({ type: 'toggleGather', tile });
  run(sim, 120);
  assert.equal(poolSize(s.tiles[tile].pool), left);
  assert.notEqual(main(s).task?.type, 'gather');
  const clear = s.tiles.findIndex((t) => t.terrain === 'clear');
  sim.command({ type: 'toggleGather', tile: clear });
  sim.step();
  assert.equal(s.tiles[clear].designated, false);
});

test('the nearest marked tile is worked first, then the next', () => {
  const sim = new Sim(newGame('order'));
  const s = sim.state;
  const camp = Math.floor(s.tiles.length / 2);
  const left = s.tiles.findLastIndex((t, i) => i < camp && t.terrain !== 'clear');
  const right = s.tiles.findIndex((t, i) => i > camp && t.terrain !== 'clear');
  const full = { left: poolSize(s.tiles[left].pool), right: poolSize(s.tiles[right].pool) };
  sim.command({ type: 'toggleGather', tile: left });
  sim.command({ type: 'toggleGather', tile: right });
  const firstWorked = () => (poolSize(s.tiles[left].pool) < full.left ? left : poolSize(s.tiles[right].pool) < full.right ? right : -1);
  let first = -1;
  for (let i = 0; i < 3600 * TICK_HZ && first < 0; i++) {
    sim.step();
    first = firstWorked();
  }
  const x0 = newGame('order').people[0].x;
  const expected = Math.abs((left + 0.5) * 32 - x0) <= Math.abs((right + 0.5) * 32 - x0) ? left : right;
  assert.equal(first, expected);
  run(sim, 3600);
  assert.equal(s.tiles[left].terrain, 'clear');
  assert.equal(s.tiles[right].terrain, 'clear');
});

test('same seed and commands give identical results', () => {
  const play = () => {
    const sim = new Sim(newGame('replay'));
    run(sim, 20);
    sim.command({ type: 'toggleGather', tile: nearest(sim.state, 'forest') });
    run(sim, 300);
    sim.command({ type: 'toggleGather', tile: nearest(sim.state, 'rock') });
    run(sim, 600);
    return sim.state;
  };
  assert.deepEqual(play(), play());
});
