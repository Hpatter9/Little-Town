import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARD_PER_PEOPLE, TAX } from '../src/shared/data/economy';
import { giveCoins } from '../src/shared/sim/economy';
import { onShift } from '../src/shared/sim/people';
import { type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { assignGuards, collectTax, dawnRng, guardsOf, guardWage, payGuards } from '../src/shared/sim/treasury';
import { camp, plainGame, row } from './helpers';

function addBuilding(s: GameState, def: string, tile: number, extra: Partial<Building> = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {}, ...extra };
  s.buildings.push(b);
  return b;
}
const clone = (s: GameState, name: string) => {
  const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name, coins: 0, pay: undefined, partner: null, guard: undefined };
  s.people.push(p);
  return p;
};

test('tax at dawn takes a share of what each earned yesterday, at the rate the player set; heavy tax kept up drives people off', () => {
  const s = plainGame('tax');
  addBuilding(s, 'trading_post', camp(s).x + 3);
  s.coins = 0;
  const p = s.people[0];
  giveCoins(s, p, 40); // (today's income)
  s.tick += TICKS_PER_DAY; // (tomorrow's dawn: yesterday's income is 40)
  collectTax(s, dawnRng(s));
  assert.equal(p.coins, 40 - Math.round(40 * TAX.fair.share));
  assert.equal(s.coins, Math.round(40 * TAX.fair.share));
  // heavy, kept up a week: someone (never the founder) leaves
  s.tax = 'heavy';
  const q = clone(s, 'Hob');
  const r = clone(s, 'Nan');
  let left = false;
  for (let d = 0; d < 40 && !left; d++) {
    s.tick += TICKS_PER_DAY;
    collectTax(s, dawnRng(s));
    left = !s.people.includes(q) || !s.people.includes(r);
  }
  assert.ok(left, 'someone left over the heavy tax');
  assert.ok(s.people.includes(p), 'the founder stays');
  assert.equal(s.taxHeavySince !== undefined, true);
  s.tax = 'low';
  collectTax(s, dawnRng(s));
  assert.equal(s.taxHeavySince, undefined);
});

test('the treasury hires guards it can pay, one for every six grown-ups, pays them at dawn, and they keep watch without a barracks', () => {
  const s = plainGame('guards');
  addBuilding(s, 'trading_post', camp(s).x + 3);
  for (let i = 0; i < GUARD_PER_PEOPLE - 1; i++) clone(s, `Folk ${i}`);
  s.people[2].skills.melee.level = 9; // (the best fighter is hired)
  s.coins = 0;
  assignGuards(s);
  assert.equal(guardsOf(s).length, 0, 'no coins, no guard');
  s.coins = guardWage(s) * 3;
  assignGuards(s);
  assert.equal(guardsOf(s).length, 1);
  assert.equal(guardsOf(s)[0], s.people[2]);
  assert.ok(onShift(s, s.people[2]) || onShift({ ...s, tick: s.tick + 12 * TICKS_PER_HOUR } as GameState, s.people[2]), 'on watch by day or by night');
  const before = s.coins;
  payGuards(s);
  assert.equal(s.coins, before - guardWage(s));
  assert.equal(s.people[2].coins, guardWage(s));
  // unpaid two dawns running, they stand down
  s.coins = 0;
  payGuards(s);
  payGuards(s);
  assert.equal(guardsOf(s).length, 0);
});
