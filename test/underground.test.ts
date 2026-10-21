import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceCommands, undergroundNow, undergroundWays, type UndergroundInput } from '../src/shared/sim/underground';

const none: UndergroundInput = { deep: null, underdark: null, places: [{ id: 1, name: 'Cave', mine: null }], deepView: null, underView: null, mine: null };

test('no way down: nothing to offer', () => {
  assert.equal(undergroundWays(none).length, 0);
  assert.equal(undergroundNow(none), null);
});

test('the Deep, the Underdark and each mine are ways down', () => {
  const s = { ...none, deep: { levels: [{}, {}] }, underdark: {}, places: [{ id: 7, name: 'x', mine: {} }] };
  assert.deepEqual(undergroundWays(s).map((w) => w.key), ['deep', 'under', 'mine:7']);
  assert.deepEqual(undergroundWays(s)[0].go, { type: 'watchDeep', depth: 2 });
});

test('going up closes whatever is open', () => {
  const s = { ...none, deepView: {}, mine: { id: 3 } };
  assert.equal(undergroundNow(s), 'mine:3');
  assert.deepEqual(surfaceCommands(s), [{ type: 'watchMine', place: null }, { type: 'watchDeep', depth: null }]);
});
