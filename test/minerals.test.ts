import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { MINERALS, ORES, tradeId } from '../src/shared/data/minerals';
import { FACTION_GOODS } from '../src/shared/data/trade';
import { WORTH } from '../src/shared/data/trade';
import { Rng } from '../src/shared/rng';
import { canSend, destinationOf, destinationUnlocked, sendExpedition } from '../src/shared/sim/expeditions';
import { MINE_DEPTH, mineLeft, openMine, placeCleared, placesHourly } from '../src/shared/sim/places';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makeOffers } from '../src/shared/sim/trade';
import { makePerson, type Building, type GameState } from '../src/shared/sim/state';
import type { MapPlace } from '../src/shared/sim/places';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { campPx, plainGame, row } from './helpers';
import { campCell } from '../src/shared/sim/state';

/** The land's first cave, or one put six cells from the camp when the seed gave none. */
function caveOf(s: GameState): MapPlace {
  let cave = s.places!.find((p) => p.kind === 'cave');
  if (!cave) {
    cave = { id: 99, kind: 'cave', x: campCell(s).x + 6, y: campCell(s).y + 6, found: s.tick, state: 'waiting' };
    s.places!.push(cave);
  }
  return cave;
}

test('the minerals are materials with a worth, recipes, wares, a topic each and a bell tower', () => {
  for (const m of MINERALS) assert.ok(WORTH[m] > 0, m);
  assert.equal(ITEM_BY_ID.smelt_copper.makes?.copper, 1);
  assert.equal(ITEM_BY_ID.cast_bronze.makes?.bronze, 2);
  assert.equal(ITEM_BY_ID.smelt_silver.station, 'bloomery');
  assert.ok(ITEM_BY_ID.copper_kettle.ware && ITEM_BY_ID.silver_ring.ware && ITEM_BY_ID.sulphur_salve.ware);
  assert.equal(TOPIC_BY_ID.bronze_working.era, 'neolithic');
  assert.equal(BUILDING_BY_ID.bell_tower.cost.bronze, 4);
});

test('a cleared cave opens as a mine: ore in the walls round its mouth, dug out it goes deeper, and the last level is the last', () => {
  const s = plainGame('mine');
  s.land.open = 60;
  s.tick = TICKS_PER_HOUR - 1;
  new Sim(s).step();
  const cave = caveOf(s);
  cave.found = s.tick;
  cave.foes = { wolf: 1 };
  const loot = {};
  placeCleared(s, `place:${cave.id}`, loot, new Rng(3));
  assert.equal(cave.state, 'done');
  assert.ok(cave.mine, 'a mine');
  assert.equal(cave.mine!.depth, 1);
  assert.ok(cave.mine!.ores.includes('copper_ore') && cave.mine!.ores.includes('tin_ore'));
  const left = mineLeft(s, cave);
  assert.ok((left.copper_ore ?? 0) > 0 && (left.tin_ore ?? 0) > 0, JSON.stringify(left));
  for (const i of cave.mine!.cells) assert.ok(s.land.pools[i], 'a pool to dig');
  // dug out (the stone left): the next level opens on the hour, richer
  for (const i of cave.mine!.cells) s.land.pools[i] = { stone: 2 };
  s.tick += TICKS_PER_HOUR - (s.tick % TICKS_PER_HOUR);
  placesHourly(s, new Rng(4));
  assert.equal(cave.mine!.depth, 2);
  assert.ok((mineLeft(s, cave).copper_ore ?? 0) > (left.copper_ore ?? 0) - 10);
  // down to the last level: gold and gems join, and nothing opens past it
  for (let d = 3; d <= MINE_DEPTH; d++) {
    for (const i of cave.mine!.cells) delete s.land.pools[i];
    s.tick += TICKS_PER_HOUR;
    placesHourly(s, new Rng(d));
    assert.equal(cave.mine!.depth, d);
  }
  assert.ok(cave.mine!.ores.includes('gold') && cave.mine!.ores.includes('gems'));
  for (const i of cave.mine!.cells) delete s.land.pools[i];
  s.tick += TICKS_PER_HOUR;
  placesHourly(s, new Rng(9));
  assert.equal(cave.mine!.depth, MINE_DEPTH, 'worked out');
  const view = snapshot(s).places.find((p) => p.id === cave.id)!;
  assert.ok(view.mine && view.mine.last);
});

test('the player goes into a mine: the snapshot has its walls and whoever is digging', () => {
  const s = plainGame('mine-watch');
  s.land.open = 60;
  s.tick = TICKS_PER_HOUR - 1;
  const sim = new Sim(s);
  sim.step();
  const cave = caveOf(s);
  cave.found = s.tick;
  cave.state = 'done';
  delete cave.foes;
  openMine(s, cave, new Rng(1));
  sim.command({ type: 'watchMine', place: cave.id });
  sim.step();
  const v = snapshot(s).mine!;
  assert.ok(v, 'a mine to watch');
  assert.equal(v.id, cave.id);
  assert.equal(v.walls.length, cave.mine!.cells.length);
  // a digger at a wall
  const p = s.people[0];
  p.task = { type: 'gather', tile: cave.mine!.cells[0], progress: 0 };
  p.x = (cave.x + 0.5) * 32;
  p.y = (cave.y + 0.5) * 32;
  const v2 = snapshot(s).mine!;
  assert.equal(v2.miners.length, 1);
  assert.ok(v2.miners[0].digging);
  assert.equal(v2.walls[0].digger?.id, p.id);
  sim.command({ type: 'watchMine', place: null });
  sim.step();
  assert.equal(snapshot(s).mine, null);
});

test('a trade caravan costs its purse and brings minerals home; the far markets wait on the scouts', () => {
  const s = plainGame('trade-caravan');
  s.research.done.push('barter');
  const a = makePerson(new Rng(1), s.nextId++, 'wanderer', campPx(s), []);
  s.people.push(a);
  const home = destinationOf(s, tradeId('heartland'))!;
  assert.equal(home.type, 'trade');
  assert.ok(destinationUnlocked(s, home), 'home market from Barter');
  assert.equal(destinationUnlocked(s, destinationOf(s, tradeId('northern_crags'))!), false, 'the crags wait on the scouts');
  s.coins = 10;
  assert.equal(canSend(s, home.id, [a.id]).ok, false, 'no purse');
  s.coins = 100;
  const r = sendExpedition(s, home.id, [a.id]);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(s.coins, 100 - home.coins!);
  const sim = new Sim(s);
  let t = 0;
  while (s.expeditions.length && t++ < 4000 * 10) sim.step();
  assert.equal(s.expeditions.length, 0, 'home');
  const back = ORES.some((m) => (s.buildings.reduce((n, b) => n + (b.store[m] ?? 0), 0) + (a.carrying[m] ?? 0)) > 0);
  assert.ok(back, 'minerals brought back');
});

test("another people's caravan brings its own goods", () => {
  const s = plainGame('faction');
  s.era = 'medieval';
  const stock: Building = { id: s.nextId++, def: 'stockpile', tile: campCell(s).x + 4, row: row(s), status: 'done', delivered: {}, progress: 1, store: { wood: 80, stone: 30 } };
  s.buildings.push(stock);
  const offers = makeOffers(s, new Rng(5), 'dwarves');
  const goods = offers.filter((o) => !o.horse).flatMap((o) => Object.keys(o.gives));
  assert.ok(goods.some((g) => FACTION_GOODS.dwarves!.includes(g as never)), `the hold's goods among ${goods.join(', ')}`);
});
