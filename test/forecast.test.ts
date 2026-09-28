import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ALERTS } from '../src/shared/ipc';
import { forecast } from '../src/shared/sim/forecast';
import { Sim } from '../src/shared/sim/sim';
import { TICK_MS, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plan } from '../src/main/alerts';
import { plainGame } from './helpers';

test('the forecast sees the next raid exactly when it will come, and leaves the real game alone', () => {
  const s = plainGame('forecast');
  s.buildings[0].store = { berries: 20 };
  s.nextRaidTick = s.tick + 2 * TICKS_PER_HOUR;
  const before = JSON.stringify(s);
  const events = forecast(s, 6 * TICKS_PER_HOUR);
  assert.equal(JSON.stringify(s), before, 'untouched');
  const raid = events.find((e) => e.kind === 'raid');
  assert.ok(raid, 'a raid is coming');

  // run the real thing: the raiders reach town at the forecast tick
  const sim = new Sim(s);
  let arrives = -1;
  for (let i = 0; i < 6 * TICKS_PER_HOUR && arrives < 0; i++) {
    sim.step();
    if (s.raid) arrives = s.raid.arrivesTick;
  }
  assert.equal(arrives, raid!.tick);
});

test('alerts are planned only when turned on, with the raid warning ahead of time', () => {
  const s = plainGame('plan');
  s.nextRaidTick = s.tick + 3 * TICKS_PER_HOUR;
  const now = 1_000_000;
  assert.deepEqual(plan({ ...DEFAULT_ALERTS }, s, now), [], 'off by default');
  const on = { ...DEFAULT_ALERTS, enabled: true, topic: 'test-topic', leadMinutes: 10 };
  const p = plan(on, s, now);
  const raid = p.find((x) => x.event.kind === 'raid')!;
  assert.ok(raid);
  assert.equal(raid.at, now + (raid.event.tick - s.tick) * TICK_MS - 10 * 60_000);
  assert.deepEqual(plan({ ...on, raids: false }, s, now).filter((x) => x.event.kind === 'raid'), []);
});
