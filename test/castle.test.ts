import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace } from '../src/shared/sim/buildings';
import { adoptRooms, CASTLE_FLOORS, CASTLE_TILES, CLIMB_SECONDS, inKeep, stairXs as stairsOf, castleFloors, castleSpan, castleWidth, floorFill, moveOnFloors, openFloors, roomOf, stairXs } from '../src/shared/sim/castle';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { Rng } from '../src/shared/rng';
import { TICK_HZ } from '../src/shared/sim/time';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

test('a Blood Court builds a castle: rooms stacked floor on floor over the camp, the yards outside', () => {
  const sim = new Sim(newGame('castle-grows', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const [lo, hi] = castleSpan(s);
  const rooms = s.buildings.filter((b) => b.room);
  assert.ok(rooms.length >= 8, `rooms: ${rooms.length}`);
  assert.ok(castleFloors(s) >= 2, `floors: ${castleFloors(s)}`);
  assert.ok(castleFloors(s) <= CASTLE_FLOORS);
  for (const b of rooms) {
    const w = BUILDING_BY_ID[b.def].width;
    assert.ok(inKeep(s, b.tile, w, b.floor ?? 0), `${b.def} in the keep, on floor ${b.floor ?? 0}`);
    // every floor up stands on one mostly built
    // (the floor below was mostly built when it went up; rooms set aside or merged since may have thinned it)
    if ((b.floor ?? 0) > 0) assert.ok(floorFill(s, (b.floor ?? 0) - 1) > 0, `${b.def} on ${b.floor}`);
  }
  // fields and walls never go in
  for (const b of s.buildings.filter((q) => !q.room)) assert.ok(BUILDING_BY_ID[b.def].layer !== 'mid' || b.tile + BUILDING_BY_ID[b.def].width <= lo || b.tile >= hi || b.def === 'campfire', `${b.def} outside`);
  assert.ok(snapshot(s).castle?.floors === castleFloors(s));
});

test('other towns spread out as before, with no castle', () => {
  const sim = new Sim(newGame('no-castle', { origin: 'settlers' }));
  for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
  assert.ok(!sim.state.buildings.some((b) => b.room));
  assert.equal(snapshot(sim.state).castle, null);
});

test('rooms overlap only on the same floor; a floor opens once the one below is half built', () => {
  const s = newGame('floors', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  const def = BUILDING_BY_ID.cottage;
  s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 0 });
  assert.equal(canPlace(s, [], def, lo, 0).ok, false);
  assert.equal(canPlace(s, [], def, lo, 1).ok, true);
  assert.deepEqual(openFloors(s), [0]);
  for (let k = 1; k * 3 < CASTLE_TILES / 2 + 3; k++) s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo + k * 3, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 0 });
  assert.deepEqual(openFloors(s), [0, 1]);
});

test("an older vampire town's buildings in the keep become its ground floor", () => {
  const s = newGame('adopt', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  s.buildings.push({ id: s.nextId++, def: 'workbench', tile: lo + 2, status: 'done', delivered: {}, progress: 1, store: {} });
  adoptRooms(s);
  const b = s.buildings.at(-1)!;
  assert.equal(b.room, true);
  assert.equal(b.floor, 0);
});

test('townsfolk are seen in the room they sleep or work in, up on its floor', () => {
  const s = newGame('upstairs', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  s.buildings.push({ id: s.nextId++, def: 'cottage', tile: lo + 4, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 2 });
  const room = s.buildings.at(-1)!;
  const p = s.people[0];
  p.x = (room.tile + 1.5) * 32;
  p.floor = 2;
  p.task = { type: 'sleep', building: room.id };
  p.activity = 'sleep';
  assert.equal(roomOf(s, p), room);
  const view = snapshot(s).people.find((q) => q.id === p.id)!;
  assert.equal(view.floor, 2);
  assert.equal(view.indoors, false, 'seen in the room, not hidden');
});

test('the keep has stairs: to reach a room up the keep, you walk to a stair tower and climb, a floor at a time', () => {
  const s = newGame('stairs', { origin: 'vampire' });
  const [lo] = castleSpan(s);
  const [a] = stairXs(s);
  const m = { x: (lo + 4) * 32, dir: 1 as const as 1 | -1, floor: 0 };
  const target = (lo + 8) * 32;
  let ticks = 0;
  let sawStair = false;
  while (!moveOnFloors(s, m, target, 2, 2) && ticks < 5000) {
    if (m.x === a && (m.floor ?? 0) < 2) sawStair = true;
    ticks++;
  }
  assert.ok(sawStair, 'went up by the stair tower');
  assert.equal(m.floor, 2);
  assert.equal(m.x, target);
  assert.ok(ticks >= 2 * CLIMB_SECONDS * TICK_HZ, `climbing takes time (${ticks} ticks)`);
});

test('raiders who get into the keep climb its stairs to reach the townsfolk upstairs', () => {
  const s = newGame('siege', { origin: 'vampire' });
  s.autopilot = false;
  const [lo] = castleSpan(s);
  s.buildings.push({ id: s.nextId++, def: 'workbench', tile: lo + 6, status: 'done', delivered: {}, progress: 1, store: {}, room: true, floor: 1 });
  s.people = s.people.slice(0, 1);
  const p = s.people[0];
  p.x = (lo + 7) * 32;
  p.floor = 1;
  p.task = { type: 'idle', untilTick: s.tick + 100000 };
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 14, new Rng(3));
  s.raid = raid;
  raid.raiders = raid.raiders.slice(0, 1);
  const rd = raid.raiders[0];
  rd.goal = 'harm';
  rd.x = (lo - 2) * 32;
  raid.arrivesTick = s.tick;
  raid.leavesTick = s.tick + 100000;
  s.prompts = [];
  raid.prompt = null;
  const rng = new Rng(9);
  for (let i = 0; i < 60 * TICK_HZ && (rd.floor ?? 0) < 1; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.equal(rd.floor, 1, 'up to the floor the townsperson is on');
  const hp = p.hp;
  for (let i = 0; i < 60 * TICK_HZ && p.hp === hp && !p.downed; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(p.hp < hp || !!p.downed, 'and along it to strike them');
});

test('the keep grows wider each era, and a Blood Court never builds its rooms outside it', () => {
  assert.ok(castleWidth('medieval') > castleWidth('neolithic'));
  assert.ok(castleWidth('space') > castleWidth('industrial'));
  const sim = new Sim(newGame('no-sprawl', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 12 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const [lo, hi] = castleSpan(s);
  const outside = s.buildings.filter((b) => {
    const d = BUILDING_BY_ID[b.def];
    return d.layer === 'mid' && !b.room && b.def !== 'campfire' && b.tile + d.width > lo && b.tile < hi;
  });
  const sprawl = s.buildings.filter((b) => !b.room && BUILDING_BY_ID[b.def].layer === 'mid' && ['longhouse', 'lean_to', 'hide_tent', 'workbench', 'cottage'].includes(b.def));
  assert.deepEqual(outside.map((b) => b.def), [], 'nothing overlapping the keep that is not a room');
  assert.deepEqual(sprawl.map((b) => b.def), [], 'homes and workshops are all rooms');
});

test('a new keep is narrow at the foot and reaches out a tile a side each floor up, clear of the stair towers; an old one stays as it was', () => {
  const s = newGame('flare', { origin: 'vampire' });
  const [lo0, hi0] = castleSpan(s);
  const [lo2, hi2] = castleSpan(s, 2);
  assert.equal(hi0 - lo0, CASTLE_TILES);
  assert.equal(hi2 - lo2, CASTLE_TILES + 4, 'two floors up, two tiles wider each side');
  // the stair towers stand just past the ground floor's ends: no room upstairs is built over them
  const [a] = stairsOf(s);
  const stairTile = Math.floor(a / 32);
  assert.ok(!inKeep(s, stairTile, 1, 2), 'not over the stairs');
  assert.ok(inKeep(s, lo2, 1, 2), 'but out past them');
  assert.ok(!inKeep(s, lo2, 1, 0), 'and not on the ground floor out there');
  // (a castle from an older save keeps its shape: 16 tiles, straight up)
  const old = newGame('flare-old', { origin: 'vampire' });
  delete old.keep;
  const [o0, o1] = castleSpan(old);
  const [p0, p1] = castleSpan(old, 3);
  assert.equal(o1 - o0, 16);
  assert.deepEqual([p0, p1], [o0, o1]);
});
