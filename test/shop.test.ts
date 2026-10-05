import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { ITEM_BY_ID, ITEMS } from '../src/shared/data/items';
import { FURNISHINGS } from '../src/shared/data/shop';
import { TOPICS } from '../src/shared/data/research';
import { totalStock } from '../src/shared/sim/buildings';
import { forSale, runPlanner, shoppingList, PLAN_TICKS, townWishes } from '../src/shared/sim/planner';
import { parseSave, serialize } from '../src/shared/sim/save';
import { appeal, fill, renownOf, shopLayout, spotFor } from '../src/shared/sim/shop';
import { BROWSE_HOURS, FILL_MAX } from '../src/shared/data/shop';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame, type Building, type GameState, type Want } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, plainGame, row } from './helpers';
import { cellAt, setGround } from '../src/shared/sim/land';

function addBuilding(s: GameState, def: string, tile: number, store = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store };
  s.buildings.push(b);
  return b;
}
/** The shop's log (newest last). */
const logOf = (s: GameState) => s.buildings.find((b) => b.def === 'trading_post' || b.def === 'general_store' || b.def === 'emporium')?.shop?.log ?? [];
/** Strangers of a tier on their way in are made to want something. */
function wanting(s: GameState, tier: number, want: Want): void {
  for (const t of s.travellers ?? []) if (t.phase === 'arriving' && (t.tier ?? 1) === tier) t.want = want;
}

/** Nothing wild left to gather: no fiber (or anything else) from the land. */
const bareLand = (s: GameState) => {
  for (const k of Object.keys(s.land.pools)) {
    const c = cellAt(s.land, Number(k));
    setGround(s.land, c.x, c.y, 'grass');
  }
};

test('travellers stop at an open shop, buy what the town has spare for coins, and walk on out of town', () => {
  const sim = new Sim(plainGame('shop-sell'));
  const s = sim.state;
  addBuilding(s, 'trading_post', camp(s).x + 3);
  addBuilding(s, 'stockpile', camp(s).x - 6, { stone: 90, clay: 40, berries: 3, totem: 1 });
  let t = 0;
  while (!(s.coins ?? 0) && t++ < 2 * TICKS_PER_DAY) sim.step();
  assert.ok((s.coins ?? 0) > 0, 'a traveller bought something');
  const stock = totalStock(s);
  assert.ok((stock.stone ?? 0) < 90 || (stock.clay ?? 0) < 40, 'spare stone or clay sold');
  assert.ok((stock.berries ?? 0) >= 3, 'food the town needs is never sold (short of it, the town buys more)');
  assert.equal(stock.totem, 1, 'the totem is never sold');
  assert.ok(logOf(s).some((l) => l.text.includes('bought')), 'the shop logs the sale');
  // they browse a while, then leave the map
  const who = (s.travellers ?? []).map((tr) => tr.id);
  for (let k = 0; k < TICKS_PER_DAY && (s.travellers ?? []).some((tr) => who.includes(tr.id)); k++) sim.step();
  assert.ok(!(s.travellers ?? []).some((tr) => who.includes(tr.id)), 'they walked on out of town');
});

test("nobody to keep it, no travellers: a shop with no shopkeeper stays shut", () => {
  const sim = new Sim(plainGame('shop-shut'));
  const s = sim.state;
  s.people[0].away = 999; // (the only person is off on an expedition)
  addBuilding(s, 'trading_post', camp(s).x + 3);
  for (let k = 0; k < TICKS_PER_DAY; k++) sim.step();
  assert.equal((s.travellers ?? []).length, 0);
  assert.equal(s.coins ?? 0, 0);
});

test('with no fiber on the land, the town buys it from travellers, whatever it costs', () => {
  const sim = new Sim(plainGame('shop-fiber'));
  const s = sim.state;
  bareLand(s);
  addBuilding(s, 'trading_post', camp(s).x + 3);
  addBuilding(s, 'stockpile', camp(s).x - 6, { wood: 30, stone: 30 });
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
  addBuilding(s, 'trading_post', camp(s).x + 3);
  s.coins = 5;
  // wood grows here: it isn't essential, and with no blueprint waiting on it the town doesn't buy it
  assert.ok(!shoppingList(s).some((w) => w.m === 'wood' && w.essential));
  assert.ok(!shoppingList(s).some((w) => w.m === 'wood'));
});

test('the shopkeeper sets out what the town makes: on the floor, clear of the counter, the door and each other', () => {
  const sim = new Sim(plainGame('shop-furnish'));
  const s = sim.state;
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  for (const f of FURNISHINGS) s.items[f.id] = 3;
  for (let k = 0; k < 40 * TICKS_PER_HOUR; k++) sim.step();
  const pieces = shop.shop!.pieces;
  assert.ok(pieces.length >= 6, `pieces ${pieces.length}`);
  const { cols, rows, counter, keeper, door } = shopLayout(shop);
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
    const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
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
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  shop.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }] };
  const one = appeal(shop);
  shop.shop.pieces.push({ item: 'plank_shelf', x: 0, y: 3 });
  assert.equal(appeal(shop) - one, Math.round(ITEM_BY_ID.plank_shelf.furnish!.appeal / 2));
});

test('rebuilt bigger, the shop keeps its furnishings, and what no longer fits goes back to be set out again', () => {
  const sim = new Sim(plainGame('shop-grow'));
  const s = sim.state;
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  shop.shop = { started: true, pieces: [{ item: 'plank_shelf', x: 0, y: 0 }, { item: 'crate_stand', x: 5, y: 3 }] };
  shop.def = 'general_store'; // (as if the upgrade just finished: 8 x 5, the counter further along)
  shop.shop.pieces.push({ item: 'crate_stand', x: 5, y: 1 }); // (right where the bigger shop's counter now stands)
  for (let k = 0; k < 2 * TICKS_PER_HOUR; k++) sim.step();
  assert.ok(shop.shop.pieces.some((p) => p.item === 'plank_shelf' && p.x === 0 && p.y === 0), 'kept where it was');
  const { counter } = shopLayout(shop);
  assert.ok(!shop.shop.pieces.some((p) => p.x >= counter.x && p.x < counter.x + counter.w && p.y === counter.y), 'nothing left on the counter');
  assert.equal(shop.shop.pieces.filter((p) => p.item === 'crate_stand').length + (s.items.crate_stand ?? 0), 2, 'the stand that was in the way is set out again or waiting in the stores');
});

test('the planner: with the land out of fiber, it studies Barter and builds a Trading Post, and then its homes get built', () => {
  const s = newGame('shop-plan', { biome: 'desert' });
  bareLand(s);
  s.research.done.push('fire_keeping', 'basic_shelter', 'flint_knapping', 'foraging');
  s.buildings[0].store = { wood: 25, stone: 25, berries: 5 };
  s.tick = PLAN_TICKS * 10;
  runPlanner(s);
  assert.equal(s.research.queue[0], 'barter', `researching ${s.research.queue.join(', ')}`);
  assert.match(s.plan!.research!.why, /fiber/);
  s.research.done.push('barter');
  s.research.queue = [];
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const post = s.buildings.find((b) => b.def === 'trading_post');
  assert.ok(post, 'a Trading Post planned');
  assert.match(s.plan!.build!.why, /fiber/);
  // built and open: now a lean-to (which needs fiber) is worth starting
  post!.status = 'done';
  post!.progress = 1;
  s.tick += PLAN_TICKS;
  runPlanner(s);
  assert.ok(s.buildings.some((b) => b.def === 'lean_to'), s.buildings.map((b) => b.def).join(','));
});

test('the shop sells only what is spare: food beyond several days, never the totem, nothing a blueprint needs', () => {
  const s = plainGame('shop-spare');
  addBuilding(s, 'stockpile', camp(s).x - 6, { wood: 100, berries: 4, totem: 1 });
  const spare = forSale(s);
  assert.ok((spare.wood ?? 0) > 0);
  assert.equal(spare.berries, undefined, 'food short: none of it is for sale');
  assert.equal(spare.totem, undefined);
});

test('old saves (from before the shop) load and play on, with an empty purse', () => {
  const s = plainGame('shop-old-save');
  const text = serialize(s, 1000);
  const raw = JSON.parse(text);
  for (const k of ['coins', 'travellers', 'nextTravellerTick', 'nextGuestTick', 'itemQ']) delete raw.state[k];
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
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  shop.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }] };
  sim.step();
  const v = snapshot(s).shop!;
  assert.equal(v.name, BUILDING_BY_ID.trading_post.name);
  assert.equal(v.cols, 8);
  assert.equal(v.pieces[0].kind, 'shelf');
  assert.ok(spotFor(shop, ITEM_BY_ID.crate_stand), 'room for more');
});

test('left alone in the desert, a town builds a shop, furnishes it, and earns coins', () => {
  const sim = new Sim(newGame('d3', { biome: 'desert' }));
  const s = sim.state;
  // (it starts bare, and every piece has to be paid for out of what travellers spend; a lone founder's town in the
  // sand, raided on the battle map, gets there in about three weeks)
  // (it stops as soon as there's a shop with something in it and travellers have come by: checked hourly)
  const ready = () => {
    const b = s.buildings.find((q) => q.def === 'trading_post' || q.def === 'general_store' || q.def === 'emporium');
    return !!b && (b.shop?.pieces.length ?? 0) >= 1 && logOf(s).length > 0;
  };
  for (let t = 0; t < 24 * TICKS_PER_DAY && !s.gameOver && (t % TICKS_PER_HOUR || !ready()); t++) sim.step();
  // (a quick town has rebuilt it as a General Store by then)
  const shop = s.buildings.find((b) => b.def === 'trading_post' || b.def === 'general_store' || b.def === 'emporium');
  assert.ok(shop, 'a Trading Post');
  assert.ok((shop!.shop?.pieces.length ?? 0) >= 1, 'something set out in it');
  assert.ok(logOf(s).length, 'travellers have come by');
});

/* ------------------------------------------------------------ attractiveness, customer tiers, wares */

/** A shop dressed up to draw a given crowd: its renown set so its attractiveness is at least `attract`. */
function grandShop(s: GameState, attract: number): Building {
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  shop.shop = { pieces: [], renown: attract };
  return shop;
}

test('an ordinary shop draws only ordinary travellers; an attractive one draws merchants and nobles too', () => {
  const tiersSeen = (attract: number) => {
    const sim = new Sim(plainGame('shop-tiers'));
    const s = sim.state;
    grandShop(s, attract);
    const seen = new Set<number>();
    for (let k = 0; k < 6 * TICKS_PER_DAY; k++) {
      sim.step();
      s.buildings.find((b) => b.def === 'trading_post')!.shop!.renown = attract; // (held steady: nobody's being satisfied here)
      for (const t of s.travellers ?? []) seen.add(t.tier ?? 1);
    }
    return seen;
  };
  assert.deepEqual([...tiersSeen(0)], [1]);
  const grand = tiersSeen(50);
  assert.ok(grand.has(2) && grand.has(3), `tiers ${[...grand]}`);
  assert.ok(!grand.has(4), 'magnates need a far grander shop');
});

test('a customer who finds a ware of their standing buys it and spreads the shop\'s renown; one who does not leaves disappointed', () => {
  const run = (stock: boolean) => {
    const sim = new Sim(plainGame('shop-renown'));
    const s = sim.state;
    s.era = 'medieval'; // (where satchels belong: purses to match)
    const shop = grandShop(s, 20); // (merchants come)
    if (stock) s.items.leather_satchel = 20;
    let merchants = 0;
    // (to the third merchant with wares to sell; to the first without, whose disappointment is then the latest news)
    for (let k = 0; k < 8 * TICKS_PER_DAY && merchants < (stock ? 3 : 1); k++) {
      const before = (s.travellers ?? []).filter((t) => t.phase === 'shopping' && t.tier === 2).length;
      wanting(s, 2, { kind: 'ware' }); // (merchants who came for fine goods)
      sim.step();
      if ((s.travellers ?? []).filter((t) => t.phase === 'shopping' && t.tier === 2).length > before) merchants++;
    }
    assert.ok(merchants >= 1, 'a merchant came');
    // (they look round first, and are served at the counter)
    for (let k = 0; k < (BROWSE_HOURS + 0.1) * TICKS_PER_HOUR; k++) sim.step();
    return { renown: renownOf(shop), left: s.items.leather_satchel ?? 0, coins: s.coins ?? 0, log: logOf(s) };
  };
  const happy = run(true);
  assert.ok(happy.left < 20, 'satchels sold');
  assert.ok(happy.renown > 20, `renown up (${happy.renown})`);
  const sad = run(false);
  assert.ok(sad.renown < 20, `renown down (${sad.renown})`);
  assert.ok(sad.log.some((l) => l.text.includes('disappointed')));
});

test('ordinary travellers never buy the finer wares; the grand buy the finest they can afford first', () => {
  const sim = new Sim(plainGame('shop-ware-tiers'));
  const s = sim.state;
  grandShop(s, 0);
  s.items.iron_brooch = 5;
  s.items.bone_trinket = 5;
  for (let k = 0; k < 3 * TICKS_PER_DAY; k++) {
    wanting(s, 1, { kind: 'ware' });
    sim.step();
  }
  assert.equal(s.items.iron_brooch, 5, 'no brooches for pedlars');
  assert.ok((s.items.bone_trinket ?? 0) < 5, 'trinkets sold');
});

test('coins go into the shop: a crowded floor is extended, and pieces are improved a level at a time', () => {
  const s = plainGame('shop-spend');
  s.autopilot = true;
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  const { cols, rows } = shopLayout(shop);
  // crates set out till the floor's as full as the keeper will have it (half of it: the rest is room to walk)
  shop.shop = { pieces: [] };
  for (let spot = spotFor(shop, ITEM_BY_ID.crate_stand); spot; spot = spotFor(shop, ITEM_BY_ID.crate_stand)) shop.shop.pieces.push({ item: 'crate_stand', ...spot });
  assert.ok(fill(shop) >= FILL_MAX && shop.shop.pieces.length < cols * rows * 0.6, `${shop.shop.pieces.length} of ${cols * rows}`);
  s.coins = 1000;
  s.tick = TICKS_PER_HOUR * 10; // (the planner spends on the hour)
  runPlanner(s);
  assert.equal(shop.shop.extensions, 1, 'extended');
  assert.equal(s.coins, 1000 - 60, 'paid for it');
  assert.equal(shopLayout(shop).cols, cols + 2);
  // not crowded now: next it improves the cheapest piece
  s.tick += TICKS_PER_HOUR;
  const before = appeal(shop);
  runPlanner(s);
  assert.ok(shop.shop.pieces.some((p) => p.level === 2), 'a piece improved');
  assert.ok(appeal(shop) >= before);
  // a poor town keeps its coins
  const poor = plainGame('shop-poor');
  poor.autopilot = true;
  const p2 = addBuilding(poor, 'trading_post', camp(poor).x + 3);
  p2.shop = { pieces: [{ item: 'plank_shelf', x: 0, y: 0 }] };
  poor.coins = 20;
  poor.tick = TICKS_PER_HOUR * 10;
  runPlanner(poor);
  assert.equal(poor.coins, 20);
});

test('an improved piece adds half its appeal again per level', () => {
  const s = plainGame('shop-levels');
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  shop.shop = { pieces: [{ item: 'trestle_table', x: 0, y: 1 }] };
  const base = appeal(shop);
  shop.shop.pieces[0].level = 3;
  assert.equal(appeal(shop) - base, ITEM_BY_ID.trestle_table.furnish!.appeal);
});

test('the town makes wares from what it has spare, never from what it can only buy', () => {
  const s = newGame('shop-wares', { biome: 'desert' });
  bareLand(s);
  s.research.done.push('fire_keeping', 'flint_knapping', 'foraging', 'cordage', 'barter', 'herbalism');
  addBuilding(s, 'trading_post', camp(s).x + 3);
  s.buildings[0].store = { fiber: 20, berries: 25, wood: 5 }; // (bought fiber: not to be woven into baskets)
  addBuilding(s, 'stockpile', camp(s).x - 8, { bone: 40, herbs: 40, meat: 20 });
  s.tick = PLAN_TICKS * 10;
  runPlanner(s);
  const wares = s.crafting.filter((o) => ITEM_BY_ID[o.item].ware).map((o) => o.item);
  assert.ok(wares.length === 1, `one ware at a time: ${wares}`);
  assert.notEqual(wares[0], 'reed_basket');
});

test('drawing customers it has no wares for, the town studies what makes them', () => {
  const s = newGame('shop-study');
  s.era = 'medieval';
  s.direction = 'trade';
  s.research.done = TOPICS.filter((t) => !t.era && !t.hidden && t.branch !== 'occult').map((t) => t.id).concat(['mining']);
  addBuilding(s, 'trading_post', camp(s).x + 3);
  s.buildings.find((b) => b.def === 'trading_post')!.shop = { pieces: [], renown: 50 }; // (nobles come: no noble's ware can be made yet)
  s.buildings[0].store = { wood: 25, stone: 25, berries: 25 };
  s.tick = PLAN_TICKS * 10;
  runPlanner(s);
  // (any topic that opens a noble's ware: Iron Working's brooch, or Weaving's gowns and dyed bolts since the workshops)
  assert.ok(s.research.queue.some((id) => ITEMS.some((i) => i.ware?.tier === 3 && i.research.includes(id))), `queue ${s.research.queue}`);
});

test('a specialty shop: its own customers come for its line, buy what the town has of it, and its stock is on show', () => {
  const sim = new Sim(plainGame('store-weapons'));
  const s = sim.state;
  const store = addBuilding(s, 'weapon_store', camp(s).x + 3);
  const blade = ITEMS.find((i) => i.slot === 'weapon' && !i.relic && !i.unique)!;
  s.items[blade.id] = 4;
  const view = snapshot(s).stores.find((v) => v.line === 'weapons');
  assert.ok(view, 'the store has its own view');
  assert.ok(view!.stock.some((p) => p.item === blade.id), 'the weapons in stock are on show');
  let t = 0;
  while (!(s.coins ?? 0) && t++ < 3 * TICKS_PER_DAY) sim.step();
  assert.ok((s.coins ?? 0) > 0, 'a customer bought something');
  assert.ok((s.items[blade.id] ?? 0) < 4, 'a weapon was sold');
  assert.ok((store.shop?.log ?? []).some((l) => /came for a weapon/.test(l.text)), 'they came for a weapon');
  assert.ok((s.travellers ?? []).every((tr) => tr.line === 'weapons'), 'only the store\'s own customers came (there is no general store)');
});

test('the planner opens a specialty shop once it has a general store, the craft and enough people', () => {
  const s = newGame('store-plan');
  s.research.done.push('barter', 'iron_working');
  addBuilding(s, 'trading_post', camp(s).x + 3);
  for (let i = 0; i < 6; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Helper ${i}`, partner: null });
  assert.ok(townWishes(s).some((w) => w.def === 'weapon_store'), 'a Weapons Store is wished for');
  s.people.splice(2);
  assert.ok(!townWishes(s).some((w) => w.def === 'weapon_store'), 'not in a town of two');
});
