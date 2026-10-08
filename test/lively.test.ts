import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, STATIONS } from '../src/shared/data/items';
import { RESEARCH_STATIONS } from '../src/shared/data/research';
import { CELL, groundAt } from '../src/shared/sim/land';
import { pastimeFor, STROLL_FROM } from '../src/shared/sim/pastimes';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { HAUL_LEAST, hauls, heapColour, mainLoad } from '../src/renderer/map/haul';
import { workLook } from '../src/renderer/map/workLooks';
import { plainGame } from './helpers';
import { ageStage, damageStage } from '../src/renderer/art/wear';
import { decorFor, dressed } from '../src/renderer/map/decorRules';
import { marketOn, marketSquare, MARKET_DAY, MARKET_EVERY, MARKET_FROM } from '../src/shared/sim/pastimes';
import { markDebris } from '../src/shared/sim/state';
import { fightFire } from '../src/shared/sim/fire';
import { sunAt } from '../src/renderer/art/sun';
import { lampCells, lampLit, LAMPS_MOST, LAMP_LOOK } from '../src/renderer/map/lampRules';
import { ERAS } from '../src/shared/data/eras';
import { snowCover, wetnessStep } from '../src/renderer/map/groundRules';
import { nextRoadCell } from '../src/renderer/map/trafficRules';
import { waterBelow } from '../src/renderer/map/reflections';

const twin = (s: GameState, extra: Partial<Person>): Person => {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, partner: null, ...extra };
  s.people.push(p);
  return p;
};

test('a heavy load goes in a wheelbarrow heaped with it', () => {
  const s = plainGame('haul');
  const v = snapshot(s).people[0];
  assert.equal(hauls({ ...v, carrying: { wood: HAUL_LEAST + 1 } }, true), true);
  assert.equal(hauls({ ...v, carrying: { wood: HAUL_LEAST + 1 } }, false), false, 'not while standing');
  assert.equal(hauls({ ...v, carrying: { wood: 1 } }, true), false, 'a light load is carried by hand');
  assert.deepEqual(mainLoad({ wood: 2, stone: 5 }), ['stone', 7]);
  assert.notDeepEqual(heapColour('wood'), heapColour('stone'));
});

test('every workshop and study shows its work', () => {
  for (const st of STATIONS) assert.ok(workLook(st), st);
  for (const st of Object.keys(RESEARCH_STATIONS)) assert.ok(workLook(st), st);
  assert.equal(workLook('smithy'), 'sparks');
  assert.equal(workLook('lean_to'), null);
});

test('idle children play together, elders sit by the fire, couples walk out of an evening', () => {
  const s = plainGame('pastime');
  const kid = twin(s, { bornTick: 0 });
  const kid2 = twin(s, { bornTick: 0 });
  const play = pastimeFor(s, kid, 0)!;
  assert.equal(play.pastime, 'play');
  assert.ok(Math.hypot(play.x - kid2.x, play.y - kid2.y) < 3 * CELL, 'beside the other child');
  const old = twin(s, { grownAt: 0 });
  s.tick = 90 * TICKS_PER_DAY;
  const sit = pastimeFor(s, old, 0)!;
  assert.equal(sit.pastime, 'sit');
  const c = campXY(s);
  assert.ok(Math.hypot(sit.x - c.x, sit.y - c.y) < 2 * CELL, 'by the fire');
  const a = twin(s, { grownAt: s.tick });
  const b = twin(s, { grownAt: s.tick, partner: a.id });
  a.partner = b.id;
  s.tick = 91 * TICKS_PER_DAY + ((STROLL_FROM + 1 - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  assert.equal(pastimeFor(s, a, 3)?.pastime, 'stroll');
  assert.equal(pastimeFor(s, b, 3)?.pastime, 'stroll');
  s.tick = 91 * TICKS_PER_DAY + ((10 - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  assert.equal(pastimeFor(s, a, 3), null, 'not at mid-morning');
});

test('the snapshot names the buildings at work and the latest news', () => {
  const s = plainGame('working');
  const st = s.buildings.find((b) => b.def === 'campfire')!;
  const p = s.people[0];
  const item = ITEMS.find((i) => i.station === 'campfire')!;
  s.crafting.push({ id: 900, item: item.id, count: 1, delivered: {}, itemsTaken: true, progress: 0.3, made: 0 });
  p.task = { type: 'craft', order: 900, phase: 'work', from: null };
  p.activity = 'build';
  assert.deepEqual(snapshot(s).workingAt, [st.id]);
  s.journal.push({ id: 9999, tick: s.tick, text: 'The well is built.', key: true });
  assert.equal(snapshot(s).news?.text, 'The well is built.');
});


test('buildings show their years and their knocks', () => {
  assert.equal(ageStage(1), 0);
  assert.equal(ageStage(10), 1);
  assert.equal(ageStage(40), 3);
  assert.equal(damageStage(100, 100), 0);
  assert.equal(damageStage(50, 100), 1);
  assert.equal(damageStage(10, 100), 2);
  assert.equal(damageStage(undefined, undefined), 0);
});

test('a fire put out leaves the building scorched', () => {
  const s = plainGame('scorch');
  const b = s.buildings.find((q) => q.def !== 'campfire')!;
  b.fire = 0.0001;
  fightFire(s, s.people[0], b);
  assert.equal(b.fire, undefined);
  assert.equal(b.scorched, s.tick);
});

test('a fallen raider leaves what it dropped, a beast its bones, a machine nothing', () => {
  const s = plainGame('debris');
  markDebris(s, 100, 100, 'person', 1);
  markDebris(s, 200, 100, 'beast', 2);
  markDebris(s, 300, 100, 'machine', 3);
  const kinds = (s.debris ?? []).map((d) => d.kind);
  assert.ok(kinds.includes('blade'));
  assert.ok(kinds.includes('bones'));
  assert.equal(kinds.length, 2);
});

test('homes and venues are dressed for the season; a market is held once a week', () => {
  const s = plainGame('decor');
  const home = { id: 4, def: 'cottage', tile: 0, row: 0, status: 'done', delivered: {}, progress: 1, store: {} } as const;
  assert.ok(dressed({ ...home }));
  assert.ok(!dressed({ ...home, def: 'well' }));
  assert.deepEqual(decorFor('winter', 1), ['lantern', 'wreath']);
  assert.deepEqual(decorFor('summer', 2), []);
  // (market day at its hour, with three grown-ups about)
  while (s.people.length < 3) s.people.push({ ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++ });
  const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  s.tick = at(MARKET_DAY + MARKET_EVERY, MARKET_FROM + 1);
  assert.ok(marketOn(s), 'market day');
  const sq = marketSquare(s);
  const kid = s.people[1];
  assert.equal(pastimeFor(s, kid, 0)?.pastime, 'market');
  assert.ok(Math.hypot(pastimeFor(s, kid, 0)!.x - sq.x, pastimeFor(s, kid, 0)!.y - sq.y) < 4 * CELL);
  s.tick = at(MARKET_DAY + MARKET_EVERY + 1, MARKET_FROM + 1);
  assert.ok(!marketOn(s), 'not the next day');
});

test('shadows lean west in the morning, east in the evening, long at the ends of the day and gone at night', () => {
  const morning = sunAt(7, 1), noon = sunAt(12, 1), evening = sunAt(17, 1);
  assert.ok(morning.skew < 0 && evening.skew > 0);
  assert.ok(Math.abs(noon.skew) < 0.01);
  assert.ok(morning.length > noon.length && evening.length > noon.length);
  assert.equal(sunAt(23, 0).alpha, 0);
});

test('street lamps stand along the roads, nearest the fire first, lit from dusk and every age has one', () => {
  const land = { w: 40, h: 40, camp: { x: 20, y: 20 } };
  const road = (x: number, y: number) => y === 20 || x === 20;
  const cells = lampCells(land, road);
  assert.ok(cells.length > 0 && cells.length <= LAMPS_MOST);
  assert.ok(cells.every((c) => road(c.x, c.y)));
  const d = (c: { x: number; y: number }) => Math.hypot(c.x - 20, c.y - 20);
  assert.ok(cells.every((c, i) => i === 0 || d(cells[i - 1]) <= d(c)), 'nearest first');
  assert.equal(lampLit(1), 0);
  assert.equal(lampLit(0.1), 1);
  assert.ok(lampLit(0.45) > 0 && lampLit(0.45) < 1, 'half lit at dusk');
  for (const e of ERAS) assert.ok(LAMP_LOOK[e], e);
});

test('rain wets the ground and it dries after; snow settles at the end of autumn and melts in spring', () => {
  let w = 0;
  w = wetnessStep(w, 'rain', TICKS_PER_HOUR);
  assert.ok(w > 0.4);
  w = wetnessStep(w, 'rain', 3 * TICKS_PER_HOUR);
  assert.equal(w, 1);
  w = wetnessStep(w, 'clear', 4 * TICKS_PER_HOUR);
  assert.ok(w > 0.4 && w < 0.6, 'drying slowly');
  assert.equal(snowCover('autumn', 3, 10), 0);
  assert.ok(snowCover('autumn', 3, 22) > 0.5);
  assert.ok(snowCover('spring', 1, 2) > snowCover('spring', 1, 18));
  assert.equal(snowCover('summer', 1, 12), 0);
});

test('a cart keeps to the road, mostly straight on, and stops at a dead end', () => {
  const road = (x: number, y: number) => y === 5 && x >= 0 && x <= 10;
  assert.deepEqual(nextRoadCell(road, { x: 3, y: 5 }, { x: 2, y: 5 }, 0.1), { x: 4, y: 5 });
  assert.equal(nextRoadCell(road, { x: 10, y: 5 }, { x: 9, y: 5 }, 0.5), null);
});

test("things at the water's edge are mirrored in it", () => {
  const s = plainGame('reflect');
  const land = s.land;
  let found: { x: number; y: number } | null = null;
  for (let y = 1; y < land.h - 1 && !found; y++)
    for (let x = 0; x < land.w && !found; x++) if (land.cells[y * land.w + x] !== land.cells[0] && groundAt(land, x, y + 1) === 'water' && groundAt(land, x, y) !== 'water') found = { x, y };
  assert.ok(found, 'a shore');
  assert.ok(waterBelow(land, (found!.x + 0.5) * CELL, (found!.y + 1) * CELL - 2, 'summer'));
  assert.ok(!waterBelow(land, (found!.x + 0.5) * CELL, (found!.y - 3) * CELL, 'summer'));
});
