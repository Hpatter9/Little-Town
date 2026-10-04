import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RETIRE_COINS, RETIRE_TRIPS } from '../src/shared/data/ambitions';
import { KEEPER_CUT } from '../src/shared/data/economy';
import { ambitionOf, bookTakings, businessPrice, buyBusinesses, homeFromTrip, settleAmbitions, takeSale } from '../src/shared/sim/ambition';
import { type Building, type GameState } from '../src/shared/sim/state';
import { camp, plainGame, row } from './helpers';

function addBuilding(s: GameState, def: string, tile: number, extra: Partial<Building> = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {}, ...extra };
  s.buildings.push(b);
  return b;
}
const clone = (s: GameState, name: string) => {
  const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name, coins: 0, pay: undefined, partner: null, ambition: undefined };
  s.people.push(p);
  return p;
};

test('everyone grown has an ambition, decided once and kept', () => {
  const s = plainGame('amb');
  for (let i = 0; i < 12; i++) clone(s, `F${i}`);
  settleAmbitions(s);
  assert.ok(s.people.every((p) => p.ambition));
  const kinds = new Set(s.people.map((p) => p.ambition));
  assert.ok(kinds.size >= 3, `a mix of ambitions (${[...kinds].join(', ')})`);
  const p = s.people[3];
  const was = p.ambition;
  p.skills.research.level = 90;
  assert.equal(ambitionOf(p), was, 'kept once decided');
});

test('a keeper saves up and buys the town\'s shop at a price that counts its takings; then its takings are theirs', () => {
  const s = plainGame('biz');
  const shop = addBuilding(s, 'trading_post', camp(s).x + 3);
  s.coins = 0;
  const p = s.people[0];
  p.ambition = 'keeper';
  const cheap = businessPrice(s, shop);
  bookTakings(s, shop, 50);
  const dear = businessPrice(s, shop);
  assert.ok(dear > cheap + 400, `a busy shop is dear (${cheap} → ${dear})`);
  p.coins = dear - 1;
  buyBusinesses(s);
  assert.equal(shop.owner, undefined, 'a coin short');
  p.coins = dear;
  buyBusinesses(s);
  assert.equal(shop.owner, p.id);
  assert.equal(p.coins, 0);
  assert.equal(s.coins, dear, 'the founder sold it to the treasury\'s profit');
  assert.equal(shop.operator, p.id, 'they keep it themselves');
  // a sale goes to the owner; with someone else keeping it, the keeper's cut comes out of it
  takeSale(s, shop, 100, p, 'shop', 'a pedlar');
  assert.equal(p.coins, 100);
  assert.equal(s.coins, dear);
  const hand = clone(s, 'Hand');
  takeSale(s, shop, 100, hand, 'shop', 'a pedlar');
  assert.equal(hand.coins, Math.round(100 * KEEPER_CUT));
  assert.equal(p.coins, 200 - Math.round(100 * KEEPER_CUT));
});

test('an adventurer home from enough trips with a full purse settles down to keep a shop', () => {
  const s = plainGame('retire');
  const p = s.people[0];
  p.ambition = 'adventurer';
  p.coins = RETIRE_COINS * 5;
  for (let i = 0; i < RETIRE_TRIPS - 1; i++) homeFromTrip(s, p);
  assert.equal(p.ambition, 'adventurer');
  homeFromTrip(s, p);
  assert.equal(p.ambition, 'keeper');
});
