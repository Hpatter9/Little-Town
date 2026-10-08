import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONQUEST } from '../src/shared/data/conquest';
import { PANELS } from '../src/shared/ipc';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';

test('the conquest is parked: no War tab, no war in the snapshot', () => {
  assert.equal(CONQUEST.on, false);
  assert.ok(!PANELS.some((p) => p.id === 'war'), 'no War tab');
  assert.equal(snapshot(newGame('parked')).war, null);
});
