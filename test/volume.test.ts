import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf } from '../src/renderer/volume';

test('a stored volume reads as a share of full, full when nothing sensible is stored', () => {
  assert.equal(levelOf(null), 1);
  assert.equal(levelOf(''), 1);
  assert.equal(levelOf('nonsense'), 1);
  assert.equal(levelOf('40'), 0.4);
  assert.equal(levelOf('0'), 0);
  assert.equal(levelOf('250'), 1);
  assert.equal(levelOf('-5'), 0);
});
