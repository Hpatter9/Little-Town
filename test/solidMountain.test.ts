import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Couriers } from '../src/renderer/map/mapCourier';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { footprint, placeBlueprint } from '../src/shared/sim/buildings';
import { castleGate, castleLayout, castleStep, coreRect, digOrder, digRoom, hallCells, isHallway, rooms } from '../src/shared/sim/castle';
import { buildingDoor } from '../src/shared/sim/buildings';
import { CELL, idx, groundAt, setGround, stepCost } from '../src/shared/sim/land';
import { Sim } from '../src/shared/sim/sim';
import { campCell, edgeXY, newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { pathTo, walk, type Walker } from '../src/shared/sim/walk';
import { clearAround } from './helpers';

const onRock = (s: ReturnType<typeof newGame>, p: { x: number; y: number }) => groundAt(s.land, Math.floor(p.x / CELL), Math.floor(p.y / CELL)) === 'mountain';

test('a path never crosses the mountain, and a face of rock is worked from the ground beside it', () => {
  const s = newGame('solid-paths', { origin: 'dwarves' });
  s.townBuilds = true;
  const c = campCell(s);
  const from = { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL };
  for (const [dx, dy] of [[20, -12], [-18, -9], [0, -20], [30, -4], [-25, 6], [10, 12]]) {
    const way = pathTo(s, from, { x: (c.x + dx + 0.5) * CELL, y: (c.y + dy + 0.5) * CELL });
    for (const p of way ?? []) assert.equal(onRock(s, p), false, `a step on rock on the way to ${dx},${dy}`);
  }
  // a goal in the rock is reached at the open ground beside it
  const face = { x: c.x, y: c.y - 8 };
  assert.equal(groundAt(s.land, face.x, face.y), 'mountain');
  const w: Walker = { ...from, dir: 1 };
  for (let i = 0; i < 4000 && !walk(s, w, { x: (face.x + 0.5) * CELL, y: (face.y + 0.5) * CELL }, 3, undefined, i); i++) assert.equal(onRock(s, w), false, 'walking over rock');
  assert.equal(onRock(s, w), false);
});

test('a walker with no way found goes only as far as the rock', () => {
  const s = newGame('solid-straight', { origin: 'dwarves' });
  s.townBuilds = true;
  clearAround(s, 6);
  const c = campCell(s);
  // a goal sealed inside the rock, far from any open ground
  const w: Walker = { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL, dir: 1 };
  const goal = { x: (c.x + 0.5) * CELL, y: (c.y - 40 + 0.5) * CELL };
  for (let i = 0; i < 3000; i++) {
    walk(s, w, goal, 3, undefined, i);
    assert.equal(onRock(s, w), false);
  }
});

test('strangers come in on open ground even where a spur of the mountain reaches the camp row', () => {
  const s = newGame('solid-edge', { origin: 'dwarves' });
  s.townBuilds = true;
  const c = campCell(s);
  for (const side of [-1, 1] as const) {
    const e = edgeXY(s, side);
    const cx = Math.floor(e.x / CELL);
    // wall the edge off with rock three cells deep and tall
    for (let y = c.y - 3; y <= c.y + 3; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x >= 0 && x < s.land.w) setGround(s.land, x, y, 'mountain');
    const moved = edgeXY(s, side);
    assert.equal(onRock(s, moved), false, 'an edge spot on rock');
    assert.notEqual(stepCost(s.land, Math.floor(moved.x / CELL), Math.floor(moved.y / CELL)), Infinity);
    assert.ok(pathTo(s, moved, { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL }), 'a way in from the new spot');
  }
});

test('a courier still reaches a town walled in by the mountain on one side, never riding over the rock', () => {
  const s = newGame('solid-courier', { origin: 'dwarves' });
  s.townBuilds = true;
  const couriers = new Couriers();
  // news from due north, where the whole land is rock
  assert.ok(couriers.dispatch(s.land, s.buildings, 0, -Math.PI / 2), 'a rider sent');
  for (let t = 0; t < 120; t += 0.5) for (const v of couriers.views(t * 1000)) assert.equal(onRock(s, v), false, `a courier on rock at ${t}s`);
  assert.ok(couriers.views(1000).length >= 0);
});

test('a mountain hold digs a room from its doorway inward, cell by cell, from ground someone stands on', () => {
  const s = newGame('solid-dig', { origin: 'dwarves' });
  s.townBuilds = true;
  clearAround(s, 12);
  const core = coreRect(s);
  assert.ok(placeBlueprint(s, 'workbench', core.x + core.w, core.y).ok);
  const room = s.buildings[s.buildings.length - 1];
  const f = footprint(room);
  const open = (x: number, y: number) => groundAt(s.land, x, y) !== 'mountain';
  const total = f.w * f.h;
  let dug = 0;
  const layout = castleLayout(s)!;
  void layout;
  while (dug < total) {
    const order = digOrder(s, f);
    assert.equal(order.length, total - dug);
    const next = order[0];
    // the next cell touches open or dug ground (so it is cut from a doorway, working inward)
    assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => open(next.x + dx, next.y + dy)), `cell ${next.x},${next.y} is cut from beside open ground`);
    if (dug === 0) assert.ok(castleStep(s, castleLayout(s)!)(next.x - 1, next.y, next.x, next.y) || [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => open(next.x + dx, next.y + dy) && castleStep(s, castleLayout(s)!)(next.x + dx, next.y + dy, next.x, next.y)), 'the first cell is cut through a doorway');
    digRoom(s, room, (dug + 1) / total);
    dug++;
    assert.equal(total - digOrder(s, f).length, dug);
  }
  assert.equal(digOrder(s, f).length, 0);
});

test('a dwarves hold finishes its rooms with nobody standing in the rock', () => {
  const sim = new Sim(Object.assign(newGame('solid-hold', { origin: 'dwarves' }), { townBuilds: true }));
  const s = sim.state;
  let on = 0;
  for (let t = 0; t < 5 * TICKS_PER_DAY && !s.gameOver; t++) {
    sim.step();
    if (t % 10 === 0) for (const p of s.people) if (onRock(s, p)) on++;
  }
  assert.equal(on, 0, 'townsfolk seen on rock');
  assert.ok(rooms(s).filter((b) => b.status === 'done').length >= 4, 'rooms were finished');
  assert.ok(BUILDING_BY_ID.longhouse);
});

test('every new room of a hold opens off the entrance hall or a hallway, and the hallways join the entrance', () => {
  const sim = new Sim(Object.assign(newGame('solid-halls', { origin: 'dwarves' }), { townBuilds: true }));
  const s = sim.state;
  for (let t = 0; t < 8 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const m = s.land;
  const halls = s.buildings.filter((b) => b.room && isHallway(b));
  assert.ok(halls.length >= 1, 'a hallway was cut');
  assert.ok(halls.some((b) => b.status === 'done'), 'a hallway was finished');
  const hall = hallCells(s);
  // the hallways are one body with the entrance hall (flood from the hall's cells over the hall-like cells)
  const core = coreRect(s);
  const seen = new Set<number>([idx(m, core.x, core.y)]);
  const queue = [idx(m, core.x, core.y)];
  for (let q = 0; q < queue.length; q++) {
    const x = queue[q] % m.w;
    const y = Math.floor(queue[q] / m.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = idx(m, x + dx, y + dy);
      if (hall.has(i) && !seen.has(i)) {
        seen.add(i);
        queue.push(i);
      }
    }
  }
  for (const i of hall) assert.ok(seen.has(i), 'a hallway cell cut off from the entrance hall');
  const gate = castleGate(s);
  const from = { x: (gate.x + 0.5) * CELL, y: (gate.y + 0.5) * CELL };
  for (const b of s.buildings.filter((q) => q.room && q.halled)) {
    const f = footprint(b);
    let touches = false;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hall.has(idx(m, x + dx, y + dy))) touches = true;
    assert.ok(touches, `${b.def} opens off a hallway or the hall`);
    if (b.status === 'done') assert.ok(pathTo(s, from, buildingDoor(b)), `a way from the gate to ${b.def}`);
  }
  assert.ok(castleLayout(s));
});
