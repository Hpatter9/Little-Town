import assert from 'node:assert/strict';
import { test } from 'node:test';
import { doorCell, hasPath, placeBlueprint } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { groundAt, idx, isPlannedRoad, isRoad, planRoad, setGround, setRoad } from '../src/shared/sim/land';
import { drawPath } from '../src/shared/sim/pathPlans';
import { BRIDGE_WOOD, isBridge, pave, paveOrder, PAVE_SECONDS, paveTask, plannedCells, streetsHourly, streetShare, streetWork } from '../src/shared/sim/streets';
import { campCell, newGame } from '../src/shared/sim/state';
import { camp, clearAround, plainGame, priorities, put } from './helpers';

/** How many cells of street are down, and planned. */
const roadCount = (s: { land: { roads: string; plannedRoads?: string } }) => ({ roads: s.land.roads.split('#').length - 1, planned: (s.land.plannedRoads ?? '').split('#').length - 1 });

test('a worn footpath stays a footpath: the town plans no street from it', () => {
  const s = plainGame('streets-wear');
  s.autopilot = true;
  clearAround(s, 20);
  const c = campCell(s);
  for (let x = c.x - 3; x <= c.x + 3; x++) setRoad(s.land, x, c.y + 1);
  s.land.wear = '0'.repeat(s.land.w * s.land.h);
  const i = idx(s.land, c.x + 2, c.y + 2);
  s.land.wear = s.land.wear.slice(0, i) + String.fromCharCode(48 + 24) + s.land.wear.slice(i + 1);
  for (let h = 0; h < 48; h++) {
    s.tick = h * TICKS_PER_HOUR;
    streetsHourly(s);
  }
  assert.equal(plannedCells(s).length, 0, 'nothing planned');
  assert.ok(!isRoad(s.land, c.x + 2, c.y + 2));
});

test('a path drawn over a river is a bridge, laid with wood', () => {
  const s = plainGame('streets-bridge');
  clearAround(s, 20);
  const c = campCell(s);
  // a river two cells wide across the way
  for (let y = c.y - 10; y <= c.y + 10; y++) for (const x of [c.x + 5, c.x + 6]) setGround(s.land, x, y, 'water');
  assert.ok(drawPath(s, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => idx(s.land, c.x + k, c.y + 3)), true) >= 9);
  const bridges = plannedCells(s).filter((i) => isBridge(s, i));
  assert.equal(bridges.length, 2, 'over the water');
  s.buildings[0].store = { wood: BRIDGE_WOOD * 2 };
  const i = bridges[0];
  assert.ok(pave(s, i));
  assert.ok(isRoad(s.land, i % s.land.w, Math.floor(i / s.land.w)));
  assert.equal(groundAt(s.land, i % s.land.w, Math.floor(i / s.land.w)), 'water', 'the river runs on under it');
  s.buildings[0].store = {};
  assert.equal(pave(s, bridges[1]), false, 'no wood, no bridge');
});

test('a gate of the ring wall gets no path of its own; a path drawn through it crosses at the gate', () => {
  const s = plainGame('streets-gate');
  s.autopilot = true;
  clearAround(s, 30);
  const c = camp(s);
  setRoad(s.land, c.x, c.y + 1);
  const g = put(s, 'palisade_gate', c.x - 12, c.y, { ring: 1 });
  s.ring = { gen: 1, rect: { x: c.x - 12, y: c.y - 12, w: 25, h: 25 }, wall: 'palisade_wall', gate: 'palisade_gate', gates: [{ x: g.tile, y: g.row }] };
  for (let h = 0; h < 24; h++) {
    s.tick = h * TICKS_PER_HOUR;
    streetsHourly(s);
  }
  assert.equal(plannedCells(s).length, 0, 'no path to the gate by itself');
  drawPath(s, [1, 0, -1].map((k) => idx(s.land, g.tile + k, g.row)), true);
  assert.ok(isPlannedRoad(s.land, g.tile, g.row), 'under the gate');
  assert.ok(isPlannedRoad(s.land, g.tile + 1, g.row) && isPlannedRoad(s.land, g.tile - 1, g.row), 'inside it and out');
});

test('a planned street is paved as one job: every hand adds to one pool and the cells go down in order from the road', () => {
  const s = plainGame('streets-one-job');
  clearAround(s, 20);
  const c = campCell(s);
  setRoad(s.land, c.x, c.y + 3);
  for (let k = 1; k <= 6; k++) planRoad(s.land, c.x + k, c.y + 3);
  assert.equal(plannedCells(s).length, 6);
  assert.deepEqual(paveOrder(s).map((i) => i % s.land.w - c.x), [1, 2, 3, 4, 5, 6], 'out from the road already down');
  streetWork(s, PAVE_SECONDS * 2.5);
  assert.equal(plannedCells(s).length, 4, 'two cells down at once');
  assert.ok(isRoad(s.land, c.x + 1, c.y + 3) && isRoad(s.land, c.x + 2, c.y + 3) && !isRoad(s.land, c.x + 3, c.y + 3), 'in order');
  assert.ok(Math.abs(streetShare(s) - 0.5) < 1e-9, 'half way to the next');
  streetWork(s, PAVE_SECONDS * 10);
  assert.equal(plannedCells(s).length, 0, 'the whole street laid');
  assert.equal(s.streetSec, undefined, 'and no work left over');
});

test('whoever has nothing to build paves the street, a quarter of the town at most; the founder goes on to the next cell', () => {
  const s = plainGame('streets-hands');
  clearAround(s, 20);
  const c = campCell(s);
  setRoad(s.land, c.x, c.y + 3);
  for (let k = 1; k <= 6; k++) planRoad(s.land, c.x + k, c.y + 3);
  const p = s.people[0];
  p.priorities = priorities({ construct: 1 });
  p.task = null;
  const sim = new Sim(s);
  for (let i = 0; i < 40 * TICK_HZ; i++) sim.step();
  assert.ok(plannedCells(s).length < 6, 'the founder laid some of it with no building to raise');
  for (let i = 0; i < 200 * TICK_HZ; i++) sim.step();
  assert.equal(plannedCells(s).length, 0, 'and all of it in the end');
  // (a quarter of the grown-ups, and at least one)
  const q = plainGame('streets-share');
  for (let k = 1; k <= 4; k++) planRoad(q.land, campCell(q).x + k, campCell(q).y + 3);
  assert.ok(paveTask(q, q.people[0]), 'one hand is spared');
  const other = { ...q.people[0], id: 99, task: { type: 'pave' as const, cell: plannedCells(q)[0], progress: 0 } };
  q.people.push(other);
  q.people.push({ ...other, id: 100, task: null });
  assert.equal(paveTask(q, q.people[2], false), null, 'three grown-ups, one already out: no more than a quarter');
  assert.ok(paveTask(q, q.people[2], true), 'unless they have nothing else to do');
});

test('no street is planned to a building put up: its card says it has no path until one is drawn to its door', () => {
  const s = plainGame('streets-early');
  s.autopilot = true;
  s.cheats.unlockAll = true;
  clearAround(s, 20);
  const c = campCell(s);
  assert.ok(placeBlueprint(s, 'workbench', c.x + 6, c.y + 2).ok);
  const b = s.buildings.at(-1)!;
  assert.equal(plannedCells(s).length, 0, 'no street to it');
  assert.equal(hasPath(s, b), false);
  const d = doorCell(b);
  drawPath(s, [idx(s.land, d.x, d.y + 1)], true);
  assert.equal(hasPath(s, b), true, 'a path drawn to its door');
  // (fields, pens and walls need none)
  assert.equal(hasPath(s, put(s, 'palisade_wall', c.x - 8, c.y - 8)), true);
});

test('a town left to run lays no path by itself', () => {
  for (const townBuilds of [false, true]) {
    const s = newGame(`streets-none-${townBuilds}`);
    if (townBuilds) s.townBuilds = true;
    s.cheats.unlockAll = true;
    s.nextRaidTick = Number.MAX_SAFE_INTEGER;
    s.buildings[0].store = { wood: 400, stone: 200, fiber: 60, berries: 200 };
    const before = roadCount(s);
    const sim = new Sim(s);
    for (let t = 0; t < 2 * TICKS_PER_DAY; t++) sim.step();
    assert.ok(s.buildings.length > 1 || !townBuilds, 'the town got on with building');
    const after = roadCount(s);
    assert.equal(after.planned, 0, `no street planned (townBuilds ${townBuilds})`);
    assert.ok(after.roads <= before.roads, `no street laid (townBuilds ${townBuilds}): ${before.roads} then ${after.roads}`);
  }
});
