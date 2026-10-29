import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restockKits } from '../src/shared/sim/kit';
import { addItems, TOOL_HOURS, wearTools } from '../src/shared/sim/crafting';
import { buyGear, buyKit } from '../src/shared/sim/wages';
import { loadPrice, mealPrice, payForMeal } from '../src/shared/sim/economy';
import { Sim } from '../src/shared/sim/sim';
import { campCell, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

// The coins balanced (docs/notes/economy-balance.md): battle items bought once the town uses coin, tools that wear
// out in a few weeks, and coins that flow back to the town.

/** A town as a real game holds it (the autopilot left out), with a warrior and, if asked, coin. */
function town(seed: string, coin: boolean): GameState {
  const s = plainGame(seed);
  delete s.autopilot;
  s.people[0].cls = 'warrior';
  if (coin) s.coins = 100;
  s.tick = TICKS_PER_HOUR;
  return s;
}

test('battle items: handed out free before the town uses coin, bought at the shop after', () => {
  const before = town('kit-free', false);
  addItems(before, 'healing_potion', 1);
  restockKits(before);
  assert.deepEqual(before.people[0].kit, ['healing_potion'], 'no coin yet: the stores hand it out');

  const after = town('kit-bought', true);
  addItems(after, 'healing_potion', 1);
  restockKits(after);
  assert.equal(after.people[0].kit?.length ?? 0, 0, 'a town with coin hands out nothing');
  assert.equal(after.items.healing_potion, 1, 'it stays on the shelf');
  const buyer = after.people[0];
  buyer.coins = 0;
  buyKit(after);
  assert.equal(buyer.kit?.length ?? 0, 0, 'no coins, no potion');
  buyer.coins = 50;
  const treasury = after.coins!;
  buyKit(after);
  assert.deepEqual(buyer.kit, ['healing_potion'], 'bought with their own coins');
  assert.ok(buyer.coins < 50, 'paid for');
  assert.equal(after.coins! - treasury, 50 - buyer.coins, 'the price goes to the treasury');
  assert.equal(after.items.healing_potion ?? 0, 0, 'off the shelf');
});

test('meals: a grown-up pays the stores for what they eat, in a town with coin; nobody goes hungry for want of it', () => {
  const s = town('meals', true);
  const p = s.people[0];
  p.coins = 10;
  const price = mealPrice(s, 'meat');
  assert.ok(price >= 1 && price < loadPrice(s, { meat: 1 }) + 2, `about what the stores paid for it (${price})`);
  assert.equal(payForMeal(s, p, 'meat'), price);
  assert.equal(p.coins, 10 - price);
  assert.equal(s.coins, 100 + price, 'to the treasury');
  assert.equal(s.ledger?.today.meals, price, 'on its own line of the ledger');
  p.coins = 0;
  assert.equal(payForMeal(s, p, 'meat'), 0, 'no coins: they eat on the town');
  const child = { ...p, id: 999, coins: 50, bornTick: 0 };
  assert.equal(payForMeal(s, child, 'meat'), 0, 'children eat free');
  const plain = town('meals-off', true);
  plain.autopilot = false;
  plain.people[0].coins = 50;
  assert.equal(payForMeal(plain, plain.people[0], 'meat'), 0, 'only with the autopilot');
  const early = town('meals-early', false);
  early.people[0].coins = 50;
  assert.equal(payForMeal(early, early.people[0], 'meat'), 0, 'not before the town uses coin');
});

test('meals: eating from the stores pays for the meal', () => {
  const s = town('meals-eat', true);
  const store = put(s, 'stockpile', campCell(s).x - 6);
  store.store = { berries: 5 };
  const p = s.people[0];
  p.coins = 20;
  p.needs.food = 0.1;
  p.task = { type: 'eat', building: store.id, until: null };
  const sim = new Sim(s);
  for (let k = 0; k < 2 * TICKS_PER_HOUR && store.store.berries === 5; k++) sim.step();
  assert.equal(store.store.berries, 4, 'a meal eaten');
  assert.equal(p.coins, 20 - mealPrice(s, 'berries'), 'and paid for');
});

test('tools: a working tool breaks in a few weeks of work, and in a town with coin the worker buys another', () => {
  // (someone at that work every day puts about a third of an hour's wear a day on their tool: the probe,
  // docs/notes/economy-balance.md)
  const days = TOOL_HOURS / 0.3;
  assert.ok(days >= 14 && days <= 21, `two to three weeks (${days.toFixed(1)} days)`);
  const s = town('tools', true);
  const p = s.people[0];
  p.gear.tool = 'stone_axe';
  p.gearQ = { tool: 1 };
  p.activity = 'chop';
  for (let h = 0; h < TOOL_HOURS; h++) wearTools(s);
  assert.equal(p.gear.tool, undefined, 'worn through');
  addItems(s, 'stone_axe', 1);
  p.coins = 30;
  buyGear(s);
  assert.equal(p.gear.tool, 'stone_axe', 'bought a new one at the shop');
  assert.ok(p.coins < 30);
});
