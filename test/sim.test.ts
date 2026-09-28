import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMP_CLEAR_RADIUS } from '../src/shared/constants';
import { Rng } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { calendar, DAYS_PER_SEASON, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR, TICK_MS } from '../src/shared/sim/time';
import { generateWorld } from '../src/shared/world';

const draw = (r: Rng, n: number) => Array.from({ length: n }, () => r.next());

test('rng: same seed gives the same sequence', () => {
  assert.deepEqual(draw(new Rng(42), 50), draw(new Rng(42), 50));
  assert.notDeepEqual(draw(new Rng(42), 50), draw(new Rng(43), 50));
});

test('rng: resuming from saved state continues the exact sequence', () => {
  const a = new Rng(7);
  draw(a, 100);
  const b = new Rng(a.state);
  assert.deepEqual(draw(a, 100), draw(b, 100));
});

test('world: same seed gives the same world, different seeds differ', () => {
  assert.deepEqual(generateWorld('alpha'), generateWorld('alpha'));
  assert.notDeepEqual(generateWorld('alpha').mid, generateWorld('beta').mid);
});

test('world: camp is cleared and rivers stay out of it', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const w = generateWorld(seed);
    for (let c = w.camp - CAMP_CLEAR_RADIUS; c < w.camp + CAMP_CLEAR_RADIUS; c++) assert.equal(w.mid[c], 'clear', `seed ${seed} col ${c}`);
    for (const r of w.rivers) assert.ok(Math.abs(r - w.camp) > CAMP_CLEAR_RADIUS + 1, `seed ${seed} river ${r}`);
    assert.ok(w.mid.every((m) => m !== undefined), `seed ${seed} has gaps`);
  }
});

test('sim: advance runs whole ticks and carries the remainder', () => {
  const sim = new Sim(newGame('t'));
  assert.equal(sim.advance(TICK_MS * 2.5), 2);
  assert.equal(sim.advance(TICK_MS * 0.5), 1);
  assert.equal(sim.state.tick, 3);
});

test('sim: chunked real time gives the same state as one big step', () => {
  const one = new Sim(newGame('chunks'));
  one.advance(TICK_MS * 500);
  const many = new Sim(newGame('chunks'));
  const r = new Rng(99);
  let total = 0;
  while (total < TICK_MS * 500) {
    const ms = Math.min(r.range(1, 400), TICK_MS * 500 - total);
    many.advance(ms);
    total += ms;
  }
  many.advance(1e-9); // float carry
  assert.deepEqual(many.state, one.state);
});

test('sim: resuming from a saved (JSON) state matches running straight through', () => {
  const straight = new Sim(newGame('save'));
  straight.advance(TICK_MS * 300);
  const first = new Sim(newGame('save'));
  first.advance(TICK_MS * 120);
  const resumed = new Sim(JSON.parse(JSON.stringify(first.state)));
  resumed.advance(TICK_MS * 180);
  assert.deepEqual(resumed.state, straight.state);
});

test('sim: pause stops time; commands apply at the next tick', () => {
  const sim = new Sim(newGame('pause'));
  sim.advance(TICK_MS * 10);
  sim.command({ type: 'setPaused', paused: true });
  assert.equal(sim.state.paused, false, 'not applied until the next tick');
  sim.advance(TICK_MS * 50);
  assert.equal(sim.state.paused, true);
  assert.equal(sim.state.tick, 10);
  sim.command({ type: 'setPaused', paused: false });
  sim.advance(TICK_MS * 5);
  assert.equal(sim.state.tick, 15, 'the unpause applies at the start of a tick that then runs');
});

test('sim: a long gap is capped instead of freezing the app', () => {
  const sim = new Sim(newGame('gap'));
  assert.equal(sim.advance(3_600_000), 600);
  assert.equal(sim.advance(0), 1, 'at most one tick of backlog carries over');
});

test('calendar: starts day 1 of spring in the morning', () => {
  const c = calendar(0);
  assert.deepEqual([c.day, c.year, c.season, c.dayOfSeason, c.hour, c.minute], [1, 1, 'spring', 1, START_HOUR, 0]);
  assert.equal(c.daylight, 1);
});

test('calendar: night is dark, days and seasons roll over', () => {
  const midnight = calendar((24 - START_HOUR) * TICKS_PER_HOUR);
  assert.deepEqual([midnight.day, midnight.hour, midnight.daylight], [2, 0, 0]);
  const dusk = calendar((20 - START_HOUR) * TICKS_PER_HOUR);
  assert.ok(dusk.daylight > 0 && dusk.daylight < 1);
  const summer = calendar(DAYS_PER_SEASON * TICKS_PER_DAY);
  assert.deepEqual([summer.season, summer.dayOfSeason, summer.day], ['summer', 1, DAYS_PER_SEASON + 1]);
  const year2 = calendar(DAYS_PER_SEASON * 4 * TICKS_PER_DAY);
  assert.deepEqual([year2.year, year2.season], [2, 'spring']);
});
