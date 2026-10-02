import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, footprint } from '../src/shared/sim/buildings';
import { castleDepth, castleWidth, growKeep, inKeep, keepFill, keepRect, KEEP_MAX, roomKind, WING_H, WING_W } from '../src/shared/sim/castle';
import { overlaps } from '../src/shared/sim/land';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { put } from './helpers';

test('a Blood Court builds a castle: one level of rooms on the keep\'s ground over the camp, the yards outside', () => {
  const sim = new Sim(newGame('castle-grows', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const keep = keepRect(s);
  const rooms = s.buildings.filter((b) => b.room);
  assert.ok(rooms.length >= 6, `rooms: ${rooms.length}`);
  for (const b of rooms) assert.ok(inKeep(s, footprint(b)), `${b.def} in the keep`);
  // fields, mines and walls never go in
  // (the fire and the first stores stand at the camp, under the keep)
  for (const b of s.buildings.filter((q) => !q.room && q.def !== 'campfire' && q.def !== 'stockpile')) assert.ok(!overlaps(keep, footprint(b)), `${b.def} outside`);
  assert.ok(keepFill(s, footprint) > 0);
  assert.deepEqual(snapshot(s).castle?.rect, keep);
});

test('other towns spread out as before, with no castle', () => {
  const sim = new Sim(newGame('no-castle', { origin: 'settlers' }));
  for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
  assert.ok(!sim.state.buildings.some((b) => b.room));
  assert.equal(snapshot(sim.state).castle, null);
});

test('rooms go inside the keep and nothing else does; the keep grows with each era', () => {
  const s = newGame('keep', { origin: 'vampire' });
  const keep = keepRect(s);
  assert.equal(keep.w, castleWidth('neolithic'));
  assert.equal(keep.h, castleDepth('neolithic'));
  const cottage = BUILDING_BY_ID.cottage;
  assert.ok(roomKind(s, cottage));
  assert.ok(!roomKind(s, BUILDING_BY_ID.garden_plot));
  assert.equal(canPlace(s, cottage, keep.x, keep.y + keep.h - 2).ok, true, 'a room inside');
  assert.equal(canPlace(s, cottage, keep.x + keep.w + 1, keep.y).ok, false, 'a room outside the keep');
  assert.equal(canPlace(s, BUILDING_BY_ID.garden_plot, keep.x, keep.y + keep.h - 2).ok, false, 'a field inside');
  put(s, 'cottage', keep.x, keep.y + keep.h - 2, { room: true });
  assert.equal(canPlace(s, cottage, keep.x, keep.y + keep.h - 2).ok, false, 'rooms never overlap');
  s.era = 'medieval';
  const grown = keepRect(s);
  assert.ok(grown.w > keep.w && grown.h > keep.h, 'wider and deeper');
  assert.ok(grown.x <= keep.x && grown.y <= keep.y, 'still over the camp');
});

test('the keep grows a wing when its rooms need the room, up to a limit', () => {
  const s = newGame('wings', { origin: 'vampire' });
  const before = keepRect(s);
  assert.ok(growKeep(s));
  const after = keepRect(s);
  assert.deepEqual([after.w - before.w, after.h - before.h], [WING_W, WING_H]);
  let n = 0;
  while (growKeep(s) && n < 100) n++;
  assert.deepEqual([keepRect(s).w, keepRect(s).h], [KEEP_MAX.w, KEEP_MAX.h]);
  assert.equal(growKeep(s), false, 'no more');
});
