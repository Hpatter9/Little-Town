import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOOMS } from '../src/shared/data/doom';
import { doomGrowth, possibleDooms, updateDoom } from '../src/shared/sim/doom';
import { mood } from '../src/shared/sim/townsfolk';
import { type Building } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('a meltdown only threatens a Modern town with a power station; it sets the reactor alight, sickens the town and stops the fields', () => {
  const s = plainGame('meltdown');
  s.tick = 30 * TICKS_PER_DAY;
  s.era = 'modern';
  assert.ok(!possibleDooms(s).includes('meltdown'), 'no reactor, no meltdown');
  const reactor = { id: s.nextId++, def: 'power_station', tile: 110, status: 'done', delivered: {}, progress: 1, store: {} } as Building;
  s.buildings.push(reactor);
  assert.ok(possibleDooms(s).includes('meltdown'));
  s.doom = { kind: 'meltdown', phase: 'signs', untilTick: s.tick + TICKS_PER_HOUR };
  const rng = new Rng(1);
  const p = s.people[0];
  const hp = p.hp;
  for (let i = 0; i < 1 + 4; i++) {
    s.tick += TICKS_PER_HOUR;
    updateDoom(s, rng);
  }
  assert.equal(s.doom?.phase, 'active');
  assert.ok(reactor.fire !== undefined, 'the reactor burns');
  assert.equal(doomGrowth(s), 0);
  assert.ok(p.hp < hp - 4, `fallout sickness (${hp} -> ${p.hp})`);
  assert.ok(mood(s, p).reasons.some((r) => r.text === 'Fallout sickness'));
  assert.equal(DOOMS.meltdown.era, 'modern');
});

test("disasters that stop the food last as long in the Modern era as in the first (a ten-day ash winter would just be a famine)", () => {
  const s = plainGame('ash-modern');
  s.era = 'modern';
  s.tick = 30 * TICKS_PER_DAY;
  s.doom = { kind: 'ash_winter', phase: 'signs', untilTick: s.tick + TICKS_PER_HOUR };
  s.tick += TICKS_PER_HOUR;
  updateDoom(s, new Rng(1));
  const hours = (s.doom!.untilTick - s.tick) / TICKS_PER_HOUR;
  assert.ok(hours >= DOOMS.ash_winter.hours[0] && hours <= DOOMS.ash_winter.hours[1], `${hours}h`);
  // (others still stretch: a war lasts longer in the Modern era)
  s.doom = { kind: 'war', phase: 'signs', untilTick: s.tick + TICKS_PER_HOUR };
  s.tick += TICKS_PER_HOUR;
  updateDoom(s, new Rng(1));
  assert.ok((s.doom!.untilTick - s.tick) / TICKS_PER_HOUR > DOOMS.war.hours[1]);
});
