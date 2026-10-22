import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readoutItems, short } from '../src/renderer/mobile/storesPick';

test('the readout shows coins once there are some, then wood, stone and food summed', () => {
  assert.deepEqual(readoutItems({ wood: 5, stone: 2 }, 0).map((i) => i.id), ['wood', 'stone', 'food']);
  const r = readoutItems({ wood: 5, stone: 2, meat: 3, berries: 4, bread: 1 }, 12.7);
  assert.deepEqual(r.map((i) => [i.id, i.n]), [['coins', 12], ['wood', 5], ['stone', 2], ['food', 8]]);
});

test('up to two more materials the town holds, the most plentiful first, at most five in all', () => {
  const r = readoutItems({ wood: 1, iron: 3, cloth: 9, leather: 5 }, 40);
  assert.deepEqual(r.map((i) => i.id), ['coins', 'wood', 'stone', 'food', 'cloth']);
  assert.equal(r.length, 5);
  assert.deepEqual(readoutItems({ iron: 3, cloth: 9, leather: 5 }, 0).map((i) => i.id), ['wood', 'stone', 'food', 'cloth', 'leather']);
});

test('big figures are shortened', () => {
  assert.equal(short(999), '999');
  assert.equal(short(12000), '12k');
  assert.equal(short(12500), '12.5k');
  assert.equal(short(250000), '250k');
});

test('a rare input the town holds, and its parts summed, come before the stage materials', () => {
  const r = readoutItems({ iron: 30, cloth: 9, silver: 2 }, 0, { iron_blade: 2, haft: 3, rope: 4 });
  assert.deepEqual(r.map((i) => [i.id, i.n]), [['wood', 0], ['stone', 0], ['food', 0], ['silver', 2], ['parts', 5]]);
  assert.deepEqual(readoutItems({ iron: 30 }, 0, { rope: 4 }).map((i) => i.id), ['wood', 'stone', 'food', 'iron'], 'no parts, no rare input: as before');
});
