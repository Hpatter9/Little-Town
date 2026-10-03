import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, doorCell, footprint } from '../src/shared/sim/buildings';
import { castleBounds, castleCells, castleGate, coreRect, joinsCastle, roomKind, rooms, sharedEdges } from '../src/shared/sim/castle';
import { idx, inMap, isRoad } from '../src/shared/sim/land';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { pathTo } from '../src/shared/sim/walk';
import { clearAround, put } from './helpers';

/** The castle's cells without one room's own. */
function cellsWithout(s: ReturnType<typeof newGame>, id: number): Set<number> {
  const others = { ...s, buildings: s.buildings.filter((b) => b.id !== id) };
  return castleCells(others);
}

test('a Blood Court builds one castle: rooms built on to the hall and each other, everything else kept clear of it', () => {
  const sim = new Sim(newGame('castle-grows', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const built = rooms(s);
  assert.ok(built.length >= 6, `rooms: ${built.length}`);
  for (const b of built) assert.ok(joinsCastle(cellsWithout(s, b.id), s.land, footprint(b)), `${b.def} is built on to the castle`);
  // the castle has grown beyond the hall
  const core = coreRect(s);
  const bounds = castleBounds(s);
  assert.ok(bounds.w * bounds.h > core.w * core.h, 'grown');
  // fields, pens, mines, walls, the shop and tavern never stand on it (the fire and the first stores at the camp aside)
  const cells = castleCells(s);
  for (const b of s.buildings.filter((q) => !q.room && q.def !== 'campfire' && q.def !== 'stockpile')) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.ok(!cells.has(idx(s.land, x, y)), `${b.def} off the castle`);
  }
  // no road runs through the castle (the first roads ran to the gate)
  for (const i of cells) {
    const x = i % s.land.w;
    const y = Math.floor(i / s.land.w);
    assert.ok(!isRoad(s.land, x, y) || !inMap(s.land, x, y), `no road at ${x},${y}`);
  }
  const snap = snapshot(s).castle!;
  assert.equal(snap.cells.length, cells.size);
  assert.deepEqual(snap.gate, castleGate(s));
});

test('other towns spread out as before, with no castle', () => {
  const sim = new Sim(newGame('no-castle', { origin: 'settlers' }));
  for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
  assert.ok(!sim.state.buildings.some((b) => b.room));
  assert.equal(snapshot(sim.state).castle, null);
});

test('a room must share a wall with the castle; nothing else may come within a cell of it', () => {
  const s = newGame('attach', { origin: 'vampire' });
  const core = coreRect(s);
  clearAround(s, 12); // (open ground all round the hall)
  const cottage = BUILDING_BY_ID.cottage;
  assert.ok(roomKind(s, cottage));
  assert.ok(!roomKind(s, BUILDING_BY_ID.garden_plot));
  assert.ok(!roomKind(s, BUILDING_BY_ID.trading_post), 'the shop keeps its own building');
  assert.ok(!roomKind(s, BUILDING_BY_ID.fireside_inn), 'so does the tavern');
  // against the hall's west wall: on; a cell away from it: not
  const west = { x: core.x - cottage.width, y: core.y };
  assert.equal(canPlace(s, cottage, west.x, west.y).ok, true, 'against the hall');
  assert.equal(canPlace(s, cottage, west.x - 1, west.y).ok, false, 'a cell short of it');
  assert.equal(canPlace(s, cottage, core.x, core.y).ok, false, 'over the hall');
  assert.equal(canPlace(s, BUILDING_BY_ID.garden_plot, west.x, west.y).ok, false, 'a field against it');
  assert.equal(canPlace(s, BUILDING_BY_ID.garden_plot, west.x - 1, west.y).ok, false, 'a field a cell from it');
  const clear = canPlace(s, BUILDING_BY_ID.garden_plot, west.x - 3, west.y);
  assert.equal(clear.ok, true, `a field two cells clear: ${clear.reason}`);
  const first = put(s, 'cottage', west.x, west.y, { room: true });
  assert.equal(canPlace(s, cottage, west.x, west.y).ok, false, 'rooms never overlap');
  // the castle grows outward: a room on to the new room, further from the hall
  const next = { x: west.x - cottage.width, y: west.y };
  assert.equal(canPlace(s, cottage, next.x, next.y).ok, true, 'on to the new room');
  const before = castleBounds(s);
  put(s, 'cottage', next.x, next.y, { room: true });
  assert.ok(castleBounds(s).w > before.w, 'wider');
  // its door is its own middle, inside
  const d = doorCell(first);
  assert.deepEqual(d, { x: west.x + Math.floor(cottage.width / 2), y: west.y + Math.floor(footprint(first).h / 2) });
  // snugness: a spot sharing more walls scores higher
  const cells = castleCells(s);
  assert.ok(sharedEdges(cells, s.land, { x: west.x, y: west.y + footprint(first).h, w: cottage.width, h: 2 }) > 0);
  assert.equal(sharedEdges(cells, s.land, { x: west.x, y: west.y, w: 1, h: 1 }), -1, 'overlapping');
});

test('people walk through the rooms, round other buildings', () => {
  const s = newGame('through', { origin: 'vampire' });
  const core = coreRect(s);
  // a long room right across the hall's south side, and the goal beyond it
  const room = put(s, 'longhouse', core.x, core.y + core.h, { room: true });
  const f = footprint(room);
  const from = { x: (core.x + 2.5) * 32, y: (core.y + 1.5) * 32 };
  const to = { x: (core.x + 2.5) * 32, y: (f.y + f.h + 1.5) * 32 };
  const path = pathTo(s, from, to);
  assert.ok(path, 'a way');
  const throughRoom = path!.some((p) => p.y >= f.y * 32 && p.y < (f.y + f.h) * 32 && p.x >= f.x * 32 && p.x < (f.x + f.w) * 32);
  assert.ok(throughRoom, 'straight through the room');
});
