import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROPS } from '../src/shared/data/crops';
import { totalStock } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { type Building, type GameState, campCell } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, priorities, row } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxTicks: number) => {
  let t = 0;
  while (!done() && t < maxTicks) {
    sim.step();
    t++;
  }
  return t;
};
const camp = (s: GameState) => campCell(s).x;
function field(s: GameState, def: string): Building {
  const b: Building = { id: s.nextId++, def, tile: camp(s) + 2, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
function farmer(seed: string): Sim {
  const sim = new Sim(plainGame(seed));
  const p = sim.state.people[0];
  p.priorities = priorities({ farm: 1 });
  p.autoPriorities = false;
  return sim;
}

test('a garden plot is sown, grows by itself, and is harvested into storage (and sown again)', () => {
  const sim = farmer('grain');
  const s = sim.state;
  const plot = field(s, 'garden_plot');
  runUntil(sim, () => plot.crop?.stage === 'growing', 600 * TICK_HZ);
  assert.equal(plot.crop?.stage, 'growing', 'sown');
  const sownAt = s.tick;
  runUntil(sim, () => plot.crop?.stage === 'ripe', 2 * TICKS_PER_DAY);
  const hours = (s.tick - sownAt) / TICKS_PER_HOUR;
  assert.ok(hours >= CROPS.garden_plot.growHours * 0.8 && hours <= CROPS.garden_plot.growHours * 1.1, `grew in ${hours}h (spring)`);
  // harvested and stored (the farmer eats some grain in between, so count carried and stored)
  runUntil(sim, () => (totalStock(s).grain ?? 0) > 0 && plot.crop?.stage === 'growing', TICKS_PER_DAY);
  assert.ok((totalStock(s).grain ?? 0) >= CROPS.garden_plot.yield - 3, `stored ${totalStock(s).grain}`);
  assert.equal(plot.crop?.stage, 'growing', 'sown again');
});

test('nothing grows in winter, and fields are not sown then', () => {
  const sim = farmer('winter');
  const s = sim.state;
  s.tick = 9 * TICKS_PER_DAY; // days 10-12 are winter
  const plot = field(s, 'herb_garden');
  plot.crop = { stage: 'growing', growth: 0.5, work: 0 };
  const fallow = field(s, 'garden_plot');
  fallow.tile += 4;
  for (let i = 0; i < 4 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(plot.crop.growth, 0.5);
  assert.equal(fallow.crop?.stage ?? 'fallow', 'fallow');
  assert.notEqual(s.people[0].task?.type, 'farm');
});
