import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { startRaid } from '../src/shared/sim/raids';
import { spawnRoamer } from '../src/shared/sim/roamers';
import { Sim } from '../src/shared/sim/sim';
import { STRAY_BAND_HOURS, STRAY_LINE, STRAY_RAID_HOURS, strays } from '../src/shared/sim/strays';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const hourly = (s: { tick: number }) => (s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR);

test('a raider still about long after its raid should have left is sent away, and the raid ends', () => {
  const s = plainGame('strays');
  s.autopilot = true;
  const sim = new Sim(s);
  const r = startRaid(s, RAID_KIND_BY_ID.shinobi, 40, new Rng(5));
  r.phase = 'active';
  for (const rd of r.raiders) { rd.x = Number.NaN; rd.hp = rd.maxHp; } // (stuck where no step takes it anywhere)
  s.tick = r.leavesTick + STRAY_RAID_HOURS * TICKS_PER_HOUR - TICKS_PER_HOUR;
  hourly(s);
  assert.equal(strays(s), 0, 'not before the time is up');
  s.tick = r.leavesTick + STRAY_RAID_HOURS * TICKS_PER_HOUR + TICKS_PER_HOUR;
  hourly(s);
  assert.ok(strays(s) > 0);
  sim.step();
  assert.equal(s.raid, null);
  assert.ok(s.journal.some((e) => e.text === STRAY_LINE));
});

test('a band shown as fighting a skirmish that is gone, or long past its time, is sent away', () => {
  const s = plainGame('strays');
  s.autopilot = true;
  const orphan = spawnRoamer(s, 'beasts')!;
  orphan.fighting = 999;
  const old = spawnRoamer(s, 'beasts')!;
  old.until = 10;
  s.tick = 10 + STRAY_BAND_HOURS * TICKS_PER_HOUR + TICKS_PER_HOUR;
  hourly(s);
  const fresh = spawnRoamer(s, 'beasts')!;
  fresh.until = s.tick + 5 * TICKS_PER_HOUR;
  assert.equal(strays(s), 2);
  assert.deepEqual((s.roamers ?? []).map((r) => r.id), [fresh.id]);
});

test('with the autopilot off nothing is swept', () => {
  const s = plainGame('strays');
  const r = spawnRoamer(s, 'beasts')!;
  r.fighting = 999;
  s.tick = 24 * TICKS_PER_HOUR;
  assert.equal(strays(s), 0);
  assert.equal(s.roamers?.length, 1);
});
