import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { INTERIOR_ROOMS } from '../src/shared/data/interiorRooms';
import { SEAT_DEFS } from '../src/shared/data/seats';
import { fieldList, fieldStr } from '../src/shared/sim/handMaps';
import { hasInside } from '../src/shared/sim/interiors';
import { kindOf } from '../src/renderer/map/roomKinds';
import { FURNITURE, handRoomFor, ROOM_KINDS, ROOM_SPEC, roomsFor, spotsOf, SPOT_KINDS } from '../src/renderer/interior/handRooms';
import { mapsFromLdtk, mapsSource } from '../tools/ldtkMaps';

const project = JSON.parse(readFileSync(ROOM_SPEC.project, 'utf8'));

test('the committed rooms are what the converter makes of the committed LDtk project (they never drift apart)', () => {
  assert.equal(mapsSource(ROOM_SPEC, mapsFromLdtk(project, ROOM_SPEC)), readFileSync(ROOM_SPEC.out, 'utf8'), 'run `node tools/ldtk-maps.mjs` after editing the rooms');
});

test('the rooms project is LDtk 1.5 JSON: its tileset by a relative path, unique uids, the game’s own lists', () => {
  assert.equal(project.__header__.fileType, 'LDtk Project JSON');
  assert.match(project.jsonVersion, /^1\.5\./);
  for (const ts of project.defs.tilesets) assert.ok(!ts.relPath.startsWith('/') && existsSync(`maps/${ts.relPath}`), ts.relPath);
  const uids = new Set<number>();
  const all = [...project.defs.layers, ...project.defs.entities, ...project.defs.tilesets, ...project.defs.enums, ...project.defs.levelFields, ...project.defs.entities.flatMap((e: { fieldDefs: unknown[] }) => e.fieldDefs), ...project.levels];
  for (const d of all) {
    assert.ok(!uids.has(d.uid) && d.uid < project.nextUid, `uid ${d.uid}`);
    uids.add(d.uid);
  }
  const values = (id: string) => project.defs.enums.find((e: { identifier: string }) => e.identifier === id).values.map((v: { id: string }) => v.id);
  assert.deepEqual(values('Furniture'), [...FURNITURE]);
  assert.deepEqual(values('SpotKind'), [...SPOT_KINDS]);
  assert.deepEqual(values('RoomKind'), [...ROOM_KINDS]);
});

test('every room: furnished one piece a cell, somewhere for its folk, a home a bed spot on each bed', () => {
  assert.deepEqual(INTERIOR_ROOMS.map((m) => m.id), ['Tavern', 'Town_Hall', 'Shop', 'Smithy', 'Chapel', 'Cottage', 'Longhouse']);
  for (const m of INTERIOR_ROOMS) {
    assert.ok(fieldStr(m, 'name'), m.id);
    assert.ok(m.w >= 7 && m.w <= 12 && m.h >= 5 && m.h <= 8, `${m.id}: a room the screen holds (${m.w}x${m.h})`);
    const at = new Set<string>();
    for (const t of m.things) {
      assert.ok(t[0] >= 0 && t[1] >= 0 && t[0] < m.w && t[1] < m.h, `${m.id}: ${t[2]} on the floor`);
      if (t[2] !== 'Furniture') continue;
      assert.ok(!at.has(`${t[0]},${t[1]}`), `${m.id}: one piece at ${t[0]},${t[1]}`);
      at.add(`${t[0]},${t[1]}`);
    }
    // (a long table runs three cells: it stays on the floor)
    for (const t of m.things) if (t[3] === 'long_table') assert.ok(t[0] + 3 <= m.w, `${m.id}: the long table`);
    assert.ok(spotsOf(m, 'station').length + spotsOf(m, 'seat').length + spotsOf(m, 'bed').length > 0, `${m.id}: somewhere to be`);
    assert.ok(m.things.filter((t) => t[2] === 'Fire').length <= 1, `${m.id}: one fire at most`);
    if (fieldList(m, 'kinds').includes('home')) {
      const beds = m.things.filter((t) => t[2] === 'Furniture' && t[3] === 'bed').map((t) => `${t[0]},${t[1]}`).sort();
      assert.deepEqual(spotsOf(m, 'bed').map(([u, v]) => `${u},${v}`).sort(), beds, `${m.id}: a sleeper on each bed`);
    }
    // (every room is for some building that has an inside to look into)
    const defs = fieldList(m, 'defs');
    for (const d of defs) assert.ok(BUILDING_BY_ID[d], `${m.id}: ${d} is a building`);
    assert.ok(defs.some((d) => hasInside(BUILDING_BY_ID[d])) || fieldList(m, 'kinds').length, `${m.id}: looked into`);
  }
});

test('a building looked into is furnished as the room drawn for it, the same each time; else as it always was', () => {
  const room = (def: string, beds = 0, id = 7) => handRoomFor(def, kindOf(BUILDING_BY_ID[def]), beds, id)?.id ?? null;
  assert.equal(room('brewery'), 'Tavern');
  assert.equal(room('market'), 'Shop');
  assert.equal(room('town_hall'), 'Town_Hall');
  assert.equal(room('smithy'), 'Smithy');
  assert.equal(handRoomFor('temple', 'temple', 0, 3)?.id, 'Chapel');
  // (each is a building the town can look into)
  for (const d of ['brewery', 'market', 'town_hall', 'smithy', 'temple', 'cathedral', 'cottage', 'longhouse']) assert.ok(hasInside(BUILDING_BY_ID[d]), d);
  // the seat, every people's and every age's
  for (const d of SEAT_DEFS) assert.equal(room(d.id), 'Town_Hall', d.id);
  // a home: the smallest room with a bed for everyone, the longhouse for a big household, none for a block of flats
  assert.equal(room('cottage', 3), 'Cottage');
  assert.equal(room('longhouse', 6), 'Longhouse');
  assert.equal(room('apartments', 16), null);
  // (a study has none drawn yet: as it always was)
  assert.equal(room('library'), null);
  // the pick among several is the building's own: the same each time
  for (let id = 1; id < 30; id++) assert.equal(handRoomFor('cottage', 'home', 2, id)?.id, handRoomFor('cottage', 'home', 2, id)?.id);
  assert.ok(roomsFor('cottage', 'home', 2).length >= 2, 'a cottage may be either home');
});
