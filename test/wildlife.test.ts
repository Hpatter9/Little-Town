import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wildChoices, WILD_KINDS } from '../src/renderer/map/mapWildlife';

test('the land offers its own beasts: wolves by night, camels in the desert, snow foxes in winter, wolves only on blighted land', () => {
  const sum = (c: ReturnType<typeof wildChoices>) => c.reduce((a, x) => a + x[1], 0);
  for (const biome of ['forest', 'desert', 'tundra', 'coast'])
    for (const season of ['spring', 'summer', 'autumn', 'winter'])
      for (const night of [false, true]) {
        const c = wildChoices(biome, season, night, false);
        assert.ok(Math.abs(sum(c) - 1) < 1e-9, `${biome} ${season} ${night}`);
        for (const [k, , [lo, hi]] of c) {
          assert.ok(WILD_KINDS.includes(k));
          assert.ok(lo >= 1 && hi >= lo);
        }
      }
  assert.ok(wildChoices('forest', 'summer', true, false).some((c) => c[0] === 'wolf'));
  assert.ok(wildChoices('desert', 'summer', false, false).some((c) => c[0] === 'camel'));
  assert.ok(wildChoices('forest', 'winter', false, false).some((c) => c[0] === 'snowfox'));
  assert.ok(!wildChoices('forest', 'summer', false, false).some((c) => c[0] === 'wolf'));
  assert.ok(wildChoices('forest', 'summer', false, true).every((c) => c[0] === 'wolf'));
});
