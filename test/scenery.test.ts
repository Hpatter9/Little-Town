import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { scenerySets } from '../src/renderer/art/scenerySets';

test('the town has pack scenery for every land and season, all in its atlas', () => {
  const frames = JSON.parse(readFileSync('src/renderer/art/scenery.json', 'utf8')) as Record<string, [number, number, number, number][]>;
  assert.ok(existsSync('src/renderer/art/scenery/scenery.png'));
  assert.ok(frames.cloud?.length >= 4, 'clouds for the sky');
  for (const biome of BIOMES)
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const k = scenerySets(biome, season);
      for (const set of [k.broadleaf, k.pine, k.bush, k.boulder]) assert.ok(frames[set]?.length, `${biome} ${season}: ${set} has pictures`);
    }
  // snow in winter and on the tundra; leaves turned in autumn
  assert.equal(scenerySets('tundra', 'summer').broadleaf, 'snowTree');
  assert.equal(scenerySets('forest', 'winter').boulder, 'snowRock');
  assert.ok(scenerySets('forest', 'autumn').turned);
  assert.equal(scenerySets('desert', 'summer').broadleaf, 'dryTree');
});
