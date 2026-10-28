import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { offerableTopics } from '../src/shared/sim/researchOffer';
import { carryCapacity } from '../src/shared/sim/state';
import { plainGame } from './helpers';

// The wheelbarrow as a study (the owner's ask): an early topic whose study lets everyone carry more.

test('the Wheelbarrow is an early study, offered once Woodcutting is learned', () => {
  const t = TOPIC_BY_ID.wheelbarrows;
  assert.ok(t, 'the topic exists');
  assert.equal(t.era ?? 'neolithic', 'neolithic');
  const s = plainGame('barrow-a');
  s.research.done = s.research.done.filter((id) => id !== 'woodcutting' && id !== 'wheelbarrows');
  assert.ok(!offerableTopics(s).includes('wheelbarrows'), 'not before Woodcutting');
  s.research.done.push('flint_knapping', 'woodcutting');
  assert.ok(offerableTopics(s).includes('wheelbarrows'), 'offered after Woodcutting');
});

test('studied, every hauler carries more', () => {
  const s = plainGame('barrow-b');
  const p = s.people[0];
  const before = carryCapacity(s, p);
  s.research.done.push('flint_knapping', 'woodcutting', 'wheelbarrows');
  assert.equal(carryCapacity(s, p), before + 5);
});
