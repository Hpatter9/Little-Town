import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';
import { pickCovered } from '../src/renderer/map/packBuildings';

/** (A hold's hallway is no picture: bare floor, the dungeon pack's flagstones, map/castleArt.ts.) What no pack has (most war engines and turrets, the launch pad, two peoples' own defences): still painted. */
const PAINTED = new Set(['gun_nest', 'gun_turret', 'laser_turret', 'launch_site', 'boiling_oil', 'ballista', 'catapult', 'flame_turret', 'mortar_pit', 'tide_pool_trap', 'acid_sprayer']);
const LOOKS = ['town', 'settlers', 'knights', 'lich', 'vampire', 'druid', 'werewolf', 'robot', 'dwarves', 'merfolk', 'nomads', 'fae', 'alchemists'];

test('every building is drawn from the packs in every look, but what no pack has', () => {
  const missing: string[] = [];
  for (const b of BUILDINGS) {
    if (CROPS[b.id] || HERDS[b.id] || b.id.startsWith('seat_') || b.id === 'campfire' || b.id === 'hold_hallway' || PAINTED.has(b.id)) continue;
    for (const look of LOOKS) {
      // (the merfolk's homes are their painted stilt huts)
      if (look === 'merfolk' && b.housing) continue;
      if (!pickCovered(b.id, look)) missing.push(`${b.id} (${look})`);
    }
  }
  assert.deepEqual(missing, []);
});
