import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOAT_BY_KIND, FISH_HOUR } from '../src/shared/data/boats';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { Rng } from '../src/shared/rng';
import { boatsHourly, boatyardSpot, fleet, freeBoat, launch, planBoats, seaworthy, waterside, wreck } from '../src/shared/sim/boats';
import { canPlace, totalStock } from '../src/shared/sim/buildings';
import { finishPiece } from '../src/shared/sim/crafting';
import { canSend, sendExpedition, updateExpeditions } from '../src/shared/sim/expeditions';
import { groundAt, makeLand, touchesWater, wet } from '../src/shared/sim/land';
import type { GameState } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

/** A town that has learned to build boats and knows enough of its land to reach the water. */
function boatTown(seed = 'boats'): GameState {
  const s = plainGame(seed);
  s.research.done.push('boatbuilding', 'carpentry', 'shipwrighting');
  s.land.open = 40;
  return s;
}

test('every land has water for a boatyard, a hold under its mountain too (a tarn below it)', () => {
  for (const shape of [undefined, 'mountain', 'sea'] as const)
    for (const biome of ['forest', 'desert', 'tundra', 'coast'] as const)
      for (const seed of ['a', 'b', 'c', 'd']) {
        const m = makeLand(seed, biome, shape);
        assert.ok(m.cells.includes('w') || m.cells.includes('S'), `${biome} ${shape ?? 'open'} ${seed} has water`);
      }
});

test("a boatyard stands only at the water's edge, and the town finds such a spot", () => {
  const s = boatTown();
  const def = BUILDING_BY_ID.boatyard;
  const at = boatyardSpot(s);
  assert.ok(at, 'a spot by the water');
  assert.ok(canPlace(s, def, at!.x, at!.y).ok);
  assert.ok(touchesWater(s.land, { x: at!.x, y: at!.y, w: def.width, h: 2 }) || touchesWater(s.land, { x: at!.x, y: at!.y, w: def.width, h: 3 }));
  // right by the camp, where no water runs, it won't stand
  const c = s.land.camp;
  const dry = canPlace(s, def, c.x - 1, c.y + 3);
  if (!touchesWater(s.land, { x: c.x - 1, y: c.y + 3, w: def.width, h: 2 })) assert.ok(!dry.ok);
  // the planner lays one down once it has learned Boatbuilding
  planBoats(s);
  assert.ok(s.buildings.some((b) => b.def === 'boatyard'));
});

test('a boat built at the boatyard joins the fleet with a name, not the stores', () => {
  const s = boatTown();
  const at = boatyardSpot(s)!;
  put(s, 'boatyard', at.x, at.y);
  const order = { id: s.nextId++, item: 'boat_dugout', count: 1, delivered: {}, itemsTaken: false, progress: 1, made: 0 };
  s.crafting.push(order);
  finishPiece(s, order, s.people[0]);
  assert.equal(fleet(s).length, 1);
  assert.equal(fleet(s)[0].kind, 'dugout');
  assert.equal(fleet(s)[0].hull, BOAT_BY_KIND.dugout.hull);
  assert.ok(fleet(s)[0].name.length > 0);
  assert.ok(!s.items.boat_dugout, 'not an item in the stores');
  assert.ok(seaworthy(fleet(s)[0]));
});

test('an island needs a boat; with one the party sails, the boat goes with them and comes home', () => {
  const s = boatTown();
  const id = s.people[0].id;
  assert.equal(canSend(s, 'gull_rock', [id]).reason, 'Needs a seaworthy boat');
  const boat = launch(s, 'dugout');
  assert.ok(canSend(s, 'gull_rock', [id]).ok);
  assert.ok(sendExpedition(s, 'gull_rock', [id]).ok);
  const e = s.expeditions[0];
  assert.equal(e.boat, boat.id);
  assert.equal(boat.away, e.id);
  assert.equal(freeBoat(s), undefined, 'no boat left at home');
  // home again (quick legs: no hour at sea passes, so no weather), she's back at her mooring
  e.outTicks = 1;
  e.workTicks = 1;
  e.backTicks = 1;
  const rng = new Rng(3);
  for (let t = 0; t < TICKS_PER_DAY && s.expeditions.length; t++) updateExpeditions(s, rng);
  assert.equal(s.expeditions.length, 0);
  assert.equal(boat.away, null);
});

test('a trip along the water goes faster by boat than on foot', () => {
  const s = boatTown('fast');
  assert.ok(waterside('riverbank'));
  const id = s.people[0].id;
  assert.ok(sendExpedition(s, 'riverbank', [id]).ok);
  const walking = s.expeditions[0].outTicks;
  s.expeditions = [];
  s.people[0].away = null;
  launch(s, 'longboat');
  assert.ok(sendExpedition(s, 'riverbank', [id]).ok);
  assert.ok(s.expeditions[0].outTicks < walking, `${s.expeditions[0].outTicks} < ${walking}`);
  assert.ok(s.expeditions[0].boat);
});

test('wrecked: the boat is lost, the party comes home with nothing, and some may drown', () => {
  let drowned = 0;
  for (const seed of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']) {
    const s = boatTown(seed);
    const boat = launch(s, 'dugout');
    const id = s.people[0].id;
    s.people[0].traits = [];
    assert.ok(sendExpedition(s, 'gull_rock', [id]).ok);
    const e = s.expeditions[0];
    e.loot = { fish: 4 };
    const before = s.people.length;
    wreck(s, e, boat, [s.people[0]], new Rng(seed.charCodeAt(1)));
    assert.equal(fleet(s).length, 0);
    assert.ok(e.wrecked);
    assert.equal(Object.keys(e.loot).length, 0);
    if (s.people.length < before || s.gameOver) drowned++;
  }
  assert.ok(drowned >= 1, 'the sea takes someone');
});

test('a boat at home fishes each evening', () => {
  const s = boatTown('fish');
  const at = boatyardSpot(s)!;
  put(s, 'boatyard', at.x, at.y);
  launch(s, 'dugout');
  const fishBefore = totalStock(s).fish ?? 0;
  // to the fishing hour (on the hour)
  s.tick -= s.tick % TICKS_PER_HOUR;
  while (calendar(s.tick).hour !== FISH_HOUR) s.tick += TICKS_PER_HOUR;
  s.autopilot = false;
  boatsHourly(s, new Rng(7));
  assert.ok((totalStock(s).fish ?? 0) > fishBefore, 'fish brought in');
});

test('the island destinations are boat-only and on the map in the sea', () => {
  for (const id of ['gull_rock', 'turtle_atoll', 'seal_skerries', 'drowned_spires', 'kraken_deep', 'pirate_haven', 'spice_port']) {
    assert.ok(DESTINATION_BY_ID[id]?.byBoat, id);
  }
  // (and a hold's tarn is real water)
  const m = makeLand('a', 'forest', 'mountain');
  let found = false;
  for (let y = 0; y < m.h && !found; y++) for (let x = 0; x < m.w && !found; x++) if (wet(groundAt(m, x, y))) found = true;
  assert.ok(found);
});
