import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlights } from '../src/shared/sim/highlights';
import type { JournalEntry } from '../src/shared/sim/state';
import { plainGame } from './helpers';

const entry = (id: number, text: string, key = true): JournalEntry => ({ id, tick: id, text, ...(key ? { key: true as const } : {}) });

test('the report card shows the three biggest things: deaths first (together), then raids, then what was built', () => {
  const s = plainGame('cards');
  const name = s.people[0].name;
  const cards = highlights(s, [
    entry(1, 'Research complete: Pottery'),
    entry(2, 'Finished building: Kiln'),
    entry(3, 'Ada has died of the plague.'),
    entry(4, 'Raid by the bandits is over. They were driven off.'),
    entry(5, 'Bo has died in the raid.'),
    entry(6, `${name} joined the town.`),
    entry(7, 'Someone went for a walk.', false),
  ]);
  assert.equal(cards.length, 3);
  assert.equal(cards[0].text, '2 died: Ada, Bo');
  assert.match(cards[1].text, /^Raid by the bandits/);
  assert.equal(cards[2].text, `${name} joined the town.`);
  assert.equal(cards[2].person, s.people[0].id, 'shown as the newcomer');
  assert.ok(cards.every((c) => c.building || c.person !== undefined), 'each has a picture');
});

test('a quiet time away gives fewer cards, and none from notes that were not milestones', () => {
  const s = plainGame('quiet');
  assert.deepEqual(highlights(s, [entry(1, 'Something small.', false)]), []);
  const one = highlights(s, [entry(2, 'Finished building: Kiln')]);
  assert.equal(one.length, 1);
  assert.equal(one[0].building, 'kiln');
});
