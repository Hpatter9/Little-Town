import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { startRaid } from '../src/shared/sim/raids';
import { skipRaid, skipRaidsTick } from '../src/shared/sim/raidSkip';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';

test('a raid skipped is fought out by the town, and the player\'s auto setting comes back after', () => {
  const s = plainGame('skip-raid');
  s.autoBattle = false;
  startRaid(s, RAID_KIND_BY_ID.wolves, 10, new Rng(1));
  assert.ok(skipRaid(s));
  assert.equal(s.autoBattle, true, 'the town takes over');
  const sim = new Sim(s);
  for (let t = 0; t < 200_000 && s.raid; t++) sim.step();
  assert.equal(s.raid, null, 'the raid ended');
  assert.equal(s.raidSkip, undefined);
  assert.equal(s.autoBattle, false, 'the setting is the player\'s again');
  assert.ok(s.raidRecap, 'and the recap is there');
});

test('a town set to skip its raids skips each as it turns active', () => {
  const s = plainGame('skip-all');
  s.skipRaids = true;
  startRaid(s, RAID_KIND_BY_ID.wolves, 10, new Rng(2));
  s.raid!.phase = 'active';
  skipRaidsTick(s);
  assert.ok(s.raidSkip);
});
