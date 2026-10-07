import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambientMix, type AmbientState } from '../src/renderer/ambienceMix';

const base: AmbientState = { daylight: 1, season: 'summer', weather: 'clear', biome: 'forest', water: 0, forest: 0.5, sea: false, blighted: false, raid: false, fire: false };

test('the land sounds by the hour: birds by day, crickets and owls by night', () => {
  const day = ambientMix(base);
  const night = ambientMix({ ...base, daylight: 0 });
  assert.ok(day.birds > 0 && day.crickets === 0);
  assert.ok(night.birds === 0 && night.crickets > 0 && night.owls > 0);
});

test('the weather and the land change the beds: rain, storm wind, water in view, frogs by it', () => {
  assert.equal(ambientMix(base).rain, 0);
  const storm = ambientMix({ ...base, weather: 'storm' });
  assert.ok(storm.rain === 1 && storm.wind === 1 && storm.birds === 0);
  const river = ambientMix({ ...base, daylight: 0, water: 0.3 });
  assert.ok(river.water > 0 && river.frogs > 0);
  assert.ok(ambientMix({ ...base, water: 0.3, sea: true }).water > river.water);
});

test('winter, the blight and a raid quieten the living things', () => {
  assert.equal(ambientMix({ ...base, season: 'winter' }).birds, 0);
  assert.equal(ambientMix({ ...base, daylight: 0, season: 'winter' }).crickets, 0);
  assert.equal(ambientMix({ ...base, blighted: true }).birds, 0);
  assert.ok(ambientMix({ ...base, daylight: 0, blighted: true }).wolves > ambientMix({ ...base, daylight: 0 }).wolves);
  assert.ok(ambientMix({ ...base, raid: true }).birds < ambientMix(base).birds);
});
