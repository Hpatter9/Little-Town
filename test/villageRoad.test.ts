import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { Rng } from '../src/shared/rng';
import { buildable, CELL, cellAt, groundAt, isPlannedRoad, isRoad, planRoad, wet } from '../src/shared/sim/land';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { streetWork } from '../src/shared/sim/streets';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { roadShare, villageRoadHourly } from '../src/shared/sim/villageRoad';
import { foundVillage, villageSpot, type Village } from '../src/shared/sim/villages';
import { VILLAGE_ROAD_HOUR } from '../src/shared/data/villages';
import { snapshot } from '../src/shared/sim/snapshot';
import { walk } from '../src/shared/sim/walk';
import { plainGame } from './helpers';

const dayAt = (day: number) => (day - 1) * TICKS_PER_DAY + ((VILLAGE_ROAD_HOUR - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function townWithVillage(seed: string): { s: GameState; v: Village } {
  const s = plainGame(seed);
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
  const w = { x: (v.x + 0.5) * CELL, y: (v.y + 2.5) * CELL };
  const camp = s.land.camp;
  for (let t = 1; t < 6000; t++) if (walk(s, w, { x: (camp.x + 0.5) * CELL, y: (camp.y + 1.5) * CELL }, 4.8, undefined, t)) return t;
  return 6000;
}

test('a village is founded with a road planned to the town', () => {
  const { s, v } = townWithVillage('vroad-plan');
  assert.ok(v.road && v.road.cells.length > 10, 'the road is planned');
  assert.equal(v.road!.cells[0], v.y + 2 === 0 ? 0 : (v.y + 2) * s.land.w + v.x, 'from the village');
  const share = roadShare(s, v)!;
  assert.ok(share >= 0 && share < 1);
  assert.ok(s.journal.some((j) => j.text.includes('road to the town')), 'the journal tells it');
  assert.equal(snapshot(s).villages[0].road, Math.round(share * 100), 'the view tells how far it is');
});

test('the road keeps off rock and water but for bridges', () => {
  const { s, v } = townWithVillage('vroad-ground');
  for (const i of v.road!.cells) {
    const c = cellAt(s.land, i);
    const g = groundAt(s.land, c.x, c.y);
    assert.ok(buildable(g) || wet(g), `cell ${c.x},${c.y} on ${g}`);
    assert.notEqual(g, 'mountain');
  }
});

test('it is built from both ends and open when they meet', () => {
  const a = townWithVillage('vroad-both');
  const days = build(a.s, a.v, true);
  assert.ok(days > 0, 'finished');
  assert.ok(a.v.road!.cells.every((i) => isRoad(a.s.land, i % a.s.land.w, Math.floor(i / a.s.land.w))));
  assert.equal(roadShare(a.s, a.v), 1);
  assert.ok(a.s.journal.some((j) => j.text === 'The road to Testford is open.'));
  // the village alone lays its own end, and the town's hands make it quicker
  const b = townWithVillage('vroad-both');
  const alone = build(b.s, b.v, false);
  assert.ok(alone > 0, 'the village alone gets there');
  assert.ok(days <= alone, `${days} days with the town, ${alone} alone`);
});

test('a walker takes the road and gets there sooner', () => {
  const { s, v } = townWithVillage('vroad-walk');
  const before = trip(s, v);
  assert.ok(build(s, v, true) > 0);
  const after = trip(s, v);
  assert.ok(after < before, `${after} ticks after, ${before} before`);
});

test('a village from an older save gets a road planned on load', () => {
  const { s, v } = townWithVillage('vroad-old');
  for (const i of v.road!.cells) {
    const c = cellAt(s.land, i);
    if (isPlannedRoad(s.land, c.x, c.y)) planRoad(s.land, c.x, c.y, false);
  }
  delete v.road;
  s.tick = dayAt(5);
  villageRoadHourly(s);
  assert.ok(v.road && v.road.cells.length > 10, 'planned again');
  assert.ok(s.notices.some((n) => n.text.includes('sets about a road')));
});
