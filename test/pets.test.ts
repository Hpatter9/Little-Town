import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLine, petsOf } from '../src/renderer/map/pets';

test('homes keep dogs, cats and hens, the same ones every time', () => {
  let dogs = 0;
  let cats = 0;
  let hens = 0;
  for (let id = 1; id <= 400; id++) {
    const a = petsOf(id, 'settlers');
    assert.deepEqual(a, petsOf(id, 'settlers'), 'a home keeps its pets');
    for (const p of a) {
      assert.ok(p.name.length > 0);
      if (p.kind === 'dog') dogs++, assert.ok(p.coat >= 0 && p.coat < 4);
      if (p.kind === 'cat') cats++, assert.ok(p.coat >= 0 && p.coat < 4);
      if (p.kind === 'hen') hens++, assert.ok(p.coat === 0 || p.coat === 1);
    }
    assert.ok(a.filter((p) => p.kind !== 'hen').length <= 1, 'one dog or cat a home');
  }
  assert.ok(dogs > 100 && cats > 90 && hens > 150, `${dogs} dogs, ${cats} cats, ${hens} hens`);
});

test('the dead keep black cats, the machines nothing', () => {
  for (let id = 1; id <= 100; id++) {
    assert.ok(petsOf(id, 'lich').every((p) => p.kind === 'cat' && p.coat === 1));
    assert.equal(petsOf(id, 'robot').length, 0);
  }
  assert.match(petLine('dog', 'bark', 'Elka'), /Elka's dog, barking/);
});

import { skyFor } from '../src/renderer/map/mapSky';
test('the sky: fog, sandstorms, blizzards and heat haze come with their weather', () => {
  const at = (weather: string, season: string, biome: string, hour = 12, spell = 3) => skyFor({ weather, season, biome, hour, daylight: 1, spell });
  assert.equal(at('fog', 'spring', 'forest').fog, 1);
  assert.ok(at('clear', 'autumn', 'forest', 6.5).fog > 0.2, 'morning mist');
  assert.equal(at('clear', 'autumn', 'forest', 14).fog, 0);
  assert.equal(at('storm', 'summer', 'desert').sand, 1);
  assert.equal(at('storm', 'summer', 'forest').sand, 0);
  assert.equal(at('snow', 'winter', 'forest', 12, 3).blizzard, 1);
  assert.ok(at('snow', 'winter', 'forest', 12, 4).blizzard < 0.5);
  assert.ok(at('clear', 'summer', 'desert', 13.5).haze > 0.9);
  assert.equal(at('clear', 'summer', 'desert', 20).haze, 0);
});
