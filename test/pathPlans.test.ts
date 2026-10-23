import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS, type BuildingDef } from '../src/shared/data/buildings';
import { parseCommand } from '../src/shared/sim/commands';
import { builtOnIndex, depthOf, isUnlocked, NO_ROAD, unlockInfo } from '../src/shared/sim/buildings';
import { pinRefusal } from '../src/shared/sim/pins';
import { doorOf, idx, isPlannedRoad, isRoad, onPath, setGround, setRoad } from '../src/shared/sim/land';
import { drawPath, PATH_CAP, pathLine, pathRefusal, pathRoute, refusalOn } from '../src/shared/sim/pathPlans';
import { snapshot } from '../src/shared/sim/snapshot';
import { findSpot } from '../src/shared/sim/planner';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { addStock, campCell, type GameState } from '../src/shared/sim/state';
import { plannedCells } from '../src/shared/sim/streets';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { clearAround, plainGame, priorities, put } from './helpers';

/** A plain town with the land cleared round it and no streets yet. */
function bareTown(seed: string): GameState {
  const s = plainGame(seed);
  clearAround(s, 25);
  s.land.roads = '.'.repeat(s.land.w * s.land.h);
  delete s.land.plannedRoads;
  return s;
}
/** Something a new town can build now, of wood and stone, with a door (a road of its own). */
const orderable = (s: GameState): BuildingDef => BUILDINGS.find((d) => !d.never && !NO_ROAD(d) && isUnlocked(unlockInfo(s), d) && pinRefusal(s, d) === null && Object.keys(d.cost).every((m) => m === 'wood' || m === 'stone'))!;
const cellsOf = (s: GameState, pts: { x: number; y: number }[]) => pts.map((p) => idx(s.land, p.x, p.y));

test('the drawPath command is checked and capped', () => {
  assert.deepEqual(parseCommand({ type: 'drawPath', cells: [1, 2], on: true }), { type: 'drawPath', cells: [1, 2], on: true });
  assert.equal(parseCommand({ type: 'drawPath', cells: Array(PATH_CAP + 1).fill(1), on: true }), null);
  assert.equal(parseCommand({ type: 'drawPath', cells: [1.5], on: true }), null);
  assert.equal(parseCommand({ type: 'drawPath', cells: [1] }), null);
});

test('a line between two cells joins edge to edge', () => {
  const line = pathLine({ x: 0, y: 0 }, { x: 4, y: 2 });
  assert.equal(line.length, 7);
  assert.deepEqual(line[0], { x: 0, y: 0 });
  assert.deepEqual(line.at(-1), { x: 4, y: 2 });
  for (let k = 1; k < line.length; k++) assert.equal(Math.abs(line[k].x - line[k - 1].x) + Math.abs(line[k].y - line[k - 1].y), 1);
  assert.equal(pathLine({ x: 3, y: 3 }, { x: 3, y: 3 }).length, 1);
});

test('a path is laid on open ground, a bridge over a river, and refused elsewhere', () => {
  const sim = new Sim(bareTown('path-rules'));
  const s = sim.state;
  const c = campCell(s);
  const y = c.y + 4;
  const open = cellsOf(s, [{ x: c.x + 1, y }, { x: c.x + 2, y }]);
  // (a river two wide: bridged)
  for (let ry = c.y - 10; ry <= c.y + 10; ry++) for (const x of [c.x + 5, c.x + 6]) setGround(s.land, x, ry, 'water');
  const river = cellsOf(s, [{ x: c.x + 5, y }]);
  // (a lake too wide to bridge)
  for (let ly = c.y + 8; ly < c.y + 24; ly++) for (let lx = c.x - 20; lx < c.x - 4; lx++) setGround(s.land, lx, ly, 'water');
  const lake = cellsOf(s, [{ x: c.x - 12, y: c.y + 16 }]);
  // (a wood, a building, and land never seen)
  setGround(s.land, c.x + 3, y + 2, 'forest');
  const wood = cellsOf(s, [{ x: c.x + 3, y: y + 2 }]);
  put(s, 'campfire', c.x - 3, y + 2);
  const under = cellsOf(s, [{ x: c.x - 3, y: y + 2 }]);
  const far = idx(s.land, c.x + 2, y + 3);
  s.explored = '1'.repeat(s.land.w * s.land.h);
  s.explored = s.explored.slice(0, far) + '0' + s.explored.slice(far + 1);
  assert.equal(pathRefusal(s, c.x + 3, y + 2), 'Wild ground: clear it first');
  assert.match(pathRefusal(s, c.x - 12, c.y + 16)!, /water/);
  assert.match(pathRefusal(s, c.x - 3, y + 2)!, /building/);
  assert.match(pathRefusal(s, c.x + 2, y + 3)!, /explored/);
  sim.command({ type: 'drawPath', cells: [...open, ...river, ...lake, ...wood, ...under, far], on: true });
  sim.step();
  assert.deepEqual(plannedCells(s).sort((a, b) => a - b), [...open, ...river].sort((a, b) => a - b), 'only open ground and the river');
  // (a tap on a cell of it lifts it)
  sim.command({ type: 'drawPath', cells: [open[1]], on: false });
  sim.step();
  assert.ok(!isPlannedRoad(s.land, c.x + 2, y) && isPlannedRoad(s.land, c.x + 1, y));
});

test('builders pave a drawn path out from the street', () => {
  const s = bareTown('path-paved');
  const c = campCell(s);
  setRoad(s.land, c.x, c.y + 3);
  const p = s.people[0];
  p.priorities = priorities({ construct: 1 });
  p.task = null;
  const sim = new Sim(s);
  const line = cellsOf(s, pathLine({ x: c.x + 1, y: c.y + 3 }, { x: c.x + 6, y: c.y + 5 }));
  sim.command({ type: 'drawPath', cells: line, on: true });
  sim.step();
  assert.equal(plannedCells(s).length, line.length);
  for (let i = 0; i < 300 * TICK_HZ && plannedCells(s).length; i++) sim.step();
  assert.equal(plannedCells(s).length, 0, 'all of it paved');
  for (const i of line) assert.ok(isRoad(s.land, i % s.land.w, Math.floor(i / s.land.w)));
});

test("a building the player orders goes beside a path where it can, and where it can't, where it would have", () => {
  const s = bareTown('path-spot');
  const def = orderable(s);
  const doorOn = (s: GameState, at: { x: number; y: number } | null) => !!at && onPath(s.land, doorOf({ x: at.x, y: at.y, w: def.width, h: depthOf(def) }));
  const c = campCell(s);
  const before = findSpot(s, def);
  assert.ok(before && !doorOn(s, before), 'no path near the nearest spot');
  // (a path a few cells off: the order goes beside it, the town's own building as before)
  drawPath(s, cellsOf(s, pathLine({ x: c.x - 8, y: c.y + 6 }, { x: c.x + 8, y: c.y + 6 })), true);
  const pathed = findSpot(s, def, true);
  assert.ok(doorOn(s, pathed), 'its door on the path');
  // (a path too far to reach: the nearest spot after all)
  const t = bareTown('path-spot');
  drawPath(t, cellsOf(t, pathLine({ x: c.x - 8, y: c.y + 22 }, { x: c.x + 8, y: c.y + 22 })), true);
  assert.deepEqual(findSpot(t, def, true), findSpot(t, def));
});

test('an order through the build menu is laid beside the drawn path', () => {
  const s = bareTown('path-pin');
  s.autopilot = true;
  const c = campCell(s);
  const def = orderable(s);
  addStock(s.buildings.find((b) => b.def === 'campfire')!.store, 'wood', 40);
  addStock(s.buildings.find((b) => b.def === 'campfire')!.store, 'stone', 40);
  const sim = new Sim(s);
  sim.command({ type: 'drawPath', cells: cellsOf(s, pathLine({ x: c.x - 8, y: c.y + 6 }, { x: c.x + 8, y: c.y + 6 })), on: true });
  sim.command({ type: 'pinBuilding', def: def.id, on: true });
  sim.step();
  for (let i = 0; i < 2 * TICKS_PER_HOUR && s.pins?.[0]?.building === undefined && s.pins?.length; i++) sim.step();
  const b = s.buildings.find((q) => q.id === s.pins?.[0]?.building);
  assert.ok(b, 'laid');
  assert.ok(onPath(s.land, doorOf({ x: b!.tile, y: b!.row, w: def.width, h: depthOf(def) })), 'its door on the path');
});

test('a drawn path is saved, an old save with none takes one, and the same strokes give the same plan', () => {
  const s = bareTown('path-save');
  const c = campCell(s);
  const back = parseSave(serialize(s, 1));
  assert.ok(back.ok);
  const old = back.save.state;
  assert.equal(old.land.plannedRoads, undefined);
  const line = cellsOf(old, pathLine({ x: c.x + 1, y: c.y + 5 }, { x: c.x + 7, y: c.y + 8 }));
  assert.equal(drawPath(old, line, true), line.length);
  const again = parseSave(serialize(old, 2));
  assert.ok(again.ok && again.save.state.land.plannedRoads === old.land.plannedRoads);
  const t = bareTown('path-save');
  drawPath(t, line, true);
  assert.equal(t.land.plannedRoads, old.land.plannedRoads);
});

test("a drag's route runs straight, or turns one corner, by the corner with more cells a path can take", () => {
  const all = () => true;
  const straight = pathRoute({ x: 2, y: 5 }, { x: 8, y: 5 }, all);
  assert.equal(straight.length, 7);
  assert.ok(straight.every((p) => p.y === 5));
  // (along the longer way first, then across)
  const corner = pathRoute({ x: 0, y: 0 }, { x: 5, y: 2 }, all);
  assert.equal(corner.length, 8);
  assert.deepEqual(corner[5], { x: 5, y: 0 }, 'the turn at the far end of the long run');
  for (let k = 1; k < corner.length; k++) assert.equal(Math.abs(corner[k].x - corner[k - 1].x) + Math.abs(corner[k].y - corner[k - 1].y), 1);
  // (a building on that corner: the other one is taken)
  const round = pathRoute({ x: 0, y: 0 }, { x: 5, y: 2 }, (x, y) => !(y === 0 && x >= 3));
  assert.deepEqual(round[2], { x: 0, y: 2 }, 'down first, then along');
  assert.deepEqual(pathRoute({ x: 3, y: 3 }, { x: 3, y: 3 }, all), [{ x: 3, y: 3 }]);
});

test("the preview's rule, read from the snapshot, refuses what the sim refuses", () => {
  const s = bareTown('path-preview');
  const c = campCell(s);
  setGround(s.land, c.x + 3, c.y + 6, 'forest');
  put(s, 'campfire', c.x - 3, c.y + 6);
  const snap = snapshot(s);
  const view = { land: snap.land, explored: snap.explored, origin: snap.origin.id, on: builtOnIndex(snap), wall: null, castle: snap.castle ? new Set(snap.castle.cells) : null, thin: null };
  for (let x = c.x - 6; x <= c.x + 6; x++) for (let y = c.y + 4; y <= c.y + 8; y++) assert.equal(refusalOn(view, x, y), pathRefusal(s, x, y), `${x},${y}`);
});
