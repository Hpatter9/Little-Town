import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { startRaid } from '../src/shared/sim/raids';
import { battleSpeedNow, fightOn, fightSpeedTick, setBattleSpeed } from '../src/shared/sim/battle';
import { Sim } from '../src/shared/sim/sim';
import type { Battle } from '../src/shared/sim/combat';
import type { Expedition } from '../src/shared/sim/state';
import { plainGame } from './helpers';

test('every raid battle starts at 1×, whatever the last one was played at', () => {
  const s = plainGame('fight-speed');
  s.battles = true;
  setBattleSpeed(s, 3);
  s.gameSpeed = 2;
  startRaid(s, RAID_KIND_BY_ID.wolves, 10, new Rng(1));
  const sim = new Sim(s);
  for (let t = 0; t < 20_000 && !fightOn(s); t++) sim.step();
  assert.ok(fightOn(s), 'the battle came on');
  sim.step(); // (seen on the next tick)
  assert.equal(s.battleSpeed, 1, 'back to 1×');
  assert.equal(battleSpeedNow(s), 1);
  setBattleSpeed(s, 3);
  sim.step();
  assert.equal(s.battleSpeed, 3, 'the player can speed it up during the fight');
  for (let t = 0; t < 200_000 && s.raid; t++) sim.step();
  assert.equal(battleSpeedNow(s), 2, 'the town runs at its own speed after');
});

test('a watched party fight starts at 1× too', () => {
  const s = plainGame('fight-speed-ff');
  setBattleSpeed(s, 3);
  const e = { id: 77, battle: { outcome: null } as unknown as Battle } as unknown as Expedition;
  s.expeditions.push(e);
  fightSpeedTick(s);
  assert.equal(s.battleSpeed, 3, 'not watched: no fight on screen');
  s.watching = 77;
  fightSpeedTick(s);
  assert.equal(s.battleSpeed, 1);
  setBattleSpeed(s, 2);
  fightSpeedTick(s);
  assert.equal(s.battleSpeed, 2, 'kept while the fight lasts');
  assert.equal(battleSpeedNow(s), 2);
});
