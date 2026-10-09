import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAMES_MOST, frameDue, SHOT_HOUR, SHOT_LEAST_CELLS, thin, townBox, type TimelapseFrame } from '../src/renderer/timelapse';

const frame = (day: number): TimelapseFrame => ({ day, era: 'neolithic', people: 3, url: 'x' });

test('a picture a day at noon, per town', () => {
  assert.equal(frameDue(null, 'a', 1, SHOT_HOUR - 1), false, 'not before noon');
  assert.equal(frameDue(null, 'a', 1, SHOT_HOUR), true);
  const t = { seed: 'a', frames: [frame(1)] };
  assert.equal(frameDue(t, 'a', 1, 15), false, 'one a day');
  assert.equal(frameDue(t, 'a', 2, 15), true);
  assert.equal(frameDue(t, 'b', 1, 15), true, 'a new town starts its own');
});

test('a long game keeps its whole span, thinner at the start', () => {
  const all = Array.from({ length: 300 }, (_, i) => frame(i + 1));
  const kept = thin(all);
  assert.ok(kept.length <= FRAMES_MOST);
  assert.equal(kept[0].day, 1, 'the founding kept');
  assert.equal(kept.at(-1)!.day, 300, 'today kept');
  const gaps = kept.slice(1).map((f, i) => f.day - kept[i].day);
  assert.ok(gaps[0] >= gaps.at(-1)!, 'thinner at the start');
});

test('the picture is a square round the town, never too small', () => {
  const cell = 32;
  const small = townBox([], { x: 1000, y: 1000 }, cell);
  assert.equal(small.w, SHOT_LEAST_CELLS * cell);
  assert.equal(small.w, small.h);
  const big = townBox([{ x: 0, y: 0, w: 64, h: 64 }, { x: 2000, y: 600, w: 64, h: 64 }], { x: 1000, y: 300 }, cell);
  assert.ok(big.w >= 2064, 'covers every building');
  assert.ok(big.x <= 0 && big.x + big.w >= 2064);
});
