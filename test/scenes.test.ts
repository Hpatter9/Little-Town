import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { INDOOR_SCENES, ROUTES, SCENES, SCENE_LOOKS, sceneFor } from '../src/shared/data/scenes';
import { BIOMES } from '../src/shared/data/biomes';
import { BACKDROPS } from '../src/shared/data/backdrops';

test('29 fight scenes, every one reachable, every destination routed', () => {
  assert.equal(SCENES.length, 29);
  assert.equal(new Set(SCENES).size, 29);
  for (const d of DESTINATIONS) assert.ok(ROUTES[d.id], `${d.id} has a route`);
  const used = new Set<string>();
  for (const d of DESTINATIONS)
    for (const phase of ['out', 'work', 'back'])
      for (const biome of BIOMES) used.add(sceneFor(d.id, d.scenery, phase, biome));
  for (const s of SCENES) assert.ok(used.has(s), `${s} is used somewhere`);
});

test('on the road it is the land; arrived at a dungeon it is inside', () => {
  assert.equal(sceneFor('bear_cave', 'cave', 'out', 'forest'), 'highlands');
  assert.equal(sceneFor('bear_cave', 'cave', 'work', 'forest'), 'cave');
  assert.equal(sceneFor('dark_keep', 'cave', 'work', 'forest'), 'keep');
  assert.equal(sceneFor('pirate_flagship', 'quarry', 'work', 'desert'), 'ship_hold');
  for (const d of DESTINATIONS) assert.ok(!INDOOR_SCENES.has(sceneFor(d.id, d.scenery, 'out', 'forest')), `${d.id}: the road is outdoors`);
  // (the town's land changes the green scenes, never a dungeon)
  assert.equal(sceneFor('berry_thicket', 'thicket', 'work', 'desert'), 'dunes');
  assert.equal(sceneFor('deep_woods', 'woods', 'out', 'tundra'), 'tundra');
  assert.equal(sceneFor('bear_cave', 'cave', 'work', 'tundra'), 'cave');
});

test('every scene has looks, and every look names a painted backdrop that exists', () => {
  for (const sc of SCENES) {
    const looks = SCENE_LOOKS[sc];
    assert.ok(looks.length >= 1, `${sc} has looks`);
    for (const l of looks) if (l !== 'painted') assert.ok((l.replace(/^sky:/, '') as string) in BACKDROPS, `${sc}: ${l} exists`);
  }
  // the new lands' green scenes become their own
  assert.equal(sceneFor('berry_thicket', 'thicket', 'work', 'swamp'), 'fen');
  assert.equal(sceneFor('deep_woods', 'woods', 'out', 'jungle'), 'jungle');
  assert.equal(sceneFor('riverbank', 'river', 'out', 'ashlands'), 'ashland');
  assert.equal(sceneFor('berry_thicket', 'thicket', 'out', 'steppe'), 'steppe');
  assert.equal(sceneFor('bear_cave', 'cave', 'out', 'ashlands'), 'crater');
  assert.equal(sceneFor('deep_woods', 'woods', 'out', 'taiga'), 'pinewoods');
});
