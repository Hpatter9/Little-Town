import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { catchUp } from '../src/shared/sim/offline';
import { RAID_WAIT_MS } from '../src/shared/sim/raidWait';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { TICK_MS } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const HOUR = 3600_000;
/** A raid on its way, due at the gate in `minutes` of play. */
function raidComing(seed: string, minutes: number) {
  const sim = new Sim(plainGame(seed));
  const s = sim.state;
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(4));
  raid.arrivesTick = s.tick + Math.round((minutes * 60_000) / TICK_MS);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  return { sim, s, raid };
}

test('raiders reaching the gate while you are away wait for you: the town pauses and asks you to watch', () => {
  const { sim, s, raid } = raidComing('wait', 5);
  catchUp(sim, 2 * HOUR);
  assert.equal(raid.phase, 'warning', 'not in yet');
  assert.equal(s.paused, true);
  const gate = s.prompts.find((p) => p.kind === 'gate');
  assert.ok(gate, 'asked to watch the fight');
  assert.deepEqual(gate!.options, ['Watch the fight']);
  assert.equal(snapshot(s).prompts.find((p) => p.id === gate!.id)!.secondsLeft, null, 'no countdown');
  assert.ok(s.tick < raid.arrivesTick + 2, 'the town stopped at the gate');
  // it waits as long as it takes in play
  const tick = s.tick;
  for (let i = 0; i < 50; i++) sim.step();
  assert.equal(s.tick, tick);
  sim.command({ type: 'answerPrompt', prompt: gate!.id, option: 0 });
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(s.paused, false);
  assert.equal(raid.phase, 'active', 'the fight is on');
  assert.ok(!s.prompts.some((p) => p.kind === 'gate'));
});

test('unpausing the town lets held raiders in too', () => {
  const { sim, s, raid } = raidComing('unpause', 1);
  catchUp(sim, HOUR);
  assert.equal(s.paused, true);
  sim.command({ type: 'setPaused', paused: false });
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(raid.phase, 'active');
});

test('away more than 12 hours after they came, and the raid played out without you', () => {
  const { sim, s } = raidComing('alone', 5);
  catchUp(sim, 14 * HOUR);
  assert.equal(s.paused, false);
  assert.ok(!s.prompts.some((p) => p.kind === 'gate'));
});

test('raiders held at the gate give up waiting after 12 hours across visits, and attack', () => {
  const { sim, s, raid } = raidComing('later', 5);
  catchUp(sim, HOUR);
  assert.ok(raid.waiting !== undefined && raid.waiting < RAID_WAIT_MS);
  catchUp(sim, RAID_WAIT_MS);
  assert.equal(s.paused, false);
  assert.ok(s.raid === null || s.raid.phase === 'active' || s.raid !== raid, 'it came in');
  assert.ok(s.journal.some((j) => j.text.includes('Nobody came to watch')));
});
