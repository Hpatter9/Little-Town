import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { HERDS, STARVE_HOURS } from '../src/shared/data/livestock';
import { totalStock } from '../src/shared/sim/buildings';
import { herdOf, needsTending, rustle, tendHerds } from '../src/shared/sim/livestock';
import { Rng } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/sim';
import type { Building, GameState } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, plainGame, priorities, row } from './helpers';

const pen = (s: GameState, def: string, tile: number): Building => {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
};
/** Days from the start of the game to a season (3 days each): spring 0, summer 1, autumn 2, winter 3. */
const toSeason = (s: GameState, season: number) => (s.tick = season * 3 * TICKS_PER_DAY + 1);

test('data: every pen is a background building, unlocked by research, with a herd that yields something', () => {
  for (const [id, h] of Object.entries(HERDS)) {
    const def = BUILDING_BY_ID[id];
    assert.ok(def && def.layer === 'back' && def.research, id);
    assert.ok(h.start >= 2 && h.start <= h.room, id);
    assert.ok(Object.keys(h.yields).length || h.forMeat, `${id} gives something`);
  }
});

test('a farmer tends the pen: eggs into the stores', () => {
  const s = plainGame('coop');
  const sim = new Sim(s);
  const p = s.people[0];
  p.priorities = priorities({ farm: 1 });
  const coop = pen(s, 'chicken_coop', camp(s).x + 3);
  herdOf(s, coop).tended = -1e9; // (long overdue)
  assert.ok(needsTending(s, coop));
  for (let i = 0; i < 120 * TICK_HZ && needsTending(s, coop); i++) sim.step();
  assert.ok(!needsTending(s, coop), 'tended');
  for (let i = 0; i < 60 * TICK_HZ && !(totalStock(s).eggs ?? 0) && !(p.carrying.eggs ?? 0); i++) sim.step();
  assert.ok((totalStock(s).eggs ?? 0) + (p.carrying.eggs ?? 0) >= 1, 'eggs collected');
});

test('herds breed in spring and summer, not in winter; a full pen stops growing', () => {
  const s = plainGame('breed');
  const b = pen(s, 'pig_sty', 90);
  const h = herdOf(s, b);
  toSeason(s, 0);
  const start = h.head;
  for (let hr = 0; hr < 60; hr++, s.tick += TICKS_PER_HOUR) tendHerds({ ...s, tick: Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR } as GameState);
  assert.ok(h.head > start, `grew from ${start} to ${h.head}`);
  h.head = HERDS.pig_sty.room;
  for (let hr = 0; hr < 100; hr++, s.tick += TICKS_PER_HOUR) tendHerds({ ...s, tick: Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR } as GameState);
  assert.equal(h.head, HERDS.pig_sty.room, 'no room for more');
});

test('in winter the herd eats grain, and starves without it', () => {
  const s = plainGame('winter');
  const b = pen(s, 'cattle_pasture', 90);
  const h = herdOf(s, b);
  const store = s.buildings.find((q) => q.def === 'campfire')!.store;
  store.grain = 20;
  const winter = 9 * TICKS_PER_DAY;
  const hours = (n: number) => {
    for (let hr = 0; hr < n; hr++) tendHerds({ ...s, tick: winter + (hr + 1) * TICKS_PER_HOUR } as GameState);
  };
  hours(24);
  assert.ok((store.grain ?? 0) < 20, 'fed from the stores');
  assert.equal(h.head, HERDS.cattle_pasture.start);
  store.grain = 0;
  // (what's owed builds up to a whole grain, then they go hungry, and a day hungry kills one)
  hours(STARVE_HOURS + 30);
  assert.equal(h.head, HERDS.cattle_pasture.start - 1, 'one starved');
});

test('raiders who get away can drive off livestock', () => {
  const s = plainGame('rustle');
  const b = pen(s, 'sheep_fold', 90);
  herdOf(s, b).head = 8;
  let lost = false;
  for (let i = 0; i < 20 && !lost; i++) {
    rustle(s, new Rng(i));
    lost = b.herd!.head < 8;
  }
  assert.ok(lost);
});

test('a druid town keeps building: a goat pen does not make hide count as available', async () => {
  const { newGame } = await import('../src/shared/sim/state');
  const sim = new Sim(newGame('soak-druid-0', { origin: 'druid' }));
  const done = () => sim.state.buildings.filter((b) => b.status === 'done').length;
  for (let t = 0; t < 3 * TICKS_PER_DAY; t++) sim.step();
  const early = done();
  for (let t = 0; t < 6 * TICKS_PER_DAY && !sim.state.gameOver; t++) sim.step();
  assert.ok(sim.state.gameOver || done() > early, 'the town finished nothing in six days');
});
