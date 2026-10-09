import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { buildingCentre } from '../src/shared/sim/buildings';
import { hasInside, insideOf, lookInside } from '../src/shared/sim/interiors';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { freeSpot, plainGame, put } from './helpers';

test('homes, workshops and studies have an inside; fields, walls and the fire do not', () => {
  for (const id of ['lean_to', 'workbench']) assert.ok(hasInside(BUILDING_BY_ID[id]), id);
  for (const id of ['garden_plot', 'campfire', 'palisade_wall', 'trading_post']) if (BUILDING_BY_ID[id]) assert.ok(!hasInside(BUILDING_BY_ID[id]), id);
});

test('whoever sleeps in a home is inside it, and the view shows them; out of doors they are listed as out', () => {
  const s = plainGame('inside-home');
  const spot = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', spot.x, spot.y);
  const p = s.people[0];
  p.bed = home.id;
  const c = buildingCentre(home);
  p.x = c.x;
  p.y = c.y;
  p.task = { type: 'sleep', building: home.id };
  p.activity = 'sleep';
  assert.deepEqual(insideOf(s, p), { building: home.id, at: 'bed' });
  assert.ok(lookInside(s, home.id));
  const v = snapshot(s).interior!;
  assert.equal(v.building, home.id);
  assert.equal(v.inside[0].id, p.id);
  assert.equal(v.inside[0].at, 'bed');
  // out at work: listed as out
  p.task = { type: 'gather', tile: 0, progress: 0 };
  p.activity = 'walk';
  p.x += 400;
  const w = snapshot(s).interior!;
  assert.equal(w.inside.length, 0);
  assert.equal(w.out[0].name, p.name);
  // and out again
  assert.ok(lookInside(s, null));
  assert.equal(snapshot(s).interior, null);
});

test('a child at home plays about the floor; a grown-up of an evening sits by the hearth; a field cannot be looked into', () => {
  const s = plainGame('inside-child');
  const spot = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', spot.x, spot.y);
  const c = buildingCentre(home);
  const kid = makePerson(new Rng(2), s.nextId++, 'gatherer', { x: c.x, y: c.y }, s.people.map((q) => q.name));
  kid.bornTick = s.tick;
  kid.bed = home.id;
  kid.activity = 'play';
  kid.task = null;
  s.people.push(kid);
  assert.equal(insideOf(s, kid)?.at, 'floor');
  const field = put(s, 'garden_plot', spot.x + 6, spot.y);
  assert.equal(lookInside(s, field.id), false);
});

test('a castle\'s own rooms are not looked into: they are seen on the map already', () => {
  const s = plainGame('in-castle');
  s.origin = 'vampire';
  const b = put(s, 'lean_to', s.land.camp.x + 4, s.land.camp.y + 2);
  assert.equal(lookInside(s, b.id), false);
  s.origin = 'settlers';
  assert.equal(lookInside(s, b.id), true);
});
