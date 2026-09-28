import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { FURNISHINGS } from '../src/shared/data/shop';
import { totalStock } from '../src/shared/sim/buildings';
import { forSale, runPlanner, shoppingList, PLAN_TICKS } from '../src/shared/sim/planner';
import { parseSave, serialize } from '../src/shared/sim/save';
import { appeal, shopLayout, spotFor } from '../src/shared/sim/shop';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { generateWorld } from '../src/shared/world';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function addBuilding(s: GameState, def: string, tile: number, store = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store };
  s.buildings.push(b);
  return b;
}
/** Nothing wild left to gather: no fiber (or anything else) from the land. */
const bareLand = (s: GameState) => {
  for (const t of s.tiles) {
    t.terrain = 'clear';
    t.pool = {};
  }
};

test('travellers stop at an open shop, buy what the town has spare for coins, and walk on out of town', () => {
  const sim = new Sim(plainGame('shop-sell'));
  const s = sim.state;
  addBuilding(s, 'trading_post', camp(s) + 3);
  addBuilding(s, 'stockpile', camp(s) - 6, { stone: 90, clay: 40, berries: 3, totem: 1 });
  let t = 0;
  while (!(s.coins ?? 0) && t++ < 2 * TICKS_PER_DAY) sim.step();
  assert.ok((s.coins ?? 0) > 0, 'a traveller bought something');
  const stock = totalStock(s);
  assert.ok((stock.stone ?? 0) < 90 || (stock.clay ?? 0) < 40, 'spare stone or clay sold');
  assert.ok((stock.berries ?? 0) >= 3, 'food the town needs is never sold (short of it, the town buys more)');
  assert.equal(stock.totem, 1, 'the totem is never sold');
  assert.ok(s.shopLog?.some((l) => l.text.includes('bought')), 'the shop logs the sale');
  // they browse a while, then leave the map
  const who = (s.travellers ?? []).map((tr) => tr.id);
  for (let k = 0; k < TICKS_PER_DAY && (s.travellers ?? []).some((tr) => who.includes(tr.id)); k++) sim.step();
  assert.ok(!(s.travellers ?? []).some((tr) => who.includes(tr.id)), 'they walked on out of town');
});

test("nobody to keep it, no travellers: a shop with no shopkeeper stays shut", () => {
  const sim = new Sim(plainGame('shop-shut'));
  const s = sim.state;
  s.people[0].away = 999; // (the only person is off on an expedition)
  addBuilding(s, 'trading_post', camp(s) + 3);
  for (let k = 0; k < TICKS_PER_DAY; k++) sim.step();
  assert.equal((s.travellers ?? []).length, 0);
  assert.equal(s.coins ?? 0, 0);
});

test('with no fiber on the land, the town buys it from travellers, whatever it costs', () => {
  const sim = new Sim(plainGame('shop-fiber'));
  const s = sim.state;
  bareLand(s);
  addBuilding(s, 'trading_post', camp(s) + 3);
  addBuilding(s, 'stockpile', camp(s) - 6, { wood: 30, stone: 30 });
  s.coins = 6; // (not enough to keep a reserve back: fiber is essential)
  const want = shoppingList(s).find((w) => w.m === 'fiber');
  assert.ok(want?.essential, 'fiber is on the list, as something only travellers can sell');
  let t = 0;
  while (!(totalStock(s).fiber ?? 0) && t++ < 2 * TICKS_PER_DAY) sim.step();
  assert.ok((totalStock(s).fiber ?? 0) > 0, 'fiber bought');
  assert.ok((s.coins ?? 0) < 6 + 200, 'and paid for');
  assert.ok((s.coins ?? 0) >= 0, 'never into debt');
});

test('what it could gather itself, it buys only for a building it is waiting on, and keeps coins back', () => {
  const s = plainGame('shop-thrifty');
  addBuilding(s, 'trading_post', camp(s) + 3);
  s.coins = 5;
  // wood grows here: it isn't essential, and with no blueprint waiting on it the town doesn't buy it
  assert.ok(!shoppingList(s).some((w) => w.m === 'wood' && w.essential));
  assert.ok(!shoppingList(s).some((w) => w.m === 'wood'));
});

test('the shopkeeper sets out what the town makes: on the floor, clear of the counter, the door and each other', () => {
  const sim = new Sim(plainGame('shop-furnish'));
  const s = sim.state;
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  for (const f of FURNISHINGS) s.items[f.id] = 3;
  for (let k = 0; k < 40 * TICKS_PER_HOUR; k++) sim.step();
  const pieces = shop.shop!.pieces;
  assert.ok(pieces.length >= 6, `pieces ${pieces.length}`);
  const { cols, rows, counter, keeper, door } = shopLayout(shop.def);
  const used = new Set<string>();
  for (const p of pieces) {
    const f = ITEM_BY_ID[p.item].furnish!;
    for (let dx = 0; dx < f.w; dx++)
      for (let dy = 0; dy < f.h; dy++) {
        const x = p.x + dx;
        const y = p.y + dy;
        assert.ok(x >= 0 && y >= 0 && x < cols && y < rows, 'on the floor');
        for (const r of [counter, keeper]) assert.ok(!(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h), 'not on the counter');
        assert.ok(!(x === door && y >= rows - 2), 'the door is kept clear');
        assert.ok(!used.has(`${x},${y}`), 'no two pieces overlap');
        used.add(`${x},${y}`);
      }
  }
  // with a full floor, the better pieces replace the poorer
  assert.ok(pieces.every((p) => ITEM_BY_ID[p.item].furnish!.appeal >= 2), JSON.stringify(pieces.map((p) => p.item)));
});

test('a better-furnished shop draws more travellers', () => {
  const visits = (furnish: boolean) => {
    const sim = new Sim(plainGame('shop-appeal'));
    const s = sim.state;
    const shop = addBuilding(s, 'trading_post', camp(s) + 3);
    if (furnish) shop.shop = { pieces: [{ item: 'trestle_table', x: 0, y: 1 }, { item: 'plank_shelf', x: 0, y: 0 }, { item: 'herb_planter', x: 5, y: 3 }, { item: 'clay_urns', x: 5, y: 2 }, { item: 'trestle_table', x: 3, y: 2 }] };
    let seen = 0;
    for (let k = 0; k < 4 * TICKS_PER_DAY; k++) {
      const before = s.nextTravellerTick;
      sim.step();
      if (before !== undefined && s.nextTravellerTick !== before) seen++;
    }
    return { seen, appeal: appeal(shop) };
  };
  const bare = visits(false);
  const nice = visits(true);
  assert.ok(nice.appeal > bare.appeal);
  assert.ok(nice.seen > bare.seen, `bare ${bare.seen}, furnished ${nice.seen}`);
});

test('a second piece just like one already out adds half its appeal', () => {
  const s = plainGame('shop-variety');
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  shop.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }] };
  const one = appeal(shop);
  shop.shop.pieces.push({ item: 'plank_shelf', x: 0, y: 3 });
  assert.equal(appeal(shop) - one, Math.round(ITEM_BY_ID.plank_shelf.furnish!.appeal / 2));
});

test('rebuilt bigger, the shop keeps its furnishings, and what no longer fits goes back to be set out again', () => {
  const sim = new Sim(plainGame('shop-grow'));
  const s = sim.state;
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  shop.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }, { item: 'crate_stand', x: 5, y: 3 }] };
  shop.def = 'general_store'; // (as if the upgrade just finished: 8 x 5, the counter further along)
  shop.shop.pieces.push({ item: 'crate_stand', x: 5, y: 1 }); // (right where the bigger shop's counter now stands)
  for (let k = 0; k < 2 * TICKS_PER_HOUR; k++) sim.step();
  assert.ok(shop.shop.pieces.some((p) => p.item === 'plank_shelf' && p.x === 0 && p.y === 0), 'kept where it was');
  const { counter } = shopLayout('general_store');
  assert.ok(!shop.shop.pieces.some((p) => p.x >= counter.x && p.x < counter.x + counter.w && p.y === counter.y), 'nothing left on the counter');
  assert.equal(shop.shop.pieces.filter((p) => p.item === 'crate_stand').length + (s.items.crate_stand ?? 0), 2, 'the stand that was in the way is set out again or waiting in the stores');
});

test('the planner: with the land out of fiber, it studies Barter and builds a Trading Post, and then its homes get built', () => {
  const s = newGame('shop-plan', { biome: 'desert' });
  const back = generateWorld(s.seed, s.biome).back;
  bareLand(s);
  s.research.done.push('fire_keeping', 'basic_shelter', 'flint_knapping', 'foraging');
  s.buildings[0].store = { wood: 25, stone: 25, berries: 5 };
  s.tick = PLAN_TICKS * 10;
  runPlanner(s, back);
  assert.equal(s.research.queue[0], 'barter', `researching ${s.research.queue.join(', ')}`);
  assert.match(s.plan!.research!.why, /fiber/);
  s.research.done.push('barter');
  s.research.queue = [];
  s.tick += PLAN_TICKS;
  runPlanner(s, back);
  const post = s.buildings.find((b) => b.def === 'trading_post');
  assert.ok(post, 'a Trading Post planned');
  assert.match(s.plan!.build!.why, /fiber/);
  // built and open: now a lean-to (which needs fiber) is worth starting
  post!.status = 'done';
  post!.progress = 1;
  s.tick += PLAN_TICKS;
  runPlanner(s, back);
  assert.ok(s.buildings.some((b) => b.def === 'lean_to'), s.buildings.map((b) => b.def).join(','));
});

test('the shop sells only what is spare: food beyond several days, never the totem, nothing a blueprint needs', () => {
  const s = plainGame('shop-spare');
  addBuilding(s, 'stockpile', camp(s) - 6, { wood: 100, berries: 4, totem: 1 });
  const spare = forSale(s);
  assert.ok((spare.wood ?? 0) > 0);
  assert.equal(spare.berries, undefined, 'food short: none of it is for sale');
  assert.equal(spare.totem, undefined);
});

test('old saves (from before the shop) load and play on, with an empty purse', () => {
  const s = plainGame('shop-old-save');
  const text = serialize(s, 1000);
  const raw = JSON.parse(text);
  for (const k of ['coins', 'travellers', 'nextTravellerTick', 'shopLog']) delete raw.state[k];
  const r = parseSave(JSON.stringify(raw));
  assert.ok(r.ok);
  if (!r.ok) return;
  const sim = new Sim(r.save.state);
  for (let k = 0; k < TICKS_PER_HOUR; k++) sim.step();
  const snap = snapshot(sim.state);
  assert.equal(snap.coins, 0);
  assert.equal(snap.shop, null);
  assert.deepEqual(snap.travellers, []);
});

test('the shop window: layout, furnishings and the log reach the snapshot', () => {
  const sim = new Sim(plainGame('shop-view'));
  const s = sim.state;
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  shop.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }] };
  sim.step();
  const v = snapshot(s).shop!;
  assert.equal(v.name, BUILDING_BY_ID.trading_post.name);
  assert.equal(v.cols, 6);
  assert.equal(v.pieces[0].kind, 'shelf');
  assert.ok(spotFor(shop, ITEM_BY_ID.crate_stand), 'room for more');
});

test('left alone in the desert, a town builds a shop, furnishes it, and earns coins', () => {
  const sim = new Sim(newGame('d3', { biome: 'desert' }));
  const s = sim.state;
  for (let t = 0; t < 12 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const shop = s.buildings.find((b) => b.def === 'trading_post');
  assert.ok(shop, 'a Trading Post');
  assert.ok((shop!.shop?.pieces.length ?? 0) >= 1, 'something set out in it');
  assert.ok(s.shopLog?.length, 'travellers have come by');
});
