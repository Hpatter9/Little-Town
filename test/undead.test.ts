import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROPS } from '../src/shared/data/crops';
import { FOOD_VALUE } from '../src/shared/data/people';
import { Sim } from '../src/shared/sim/sim';
import { eatersOf, foodDaysFor, newGame, NO_EATERS_DAYS, tireless } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { keepKin, mood, wantsSleep } from '../src/shared/sim/townsfolk';

test('the lich is dead in body too: no hunger, no sleep, nobody in a lich town eats', () => {
  const s = newGame('undead-1', { origin: 'lich' });
  const lich = s.people.find((p) => p.id === s.mainId)!;
  assert.ok(lich.undying && tireless(lich), 'the lich');
  assert.ok(s.people.every((p) => tireless(p)), 'and all the town');
  assert.equal(eatersOf(s), 0);
  assert.equal(foodDaysFor(s, 0), NO_EATERS_DAYS, 'no food is never short');
  lich.needs.rest = 0.1;
  assert.ok(!wantsSleep(s, lich), 'the lich never sleeps');
  const reasons = mood(s, lich).reasons.map((r) => r.text);
  assert.ok(!reasons.some((t) => /Living among the dead|Hungry|Well fed|Tired|Rested/.test(t)), reasons.join(', '));
});

test('an older lich town\'s lich is made undying, and the raised are left neither hungry nor tired', () => {
  const s = newGame('undead-2', { origin: 'lich' });
  const lich = s.people.find((p) => p.id === s.mainId)!;
  delete lich.undying;
  const p = { ...s.people[1], id: 77, monster: null, needs: { food: 0.1, rest: 0.1 } } as (typeof s.people)[number];
  s.people.push(p);
  keepKin(s);
  assert.ok(lich.undying);
  assert.equal(p.monster, 'undead');
  assert.equal(p.needs.food, 1);
  assert.equal(p.needs.rest, 1);
});

test('a lich town sows a field at most (for its tavern\'s guests); a settlers\' town farms for its people', () => {
  const foodFields = (s: ReturnType<typeof newGame>) => s.buildings.filter((b) => CROPS[b.def] && FOOD_VALUE[CROPS[b.def].material]).length;
  const run = (origin: 'lich' | 'settlers', salt = '', days = 5) => {
    const s = newGame(`undead-farm-${origin}${salt}`, { origin });
    s.nextRaidTick = Infinity;
    const sim = new Sim(s);
    for (let t = 0; t < days * TICKS_PER_DAY; t++) sim.step();
    return s;
  };
  const lich = run('lich');
  // (how many fields a lone town has sown early on is the seed's luck: the better of two towns, by day 8)
  const sown = Math.max(foodFields(run('settlers', '-c', 8)), foodFields(run('settlers', '-e', 8)));
  assert.ok(foodFields(lich) <= 1, `the dead sow nothing for themselves (${foodFields(lich)})`);
  assert.ok(sown > foodFields(lich), `the living do (${sown})`);
});

test('the dead don\'t bleed out: struck down, they fall apart and pull themselves together, needing no healer or medkit', async () => {
  const { knockDown, heal, REFORM_HOURS } = await import('../src/shared/sim/health');
  const { TICKS_PER_HOUR } = await import('../src/shared/sim/time');
  const s = newGame('undead-bleed', { origin: 'lich' });
  s.items.medkit = 3;
  const p = s.people.find((q) => q.id !== s.mainId) ?? s.people[0];
  p.lastHit = s.tick;
  const blood = s.blood?.length ?? 0;
  knockDown(s, p);
  assert.ok(p.downed, 'down');
  assert.equal(p.downed!.bleedUntil, null, 'not bleeding');
  assert.equal(s.items.medkit, 3, 'no medkit spent');
  assert.equal(s.blood?.length ?? 0, blood, 'no blood');
  assert.ok(s.journal.some((j) => /falls apart|shuts down/.test(j.text)));
  let t = 0;
  for (; t < (REFORM_HOURS + 2) * TICKS_PER_HOUR && p.downed; t++) {
    s.tick++;
    heal(s, p);
  }
  assert.equal(p.downed, null, `risen again after ${(t / TICKS_PER_HOUR).toFixed(1)} hours`);
});
