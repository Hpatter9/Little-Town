// Footpaths: the cells people step into wear, a worn path grasses over hour by hour, and roads never wear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addWear, decayWear, idx, setRoad, wearAt, WEAR_DECAY, WEAR_DECAY_HOURS, WEAR_FULL, WEAR_MAX, WEAR_SHOW, WEAR_STEP } from '../src/shared/sim/land';
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

// Walk one cell `crossings` times in a game day (back and forth over the same ground), the hours going by.
function walkDay(s: ReturnType<typeof plainGame>, w: Walker, a: { x: number; y: number }, b: { x: number; y: number }, crossings: number, hourFrom: number): void {
  for (let h = 0; h < 24; h++) {
    if (h < crossings)
      for (const [from, to] of [[a, b], [b, a]] as const) {
        w.x = from.x;
        w.y = from.y;
        delete w.path;
        delete w.cell;
        for (let i = 0; i < 400 && !walk(s, w, to, 4, undefined, i); i++);
      }
    decayWear(s.land, hourFrom + h);
  }
}

test('a route walked a few times a day shows a track by day 2 and a clear path in a few days, and fades slower than it wears', () => {
  const s = plainGame('footpath-day');
  const c = campCell(s);
  const a = cellPx(s, idx(s.land, c.x - 3, c.y + 4));
  const b = cellPx(s, idx(s.land, c.x + 3, c.y + 4));
  const mid = idx(s.land, c.x, c.y + 4);
  const w: Walker = { x: a.x, y: a.y, dir: 1 };
  let hour = 0;
  walkDay(s, w, a, b, 6, hour); // (six round trips a day: twelve steps into each cell on the way)
  hour += 24;
  assert.ok(wearAt(s.land, mid) >= WEAR_SHOW, 'a faint track the first day');
  walkDay(s, w, a, b, 6, hour);
  hour += 24;
  assert.ok(wearAt(s.land, mid) >= (WEAR_SHOW + WEAR_FULL) / 2, 'plain by day 2');
  for (let d = 0; d < 2; d++, hour += 24) walkDay(s, w, a, b, 6, hour);
  assert.ok(wearAt(s.land, mid) >= WEAR_FULL, 'a clear path within four days');
  // left alone, it fades: slowly, over more than a day
  let hours = 0;
  while (wearAt(s.land, mid) >= WEAR_SHOW && hours < 24 * 20) decayWear(s.land, hour + hours++);
  assert.ok(hours > 30, `an unused clear path lasts more than a day and a half (${hours} hours)`);
});

test('the wear fades by WEAR_DECAY every WEAR_DECAY_HOURS hours, not every hour', () => {
  const s = plainGame('footpath-fade');
  addWear(s.land, 7, 30);
  let took = 0;
  for (let h = 1; h <= WEAR_DECAY_HOURS * 2; h++) {
    decayWear(s.land, h);
    took = 30 - wearAt(s.land, 7);
  }
  assert.equal(took, 2 * WEAR_DECAY);
  assert.ok(WEAR_DECAY * 24 / WEAR_DECAY_HOURS < WEAR_STEP * 9, 'a day of rest takes off less than nine crossings add');
});
