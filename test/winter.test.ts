import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathShows, freezes, iceAt, trackGround, trackLife } from '../src/renderer/map/ice';

test('narrow water freezes in the cold, wide water stays open', () => {
  assert.equal(freezes('winter', 'forest'), true);
  assert.equal(breathShows('summer', 'tundra', 1), true);
  assert.equal(freezes('summer', 'forest'), false);
  // a river two wide running across, and a sea filling everything below row 20
  const water = (_x: number, y: number) => (y >= 5 && y <= 6) || y >= 20;
  assert.equal(iceAt(water, 10, 5), true, 'the river ices over');
  assert.equal(iceAt(water, 10, 30), false, 'the sea stays open');
  assert.equal(iceAt(water, 10, 10), false, 'dry land is no ice');
});

test('footprints: deep in snow, brief in sand, in mud only in the rain, never on roads', () => {
  assert.equal(trackGround('grass', 'winter', 'forest', 'clear', false), 'snow');
  assert.equal(trackGround('grass', 'winter', 'forest', 'clear', true), 'none');
  assert.equal(trackGround('sand', 'summer', 'desert', 'clear', false), 'sand');
  assert.equal(trackGround('grass', 'summer', 'forest', 'clear', false), 'none');
  assert.equal(trackGround('grass', 'summer', 'forest', 'rain', false), 'mud');
  assert.equal(trackGround('rock', 'winter', 'forest', 'clear', false), 'none');
  assert.ok(trackLife('snow', 'clear') > trackLife('mud', 'rain'));
  assert.ok(trackLife('mud', 'rain') > trackLife('sand', 'clear'));
  assert.ok(trackLife('snow', 'snow') < trackLife('snow', 'clear'), 'falling snow fills prints sooner');
});

test('breath shows in the cold', () => {
  assert.equal(breathShows('winter', 'forest', 1), true);
  assert.equal(breathShows('summer', 'forest', 1), false);
  assert.equal(breathShows('autumn', 'forest', 0.1), true);
});
