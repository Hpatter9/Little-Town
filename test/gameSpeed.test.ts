import test from 'node:test';
import assert from 'node:assert/strict';
import { plainGame } from './helpers';
import { Sim } from '../src/shared/sim/sim';
import { GAME_SPEEDS, battleSpeedNow } from '../src/shared/sim/battle';
import { parseCommand } from '../src/shared/sim/commands';

test('the town can run at 5x and 10x; other values fall back to 1x', () => {
  const s = plainGame('speed');
  const sim = new Sim(s);
  for (const sp of GAME_SPEEDS) {
    sim.command({ type: 'gameSpeed', speed: sp });
    sim.step();
    assert.equal(battleSpeedNow(s), sp);
  }
  sim.command({ type: 'gameSpeed', speed: 7 });
  sim.step();
  assert.equal(battleSpeedNow(s), 1);
  assert.equal(parseCommand({ type: 'gameSpeed', speed: 10 })?.type, 'gameSpeed');
  assert.equal(parseCommand({ type: 'gameSpeed', speed: 4 }), null);
});

test('advance with a time budget keeps the unrun ticks owed', () => {
  const sim = new Sim(plainGame('budget'));
  const n = sim.advance(100 * 100, 1000, -1); // (a budget already spent: stops at the first check)
  assert.ok(n < 1000);
  assert.ok(sim.advance(0, 1000) > 0, 'the rest is run on the next call');
});
