import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace } from '../src/shared/sim/buildings';
import { adoptRooms, CASTLE_FLOORS, CASTLE_TILES, castleFloors, castleSpan, floorFill, openFloors, roomOf } from '../src/shared/sim/castle';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

test('a Blood Court builds a castle: rooms stacked floor on floor over the camp, the yards outside', () => {
  const sim = new Sim(newGame('castle-grows', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const [lo, hi] = castleSpan(s);
  const rooms = s.buildings.filter((b) => b.room);
  assert.ok(rooms.length >= 8, `rooms: ${rooms.length}`);
  assert.ok(castleFloors(s) >= 2, `floors: ${castleFloors(s)}`);
  assert.ok(castleFloors(s) <= CASTLE_FLOORS);
  for (const b of rooms) {
    const w = BUILDING_BY_ID[b.def].width;
    assert.ok(b.tile >= lo && b.tile + w <= hi, `${b.def} in the keep`);
    // every floor up stands on one mostly built
    if ((b.floor ?? 0) > 0) assert.ok(floorFill(s, (b.floor ?? 0) - 1) >= CASTLE_TILES / 2, `${b.def} on ${b.floor}`);
  }
  // fields and walls never go in
  for (const b of s.buildings.filter((q) => !q.room)) assert.ok(BUILDING_BY_ID[b.def].layer !== 'mid' || b.tile + BUILDING_BY_ID[b.def].width <= lo || b.tile >= hi || b.def === 'campfire', `${b.def} outside`);
  assert.ok(snapshot(s).castle?.floors === castleFloors(s));
});

test('other towns spread out as before, with no castle', () => {
  const sim = new Sim(newGame('no-castle', { origin: 'settlers' }));
  for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
  assert.ok(!sim.state.buildings.some((b) => b.room));
  assert.equal(snapshot(sim.state).castle, null);
});

test('rooms overlap only on the same floor; a floor opens once the one below is half built', () => {
  const s = newGame('floors', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  const def = BUILDING_BY_ID.cottage;
  s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 0 });
  assert.equal(canPlace(s, [], def, lo, 0).ok, false);
  assert.equal(canPlace(s, [], def, lo, 1).ok, true);
  assert.deepEqual(openFloors(s), [0]);
  for (let k = 1; k * 3 < CASTLE_TILES / 2 + 3; k++) s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo + k * 3, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 0 });
  assert.deepEqual(openFloors(s), [0, 1]);
});

test("an older vampire town's buildings in the keep become its ground floor", () => {
  const s = newGame('adopt', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  s.buildings.push({ id: s.nextId++, def: 'workbench', tile: lo + 2, status: 'done', delivered: {}, progress: 1, store: {} });
  adoptRooms(s);
  const b = s.buildings.at(-1)!;
  assert.equal(b.room, true);
  assert.equal(b.floor, 0);
});

test('townsfolk are seen in the room they sleep or work in, up on its floor', () => {
  const s = newGame('upstairs', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo + 4, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 2 });
  const room = s.buildings.at(-1)!;
  const p = s.people[0];
  p.x = (room.tile + 1.5) * 32;
  p.task = { type: 'sleep', building: room.id };
  p.activity = 'sleep';
  assert.equal(roomOf(s, p), room);
  const view = snapshot(s).people.find((q) => q.id === p.id)!;
  assert.equal(view.floor, 2);
  assert.equal(view.indoors, false, 'seen in the room, not hidden');
});
