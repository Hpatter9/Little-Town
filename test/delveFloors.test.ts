import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DELVE_FLOORS } from '../src/shared/data/delveFloors';
import { DUNGEON_BY_ID, DUNGEONS, type RoomKind } from '../src/shared/data/dungeons';
import { Rng } from '../src/shared/rng';
import {
  DUNGEON_TYPES,
  FLOOR_GROUNDS,
  FLOOR_LOOKS,
  FLOOR_LOW,
  FLOOR_PROPS,
  FLOOR_ROCK,
  FLOOR_SPEC,
  floorKinds,
  floorPath,
  floorPreview,
  floorRooms,
  floorsFor,
  floorWalks,
  generatedFloor,
  HAND_FLOOR_SHARE,
  pickFloor,
  type FloorProp,
} from '../src/shared/sim/delveFloors';
import { fieldList, fieldStr, type HandMap } from '../src/shared/sim/handMaps';
import { sendDelve } from '../src/shared/sim/expeditions';
import { addStock, makePerson, maxHp, type Expedition, type GameState, type Person } from '../src/shared/sim/state';
import { groundTiles, propTiles, tileIndex } from '../src/renderer/delve/floorArt';
import { mapsFromLdtk, mapsSource } from '../tools/ldtkMaps';
import { campPx, plainGame } from './helpers';

const project = JSON.parse(readFileSync(FLOOR_SPEC.project, 'utf8'));

test('the committed floor data is what the converter makes of the committed LDtk project (they never drift apart)', () => {
  assert.equal(mapsSource(FLOOR_SPEC, mapsFromLdtk(project, FLOOR_SPEC)), readFileSync(FLOOR_SPEC.out, 'utf8'), 'run `node tools/ldtk-maps.mjs` after editing the floors');
});

test('the converter reads the values by their identifiers (reordered in the editor, the data is the same)', () => {
  const p = JSON.parse(JSON.stringify(project));
  const layer = p.defs.layers.find((l: { identifier: string }) => l.identifier === 'Ground');
  const n = layer.intGridValues.length;
  // (turn the values round: value i becomes n + 1 - i, in the definitions and in every level)
  for (const x of layer.intGridValues) x.value = n + 1 - x.value;
  for (const lv of p.levels) for (const l of lv.layerInstances) if (l.__identifier === 'Ground') l.intGridCsv = l.intGridCsv.map((c: number) => (c ? n + 1 - c : 0));
  assert.deepEqual(mapsFromLdtk(p, FLOOR_SPEC), mapsFromLdtk(project, FLOOR_SPEC));
});

test('the LDtk project is LDtk 1.5 JSON: its layers, its tileset found by a relative path, every entity on its level', () => {
  assert.equal(project.__header__.fileType, 'LDtk Project JSON');
  assert.match(project.jsonVersion, /^1\.5\./);
  for (const ts of project.defs.tilesets) {
    assert.ok(!ts.relPath.startsWith('/') && !/^[a-z]:/i.test(ts.relPath), 'a relative path');
    assert.ok(existsSync(`maps/${ts.relPath}`), ts.relPath);
  }
  const uids = new Set<number>();
  const all = [...project.defs.layers, ...project.defs.entities, ...project.defs.tilesets, ...project.defs.enums, ...project.defs.levelFields, ...project.defs.entities.flatMap((e: { fieldDefs: unknown[] }) => e.fieldDefs), ...project.levels];
  for (const d of all) {
    assert.ok(!uids.has(d.uid), `uid ${d.uid} once`);
    assert.ok(d.uid < project.nextUid, 'nextUid past every uid');
    uids.add(d.uid);
  }
  for (const lv of project.levels) {
    assert.deepEqual(
      lv.layerInstances.map((l: { __identifier: string }) => l.__identifier),
      project.defs.layers.map((l: { identifier: string }) => l.identifier),
    );
    for (const l of lv.layerInstances) {
      assert.equal(l.__cWid * l.__gridSize, lv.pxWid);
      assert.equal(l.__cHei * l.__gridSize, lv.pxHei);
      if (l.__type === 'IntGrid') assert.equal(l.intGridCsv.length, l.__cWid * l.__cHei);
      for (const e of l.entityInstances) {
        assert.deepEqual(e.px, [e.__grid[0] * l.__gridSize, e.__grid[1] * l.__gridSize]);
        assert.ok(e.__grid[0] >= 0 && e.__grid[1] >= 0 && e.__grid[0] < l.__cWid && e.__grid[1] < l.__cHei, `${lv.identifier} ${e.__identifier} on the level`);
      }
    }
  }
  // (the editor's enums are the game's lists)
  const values = (id: string) => project.defs.enums.find((e: { identifier: string }) => e.identifier === id).values.map((v: { id: string }) => v.id);
  assert.deepEqual(values('FloorProp'), [...FLOOR_PROPS]);
  assert.deepEqual(values('Look'), [...FLOOR_LOOKS]);
  assert.deepEqual(values('DungeonType'), [...DUNGEON_TYPES]);
});

/** A floor's rooms are a delve's: the way in, a fight first, rooms, a camp, then the boss; numbered in order. */
function checkRooms(m: HandMap): void {
  const rooms = floorRooms(m);
  assert.deepEqual(rooms.map((r) => r.step), rooms.map((_, i) => i), `${m.id}: steps 0, 1, 2... once each`);
  assert.equal(rooms[0].kind, 'entry', `${m.id}: step 0 is the way in`);
  const kinds = floorKinds(m);
  assert.ok(!kinds.includes('entry' as RoomKind), `${m.id}: one way in`);
  assert.equal(kinds[0], 'fight', `${m.id}: a fight first`);
  assert.equal(kinds.at(-2), 'camp', `${m.id}: a camp before the boss`);
  assert.equal(kinds.at(-1), 'boss', `${m.id}: the boss last`);
  assert.equal(kinds.filter((k) => k === 'boss').length, 1, `${m.id}: one boss`);
  // every room stands on open ground, and the party can walk from each to the next, round what stands in the way
  for (const r of rooms) assert.ok(floorWalks(m, r.u, r.v), `${m.id}: room ${r.step} on open ground`);
  for (let i = 1; i < rooms.length; i++) assert.ok(floorPath(m, rooms[i - 1], rooms[i]), `${m.id}: a way from room ${i - 1} to room ${i}`);
}

test('every floor is a whole delve: its rooms in order, each reached from the one before', () => {
  assert.ok(DELVE_FLOORS.length >= 8, 'about eight floors');
  for (const m of DELVE_FLOORS) {
    assert.ok(fieldStr(m, 'name'), `${m.id} named`);
    assert.ok((FLOOR_LOOKS as readonly string[]).includes(fieldStr(m, 'look')), `${m.id}: a look`);
    assert.ok(fieldList(m, 'types').length, `${m.id}: a dungeon kind`);
    assert.equal(m.grids.Ground.length, m.h);
    for (const row of m.grids.Ground) {
      assert.equal(row.length, m.w);
      for (const ch of row) assert.ok(ch === FLOOR_ROCK || FLOOR_GROUNDS.some((g) => g.ch === ch), `${m.id}: ground ${ch}`);
    }
    // (open ground never runs off the map's edge: the walls are drawn round it)
    for (let u = 0; u < m.w; u++) for (const v of [0, m.h - 1]) assert.ok(!floorWalks(m, u, v, new Set()) || m.grids.Ground[v][u] === '<', `${m.id}: ${u},${v} at the edge`);
    checkRooms(m);
    // a prop is on the floor's open ground, one a cell, and never on a room's middle unless it's walked over
    const seen = new Set<string>();
    for (const t of m.things) {
      if (t[2] !== 'Prop') continue;
      const ch = m.grids.Ground[t[1]][t[0]];
      assert.ok(ch !== FLOOR_ROCK && ch !== '#', `${m.id}: ${t[3]} at ${t[0]},${t[1]} on open ground`);
      assert.ok(!seen.has(`${t[0]},${t[1]}`), `${m.id}: one prop at ${t[0]},${t[1]}`);
      seen.add(`${t[0]},${t[1]}`);
      const room = m.things.some((r) => r[2] === 'Room' && r[0] === t[0] && r[1] === t[1]);
      assert.ok(!room || FLOOR_LOW.has(t[3] as FloorProp), `${m.id}: ${t[3]} on a room's middle`);
    }
    // it fits some dungeon: one of its kinds, about as many rooms
    assert.ok(DUNGEONS.some((d) => floorsFor(d, d.rooms + 1).includes(m)), `${m.id} fits a dungeon`);
  }
  // (the secret doors, the traps and the chasms are there: at least a couple of floors have each)
  const has = (ch: string) => DELVE_FLOORS.filter((m) => m.grids.Ground.some((r) => r.includes(ch))).length;
  assert.ok(has('S') >= 1 && has('P') >= 1 && has('L') >= 1 && has('W') >= 2, 'secret doors, chasms, lava, deep water');
});

test('every tile a floor is drawn with is in the sheet', () => {
  for (const m of DELVE_FLOORS) {
    const found = new Set<number>();
    for (let v = 0; v < m.h; v++) for (let u = 0; u < m.w; u++) if (m.grids.Ground[v][u] === 'S') found.add(v * m.w + u);
    for (const l of [...groundTiles(m), ...groundTiles(m, found), ...propTiles(m)]) assert.ok(tileIndex(l.name) >= 0, `${m.id}: ${l.name}`);
    // (a secret door is wall until it's found)
    if (found.size) {
      const [c] = found;
      const at = (ls: ReturnType<typeof groundTiles>) => ls.filter((l) => l.v * m.w + l.u === c).map((l) => l.name);
      assert.ok(at(groundTiles(m)).every((n) => n.startsWith('wall:')), `${m.id}: the secret door hidden`);
      assert.ok(at(groundTiles(m, found)).some((n) => !n.startsWith('wall:')), `${m.id}: the secret door found`);
    }
  }
  for (const p of FLOOR_PROPS) if (p !== 'pillar') assert.ok(tileIndex(p) >= 0, `${p} drawn`);
});

test('a floor laid out from rolled rooms has every room, each reached from the one before, the same each time', () => {
  const rng = new Rng(7);
  const kinds: RoomKind[] = ['trap', 'treasure', 'shrine', 'puzzle', 'fork', 'rival', 'fight'];
  for (let n = 0; n < 60; n++) {
    const count = rng.int(6, 14);
    const plan: RoomKind[] = ['fight', ...Array.from({ length: count - 2 }, () => kinds[rng.int(0, kinds.length - 1)]), 'camp', 'boss'];
    const look = FLOOR_LOOKS[n % FLOOR_LOOKS.length];
    const m = generatedFloor(plan, 1000 + n, look);
    assert.deepEqual(generatedFloor(plan, 1000 + n, look), m, 'the same each time');
    assert.equal(floorRooms(m).length, plan.length + 1);
    checkRooms(m);
    for (const l of [...groundTiles(m), ...propTiles(m)]) assert.ok(tileIndex(l.name) >= 0, l.name);
  }
});

/* ------------------------------------------------------------ picking */

function hero(s: GameState): Person {
  const p = makePerson(new Rng(s.nextId * 31), s.nextId++, 'gatherer', campPx(s), s.people.map((q) => q.name));
  p.skills.melee.level = 25;
  p.hp = maxHp(p);
  s.people.push(p);
  return p;
}
function delveTown(seed: string, autopilot = true): { s: GameState; party: Person[] } {
  const s = plainGame(seed);
  s.autopilot = autopilot;
  s.cheats.unlockAll = true;
  s.regions = DUNGEONS.map((d) => d.region);
  const party = [hero(s), hero(s), hero(s), hero(s)];
  addStock(s.buildings.find((b) => b.def === 'campfire')!.store, 'wood', 40);
  addStock(s.buildings.find((b) => b.def === 'campfire')!.store, 'dried_meat', 60);
  return { s, party };
}
const fakeTrip = (id: number, dest: string) => ({ id, dest }) as Expedition;

test('a delve goes down a hand-made floor that fits its dungeon most of the time, picked from a side stream', () => {
  const d = DUNGEON_BY_ID.barrow_crypt;
  const { s } = delveTown('floors');
  const before = s.rngState;
  let hand = 0;
  for (let id = 1; id <= 400; id++) {
    const m = pickFloor(s, fakeTrip(id, d.id), d, d.rooms + 1);
    assert.equal(pickFloor(s, fakeTrip(id, d.id), d, d.rooms + 1), m, 'the same trip, the same floor');
    if (!m) continue;
    hand++;
    assert.ok(fieldList(m, 'types').includes(d.type), `${m.id} drawn for a crypt`);
  }
  assert.equal(s.rngState, before, "the town's own stream is never drawn on");
  assert.ok(Math.abs(hand / 400 - HAND_FLOOR_SHARE) < 0.08, `about ${HAND_FLOOR_SHARE} of them (${hand / 400})`);
  // (a dungeon no floor is drawn for, or a town with the autopilot off, rolls its rooms)
  const vault = DUNGEON_BY_ID.machine_vault;
  assert.equal(floorsFor(vault, vault.rooms + 1).length, 0);
  for (let id = 1; id <= 20; id++) assert.equal(pickFloor(s, fakeTrip(id, vault.id), vault, vault.rooms + 1), null);
  s.autopilot = false;
  for (let id = 1; id <= 20; id++) assert.equal(pickFloor(s, fakeTrip(id, d.id), d, d.rooms + 1), null);
});

test("a delve sent down a hand-made floor takes the floor's rooms; one rolled, or begun before floors, still has its map", () => {
  floorPreview.id = 'The_Bone_Stair';
  try {
    const { s, party } = delveTown('bone stair');
    const r = sendDelve(s, 'barrow_crypt', party.map((p) => p.id), 'safe');
    assert.ok(r.ok);
    const v = s.expeditions[0].delve!;
    assert.equal(v.floor, 'The_Bone_Stair');
    const kinds = floorKinds(DELVE_FLOORS.find((m) => m.id === 'The_Bone_Stair')!);
    assert.equal(v.rooms.length, kinds.length);
    v.rooms.forEach((k, i) => assert.ok(k === kinds[i] || k === 'rival', `room ${i}: ${k}`));
    assert.match(v.log.join(' '), /The Bone Stair/);
  } finally {
    delete floorPreview.id;
  }
  // (an old save's delve: no floor named, its rooms laid out for the map)
  const { s, party } = delveTown('rolled', false);
  assert.ok(sendDelve(s, 'barrow_crypt', party.map((p) => p.id), 'safe').ok);
  const v = s.expeditions[0].delve!;
  assert.equal(v.floor, undefined);
  delete v.floor;
  const m = generatedFloor(v.rooms, 5, 'crypt');
  assert.equal(floorRooms(m).length, v.rooms.length + 1);
});
