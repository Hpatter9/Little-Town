import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { pictureSource } from '../src/renderer/art/pictureSource';

const LOOKS = ['town', 'settlers', 'knights', 'lich', 'vampire', 'druid', 'werewolf', 'robot', 'dwarves', 'merfolk', 'nomads', 'nomads_city', 'fae', 'alchemists', 'orcs'];
/** What no pack has, so the card shows the top-down painter's (the same list as test/packCoverage.test.ts). */
const PAINTED = new Set(['gun_nest', 'gun_turret', 'laser_turret', 'launch_site', 'boiling_oil', 'ballista', 'catapult', 'flame_turret', 'mortar_pit', 'tide_pool_trap', 'acid_sprayer', 'hold_hallway']);

test('every building has a picture source in every look: the map\'s pack art, or a named painted fallback', () => {
  const strays: string[] = [];
  for (const b of BUILDINGS)
    for (const look of LOOKS) {
      const src = pictureSource(b.id, look);
      if (src === 'painted' && !PAINTED.has(b.id) && !(look === 'merfolk' && b.housing)) strays.push(`${b.id} (${look})`);
    }
  assert.deepEqual(strays, []);
});

test('fields, pens, seats and the campfire draw as the map does', () => {
  assert.equal(pictureSource('orchard', 'town'), 'plot');
  assert.equal(pictureSource('chicken_coop', 'town'), 'plot');
  assert.equal(pictureSource('campfire', 'town'), 'campfire');
  assert.equal(pictureSource(BUILDINGS.find((b) => b.id.startsWith('seat_'))!.id, 'town'), 'seat');
});
