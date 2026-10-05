import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID, BUILDINGS } from '../src/shared/data/buildings';
import { SEAT_DEFS } from '../src/shared/data/seats';
import { kindOf } from '../src/renderer/map/roomKinds';

// A castle's or a hold's rooms are dressed by what they are (map/castleClutter.ts): beds' rooms with chests and jars,
// a library with shelves and books, a smithy with racks and shields, the seat with gold.

test('every room is dressed as what it is', () => {
  assert.equal(kindOf(BUILDING_BY_ID.longhouse), 'home');
  assert.equal(kindOf(BUILDING_BY_ID.healers_hut), 'healer');
  assert.equal(kindOf(BUILDING_BY_ID.smithy), 'forge');
  assert.equal(kindOf(BUILDING_BY_ID.library), 'study');
  assert.equal(kindOf(BUILDING_BY_ID.stockpile), 'store');
  for (const s of SEAT_DEFS) assert.equal(kindOf(s), 'treasury', `${s.id} is a throne room`);
  const kinds = new Set(['hall', 'home', 'store', 'study', 'forge', 'healer', 'kitchen', 'treasury', 'mine', 'work']);
  for (const b of BUILDINGS) assert.ok(kinds.has(kindOf(b)), b.id);
  // (and something besides the plain workroom: most kinds of room are told apart)
  const seen = new Set(BUILDINGS.map(kindOf));
  assert.ok(seen.size >= 8, [...seen].join(' '));
});
