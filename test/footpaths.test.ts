// Footpaths: the cells people step into wear, a worn path grasses over hour by hour, and roads never wear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addWear, decayWear, idx, setRoad, wearAt, WEAR_DECAY, WEAR_MAX, WEAR_STEP } from '../src/shared/sim/land';
import { walk, type Walker } from '../src/shared/sim/walk';
import { campCell } from '../src/shared/sim/state';
import { plainGame, cellPx } from './helpers';

test('walking across the land wears each cell stepped into, roads excepted, and the wear grasses over by the hour', () => {
  const s = plainGame('footpath');
  const c = campCell(s);
  const from = cellPx(s, idx(s.land, c.x - 3, c.y + 3));
  const to = cellPx(s, idx(s.land, c.x + 3, c.y + 3));
  setRoad(s.land, c.x, c.y + 3);
  const w: Walker = { x: from.x, y: from.y, dir: 1 };
  for (let i = 0; i < 400 && !walk(s, w, to, 4, undefined, i); i++);
  assert.ok(Math.hypot(w.x - to.x, w.y - to.y) < 3, 'got there');
  assert.equal(wearAt(s.land, idx(s.land, c.x + 1, c.y + 3)), WEAR_STEP, 'a cell on the way is worn once');
  assert.equal(wearAt(s.land, idx(s.land, c.x, c.y + 3)), 0, 'the road is not');
  assert.equal(wearAt(s.land, idx(s.land, c.x - 3, c.y + 3)), 0, 'the cell started in is not (nobody stepped into it)');
  // back and forth, and the path deepens, to a limit
  for (let trip = 0; trip < 60; trip++) {
    const [a, b] = trip % 2 ? [to, from] : [from, to];
    w.x = a.x;
    w.y = a.y;
    delete w.path;
    for (let i = 0; i < 400 && !walk(s, w, b, 4, undefined, i); i++);
  }
  assert.equal(wearAt(s.land, idx(s.land, c.x + 1, c.y + 3)), WEAR_MAX, 'worn to the limit');
  decayWear(s.land);
  assert.equal(wearAt(s.land, idx(s.land, c.x + 1, c.y + 3)), WEAR_MAX - WEAR_DECAY, 'an hour on, a little less');
  const fresh = plainGame('footpath-2');
  addWear(fresh.land, 5);
  assert.equal(wearAt(fresh.land, 5), WEAR_STEP);
  for (let h = 0; h < WEAR_STEP; h++) decayWear(fresh.land);
  assert.equal(fresh.land.wear, undefined, 'all grassed over: the field is dropped');
});
