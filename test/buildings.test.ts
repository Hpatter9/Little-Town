import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILD_QUEUE_SLOTS, BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, placeBlueprint, totalCapacity, totalStock, upgrade } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';
import { addStock, newGame, poolSize, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { generateWorld } from '../src/shared/world';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};
const building = (s: GameState, def: string) => s.buildings.find((b) => b.def === def);
const campfire = (s: GameState) => building(s, 'campfire')!;
/** A free spot on cleared land for a fore building of `width`, right of the campfire. */
const freeForeTile = (s: GameState) => campfire(s).tile + 2;

test('placement: needs cleared land, no overlap, inside the town', () => {
  const s = newGame('place');
  const back = generateWorld('place').back;
  const stockpile = BUILDING_BY_ID.stockpile;
  assert.equal(canPlace(s, back, stockpile, freeForeTile(s)).ok, true);
  assert.equal(canPlace(s, back, stockpile, campfire(s).tile - 1).ok, false, 'overlaps the campfire');
  const wild = s.tiles.findIndex((t) => t.terrain !== 'clear');
  assert.equal(canPlace(s, back, stockpile, wild).ok, false, 'wild land');
  assert.equal(canPlace(s, back, stockpile, -1).ok, false);
  assert.equal(canPlace(s, back, stockpile, s.tiles.length - 2).ok, false);
  // a midground building may sit behind a foreground one
  assert.equal(canPlace(s, back, BUILDING_BY_ID.lean_to, campfire(s).tile).ok, true);
});

test('placement: locked buildings need research (or the debug unlock); the queue has limited slots', () => {
  const s = newGame('locks');
  const back = generateWorld('locks').back;
  assert.equal(placeBlueprint(s, back, 'lean_to', camp(s) - 6).ok, false);
  s.cheats.unlockAll = true;
  assert.equal(placeBlueprint(s, back, 'lean_to', camp(s) - 6).ok, true);
  // fill the remaining slots with 1-wide racks on the cleared camp land
  for (let i = 1; i < BUILD_QUEUE_SLOTS; i++) assert.equal(placeBlueprint(s, back, 'drying_rack', camp(s) - 6 - i).ok, true);
  const full = placeBlueprint(s, back, 'stockpile', freeForeTile(s));
  assert.equal(full.ok, false);
  assert.match(full.reason!, /queue/);
});

test('with storage full of stone, gathered wood goes straight to the blueprint', () => {
  const sim = new Sim(plainGame('full'));
  const s = sim.state;
  campfire(s).store = { stone: 30 };
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: freeForeTile(s) });
  const forest = s.tiles.findIndex((t, i) => i > camp(s) && t.terrain === 'forest');
  sim.command({ type: 'toggleGather', tile: forest });
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
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: freeForeTile(s) });
  const forest = s.tiles.findIndex((t, i) => i > camp(s) && t.terrain === 'forest');
  sim.command({ type: 'toggleGather', tile: forest });
  run(sim, 1);
  const sp = building(s, 'stockpile')!;
  assert.equal(sp.status, 'blueprint');
  run(sim, 40 * 60);
  assert.equal(sp.status, 'done', 'finished');
  assert.equal(totalCapacity(s), 130, 'campfire cache + stockpile');
  const wood = newGame('build').tiles[forest].pool.wood!;
  assert.equal(totalStock(s).wood, wood - 6, 'the 6 wood went into the stockpile, the rest is stored');
  const mc = s.people[0];
  assert.ok(mc.skills.construction.xp > 0 || mc.skills.construction.level > newGame('build').people[0].skills.construction.level);
});

test('construction waits for materials, then starts when they arrive', () => {
  const sim = new Sim(plainGame('wait'));
  const s = sim.state;
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: freeForeTile(s) });
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
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: freeForeTile(s) });
  run(sim, 120);
  const sp = building(s, 'stockpile')!;
  assert.equal(sp.status, 'done');
  assert.equal(totalStock(s).wood, 6);
  sim.command({ type: 'demolish', building: sp.id });
  sim.step();
  assert.equal(building(s, 'stockpile'), undefined);
  assert.equal(totalStock(s).wood, 9, '6 left + half of 6 back');

  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: freeForeTile(s) });
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
  const forest = s.tiles.findIndex((t, i) => i > camp(s) && t.terrain === 'forest');
  sim.command({ type: 'toggleGather', tile: forest });
  run(sim, 600);
  const mc = s.people[0];
  assert.equal(poolSize(mc.carrying), 10, 'hands full');
  assert.equal(mc.blocked, true);
  assert.ok(s.tiles[forest].terrain === 'forest', 'tile not cleared');
});

test('upgrading in place: a lean-to becomes a hide tent where it stands, reusing half its materials', () => {
  const s = plainGame('upgrade');
  const back = generateWorld('upgrade').back;
  const lean = { id: s.nextId++, def: 'lean_to', tile: camp(s) + 3, status: 'done' as const, delivered: {}, progress: 1, store: {} };
  s.buildings.push(lean);
  assert.equal(upgrade(s, back, lean.id).ok, false, 'needs Tanning');
  s.research.done.push('tanning');
  const r = upgrade(s, back, lean.id);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(lean.def, 'hide_tent');
  assert.equal(lean.status, 'blueprint');
  assert.deepEqual(lean.delivered, { wood: 4, fiber: 2 }, 'half the lean-to (8 wood, 4 fiber) goes into the tent');
});