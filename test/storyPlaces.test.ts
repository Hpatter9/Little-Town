import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SAGAS } from '../src/shared/data/sagas';
import { STORY_PLACES } from '../src/shared/data/storyPlaces';
import { FLOOR_GROUNDS, FLOOR_LOOKS, FLOOR_LOW, FLOOR_PROPS, FLOOR_ROCK, floorPath, floorRooms, floorWalks, type FloorProp } from '../src/shared/sim/delveFloors';
import { fieldList, fieldStr } from '../src/shared/sim/handMaps';
import { DRAGON_DEST } from '../src/shared/sim/dragon';
import { openAir, placesFor, PLACE_KINDS, STORY_SPEC, storyPlaceOf } from '../src/shared/sim/storyPlaces';
import { placeDestId } from '../src/shared/data/places';
import { groundTiles, propTiles, tileIndex } from '../src/renderer/delve/floorArt';
import { mapsFromLdtk, mapsSource } from '../tools/ldtkMaps';
import { plainGame } from './helpers';

const project = JSON.parse(readFileSync(STORY_SPEC.project, 'utf8'));

test('the committed story places are what the converter makes of the committed LDtk project (they never drift apart)', () => {
  assert.equal(mapsSource(STORY_SPEC, mapsFromLdtk(project, STORY_SPEC)), readFileSync(STORY_SPEC.out, 'utf8'), 'run `node tools/ldtk-maps.mjs` after editing the places');
});

test('the story places project is LDtk 1.5 JSON: its tileset by a relative path, unique uids, every entity on its level', () => {
  assert.equal(project.__header__.fileType, 'LDtk Project JSON');
  assert.match(project.jsonVersion, /^1\.5\./);
  for (const ts of project.defs.tilesets) assert.ok(!ts.relPath.startsWith('/') && existsSync(`maps/${ts.relPath}`), ts.relPath);
  const uids = new Set<number>();
  const all = [...project.defs.layers, ...project.defs.entities, ...project.defs.tilesets, ...project.defs.enums, ...project.defs.levelFields, ...project.defs.entities.flatMap((e: { fieldDefs: unknown[] }) => e.fieldDefs), ...project.levels];
  for (const d of all) {
    assert.ok(!uids.has(d.uid) && d.uid < project.nextUid, `uid ${d.uid}`);
    uids.add(d.uid);
  }
  for (const lv of project.levels)
    for (const l of lv.layerInstances) {
      if (l.__type === 'IntGrid') assert.equal(l.intGridCsv.length, l.__cWid * l.__cHei);
      for (const e of l.entityInstances) assert.ok(e.__grid[0] < l.__cWid && e.__grid[1] < l.__cHei, `${lv.identifier} ${e.__identifier} on the level`);
    }
  const values = (id: string) => project.defs.enums.find((e: { identifier: string }) => e.identifier === id).values.map((v: { id: string }) => v.id);
  assert.deepEqual(values('FloorProp'), [...FLOOR_PROPS]);
  assert.deepEqual(values('Look'), [...FLOOR_LOOKS]);
  assert.deepEqual(values('PlaceKind'), [...PLACE_KINDS]);
});

test('every story place is walked from its way in to each spot in turn, dressed on open ground, drawn from the sheet', () => {
  const want = ['Dragons_Lair', 'Ruined_Keep', 'Lords_Castle', 'Haunted_Barrow', 'Bandit_Camp', 'Woodland_Shrine'];
  assert.deepEqual(STORY_PLACES.map((m) => m.id), want, 'the six places');
  for (const m of STORY_PLACES) {
    assert.ok(fieldStr(m, 'name'));
    assert.ok(fieldList(m, 'dests').length + fieldList(m, 'words').length + fieldList(m, 'kinds').length > 0, `${m.id}: some trip comes here`);
    for (const row of m.grids.Ground) for (const ch of row) assert.ok(ch === FLOOR_ROCK || FLOOR_GROUNDS.some((g) => g.ch === ch), `${m.id}: ${ch}`);
    const rooms = floorRooms(m);
    assert.ok(rooms.length >= 4, `${m.id}: a way in and a few spots`);
    assert.deepEqual(rooms.map((r) => r.step), rooms.map((_, i) => i), `${m.id}: steps in order`);
    assert.equal(rooms[0].kind, 'entry');
    assert.ok(rooms.some((r) => r.kind === 'boss'), `${m.id}: who waits there`);
    for (const r of rooms) assert.ok(floorWalks(m, r.u, r.v), `${m.id}: spot ${r.step} on open ground`);
    for (let i = 1; i < rooms.length; i++) assert.ok(floorPath(m, rooms[i - 1], rooms[i]), `${m.id}: a way from spot ${i - 1} to ${i}`);
    const at = new Set<string>();
    for (const t of m.things.filter((x) => x[2] === 'Prop')) {
      const ch = m.grids.Ground[t[1]][t[0]];
      assert.ok(ch !== FLOOR_ROCK && ch !== '#', `${m.id}: ${t[3]} at ${t[0]},${t[1]} on open ground`);
      assert.ok(!at.has(`${t[0]},${t[1]}`), `${m.id}: one prop a cell`);
      at.add(`${t[0]},${t[1]}`);
      const spot = m.things.some((r) => r[2] === 'Room' && r[0] === t[0] && r[1] === t[1]);
      assert.ok(!spot || FLOOR_LOW.has(t[3] as FloorProp), `${m.id}: ${t[3]} on a spot`);
    }
    for (const l of [...groundTiles(m), ...propTiles(m)]) assert.ok(tileIndex(l.name) >= 0, `${m.id}: ${l.name}`);
  }
  // (four are out of doors, in daylight; the lair and the barrow are underground)
  assert.deepEqual(STORY_PLACES.filter(openAir).map((m) => m.id), ['Ruined_Keep', 'Lords_Castle', 'Bandit_Camp', 'Woodland_Shrine']);
});

test("trips come to the story places by their destination, their name's words or the kind of place they are", () => {
  const one = (dest: string, name: string) => placesFor(dest, name).map((m) => m.id);
  assert.deepEqual(one(DRAGON_DEST, 'The Dragon’s Lair in the hills'), ['Dragons_Lair']);
  assert.deepEqual(one('saga:3', 'The camp of Black Maud'), ['Bandit_Camp']);
  assert.deepEqual(one('saga:4', "The Hollow King's barrow"), ['Haunted_Barrow']);
  assert.deepEqual(one('saga:5', 'The halls of Khazrun'), ['Ruined_Keep']);
  assert.deepEqual(one('saga:6', "The tournament at Lord Hamel's"), ['Lords_Castle']);
  assert.deepEqual(one('saga:7', "The Huntsman's clearing"), ['Woodland_Shrine']);
  assert.deepEqual(one('saga:8', "The wolf's den"), [], 'a place none is drawn for: the watch screen as before');
  // (a robbed cart's robbers are in their camp; old ruins on the land are a ruined keep)
  const s = plainGame('places');
  s.places = [
    { id: 1, kind: 'cart', x: 1, y: 1, found: 0, state: 'waiting' },
    { id: 2, kind: 'ruin', x: 2, y: 2, found: 0, state: 'waiting' },
    { id: 3, kind: 'cave', x: 3, y: 3, found: 0, state: 'waiting' },
  ];
  assert.equal(storyPlaceOf(s, { id: 9, dest: placeDestId(1) }, "Trader's Cart to the north")?.id, 'Bandit_Camp');
  assert.equal(storyPlaceOf(s, { id: 9, dest: placeDestId(2) }, 'Old Ruins to the east')?.id, 'Ruined_Keep');
  assert.equal(storyPlaceOf(s, { id: 9, dest: placeDestId(3) }, 'Cave to the west'), null);
  // most of the sagas' trips come to one
  const trips = SAGAS.flatMap((g) => Object.values(g.chapters)).filter((c) => c.kind === 'trip') as { place: string }[];
  const drawn = trips.filter((c) => placesFor('saga:1', c.place).length);
  assert.ok(drawn.length >= trips.length / 2, `${drawn.length} of ${trips.length} saga trips`);
});

test('among several places that fit, the pick is the side stream’s: the same for a trip each time, never the town’s', () => {
  const s = plainGame('picks');
  const before = s.rngState;
  const name = "The Ice Witch's tower";
  assert.equal(placesFor('saga:1', name).length, 2, 'a witch (the shrine) and a tower (the keep)');
  const seen = new Set<string>();
  for (let id = 1; id <= 40; id++) {
    const a = storyPlaceOf(s, { id, dest: 'saga:1' }, name)!.id;
    assert.equal(storyPlaceOf(s, { id, dest: 'saga:1' }, name)!.id, a);
    seen.add(a);
  }
  assert.equal(seen.size, 2, 'either, by the trip');
  assert.equal(s.rngState, before);
});
