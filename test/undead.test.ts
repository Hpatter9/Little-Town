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
  const run = (origin: 'lich' | 'settlers') => {
    const s = newGame(`undead-farm-${origin}`, { origin });
    s.nextRaidTick = Infinity;
    const sim = new Sim(s);
    for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
    return s;
  };
  const lich = run('lich');
  const settlers = run('settlers');
  assert.ok(foodFields(lich) <= 1, `the dead sow nothing for themselves (${foodFields(lich)})`);
  assert.ok(foodFields(settlers) > foodFields(lich), `the living do (${foodFields(settlers)})`);
});
