// The fighting poses' sim side: a defender's blow is remembered the tick it's struck (whether or not it lands), and a
// raider's blow turned on armour or a shield is remembered as a block, so the views can show the blow and the guard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { attackPerson, defenderAttack, startRaid } from '../src/shared/sim/raids';
import { plainGame } from './helpers';

test('striking at a raider records the blow; a blow turned by a shield records the block', () => {
  const s = plainGame('poses');
  const p = s.people[0];
  p.hp = 1000;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(1));
  const rd = r.raiders[0];
  rd.x = p.x - 20;
  rd.y = p.y;
  assert.equal(p.lastBlow, undefined);
  s.tick += 5;
  defenderAttack(s, p, rd, new Rng(2));
  assert.equal(p.lastBlow, s.tick, 'the blow is remembered the tick it is struck');
  // a shield that turns a good share of blows: each one turned is a block, never a wound
  p.gear.offhand = 'order_shield';
  const rng = new Rng(3);
  let blocked = 0;
  for (let i = 0; i < 60; i++) {
    s.tick++;
    const before = p.hp;
    attackPerson(s, rd, p, rng);
    if (p.lastBlock === s.tick) {
      blocked++;
      assert.equal(p.hp, before, 'a blocked blow does no harm');
    }
  }
  assert.ok(blocked > 0, 'some blows were turned');
});
