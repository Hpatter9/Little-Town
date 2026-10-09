import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  batsOut,
  beesOut,
  crowsFor,
  CROWS_PER_FIELD,
  dewOn,
  dragonfliesOut,
  driftDepth,
  frostOn,
  hailing,
  hasScarecrow,
  hiveKind,
  mothsOut,
  ratCount,
  ratPlague,
  RATS_MOST,
  tempting,
} from '../src/renderer/map/critterRules';

const sky = (o: Partial<{ season: string; weather: string; daylight: number; hour: number; cold: boolean; dayOfSeason: number }> = {}) => ({ season: 'summer', weather: 'clear', daylight: 1, hour: 12, cold: false, dayOfSeason: 2, ...o });

test('bees work by day in the warm seasons, never in the cold or the wet', () => {
  assert.ok(beesOut(sky()));
  assert.ok(beesOut(sky({ season: 'spring' })));
  assert.ok(!beesOut(sky({ season: 'winter' })));
  assert.ok(!beesOut(sky({ weather: 'rain' })));
  assert.ok(!beesOut(sky({ daylight: 0.1, hour: 22 })));
  assert.ok(!beesOut(sky({ cold: true })));
  assert.equal(hiveKind('neolithic'), 'skep');
  assert.equal(hiveKind('medieval'), 'skep');
  assert.equal(hiveKind('industrial'), 'box');
});

test('dragonflies by summer days, bats at dusk, moths on warm nights', () => {
  assert.ok(dragonfliesOut(sky()));
  assert.ok(!dragonfliesOut(sky({ season: 'spring', dayOfSeason: 1 })));
  assert.ok(!dragonfliesOut(sky({ season: 'autumn' })));
  assert.equal(batsOut(sky()), 0);
  assert.equal(batsOut(sky({ hour: 19, daylight: 0.4 })), 1);
  assert.ok(batsOut(sky({ hour: 1, daylight: 0 })) > 0);
  assert.equal(batsOut(sky({ hour: 6, daylight: 0.3 })), 0);
  assert.equal(batsOut(sky({ hour: 19, daylight: 0.4, season: 'winter' })), 0);
  assert.equal(batsOut(sky({ hour: 19, daylight: 0.4, weather: 'rain' })), 0);
  assert.ok(mothsOut(sky({ hour: 23, daylight: 0 })));
  assert.ok(!mothsOut(sky()));
  assert.ok(!mothsOut(sky({ hour: 23, daylight: 0, season: 'winter' })));
});

test('crows come to ripening fields, and a scarecrow keeps all but one off', () => {
  assert.ok(tempting({ stage: 'ripe', growth: 1 }));
  assert.ok(tempting({ stage: 'growing', growth: 0.8 }));
  assert.ok(!tempting({ stage: 'growing', growth: 0.3 }));
  assert.ok(!tempting({ stage: 'fallow', growth: 0 }));
  assert.ok(!tempting(undefined));
  assert.equal(crowsFor(true, false), CROWS_PER_FIELD);
  assert.equal(crowsFor(true, true), 1);
  assert.equal(crowsFor(false, false), 0);
  // (about three crop fields in five have one; never the orchard or the herbs)
  const ids = Array.from({ length: 200 }, (_, i) => i + 1);
  const share = ids.filter((id) => hasScarecrow(id, 'garden_plot')).length / ids.length;
  assert.ok(share > 0.45 && share < 0.75, `share ${share}`);
  assert.ok(ids.every((id) => !hasScarecrow(id, 'orchard') && !hasScarecrow(id, 'herb_garden')));
  assert.equal(hasScarecrow(5, 'garden_plot'), hasScarecrow(5, 'garden_plot'));
});

test('rats come as the stores fill, more with a full granary, a swarm in the plague', () => {
  assert.equal(ratCount(10, 100, false, false), 0);
  assert.ok(ratCount(90, 100, false, false) > 0);
  assert.ok(ratCount(90, 100, true, false) > ratCount(90, 100, false, false));
  assert.ok(ratCount(10, 100, false, true) >= 6);
  assert.ok(ratCount(100, 100, true, true) <= RATS_MOST);
  assert.equal(ratCount(0, 0, false, false), 0);
  assert.ok(ratPlague(['Rats'], null));
  assert.ok(ratPlague([], '⚡ Rats'));
  assert.ok(!ratPlague(['Pirates'], 'Ratsbane harvest'));
});

test('frost on cold mornings, dew on the others at dawn', () => {
  assert.equal(frostOn(sky({ season: 'winter', hour: 6 })), 1);
  assert.equal(frostOn(sky({ season: 'winter', hour: 6, weather: 'cloudy' })), 0.5);
  assert.equal(frostOn(sky({ season: 'winter', hour: 12 })), 0);
  assert.equal(frostOn(sky({ season: 'winter', hour: 6, weather: 'rain' })), 0);
  assert.equal(frostOn(sky({ season: 'summer', hour: 6 })), 0);
  assert.ok(frostOn(sky({ season: 'autumn', dayOfSeason: 3, hour: 9 })) > 0);
  assert.ok(frostOn(sky({ season: 'spring', hour: 5, cold: true })) > 0);
  assert.equal(dewOn(sky({ hour: 6, daylight: 0.4 })), 1);
  assert.equal(dewOn(sky({ hour: 14 })), 0);
  assert.equal(dewOn(sky({ hour: 6, season: 'winter' })), 0);
  assert.equal(dewOn(sky({ hour: 6, weather: 'rain' })), 0);
});

test('hail in some cold storms, never in summer\'s; drifts deepen through winter', () => {
  let storms = 0;
  for (let day = 1; day <= 30; day++) for (let hour = 0; hour < 24; hour += 3) if (hailing('storm', 'autumn', false, day, hour)) storms++;
  assert.ok(storms > 40 && storms < 120, `hailing spells ${storms} of 240`);
  for (let day = 1; day <= 30; day++) for (let hour = 0; hour < 24; hour++) assert.ok(!hailing('storm', 'summer', false, day, hour) && !hailing('clear', 'winter', false, day, hour));
  assert.equal(hailing('storm', 'winter', false, 4, 7), hailing('storm', 'winter', false, 4, 8));
  assert.equal(driftDepth('summer', 2, 'clear', false), 0);
  assert.ok(driftDepth('winter', 3, 'clear', false) > driftDepth('winter', 1, 'clear', false));
  assert.ok(driftDepth('winter', 3, 'snow', false) <= 1);
  assert.ok(driftDepth('autumn', 1, 'clear', true) > 0);
});
