import assert from 'node:assert/strict';
import { test } from 'node:test';
import { venueRoom, venueSpots } from '../src/renderer/interior/handRooms';

test('the inns are drawn from the Common Room and every shop from the Shop', () => {
  assert.equal(venueRoom('tavern')?.fields.name, 'The Common Room');
  assert.equal(venueRoom('shop')?.fields.name, 'The Shop');
});

test("a venue's people stand where the room has room: the keeper behind the counter, customers in front of it, the door below", () => {
  for (const venue of ['tavern', 'shop'] as const) {
    const m = venueRoom(venue)!;
    const s = venueSpots(m);
    const stations = m.things.filter((t) => t[2] === 'Spot' && t[3] === 'station');
    assert.ok(stations.length, venue);
    assert.equal(s.keeper.x, stations[0][0] + 0.5, venue);
    assert.ok(s.counter.length >= 2, venue);
    for (const c of s.counter) assert.ok(c.y > s.keeper.y + 1 && c.y < m.h, `${venue}: the counter's front is on the floor, past the counter`);
    assert.ok(s.browse.length >= 3, venue);
    const sits = new Set(m.things.filter((t) => t[2] === 'Spot' && (t[3] === 'seat' || t[3] === 'hearth')).map((t) => `${t[0]},${t[1]}`));
    const stood = new Set(m.things.filter((t) => t[2] === 'Furniture' && t[3] !== 'rug_grey').map((t) => `${t[0]},${t[1]}`));
    for (const b of s.browse) {
      assert.ok(b.x > 0 && b.x < m.w && b.y > 0 && b.y < m.h, `${venue}: on the floor`);
      const cell = `${Math.floor(b.x)},${Math.floor(b.y)}`;
      assert.ok(sits.has(cell) || !stood.has(cell), `${venue}: nobody stands in the furniture, but on a seat`);
    }
    assert.ok(s.door.y >= m.h - 0.5 && s.door.x > 1 && s.door.x < m.w - 1, `${venue}: the door is below the room's middle`);
  }
});
