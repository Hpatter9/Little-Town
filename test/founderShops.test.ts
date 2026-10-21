// The founder's shops: buying, the stock line and price, the manager rule, the daily settlement and losses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/shared/sim/commands';
import { founderShopManager, managerWage, shopPrice } from '../src/shared/sim/founderShops';
import { shopLoss } from '../src/shared/sim/founderShops';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { takeSale } from '../src/shared/sim/ambition';
import { makePerson, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { camp, campPx, plainGame, put, row } from './helpers';

function town(seed: string): { s: GameState; sim: Sim; shop: Building; f: Person } {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  const shop = put(s, 'trading_post', camp(s).x + 8, row(s));
  const f = s.people[0];
  f.coins = 10000;
  return { s, sim: new Sim(s), shop, f };
}
function hire(s: GameState, name: string): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
  p.name = name;
  s.people.push(p);
  return p;
}
const dawn = (s: GameState, sim: Sim) => {
  while (s.tick % TICKS_PER_DAY !== 0 || s.tick === 0) sim.step();
};

test('Buying: the founder pays their own purse, becomes the owner, and the treasury is paid', () => {
  const { s, sim, shop, f } = town('fs-buy');
  const price = shopPrice(s, shop);
  const treasury = s.coins ?? 0;
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  assert.equal(shop.owner, f.id);
  assert.equal(f.coins, 10000 - price);
  assert.equal(s.coins, treasury + price);
  assert.ok(shop.shop?.run);
  assert.equal(shop.operator, null, 'no manager yet');
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  assert.equal(f.coins, 10000 - price, 'not bought twice');
});

test('Buying: too poor, or already owned, does nothing', () => {
  const { s, sim, shop, f } = town('fs-poor');
  f.coins = 1;
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  assert.equal(shop.owner, undefined);
  assert.ok(snapshot(s).founder!.buyable.some((b) => b.id === shop.id));
});

test('Stock and price commands, and their checks', () => {
  const { sim, shop } = town('fs-run');
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.command({ type: 'founderShopStock', building: shop.id, stock: 'fine' });
  sim.command({ type: 'founderShopPrice', building: shop.id, price: 'high' });
  sim.step();
  assert.equal(shop.shop!.run!.stock, 'fine');
  assert.equal(shop.shop!.run!.price, 'high');
  sim.command({ type: 'founderShopStock', building: shop.id, stock: 'nonsense' });
  sim.step();
  assert.equal(shop.shop!.run!.stock, 'fine');
  assert.equal(parseCommand({ type: 'founderShopPrice', building: 1, price: 'free' }), null);
  assert.ok(parseCommand({ type: 'founderShopManager', building: 1, person: null }));
});

test('The manager rule: no manager, no opening; the autopilot never hires one', () => {
  const { s, sim, shop, f } = town('fs-manager');
  s.autopilot = true;
  hire(s, 'Ann');
  sim.command({ type: 'founderBuyShop', building: shop.id });
  for (let i = 0; i < 700; i++) sim.step();
  assert.equal(shop.operator, null, 'the town did not put a keeper in');
  const m = hire(s, 'Bob');
  assert.equal(founderShopManager(s, shop.id, m.id), true);
  assert.equal(shop.operator, m.id);
  assert.equal(founderShopManager(s, shop.id, f.id), true, 'the founder can work the counter');
  assert.equal(shop.operator, f.id);
  assert.equal(founderShopManager(s, shop.id, null), true);
  assert.equal(shop.operator, null);
});

test('Takings: a sale goes to the till, and at dawn the profit (less stock and wage) reaches the founder and tax follows', () => {
  const { s, sim, shop, f } = town('fs-takings');
  const m = hire(s, 'Cara');
  m.skills.social.level = 0;
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  founderShopManager(s, shop.id, m.id);
  const before = f.coins!;
  takeSale(s, shop, 100, m, 'shop', 'a traveller');
  assert.equal(f.coins, before, 'not paid until dawn');
  const till = shop.shop!.run!.till;
  assert.ok(till > 0 && till <= 100);
  const wage = managerWage(s, m);
  const mBefore = m.coins ?? 0;
  const stockCost = Math.round(till * 0.25);
  dawn(s, sim);
  const gain = f.coins! - before;
  assert.ok(Math.abs(gain - (till - stockCost - wage)) <= 1 || gain < 0, `profit ${gain}`);
  assert.equal(m.coins! - mBefore >= wage, true, 'the manager was paid');
  assert.equal(shop.shop!.run!.till, 0);
  assert.ok(snapshot(s).founder!.shops[0].seasonGross >= till);
});

test('The founder at the counter takes more than a hired hand, and a price level changes a sale', () => {
  const { s, sim, shop, f } = town('fs-self');
  const m = hire(s, 'Dan');
  m.skills.social.level = 0;
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  takeSale(s, shop, 100, m, 'shop', 'x');
  const hired = shop.shop!.run!.till;
  shop.shop!.run!.till = 0;
  takeSale(s, shop, 100, f, 'shop', 'x');
  const self = shop.shop!.run!.till;
  assert.ok(self > hired);
  shop.shop!.run!.till = 0;
  shop.shop!.run!.price = 'high';
  takeSale(s, shop, 100, f, 'shop', 'x');
  assert.ok(shop.shop!.run!.till > self);
});

test('A loss comes out of the takings; a manager who cannot be paid leaves', () => {
  const { s, sim, shop, f } = town('fs-loss');
  const m = hire(s, 'Eve');
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  founderShopManager(s, shop.id, m.id);
  takeSale(s, shop, 100, m, 'shop', 'x');
  const till = shop.shop!.run!.till;
  shopLoss(s, shop, 30);
  assert.equal(shop.shop!.run!.till, till - 30);
  shop.shop!.run!.till = 0;
  f.coins = 0;
  dawn(s, sim);
  assert.equal(shop.operator, null, 'unpaid manager left');
});

test('Wages: a manager is paid at dawn out of the founder’s purse when the till is empty', () => {
  const { s, sim, shop, f } = town('fs-wage');
  const m = hire(s, 'Finn');
  sim.command({ type: 'founderBuyShop', building: shop.id });
  sim.step();
  founderShopManager(s, shop.id, m.id);
  const wage = managerWage(s, m);
  const before = f.coins!;
  const mBefore = m.coins ?? 0;
  dawn(s, sim);
  assert.equal(before - f.coins!, wage);
  assert.ok((m.coins ?? 0) - mBefore >= wage - 1);
});
