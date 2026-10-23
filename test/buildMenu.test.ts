import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/shared/sim/commands';
import { BUILDING_BY_ID, BUILDINGS } from '../src/shared/data/buildings';
import { BUILD_KINDS, kindOf } from '../src/renderer/panel/buildKinds';
import { isUnlocked, unlockInfo } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { ORIGINS } from '../src/shared/data/origins';
import { recommendBuilding } from '../src/shared/sim/planner';
import { ringAdvice } from '../src/shared/sim/ringWall';
import { housingCapacity } from '../src/shared/sim/townsfolk';
import { addStock, newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

test('every building falls in a menu group', () => {
  for (const b of BUILDINGS) assert.ok((BUILD_KINDS as readonly string[]).includes(kindOf(b)), b.id);
});

test('an ordered building is laid by the town, and cancelling clears the order and its site', () => {
  const s = newGame('build-menu');
  s.autopilot = true;
  const sim = new Sim(s);
  const def = BUILDINGS.find((d) => !d.never && !d.housing && !d.hp && !d.storage && !d.seat && d.buildSeconds >= 60 && isUnlocked(unlockInfo(s), d) && !s.buildings.some((b) => b.def === d.id) && Object.keys(d.cost).every((m) => m === 'wood' || m === 'stone'))!;
  const store = s.buildings.find((b) => b.def === 'campfire')!.store;
  for (const [m, n] of Object.entries(def.cost)) addStock(store, m as never, n as number);
  sim.command({ type: 'pinBuilding', def: def.id, on: true });
  for (let i = 0; i < 2 * TICKS_PER_HOUR && s.pins?.[0]?.building === undefined; i++) sim.step();
  const id = s.pins![0].building!;
  assert.ok(s.buildings.some((b) => b.id === id && b.status === 'blueprint'));
  sim.command({ type: 'pinBuilding', def: def.id, on: false });
  sim.command({ type: 'demolish', building: id });
  sim.step();
  assert.equal(s.pins!.length, 0);
  assert.ok(!s.buildings.some((b) => b.id === id && b.status === 'blueprint'));
});

test('the town lays no blueprint of its own unless townBuilds is set', () => {
  for (const builds of [false, true]) {
    const s = newGame('founder-builds');
    s.autopilot = true;
    s.townBuilds = builds;
    s.research.done.push('basic_shelter', 'carpentry');
    const sim = new Sim(s);
    const before = s.buildings.length;
    for (let i = 0; i < 48 * TICKS_PER_HOUR; i++) sim.step();
    if (builds) assert.ok(s.buildings.length > before, 'the old planner builds');
    else assert.equal(s.buildings.filter((b) => b.status === 'blueprint').length, 0, 'nothing laid unordered');
  }
});

test('homes are recommended when beds are short, for every people', () => {
  for (const origin of ORIGINS) {
    const s = newGame(`rec-${origin}`, { origin });
    s.autopilot = true;
    if (!s.research.done.includes('basic_shelter')) s.research.done.push('basic_shelter');
    const r = recommendBuilding(s);
    assert.ok(r === null || r.name.length > 0, origin);
    s.pins = [];
    // (no beds free: more people than beds)
    for (let i = 0; i < 8 && housingCapacity(s) >= s.people.length; i++) s.people.push({ ...s.people[0], id: 9000 + i });
    const h = recommendBuilding(s);
    const homes = BUILDINGS.filter((d) => d.housing && !d.never && isUnlocked(unlockInfo(s), d));
    assert.ok(homes.length, `${origin} can build a home once it knows shelter`);
    if (homes.length) assert.ok(h?.def && BUILDING_BY_ID[h.def].housing, `${origin} recommends a home, got ${h?.def}`);
  }
});

test('the wall is not recommended for widening until the inside is mostly built on', () => {
  const s = newGame('wall-rec');
  s.ring = { gen: 1, rect: { x: 0, y: 0, w: 60, h: 60 }, line: [], wall: 'palisade', gate: 'palisade_gate', gates: [], done: true } as never;
  assert.equal(ringAdvice(s, 6, false), null);
});

test('ordering the ring wall sets the founder\'s order; there is no order to lay the streets (the player draws them)', () => {
  const s = newGame('orders');
  const sim = new Sim(s);
  sim.command({ type: 'orderRing' });
  sim.step();
  assert.equal(s.ringOrder, true);
  assert.equal(parseCommand({ type: 'orderStreets' }), null);
});
