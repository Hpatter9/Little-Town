import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events';
import { raided } from '../src/shared/data/eventKit';
import { apply } from '../src/shared/sim/events';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

// The events that speak of "the last raid" wait for a raid to have come (the playthrough met "The standard" on day 2).
test('events about the last raid need a raid to have come', () => {
  const s = plainGame('raided-events');
  s.people.push(...Array.from({ length: 5 }, () => ({ ...s.people[0] })));
  for (const id of ['w_captured_standard', 'w_veteran_tale', 'w_war_trophy']) {
    const e = EVENT_BY_ID[id];
    assert.ok(e.when, `${id} has a condition`);
    assert.equal(e.when!(s), false, `${id} not before any raid`);
  }
  assert.equal(raided(s), false);
  s.raidRecap = {} as never;
  assert.equal(raided(s), true);
  assert.equal(EVENT_BY_ID.w_captured_standard.when!(s), true, 'after a raid it may come');
});

// An event's renown goes to the town's shops; a town with none was told "the shop's renown +2".
test('renown from an event is told only when the town has a shop', () => {
  const s = plainGame('renown-no-shop');
  const out: string[] = [];
  apply(s, [{ renown: 2 }], new Rng(1), undefined, out);
  assert.ok(!out.some((l) => /renown/.test(l)), out.join('; '));
});
