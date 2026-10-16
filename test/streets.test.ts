import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectRoad, layStreet } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { TICK_HZ } from '../src/shared/sim/time';
import { groundAt, idx, isPlannedRoad, isRoad, planRoad, setGround, setRoad } from '../src/shared/sim/land';
import { BRIDGE_WOOD, gatePaths, isBridge, pave, paveOrder, PAVE_SECONDS, paveTask, planStreets, plannedCells, STREET_WEAR, streetShare, streetWork } from '../src/shared/sim/streets';
import { campCell } from '../src/shared/sim/state';
import { camp, clearAround, plainGame, priorities, put } from './helpers';

test('a worn footpath that joins a street is planned as a street', () => {
  const s = plainGame('streets-wear');
  clearAround(s, 20);
  const c = campCell(s);
  for (let x = c.x - 3; x <= c.x + 3; x++) setRoad(s.land, x, c.y + 1);
  s.land.wear = '0'.repeat(s.land.w * s.land.h);
  const worn = (x: number, y: number) => {
    const i = idx(s.land, x, y);
    s.land.wear = s.land.wear!.slice(0, i) + String.fromCharCode(48 + STREET_WEAR + 2) + s.land.wear!.slice(i + 1);
  };
  worn(c.x + 2, c.y + 2); // joins the street
  worn(c.x + 9, c.y + 9); // joins nothing
  assert.equal(planStreets(s), 1);
  assert.ok(isPlannedRoad(s.land, c.x + 2, c.y + 2));
  assert.ok(!isPlannedRoad(s.land, c.x + 9, c.y + 9));
});

test('a street over a river is a bridge, laid with wood', () => {
  const s = plainGame('streets-bridge');
  clearAround(s, 20);
  const c = campCell(s);
  // a river two cells wide across the way
  for (let y = c.y - 10; y <= c.y + 10; y++) for (const x of [c.x + 5, c.x + 6]) setGround(s.land, x, y, 'water');
  assert.ok(layStreet(s, { x: c.x + 9, y: c.y + 1 }, { x: c.x, y: c.y + 1 }));
  const bridges = plannedCells(s).filter((i) => isBridge(s, i));
  assert.ok(bridges.length >= 2, 'over the water');
  s.buildings[0].store = { wood: BRIDGE_WOOD * 2 };
  const i = bridges[0];
  assert.ok(pave(s, i));
  assert.ok(isRoad(s.land, i % s.land.w, Math.floor(i / s.land.w)));
  assert.equal(groundAt(s.land, i % s.land.w, Math.floor(i / s.land.w)), 'water', 'the river runs on under it');
  s.buildings[0].store = {};
  assert.equal(pave(s, bridges[1]), false, 'no wood, no bridge');
});

test("every gate of the ring wall gets a street to it, through it and out", () => {
  const s = plainGame('streets-gate');
  clearAround(s, 30);
  const c = camp(s);
  setRoad(s.land, c.x, c.y + 1);
  const g = put(s, 'palisade_gate', c.x - 12, c.y, { ring: 1 });
  s.ring = { gen: 1, rect: { x: c.x - 12, y: c.y - 12, w: 25, h: 25 }, wall: 'palisade_wall', gate: 'palisade_gate', gates: [{ x: g.tile, y: g.row }] };
  gatePaths(s);
  assert.ok(isPlannedRoad(s.land, g.tile, g.row), 'under the gate');
  assert.ok(isPlannedRoad(s.land, g.tile + 1, g.row), 'inside it');
  assert.ok(isPlannedRoad(s.land, g.tile - 1, g.row), 'and out beyond it');
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

test('streets are planned from the first buildings, before any footpath is worn', () => {
  const s = plainGame('streets-early');
  clearAround(s, 20);
  const c = campCell(s);
  assert.equal(plannedCells(s).length, 0);
  const b = put(s, 'workbench', c.x + 6, c.y + 2);
  connectRoad(s, b);
  assert.ok(plannedCells(s).length > 0, 'a street is planned to the first building put up');
  const n = plannedCells(s).length;
  const b2 = put(s, 'workbench', c.x - 8, c.y + 4);
  connectRoad(s, b2);
  assert.ok(plannedCells(s).length > n, 'and to the next');
});
