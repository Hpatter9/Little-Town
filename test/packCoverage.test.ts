import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';
import { pickCovered } from '../src/renderer/map/packBuildings';

/** What no pack has (the war engines and turrets, the launch pad, three peoples' own defences): still painted. */
const PAINTED = new Set(['gun_nest', 'gun_turret', 'laser_turret', 'launch_site', 'boiling_oil', 'ballista', 'catapult', 'cannon', 'flame_turret', 'mortar_pit', 'sentry_bot', 'tide_pool_trap', 'acid_sprayer']);
const LOOKS = ['town', 'settlers', 'knights', 'lich', 'vampire', 'druid', 'werewolf', 'robot', 'dwarves', 'merfolk', 'nomads', 'fae', 'alchemists'];

test('every building is drawn from the packs in every look, but what no pack has', () => {
  const missing: string[] = [];
  for (const b of BUILDINGS) {
    if (CROPS[b.id] || HERDS[b.id] || b.id.startsWith('seat_') || b.id === 'campfire' || PAINTED.has(b.id)) continue;
    for (const look of LOOKS) {
      // (the merfolk's homes are their painted stilt huts)
      if (look === 'merfolk' && b.housing) continue;
      if (!pickCovered(b.id, look)) missing.push(`${b.id} (${look})`);
    }
  }
  assert.deepEqual(missing, []);
});
