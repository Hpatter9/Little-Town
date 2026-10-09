import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGINS } from '../src/shared/data/origins';
import { seatPacked } from '../src/renderer/map/seatPacks';

test('every people\'s seat is laid together from the packs, all five stages', () => {
  const missing = ORIGINS.filter((id) => !seatPacked(id));
  assert.deepEqual(missing, []);
});
