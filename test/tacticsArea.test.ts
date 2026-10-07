import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hit, heal } from '../src/shared/data/effects';
import type { KitAction } from '../src/shared/sim/actions';
import { aimTiles, areaOf, areaTiles } from '../src/shared/sim/tacticsArea';

const act = (name: string, effects: KitAction['effects'], spell = true, pool: KitAction['pool'] = 'mp'): KitAction => ({
  id: name.toLowerCase().replace(/ /g, '_'),
  name,
  spell,
  level: 1,
  cooldown: 0,
  ready: 0,
  effects,
  use: effects.some((e) => e.kind === 'heal') ? 'heal' : 'attack',
  cost: 0,
  pool,
});

test('every spell and skill has its own reach and area on the board, by what it does and what it is called', () => {
  assert.equal(areaOf(act('Spark', [hit(1, 'fire')])).shape, 'one', 'a single mark');
  assert.equal(areaOf(act('Fireball', [hit(1, 'fire')])).shape, 'cross', 'a burst on one foe spreads to those beside it');
  assert.equal(areaOf(act('Flame Wave', [hit(1, 'fire', 'foes')])).shape, 'square', 'a spell for many: a 3x3');
  assert.equal(areaOf(act('Ice Lance', [hit(1, 'ice')])).shape, 'line', 'a lance runs out in a line');
  assert.equal(areaOf(act('Whirlwind', [hit(1, 'physical', 'foes')], false, 'sp')).shape, 'ring', 'a whirl strikes all round');
  assert.equal(areaOf(act('Mend', [heal(1)])).shape, 'one');
  const strike = areaOf(act('Power Strike', [hit(1.4)], false, 'sp'), 4.5);
  assert.deepEqual([strike.shape, strike.max], ['one', 4], 'a weapon art goes as far as the weapon');
  const ult = areaOf(act('Meteor', [hit(2, 'fire', 'foes')], true, 'limit'));
  assert.deepEqual([ult.shape, ult.size], ['square', 2], 'an ultimate covers a 5x5');
});

test('the tiles an area touches and where it may be aimed', () => {
  const me = [5, 5] as const;
  assert.equal(areaTiles({ shape: 'square', size: 1, min: 2, max: 5 }, me, [8, 5], 20, 20).length, 9);
  assert.equal(areaTiles({ shape: 'cross', size: 1, min: 1, max: 5 }, me, [8, 5], 20, 20).length, 5);
  assert.equal(areaTiles({ shape: 'ring', size: 1, min: 0, max: 0 }, me, me, 20, 20).length, 8);
  const line = areaTiles({ shape: 'line', size: 4, min: 1, max: 1 }, me, [6, 5], 20, 20);
  assert.deepEqual(line, [[6, 5], [7, 5], [8, 5], [9, 5]], 'a line runs out from the user the way it is aimed');
  const aims = aimTiles({ shape: 'square', size: 1, min: 2, max: 3 }, me, 20, 20);
  assert.ok(aims.every(([u, v]) => Math.abs(u - 5) + Math.abs(v - 5) >= 2 && Math.abs(u - 5) + Math.abs(v - 5) <= 3), 'within its reach, not too near');
  assert.equal(aimTiles({ shape: 'line', size: 4, min: 1, max: 1 }, me, 20, 20).length, 4, 'a line is aimed by one of the four ways');
  assert.deepEqual(aimTiles({ shape: 'ring', size: 1, min: 0, max: 0 }, me, 20, 20), [me]);
  // (at the board's edge, only what's on it)
  assert.equal(areaTiles({ shape: 'square', size: 1, min: 0, max: 4 }, [0, 0], [0, 0], 20, 20).length, 4);
});
