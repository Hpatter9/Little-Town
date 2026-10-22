import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PARTS, partsOf } from '../src/shared/data/chains';
import { ITEM_BY_ID, ITEMS } from '../src/shared/data/items';
import { chainCost, chainMakeable, nextStep } from '../src/shared/sim/chains';
import { buyRare, stallCap, stallPrice, stallView } from '../src/shared/sim/rareStall';
import { parseSave, serialize } from '../src/shared/sim/save';
import { priceOf } from '../src/shared/sim/prices';
import { MATERIALS } from '../src/shared/data/materials';
import { totalStock, storages } from '../src/shared/sim/buildings';
import { type Building, type GameState } from '../src/shared/sim/state';
import { plainGame, row } from './helpers';

const FOOD_PARTS = ['pastry', 'cheese_wheel', 'broth', 'sausage', 'preserves'];
const fare = ITEMS.filter((i) => i.fare);

function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

test('food parts are made from raw food at a kitchen station, and the better dishes use them', () => {
  for (const id of FOOD_PARTS) {
    const p = ITEM_BY_ID[id];
    assert.ok(p?.part && PARTS.includes(p), id);
    assert.ok(Object.keys(p.cost).every((m) => (MATERIALS as readonly string[]).includes(m)), `${id} from raw food`);
  }
  for (const id of ['fruit_tart', 'meat_pie', 'cheese_pie', 'sausage_roll', 'jam_tart', 'ploughmans_plate']) assert.ok(partsOf(ITEM_BY_ID[id]).length >= 1, id);
  // a pie's whole chain is raw food: milk, flour, meat, herbs
  const raw = Object.keys(chainCost({ items: {} } as unknown as GameState, ITEM_BY_ID.cheese_pie));
  assert.ok(['flour', 'milk'].every((m) => raw.includes(m)), raw.join());
});

test('plain fare stays makeable from raw food, without any part', () => {
  const plain = fare.filter((i) => partsOf(i).length === 0);
  for (const id of ['roast_meat', 'porridge', 'berry_bowl', 'fried_eggs', 'herb_tea', 'vegetable_soup', 'ale', 'stew', 'goat_cheese']) assert.ok(plain.includes(ITEM_BY_ID[id]), id);
  for (const i of plain) assert.deepEqual(Object.keys(i.items ?? {}), [], i.id);
  // the tavern's staples are the early ones: at least a drink, a hearty meal and a sweet need no part
  for (const kind of ['hearty', 'sweet', 'drink']) assert.ok(plain.some((i) => i.fare!.kind === kind), kind);
});

test('a dish whose parts are missing is made by first queueing its parts, down to the raw food', () => {
  const s = plainGame('food-chain');
  s.cheats.unlockAll = true;
  addBuilding(s, 'bakery', 5);
  const tart = ITEM_BY_ID.jam_tart;
  assert.ok(chainMakeable(s, tart, { flour: 9, milk: 9, fruit: 9 }) || !chainMakeable(s, tart, {}), 'sanity');
  const step = nextStep(s, tart, { flour: 9, milk: 9, fruit: 9 });
  assert.ok(step && step.id !== 'jam_tart', 'a part comes first');
  s.items.pastry = 1;
  s.items.preserves = 1;
  assert.equal(nextStep(s, tart, {})?.id, 'jam_tart', 'with the parts in hand, the dish itself');
});

/* ------------------------------------------------------------ the traders' stall */

function stallTown(era: GameState['era'] = 'medieval'): GameState {
  const s = plainGame('rare-stall');
  s.era = era;
  s.cheats.unlockAll = true;
  addBuilding(s, 'market', 6);
  s.coins = 5000;
  return s;
}

test('with a market, the traders sell the early rare inputs in small amounts, at a high price', () => {
  const s = stallTown();
  const lines = stallView(s);
  assert.ok(lines.length > 0);
  for (const l of lines) {
    assert.ok(l.left >= 1 && l.left <= 6, `${l.m} ${l.left}`);
    assert.ok(l.price >= priceOf(s, l.m) * 2, `${l.m} dear`);
  }
  assert.ok(!lines.some((l) => l.m === 'gems'), 'no gems before the Industrial age and trade');
  // (same season, same stock)
  assert.deepEqual(stallView(s), lines);
});

test('no market, no stall; a later age with trade brings more', () => {
  const bare = plainGame('rare-bare');
  bare.era = 'medieval';
  assert.deepEqual(stallView(bare), []);
  const early = stallTown('medieval');
  const late = stallTown('industrial');
  assert.ok(stallCap(late, 'silver') >= 1);
  assert.ok(stallCap(late, 'gems') >= stallCap(early, 'gems'));
});

test('buying a rare input costs the purse, fills the stores, and runs the stall down', () => {
  const s = stallTown();
  addBuilding(s, 'granary', 12);
  const line = stallView(s)[0];
  const before = s.coins!;
  const have = totalStock(s)[line.m] ?? 0;
  assert.ok(storages(s).length > 0);
  assert.equal(buyRare(s, line.m, 1, 'town'), true);
  assert.equal(s.coins, before - stallPrice(s, line.m));
  assert.equal(totalStock(s)[line.m], have + 1);
  assert.equal(stallView(s).find((l) => l.m === line.m)?.left ?? 0, line.left - 1);
  // the most the stall holds, then no more
  for (let i = 0; i < 10; i++) buyRare(s, line.m, 1, 'town');
  assert.equal(stallView(s).find((l) => l.m === line.m), undefined);
  assert.equal(buyRare(s, line.m, 1, 'town'), false);
  // a poor purse can't buy
  const t = stallTown();
  t.coins = 0;
  assert.equal(buyRare(t, stallView(t)[0].m, 1, 'town'), false);
  // it comes back next season
  s.tick += 10 * 10 * 600 * 24 + 1;
  assert.ok(stallView(s).length > 0);
});

test('an old save without the stall record loads and plays', () => {
  const s = stallTown();
  assert.equal(s.rareSold, undefined);
  const back = parseSave(serialize(s, 1));
  assert.ok(back.ok);
  if (back.ok) assert.ok(stallView(back.save.state).length > 0);
});
