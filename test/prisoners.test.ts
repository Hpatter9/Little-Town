import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releasePrisoner, takePrisoners, updatePrisoners } from '../src/shared/sim/prisoners';
import type { Raider } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { freeSpot, plainGame, put } from './helpers';

const fallen = (kind: string, id: number): Raider => ({ id, kind, x: 0, y: 0, dir: 1, hp: 0, maxHp: 40, cooldown: 0, down: true, fleeing: false, gone: false, carrying: {}, lastAction: 0, lastHit: 0 });

test('fallen human raiders may be taken alive (never beasts); prisoners come round and join, or go free', () => {
  const s = plainGame('prisoners');
  // (a prison with cells enough: data/prisons.ts)
  const at = freeSpot(s, 'prison');
  put(s, 'prison', at.x, at.y);
  const rng = new Rng(4);
  let taken = 0;
  for (let i = 0; i < 20; i++) taken += takePrisoners(s, [fallen('bandit', 100 + i), fallen('wolf', 200 + i)], rng);
  assert.ok(taken > 3 && taken < 17, `${taken} of 20`);
  assert.ok(s.prisoners.every((p) => p.enemy === 'bandit'));

  const free = s.prisoners[0];
  releasePrisoner(s, free.id);
  assert.ok(!s.prisoners.includes(free));
  assert.equal(s.reputation, 1);

  // well fed, with no escapes on this seed, they all come round within ten days or so
  s.buildings[0].store = { bread: 200 };
  const people = s.people.length;
  const held = s.prisoners.length;
  for (let h = 1; h <= 12 * 24 && s.prisoners.length; h++) {
    s.tick = h * TICKS_PER_HOUR;
    updatePrisoners(s, rng);
  }
  assert.equal(s.prisoners.length, 0);
  const joined = s.people.length - people;
  const escaped = s.notices.filter((n) => n.text.includes('escaped')).length;
  assert.equal(joined + escaped, held);
  assert.ok(joined > 0);
  assert.ok(s.tick <= 12 * TICKS_PER_DAY);
});
