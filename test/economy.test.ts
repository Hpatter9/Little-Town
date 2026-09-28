import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { MAX_QUALITY, qualityMult, rollQuality, typicalQuality } from '../src/shared/data/quality';
import { addItems, equipAll, gearEffects, qualitiesOf, takeItem } from '../src/shared/sim/crafting';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { appeal, tavernOf } from '../src/shared/sim/shop';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { buyGear, nightOut, payWages, wageBill } from '../src/shared/sim/wages';
import { Rng } from '../src/shared/rng';
import { generateWorld } from '../src/shared/world';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function addBuilding(s: GameState, def: string, tile: number, store = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store };
  s.buildings.push(b);
  return b;
}

/* ------------------------------------------------------------ quality */

test('a master crafter makes finer things than a novice, and the finest stay rare', () => {
  const rng = new Rng(7);
  const roll = (level: number) => Array.from({ length: 2000 }, () => rollQuality(rng, level));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const novice = roll(1);
  const master = roll(20);
  assert.ok(avg(master) > avg(novice) + 3, `${avg(novice)} vs ${avg(master)}`);
  assert.ok(novice.every((q) => q <= 3), 'a novice never makes anything Epic');
  assert.ok(master.some((q) => q === MAX_QUALITY), 'a master now and then makes something Divine');
  assert.ok(master.filter((q) => q === MAX_QUALITY).length < master.length * 0.1, 'but rarely');
  assert.ok(typicalQuality(20) > typicalQuality(10) && typicalQuality(10) > typicalQuality(1));
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

test('wages come out of the town purse, never more than half of it on one payday', () => {
  const s = plainGame('wages-pay');
  addBuilding(s, 'trading_post', camp(s) + 3);
  s.coins = 1000;
  payWages(s);
  assert.equal(s.coins, 1000 - wageBill(s));
  assert.ok((s.people[0].coins ?? 0) > 0);
  s.coins = 2; // (a poor town pays what it can)
  payWages(s);
  assert.ok(s.coins >= 1);
});

test('venues start bare, and the town only commissions a furnishing it can pay for; the crafter is paid for it', () => {
  const s = plainGame('bare-venue');
  s.autopilot = true;
  s.research.done.push('barter', 'hospitality', 'flint_knapping', 'fire_keeping', 'foraging');
  const shop = addBuilding(s, 'trading_post', camp(s) + 3);
  addBuilding(s, 'workbench', camp(s) - 4);
  addBuilding(s, 'stockpile', camp(s) - 8, { wood: 200, stone: 100, berries: 200 });
  assert.equal(appeal(shop), 0, 'bare');
  const back = generateWorld(s.seed).back;
  s.coins = 0;
  s.tick = PLAN_TICKS * 40;
  runPlanner(s, back);
  assert.ok(!s.crafting.some((o) => ITEM_BY_ID[o.item].furnish), 'no coins, no furniture');
  s.coins = 500;
  s.tick += PLAN_TICKS;
  runPlanner(s, back);
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
  const sim = new Sim(plainGame('tavern-guests'));
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
  inn.operator = s.people[0].id;
  addItems(s, 'herb_tea', 3, 1);
  const p = s.people[0];
  p.coins = 50;
  p.morale = 50;
  s.coins = 0;
  nightOut(s);
  assert.ok(p.coins < 50 && (s.coins ?? 0) > 0);
  assert.ok(p.morale > 50);
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
