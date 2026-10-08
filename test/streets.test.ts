import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layStreet } from '../src/shared/sim/buildings';
import { groundAt, idx, isPlannedRoad, isRoad, setGround, setRoad } from '../src/shared/sim/land';
import { BRIDGE_WOOD, gatePaths, isBridge, pave, planStreets, plannedCells, STREET_WEAR } from '../src/shared/sim/streets';
import { campCell } from '../src/shared/sim/state';
import { camp, clearAround, plainGame, put } from './helpers';

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
