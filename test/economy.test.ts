import { MAX_SKILL } from '../src/shared/data/skills';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { MAX_QUALITY, qualityMult, rollQuality, typicalQuality } from '../src/shared/data/quality';
import { addItems, equipAll, gearEffects, qualitiesOf, takeItem } from '../src/shared/sim/crafting';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { appeal, roomsOf, spotFor, tavernOf } from '../src/shared/sim/shop';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { type Building, type GameState, campCell } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { buyGear, TAVERN_NIGHT } from '../src/shared/sim/wages';
import { drinkAt, nightOut } from '../src/shared/sim/nightOut';
import { incomeOf, loadPrice, payFromTreasury, payParty } from '../src/shared/sim/economy';
import { TREASURY_KEEP } from '../src/shared/data/economy';
import { Rng } from '../src/shared/rng';
import { plainGame, row } from './helpers';

const camp = (s: GameState) => campCell(s).x;
function addBuilding(s: GameState, def: string, tile: number, store = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store };
  s.buildings.push(b);
  return b;
}

/* ------------------------------------------------------------ quality */

test('a master crafter makes finer things than a novice, and the finest stay rare', () => {
  const rng = new Rng(7);
  const roll = (level: number) => Array.from({ length: 2000 }, () => rollQuality(rng, level));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const novice = roll(1);
  const master = roll(MAX_SKILL);
  const journeyman = roll(20);
  assert.ok(avg(master) > avg(novice) + 1.5, `${avg(novice)} vs ${avg(master)}`);
  assert.ok(novice.every((q) => q <= 3), 'a novice never makes anything Epic');
  assert.ok(journeyman.every((q) => q <= 5) && journeyman.filter((q) => q >= 4).length < journeyman.length * 0.03, 'at level 20 an Epic is a rare day, and nothing finer comes');
  const many = Array.from({ length: 10 }, () => roll(MAX_SKILL)).flat(); // (20 000 pieces: a Divine is one in several thousand)
  assert.ok(many.some((q) => q === MAX_QUALITY), 'a master now and then makes something Divine');
  assert.ok(master.filter((q) => q === MAX_QUALITY).length < master.length * 0.03, 'but very rarely');
  assert.ok(typicalQuality(MAX_SKILL) > typicalQuality(20) && typicalQuality(20) > typicalQuality(1));
});

test("the inventory keeps each piece's quality: best first, and pieces used up elsewhere take the poorest", () => {
  const s = plainGame('quality-store');
  addItems(s, 'spear', 1, 2);
  addItems(s, 'spear', 1, 5);
  addItems(s, 'spear', 1, 0);
  assert.deepEqual(qualitiesOf(s, 'spear'), [5, 2, 0]);
  s.items.spear = 2; // (something used one up without a word about quality)
  assert.deepEqual(qualitiesOf(s, 'spear'), [5, 2]);
  assert.equal(takeItem(s, 'spear', 'best'), 5);
  assert.equal(s.items.spear, 1);
});

test('finer gear does more in a fight', () => {
  const s = plainGame('quality-gear');
  const p = s.people[0];
  p.gear = { weapon: 'spear' };
  p.gearQ = { weapon: 1 };
  const common = gearEffects(p).damage;
  p.gearQ = { weapon: 6 };
  assert.equal(gearEffects(p).damage, common * qualityMult(6));
});

/* ------------------------------------------------------------ money: wages, gear, bare venues */

test('before the town has money, gear is handed out; after, the townsfolk buy it with their wages', () => {
  const s = plainGame('wages-gear');
  const p = s.people[0];
  addItems(s, 'spear', 1, 3);
  equipAll(s);
  assert.equal(p.gear.weapon, 'spear', 'handed out: no shop yet');
  // a shop: now it's for sale
  addBuilding(s, 'trading_post', camp(s) + 3);
  addItems(s, 'fire_spear', 1, 3);
  equipAll(s);
  assert.equal(p.gear.weapon, 'spear', 'not handed out any more');
  p.coins = 0;
  buyGear(s);
  assert.equal(p.gear.weapon, 'spear', "can't afford it");
  p.coins = 500;
  s.coins = 0;
  buyGear(s);
  assert.equal(p.gear.weapon, 'fire_spear', 'bought it');
  assert.ok(p.coins < 500 && (s.coins ?? 0) > 0, 'the coins went to the town');
  assert.equal(s.items.spear, 1, 'the old spear went back into stock');
  assert.ok(p.recent?.some((r) => r.text.includes('Bought')), 'it shows on their card');
});

test('people earn by their work: a load sold to the stores, pay from the treasury above its keep, loot split among a party', () => {
  const s = plainGame('pay');
  addBuilding(s, 'trading_post', camp(s) + 3);
  const store = addBuilding(s, 'stockpile', camp(s) - 6);
  s.coins = 500;
  const p = s.people[0];
  p.carrying = { wood: 10 };
  p.task = { type: 'store', building: store.id };
  const sim = new Sim(s);
  for (let k = 0; k < 3 * TICKS_PER_HOUR && !(p.coins ?? 0); k++) sim.step();
  const price = loadPrice(s, { wood: 10 });
  assert.ok(price > 0);
  assert.equal(p.coins, price, 'the gatherer sold the load to the stores');
  assert.equal(s.coins, 500 - price, 'and the treasury paid');
  assert.equal(incomeOf(s, p).today, price);
  assert.ok(p.recent?.some((r) => /Sold 10 wood/.test(r.text)));
  // the treasury keeps a little back
  s.coins = 10;
  assert.equal(payFromTreasury(s, p, 50, 'wages'), 0);
  s.coins = TREASURY_KEEP + 5;
  assert.equal(payFromTreasury(s, p, 50, 'wages'), 5);
  // a party's spoils are split, the odd coin to the first
  const q = { ...p, id: 999, coins: 0, pay: undefined, recent: [] };
  const before = (p.coins ?? 0);
  payParty(s, [p, q], 7, 'Spoils');
  assert.equal((p.coins ?? 0) - before, 4);
  assert.equal(q.coins, 3);
});

test('venues start bare, and the town only commissions a furnishing it can pay for; the crafter is paid for it', () => {
  const s = plainGame('bare-venue');
  s.autopilot = true;
  s.research.done.push('barter', 'hospitality', 'flint_knapping', 'fire_keeping', 'foraging');
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  addBuilding(s, 'workbench', camp(s) - 4);
  addBuilding(s, 'stockpile', camp(s) - 8, { wood: 200, stone: 100, berries: 200 });
  assert.equal(appeal(shop), 0, 'bare');
  s.coins = 0;
  s.tick = PLAN_TICKS * 40;
  runPlanner(s);
  assert.ok(!s.crafting.some((o) => ITEM_BY_ID[o.item].furnish), 'no coins, no furniture');
  s.coins = 500;
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const order = s.crafting.find((o) => ITEM_BY_ID[o.item].furnish);
  assert.ok(order, 'a furnishing commissioned');
  assert.equal(order!.for?.venue, 'shop');
  assert.ok((order!.for?.pay ?? 0) > 0, 'with a price');
});

test("a crafter working a commission says who it's for, who asked, and the price; and is paid when it's done", () => {
  const sim = new Sim(plainGame('commission'));
  const s = sim.state;
  const crafter = s.people[0];
  crafter.priorities.craft = 1;
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  shop.operator = crafter.id; // (keeps the shop, and makes its shelf too)
  addBuilding(s, 'workbench', camp(s) - 4);
  addBuilding(s, 'stockpile', camp(s) - 8, { wood: 50 });
  s.research.done.push('barter');
  s.coins = 100;
  s.crafting.push({ id: s.nextId++, item: 'plank_shelf', count: 1, delivered: {}, itemsTaken: false, progress: 0, made: 0, for: { venue: 'shop', by: crafter.id, pay: 10 } });
  let doing = '';
  for (let k = 0; k < 6 * TICKS_PER_HOUR && s.crafting.length; k++) {
    sim.step();
    const d = snapshot(s).people[0].doing;
    if (d.startsWith('Crafting')) doing = d;
  }
  assert.match(doing, /Plank Shelf \(\d+%\) for the Trading Post, 10 coins/);
  assert.ok(crafter.recent?.some((r) => r.text.startsWith('Took an order')), (crafter.recent ?? []).map((r) => r.text).join(' | '));
  assert.ok(crafter.recent?.some((r) => r.text.startsWith('Was paid')), 'paid for it');
  assert.ok((crafter.coins ?? 0) > 0);
});

/* ------------------------------------------------------------ the tavern */

test('a tavern guest used to more comfort walks out; one it suits eats, and pays', () => {
  const sim = new Sim(plainGame('tavern-guests-3')); // (a seed that brings a guest or two used to nothing better)
  const s = sim.state;
  s.research.done.push('barter', 'hospitality');
  const inn = addBuilding(s, 'fireside_inn', camp(s) + 3);
  addItems(s, 'roast_meat', 20, 1);
  addItems(s, 'herb_tea', 20, 1);
  addItems(s, 'berry_bowl', 20, 1);
  let rough = 0;
  let served = 0;
  for (let k = 0; k < 5 * TICKS_PER_DAY; k++) {
    sim.step();
    for (const l of inn.shop?.log ?? []) {
      if (l.tick !== s.tick) continue;
      if (l.text.includes('too rough')) rough++;
      if (l.text.includes(': had the')) served++;
    }
  }
  assert.ok(served > 0, 'guests were fed');
  assert.ok(rough > 0, 'a bare inn is too rough for some');
  assert.ok((s.coins ?? 0) > 0);
  assert.ok(s.ledger?.today.tavern || s.ledger?.yesterday?.tavern, 'the ledger books it');
});

test('of an evening the townsfolk spend their wages at the tavern, and it cheers them', () => {
  const s = plainGame('night-out');
  addBuilding(s, 'trading_post', camp(s) + 3);
  const inn = addBuilding(s, 'fireside_inn', camp(s) - 6);
  const keeper = s.people[0];
  inn.operator = keeper.id;
  addItems(s, 'herb_tea', 3, 1);
  // (a second townsperson: the keeper stays behind the bar)
  const p = JSON.parse(JSON.stringify(keeper)) as typeof keeper;
  p.id = s.nextId++;
  p.name = 'Bo';
  p.task = null;
  p.nature = 'jolly'; // (the keenest: the roll by nature never keeps them home)
  s.people.push(p);
  p.coins = 50;
  p.morale = 50;
  p.needs.rest = 1;
  s.coins = 0;
  nightOut(s); // (they set out: sim/nightOut.ts)
  assert.ok(s.nightOut?.ids.includes(p.id), 'Bo goes out');
  assert.ok(!s.nightOut?.ids.includes(keeper.id), 'the keeper stays to serve');
  drinkAt(s, p); // (in at the door: the drink is bought)
  assert.ok(p.coins < 50 && (s.coins ?? 0) > 0);
  assert.ok(p.morale >= 50 + TAVERN_NIGHT - 0.01);
  assert.ok(tavernOf(s));
});

test('strangers have names of their own, a temper, and something they came for', () => {
  const sim = new Sim(plainGame('strangers'));
  const s = sim.state;
  addBuilding(s, 'trading_post', camp(s) + 3);
  for (let k = 0; k < 3 * TICKS_PER_DAY && !(s.travellers ?? []).length; k++) sim.step();
  const t = snapshot(s).travellers[0];
  assert.ok(t, 'someone came');
  assert.ok(!s.people.some((p) => p.name === t.name));
  assert.ok(t.wants.length > 0, 'they want something');
  assert.ok(t.purse > 0);
});

test('guests who come of an evening take a bed for the night and leave in the morning; with no beds they ask for one', () => {
  const run = (beds: boolean) => {
    const sim = new Sim(plainGame(beds ? 'lodging' : 'no-beds'));
    const s = sim.state;
    s.nextRaidTick = Number.MAX_SAFE_INTEGER; // (a raid sends lodgers off in the night)
    s.research.done.push('barter', 'hospitality');
    const inn = addBuilding(s, 'fireside_inn', camp(s) + 3);
    inn.shop = { started: true, pieces: beds ? [{ item: 'straw_pallet', x: 0, y: -1 }, { item: 'box_bed', x: 1, y: -1 }] : [] }; // (the starters would put a pallet in a room)
    for (const f of ['roast_meat', 'herb_tea', 'berry_bowl']) addItems(s, f, 40, 1);
    const lodgers = new Set<number>();
    const left = new Set<number>();
    let morning = true;
    let paid = false;
    let askedBed = 0;
    for (let k = 0; k < 10 * TICKS_PER_DAY; k++) {
      sim.step();
      // (the inn's log keeps only its latest lines: look as it goes)
      if (k % 600 === 0) paid ||= (inn.shop?.log ?? []).some((l) => l.text.includes('for the night ('));
      askedBed = Math.max(askedBed, inn.shop?.asked?.bed ?? 0); // (wants fade day by day)
      for (const t of s.travellers ?? []) {
        if (!t.bed) continue;
        lodgers.add(t.id);
        // (nobody with a bed walks off in the night: they set out in the morning)
        if (t.phase === 'leaving' && !left.has(t.id)) {
          left.add(t.id);
          if (calendar(s.tick).hour !== 7) morning = false;
        }
      }
    }
    const lodged = lodgers.size;
    return { s, inn, lodged, morning, paid, askedBed };
  };
  const withBeds = run(true);
  assert.ok(withBeds.lodged > 0, 'someone stayed the night');
  assert.ok(withBeds.morning, 'and left in the morning');
  assert.ok(withBeds.paid, 'and paid for it');
  const bare = run(false);
  assert.equal(bare.lodged, 0);
  assert.ok(bare.askedBed > 0, 'guests asked for a bed');
});

test('a tavern has guest rooms upstairs, one bed to a room, and more rooms as it is extended', () => {
  const s = plainGame('rooms');
  s.research.done.push('barter', 'hospitality');
  const inn = addBuilding(s, 'fireside_inn', camp(s) + 3);
  inn.shop = { pieces: [] };
  assert.equal(roomsOf(inn), 3);
  const bed = ITEM_BY_ID.straw_pallet;
  for (let x = 0; x < 3; x++) {
    assert.deepEqual(spotFor(inn, bed), { x, y: -1 });
    inn.shop.pieces.push({ item: 'straw_pallet', x, y: -1 });
  }
  assert.equal(spotFor(inn, bed), null, 'every room has its bed');
  assert.ok(spotFor(inn, ITEM_BY_ID.log_table), 'and the common room is still free for tables');
  inn.shop.extensions = 2; // (two cells wider each time: 13 cells, four rooms)
  assert.equal(roomsOf(inn), 4);
  assert.deepEqual(spotFor(inn, bed), { x: 3, y: -1 });
});
