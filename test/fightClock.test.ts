import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { holdOf } from '../src/shared/sim/popups';
import { startRaid } from '../src/shared/sim/raids';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { Sim } from '../src/shared/sim/sim';
import { makePerson } from '../src/shared/sim/state';
import { calendarOf, clockTick, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('the day clock stands still through a fight tick and runs on after it', () => {
  const s = plainGame('clock-hold');
  const sim = new Sim(s);
  sim.step();
  const before = calendarOf(s);
  const clock = clockTick(s);
  for (let i = 0; i < 2500; i++) sim.step('fight');
  assert.equal(clockTick(s), clock, 'the clock did not move');
  assert.deepEqual(calendarOf(s), before);
  assert.equal(s.fightTicks, 2500, 'the ticks held are counted');
  sim.step();
  assert.equal(clockTick(s), clock + 1, 'and it starts again');
});

test('a raid battle holds the hour on screen but its own timers keep counting', () => {
  const s = plainGame('clock-raid');
  s.battles = true;
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 5 && !fightOnScreen(s); i++) sim.step();
  assert.equal(holdOf(s), 'fight');
  const tick = s.tick, hour = calendarOf(s).hour;
  for (let i = 0; i < TICKS_PER_HOUR + 7 && holdOf(s) === 'fight'; i++) sim.step(holdOf(s));
  assert.ok(s.tick > tick, 'the tick counted for the battle');
  assert.equal(calendarOf(s).hour, hour);
  assert.equal(clockTick(s), s.tick - (s.fightTicks ?? 0));
});

test('an old save with no fightTicks reads the plain calendar', () => {
  const s = plainGame('clock-old');
  assert.equal(s.fightTicks, undefined);
  assert.equal(clockTick(s), s.tick);
});
