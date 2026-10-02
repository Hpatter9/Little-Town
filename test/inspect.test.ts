import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

test('the inspect page sees how someone fights, and their kit, and keeps up with their gear', () => {
  const s = plainGame('inspect');
  const p = s.people[0];
  p.cls = 'mage';
  p.level = 20;
  const bare = snapshot(s).people[0];
  assert.ok(bare.battle.damage[1] >= bare.battle.damage[0] && bare.battle.damage[0] >= 0);
  assert.ok(bare.kit.some((a) => a.spell), 'a mage of level 20 keeps spells ready');
  assert.equal(bare.battle.armor, 0, 'no armour on');

  p.cls = 'knight';
  p.gear.body = 'hide_armor';
  const dressed = snapshot(s).people[0];
  assert.ok(dressed.battle.armor > 0, 'the armour counts');
});
