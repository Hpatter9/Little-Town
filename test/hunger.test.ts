import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { ASLEEP_HUNGER, drainNeeds } from '../src/shared/sim/townsfolk';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

test('asleep, hunger drains at half the pace', () => {
  const s = newGame('hunger1');
  const p = s.people[0];
  p.needs.food = 1;
  for (let t = 0; t < TICKS_PER_HOUR * 4; t++) drainNeeds(p, true);
  const asleep = 1 - p.needs.food;
  p.needs.food = 1;
  for (let t = 0; t < TICKS_PER_HOUR * 4; t++) drainNeeds(p, false);
  const awake = 1 - p.needs.food;
  assert.ok(Math.abs(asleep - awake * ASLEEP_HUNGER) < 1e-6);
});

test('a new town with food in store has nobody starving in its first three days', () => {
  for (const seed of ['hunger-a', 'hunger-b']) {
    const s = newGame(seed, { origin: 'settlers', biome: 'forest', difficulty: 'easy', founder: { pick: 'maren' } } as Parameters<typeof newGame>[1]);
    const sim = new Sim(s);
    for (let t = 0; t < 3 * TICKS_PER_DAY; t++) {
      sim.step();
      for (const p of s.people) assert.ok(!p.starving, `${p.name} starving at tick ${t} in ${seed}`);
    }
  }
});
