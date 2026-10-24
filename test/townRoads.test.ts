import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { doorCell, footprint, placeBlueprint } from '../src/shared/sim/buildings';
import { idx, inRect, isPlannedRoad, isRoad, setGround } from '../src/shared/sim/land';
import { ensureLayout } from '../src/shared/sim/layout';
import { drawPath, pathLine } from '../src/shared/sim/pathPlans';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { streetsHourly } from '../src/shared/sim/streets';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { doorReached, network, planTownRoads, route } from '../src/shared/sim/townRoads';
import { clearAround, plainGame, put } from './helpers';
import { auditRoads } from './roadAudit';

const street = (s: GameState, x: number, y: number) => isRoad(s.land, x, y) || isPlannedRoad(s.land, x, y);

/** A plain town with the autopilot on, the land cleared round it and its plan laid down (its square and main
 *  streets with it). */
function planned(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.cheats.unlockAll = true;
  clearAround(s, 30);
  s.land.roads = '.'.repeat(s.land.w * s.land.h);
  delete s.land.plannedRoads;
  ensureLayout(s);
  return s;
}

test('a town just founded gets its square and its main streets laid at once', () => {
  const s = planned('roads-founding');
  const L = s.layout!;
  for (let x = L.sq.x; x < L.sq.x + L.sq.w; x++) assert.ok(isRoad(s.land, x, L.row), 'the square paved');
  // (the high street west and east, the road south, straight along the plan's lines)
  assert.ok(isRoad(s.land, L.sq.x - 3, L.row) && isRoad(s.land, L.sq.x + L.sq.w + 2, L.row), 'the high street');
  assert.ok(isRoad(s.land, L.col, L.row + 4), 'the road south');
  assert.ok(!s.land.plannedRoads?.includes('#'), 'nothing left to pave');
});

test("a building ordered gets a side street from its door to the town's streets, planned with it", () => {
  const s = planned('roads-door');
  const L = s.layout!;
  assert.ok(placeBlueprint(s, 'workbench', L.col + 9, L.row + 6).ok);
  const b = s.buildings.at(-1)!;
  assert.ok(doorReached(s, b, network(s)), 'its door reached');
  assert.ok(s.land.plannedRoads?.includes('#'), 'planned, for the builders to pave');
  const d = doorCell(b);
  assert.ok(street(s, d.x, d.y), 'from the cell before its door');
});

test('a side street runs straight with one corner on open ground, and goes round a field', () => {
  const s = planned('roads-route');
  const L = s.layout!;
  const from = { x: L.col + 10, y: L.row + 9 };
  const way = route(s, [from], network(s))!;
  assert.ok(way, 'a way');
  const turns = way.slice(2).filter((p, k) => (p.x - way[k + 1].x !== way[k + 1].x - way[k].x) || (p.y - way[k + 1].y !== way[k + 1].y - way[k].y)).length;
  assert.ok(turns <= 1, `${turns} turns`);
  // (a field across the straight way: the street goes round it, never over it)
  const mid = way[Math.floor(way.length / 2)];
  const f = put(s, 'garden_plot', mid.x - 1, mid.y - 1);
  assert.ok(!inRect(footprint(f), from.x, from.y), 'the field clear of the start');
  const round = route(s, [from], network(s))!;
  assert.ok(round, 'a way round');
  const r = footprint(f);
  for (const p of round) assert.ok(!inRect(r, p.x, p.y), 'not over the field');
  assert.equal(auditRoads(s).onFields, 0);
});

test('a street goes round a wood where the way round is short', () => {
  const s = planned('roads-land');
  const L = s.layout!;
  const from = { x: L.col + 12, y: L.row + 4 };
  // a little wood straight in the way, three cells deep
  for (let y = from.y - 1; y <= from.y + 1; y++) for (let x = from.x - 4; x <= from.x - 2; x++) {
    setGround(s.land, x, y, 'forest');
    s.land.pools[idx(s.land, x, y)] = { wood: 10 };
  }
  const way = route(s, [from], network(s))!;
  assert.ok(way.every((p) => !(p.x >= from.x - 4 && p.x <= from.x - 2 && p.y >= from.y - 1 && p.y <= from.y + 1)), 'round the wood');
});

test('every gate of the ring wall gets a street from the town, through it and on a few cells beyond', () => {
  const s = planned('roads-gate');
  const L = s.layout!;
  // (a gate north of the square, off the main streets' lines)
  const g = put(s, 'palisade_gate', L.col + 3, L.row - 14, { ring: 1 });
  s.ring = { gen: 1, rect: { x: L.col - 14, y: L.row - 14, w: 29, h: 29 }, wall: 'palisade_wall', gate: 'palisade_gate', gates: [{ x: g.tile, y: g.row }], done: true };
  for (let h = 0; h < 24; h++) {
    s.tick = h * TICKS_PER_HOUR;
    streetsHourly(s);
  }
  const net = network(s);
  assert.equal(net[idx(s.land, g.tile, g.row)], 1, "the gate is on the town's streets");
  assert.ok(street(s, g.tile, g.row - 1) && street(s, g.tile, g.row - 3), 'and the street runs on beyond it');
  assert.equal(auditRoads(s).gatesOff, 0);
});

test("the player's path is kept and joined to the town's streets", () => {
  const s = planned('roads-joined');
  const L = s.layout!;
  const line = pathLine({ x: L.col + 8, y: L.row + 12 }, { x: L.col + 16, y: L.row + 12 }).map((p) => idx(s.land, p.x, p.y));
  assert.equal(drawPath(s, line, true), line.length);
  assert.ok(!network(s)[line[0]], 'cut off at first');
  planTownRoads(s);
  for (const i of line) assert.ok(isPlannedRoad(s.land, i % s.land.w, Math.floor(i / s.land.w)), 'every cell of it kept');
  assert.ok(line.every((i) => network(s)[i] === 1), 'and joined');
});

test('a town left to run lays streets that make sense: every door on one, all joined, no doubled or parallel streets, none on a field', () => {
  for (const origin of ['settlers', 'orcs']) {
    const s = newGame(`roads-run-${origin}`, { origin: origin as 'settlers' });
    // (the town orders its own buildings, standing in for the player)
    s.townBuilds = true;
    s.nextRaidTick = Number.MAX_SAFE_INTEGER;
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
    const sim = new Sim(s);
    for (let t = 0; t < 6 * TICKS_PER_DAY; t++) sim.step();
    const a = auditRoads(s);
    assert.ok(s.buildings.length > 8, `${origin}: the town got on with building (${s.buildings.length})`);
    assert.ok(a.cells > 40, `${origin}: streets laid (${a.cells})`);
    assert.deepEqual(a.doorless, [], `${origin}: every door on a street`);
    assert.deepEqual(a.cutOff, [], `${origin}: every street joined to the square`);
    assert.equal(a.doubled, 0, `${origin}: no doubled street`);
    assert.equal(a.parallel, 0, `${origin}: no parallel streets a cell apart`);
    assert.equal(a.onFields, 0, `${origin}: none on a field`);
    assert.ok(s.land.roads.split('#').length - 1 > 20, `${origin}: and paved as the town goes`);
  }
});

test('an older town with no streets of its own gets them planned from now on, nothing torn up', () => {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  assert.ok(r.ok);
  const s = r.save.state;
  s.layout = undefined;
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  const roads = s.land.roads;
  const before = s.land.plannedRoads;
  s.tick = Math.ceil(s.tick / PLAN_TICKS) * PLAN_TICKS;
  runPlanner(s);
  assert.ok(s.layout, 'a plan fitted');
  for (let i = 0; i < roads.length; i++) {
    if (roads[i] === '#') assert.equal(s.land.roads[i], '#', 'every street laid stays');
    if (before?.[i] === '#') assert.ok(s.land.roads[i] === '#' || s.land.plannedRoads?.[i] === '#', 'every street planned stays');
  }
  assert.ok((s.land.plannedRoads ?? '').split('#').length - 1 > (before ?? '').split('#').length - 1, 'more planned');
});
