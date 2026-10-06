import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILD_QUEUE_SLOTS, BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, canUpgrade, placeBlueprint, totalCapacity, totalStock, upgrade } from '../src/shared/sim/buildings';
import { isSeat } from '../src/shared/data/seats';
import { Sim } from '../src/shared/sim/sim';
import { camp, freeSpot, isWild, nearestWild, plainGame, poolOf, put, row } from './helpers';
import { addStock, newGame, poolSize, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { cellAt } from '../src/shared/sim/land';

const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};
const building = (s: GameState, def: string) => s.buildings.find((b) => b.def === def);
const campfire = (s: GameState) => building(s, 'campfire')!;

test('placement: needs cleared land, no overlap, inside the known land', () => {
  const s = newGame('place');
  const stockpile = BUILDING_BY_ID.stockpile;
  const spot = freeSpot(s, 'stockpile');
  assert.equal(canPlace(s, stockpile, spot.x, spot.y).ok, true);
  assert.equal(canPlace(s, stockpile, campfire(s).tile - 1, campfire(s).row).ok, false, 'overlaps the campfire');
  const wild = cellAt(s.land, nearestWild(s));
  assert.equal(canPlace(s, stockpile, wild.x, wild.y).ok, false, 'wild land');
  assert.equal(canPlace(s, stockpile, -1, camp(s).y).ok, false);
  assert.equal(canPlace(s, stockpile, s.land.w - 2, camp(s).y).ok, false);
  assert.equal(canPlace(s, stockpile, camp(s).x, 0).ok, false, 'beyond the known land');
});

test('placement: locked buildings need research (or the debug unlock); the queue has limited slots', () => {
  const s = newGame('locks');
  const at = freeSpot(s, 'lean_to');
  assert.equal(placeBlueprint(s, 'lean_to', at.x, at.y).ok, false);
  s.cheats.unlockAll = true;
  assert.equal(placeBlueprint(s, 'lean_to', at.x, at.y).ok, true);
  // fill the remaining slots with racks on the cleared camp land
  for (let i = 1; i < BUILD_QUEUE_SLOTS; i++) {
    const r = freeSpot(s, 'drying_rack');
    assert.equal(placeBlueprint(s, 'drying_rack', r.x, r.y).ok, true);
  }
  const sp = freeSpot(s, 'stockpile');
  const full = placeBlueprint(s, 'stockpile', sp.x, sp.y);
  assert.equal(full.ok, false);
  assert.match(full.reason!, /queue/);
});

test('a blueprint gets a road to the camp', () => {
  const s = newGame('road');
  const at = freeSpot(s, 'stockpile');
  assert.ok(placeBlueprint(s, 'stockpile', at.x, at.y).ok);
  assert.ok(s.land.roads.includes('#'), 'a road was laid');
});

test('with storage full of stone, gathered wood goes straight to the blueprint', () => {
  const sim = new Sim(plainGame('full'));
  const s = sim.state;
  campfire(s).store = { stone: 30 };
  const at = freeSpot(s, 'stockpile');
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  sim.command({ type: 'toggleGather', cell: nearestWild(s, 'forest') });
  run(sim, 40 * 60);
  assert.equal(building(s, 'stockpile')!.status, 'done');
  assert.equal(campfire(s).store.stone, 30, 'the stone was never touched');
});

test('throwing out a stored material frees the room', () => {
  const sim = new Sim(plainGame('discard'));
  const s = sim.state;
  campfire(s).store = { stone: 20, wood: 10 };
  sim.command({ type: 'discardStock', building: campfire(s).id, material: 'stone' });
  run(sim, 1);
  assert.deepEqual(campfire(s).store, { wood: 10 });
});

test('a stockpile gets built from gathered wood: gather, store, fetch, deliver, build', () => {
  const sim = new Sim(plainGame('build'));
  const s = sim.state;
  const at = freeSpot(s, 'stockpile');
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  const forest = nearestWild(s, 'forest');
  const wood = poolOf(s, forest).wood!;
  sim.command({ type: 'toggleGather', cell: forest });
  run(sim, 1);
  const sp = building(s, 'stockpile')!;
  assert.equal(sp.status, 'blueprint');
  run(sim, 40 * 60);
  assert.equal(sp.status, 'done', 'finished');
  assert.equal(totalCapacity(s), 130, 'campfire cache + stockpile');
  assert.equal(totalStock(s).wood, wood - 6, 'the 6 wood went into the stockpile, the rest is stored');
  const mc = s.people[0];
  assert.ok(mc.skills.construction.xp > 0 || mc.skills.construction.level > newGame('build').people[0].skills.construction.level);
});

test('construction waits for materials, then starts when they arrive', () => {
  const sim = new Sim(plainGame('wait'));
  const s = sim.state;
  const at = freeSpot(s, 'stockpile');
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  run(sim, 120);
  assert.equal(building(s, 'stockpile')!.progress, 0, 'nothing to build with');
  addStock(campfire(s).store, 'wood', 6);
  run(sim, 120);
  assert.equal(building(s, 'stockpile')!.status, 'done');
  assert.deepEqual(totalStock(s), {});
});

test('cancelling a blueprint refunds deliveries; demolishing refunds half the cost', () => {
  const sim = new Sim(plainGame('demolish'));
  const s = sim.state;
  addStock(campfire(s).store, 'wood', 12);
  const at = freeSpot(s, 'stockpile');
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  run(sim, 120);
  const sp = building(s, 'stockpile')!;
  assert.equal(sp.status, 'done');
  assert.equal(totalStock(s).wood, 6);
  sim.command({ type: 'demolish', building: sp.id });
  sim.step();
  assert.equal(building(s, 'stockpile'), undefined);
  assert.equal(totalStock(s).wood, 9, '6 left + half of 6 back');

  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  run(sim, 8); // long enough to fetch and deliver, not to finish
  const bp = building(s, 'stockpile')!;
  assert.equal(bp.status, 'blueprint');
  sim.command({ type: 'demolish', building: bp.id });
  run(sim, 30);
  assert.equal(poolSize(totalStock(s)) + poolSize(s.people[0].carrying), 9, 'nothing lost');
});

test('with all storage full, gathering stops and the worker says so', () => {
  const sim = new Sim(plainGame('full'));
  const s = sim.state;
  addStock(campfire(s).store, 'stone', 30);
  const forest = nearestWild(s, 'forest');
  sim.command({ type: 'toggleGather', cell: forest });
  run(sim, 600);
  const mc = s.people[0];
  assert.equal(poolSize(mc.carrying), 10, 'hands full');
  assert.equal(mc.blocked, true);
  assert.ok(isWild(s, forest), 'cell not cleared');
});

test('upgrading in place: a lean-to becomes a longhouse where it stands, reusing half its materials', () => {
  const s = plainGame('upgrade');
  const lean = put(s, 'lean_to', camp(s).x + 3);
  assert.equal(upgrade(s, lean.id).ok, false, 'needs Oral Tradition');
  s.research.done.push('oral_tradition');
  const r = upgrade(s, lean.id);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(lean.def, 'longhouse');
  assert.equal(lean.status, 'blueprint');
  assert.deepEqual(lean.delivered, { wood: 4 }, "half the lean-to's wood goes into the longhouse (its fiber to storage)");
});
test('merging: two lean-tos side by side with no room to widen become one longhouse', () => {
  const s = plainGame('merge');
  s.research.done.push('oral_tradition');
  const at = camp(s).x + 3;
  const a = put(s, 'lean_to', at);
  const b = put(s, 'lean_to', at + 2);
  // hemmed in: a stretch of wall on each side (never pulled down to make room)
  put(s, 'palisade_wall', at - 1, undefined, { hp: 100 });
  put(s, 'palisade_wall', at + 4, undefined, { hp: 100 });
  assert.equal(upgrade(s, a.id).ok, false, 'no room on its own');
  const before = s.buildings.length;
  const r = upgrade(s, a.id, b.id);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(s.buildings.length, before - 1, 'one home instead of two');
  assert.equal(a.def, 'longhouse');
  assert.ok(!s.buildings.includes(b));
  assert.deepEqual(a.delivered, { wood: 8 }, "both lean-tos' wood goes into the longhouse");
});

test('an upgrade with no room pulls down the small things in its way, never what matters', () => {
  const s = plainGame('clear-way');
  s.research.done.push('oral_tradition');
  const at = camp(s).x + 4;
  const home = put(s, 'lean_to', at);
  // a workbench on one side, a stretch of wall on the other
  const bench = put(s, 'workbench', at + 2);
  put(s, 'palisade_wall', at - 1, undefined, { hp: 100 });
  const check = canUpgrade(s, home.id);
  assert.ok(check.ok, check.reason ?? '');
  assert.deepEqual(check.clear, [bench.id]);
  const r = upgrade(s, home.id);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(home.def, 'longhouse');
  assert.ok(!s.buildings.includes(bench), 'the workbench is pulled down');
  assert.ok(s.journal.some((j) => /pulled down to make room for the Longhouse/.test(j.text)));
  // the town's seat in the way is never pulled down
  const t = plainGame('clear-seat');
  t.research.done.push('oral_tradition');
  const at2 = camp(t).x + 4;
  const home2 = put(t, 'lean_to', at2);
  put(t, 'settlers_seat_1' in BUILDING_BY_ID ? 'settlers_seat_1' : Object.keys(BUILDING_BY_ID).find((id) => isSeat(id))!, at2 + 2);
  put(t, 'palisade_wall', at2 - 1, undefined, { hp: 100 });
  assert.equal(canUpgrade(t, home2.id).ok, false);
});

test('a town short of beds rebuilds a small home bigger before building another', () => {
  const sim = new Sim(newGame('beds-up'));
  const s = sim.state;
  s.research.done.push('basic_shelter', 'oral_tradition');
  for (const b of s.buildings.filter((q) => q.def === 'lean_to')) s.buildings.splice(s.buildings.indexOf(b), 1);
  const home = put(s, 'lean_to', camp(s).x - 8, row(s));
  addStock(campfire(s).store, 'wood', 24);
  addStock(campfire(s).store, 'stone', 6);
  const homes = () => s.buildings.filter((b) => BUILDING_BY_ID[b.def].housing).length;
  const was = homes();
  for (let i = 0; i < 20 && home.def === 'lean_to'; i++) sim.step();
  run(sim, 30);
  assert.equal(home.def, 'longhouse', 'the lean-to is being rebuilt as a longhouse');
  assert.equal(homes(), was, 'no new home beside it');
});
