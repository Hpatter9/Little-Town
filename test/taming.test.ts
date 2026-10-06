// Taming isn't sure (data/taming.ts): the tamer against the beast, its kind, its hurt, and the tries before.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tameChance, tamedMost, tamerPower, TAME_LEAST, TAME_MOST } from '../src/shared/data/taming';

test('a novice rarely tames a wild, strong beast; a master often tames a hurt wolf; never sure', () => {
  const novice = tamerPower(3, 0, 2);
  const master = tamerPower(60, 3, 40);
  const dragonish = tameChance(novice, 'young_dragon', 300, 300, 0);
  const wolf = tameChance(master, 'wolf', 40, 10, 0);
  assert.ok(dragonish <= 0.05, `novice vs a dragon's kind: ${dragonish}`);
  assert.ok(wolf >= 0.7 && wolf <= TAME_MOST, `master vs a hurt wolf: ${wolf}`);
  assert.ok(dragonish >= TAME_LEAST);
});

test('the same tamer finds a gentle kind easier than a wild one, a hurt beast easier, and a wary one harder', () => {
  const p = tamerPower(20, 1, 15);
  const fresh = tameChance(p, 'wolf', 80, 80, 0);
  assert.ok(tameChance(p, 'wolf', 80, 80, 0) > tameChance(p, 'manticore', 80, 80, 0), 'a wolf over a manticore');
  assert.ok(tameChance(p, 'wolf', 80, 20, 0) > fresh, 'hurt is easier');
  assert.ok(tameChance(p, 'wolf', 80, 80, 2) < fresh, 'tried twice, it grows wary');
  assert.ok(tameChance(p, 'wolf', 200, 200, 0) < fresh, 'a mightier beast (a seasoned raid) is harder');
});

test('a tamer holds more beasts as their calling grows', () => {
  assert.equal(tamedMost(0), 1);
  assert.ok(tamedMost(4) > tamedMost(0));
});
