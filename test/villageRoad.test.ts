import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { Rng } from '../src/shared/rng';
import { CELL, findPath, groundAt, idx, isRoad, setGround, WILD } from '../src/shared/sim/land';
import { drawPath, PATH_CAP, pathGround, refusalOn } from '../src/shared/sim/pathPlans';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { streetWork } from '../src/shared/sim/streets';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { roadShare, villageRoadHourly } from '../src/shared/sim/villageRoad';
import { foundVillage, villageSpot, type Village } from '../src/shared/sim/villages';
import { VILLAGE_ROAD_HOUR } from '../src/shared/data/villages';
import { snapshot } from '../src/shared/sim/snapshot';
import { walk } from '../src/shared/sim/walk';
import { ROAD_NEAR_TOWN, ROAD_NEAR_VILLAGE } from '../src/shared/sim/villageRoad';
import { plainGame } from './helpers';

const dayAt = (day: number) => (day - 1) * TICKS_PER_DAY + ((VILLAGE_ROAD_HOUR - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function townWithVillage(seed: string): { s: GameState; v: Village } {
  const s = plainGame(seed);
  s.townBuilds = true;
  const rng = new Rng(9);
  const c = s.people[0];
  while (s.people.length < 11) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 4, y: c.y }, s.people.map((p) => p.name)));
  s.autopilot = true;
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 60, stone: 20, berries: 30 };
  const at = villageSpot(s, new Rng(4))!;
  const ids = s.people.slice(1, 6).map((p) => p.id);
  const v = foundVillage(s, { ids, leader: ids[0], x: at.x, y: at.y, name: 'Testford' }, 70)!;
  return { s, v };
}

/** The player draws a path from before the village's fire to before the town's (over the cells a path may take, a
 *  wood on the way cleared first, as the player would with ⛏), from `from` of the way to `upTo` of it. */
const ways = new WeakMap<GameState, number[]>();
function drawRoad(s: GameState, v: Village, upTo = 1, from = 0): number[] {
  const had = ways.get(s);
  if (had) return lay(s, had.slice(Math.floor(had.length * from), Math.ceil(had.length * upTo)));
  const m = s.land;
  const ground = pathGround(s);
  const way = findPath(m, { x: v.x, y: v.y + 2 }, { x: m.camp.x, y: m.camp.y + 1 }, (x, y) => !WILD.includes(groundAt(m, x, y)) && refusalOn(ground, x, y) !== null, { four: true, maxNodes: 40000 })!;
  assert.ok(way, 'a way to draw');
  for (const p of way) if (WILD.includes(groundAt(m, p.x, p.y))) setGround(m, p.x, p.y, 'grass');
  const all = [{ x: v.x, y: v.y + 2 }, ...way].map((p) => idx(m, p.x, p.y));
  ways.set(s, all);
  return lay(s, all.slice(Math.floor(all.length * from), Math.ceil(all.length * upTo)));
}
function lay(s: GameState, cells: number[]): number[] {
  for (let k = 0; k < cells.length; k += PATH_CAP) drawPath(s, cells.slice(k, k + PATH_CAP), true);
  return cells;
}

/** Days of the village's laying (and, with `town`, the town's pavers beside them) until the road is open. */
function build(s: GameState, v: Village, town: boolean, days = 60): number {
  for (let d = 1; d <= days; d++) {
    s.tick = dayAt(d);
    if (town) streetWork(s, 60);
    villageRoadHourly(s);
    if (v.road?.done !== undefined) return d;
  }
  return -1;
}

/** Ticks a walker takes to go from the village to the town's fire. */
function trip(s: GameState, v: Village): number {
  const w = { x: (v.x + 0.5) * CELL, y: (v.y + 2.5) * CELL, dir: 1 as const };
  const camp = s.land.camp;
  for (let t = 1; t < 6000; t++) if (walk(s, w, { x: (camp.x + 0.5) * CELL, y: (camp.y + 1.5) * CELL }, 4.8, undefined, t)) return t;
  return 6000;
}

test('a village is founded with no road of its own, and the player is told to draw one', () => {
  const { s, v } = townWithVillage('vroad-plan');
  assert.ok(!s.land.plannedRoads?.includes('#'), 'no street planned');
  assert.equal(roadShare(s, v), null, 'no road yet');
  assert.ok(s.notices.some((n) => n.text === 'Draw a path from Testford to the town, and both ends will build the road.'), 'the hint');
  // (and it stays so while nothing is drawn, the hint told once)
  for (let d = 1; d <= 5; d++) {
    s.tick = dayAt(d);
    villageRoadHourly(s);
  }
  assert.ok(!s.land.plannedRoads?.includes('#'));
  assert.equal(s.notices.filter((n) => n.text.startsWith('Draw a path from Testford')).length, 1);
});

test('a path drawn from the village to the town becomes its road', () => {
  const { s, v } = townWithVillage('vroad-drawn');
  drawRoad(s, v);
  s.tick = dayAt(1);
  villageRoadHourly(s);
  assert.ok(v.road && v.road.cells.length > 10, 'the road is taken');
  const first = v.road!.cells[0], last = v.road!.cells.at(-1)!;
  const w = s.land.w;
  assert.ok(Math.max(Math.abs((first % w) - v.x), Math.abs(Math.floor(first / w) - v.y)) <= ROAD_NEAR_VILLAGE, 'from the village');
  assert.ok(Math.max(Math.abs((last % w) - s.land.camp.x), Math.abs(Math.floor(last / w) - s.land.camp.y - 1)) <= ROAD_NEAR_TOWN, 'to the town');
  const share = roadShare(s, v)!;
  assert.ok(share >= 0 && share < 1);
  assert.ok(s.notices.some((n) => n.text.includes('sets about a road')), 'told');
  assert.equal(snapshot(s).villages[0].road, Math.round(share * 100), 'the view tells how far it is');
});

test('a path that stops short of the town is no road until it reaches it', () => {
  const { s, v } = townWithVillage('vroad-drawn');
  const cells = drawRoad(s, v, 0.5);
  s.tick = dayAt(1);
  villageRoadHourly(s);
  assert.equal(roadShare(s, v), null, 'half a path: no road');
  assert.ok(cells.every((i) => !isRoad(s.land, i % s.land.w, Math.floor(i / s.land.w))), 'and the village lays none of it');
  drawRoad(s, v, 1, 0.5);
  s.tick = dayAt(2);
  villageRoadHourly(s);
  assert.ok(v.road!.cells.length > 10, 'the whole way: a road');
});

test('it is built from both ends and open when they meet', () => {
  const a = townWithVillage('vroad-both');
  drawRoad(a.s, a.v);
  const days = build(a.s, a.v, true);
  assert.ok(days > 0, 'finished');
  assert.ok(a.v.road!.cells.every((i) => isRoad(a.s.land, i % a.s.land.w, Math.floor(i / a.s.land.w))));
  assert.equal(roadShare(a.s, a.v), 1);
  assert.ok(a.s.journal.some((j) => j.text === 'The road to Testford is open.'));
  // the village alone lays its own end, and the town's hands make it quicker
  const b = townWithVillage('vroad-both');
  drawRoad(b.s, b.v);
  const alone = build(b.s, b.v, false);
  assert.ok(alone > 0, 'the village alone gets there');
  assert.ok(days <= alone, `${days} days with the town, ${alone} alone`);
});

test('a walker takes the road and gets there sooner', () => {
  const { s, v } = townWithVillage('vroad-walk');
  const before = trip(s, v);
  drawRoad(s, v);
  assert.ok(build(s, v, true) > 0);
  const after = trip(s, v);
  assert.ok(after < before, `${after} ticks after, ${before} before`);
});

test('a village from an older save whose road was never found takes the path drawn to it', () => {
  const { s, v } = townWithVillage('vroad-old');
  v.road = { cells: [], failed: 5, sig: '3|', told: true };
  drawRoad(s, v);
  s.tick = dayAt(5);
  villageRoadHourly(s);
  assert.ok((v as Village).road!.cells.length > 10, 'taken');
  assert.equal((v as Village).road!.failed, undefined);
});
