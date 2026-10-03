import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANYONE, lineFor, NATURE_BY_ID, NATURES, natureFit, natureOf, TOPICS } from '../src/shared/data/natures';
import { newGame } from '../src/shared/sim/state';
import { workFactor } from '../src/shared/sim/townsfolk';

test('fourteen natures, each with a name, a line and something to say on most topics; everyone has one', () => {
  assert.equal(NATURES.length, 14);
  for (const n of NATURES) {
    assert.ok(n.name && n.line, n.id);
    const topics = TOPICS.filter((t) => (n.say[t]?.length ?? 0) > 0).length;
    assert.ok(topics >= 14, `${n.id} speaks on ${topics} topics`);
    for (const t of TOPICS) assert.ok(lineFor(n, t, 3).length > 0);
    for (const l of n.likes) assert.ok(NATURE_BY_ID[l], `${n.id} likes ${l}`);
    for (const l of n.clashes) assert.ok(NATURE_BY_ID[l], `${n.id} clashes ${l}`);
  }
  for (const t of TOPICS) assert.ok(ANYONE[t].length);
  // spread: a hundred ids land on every nature, and the same id always gets the same one
  const seen = new Set<string>();
  for (let id = 1; id <= 100; id++) seen.add(natureOf({ id }).id);
  assert.equal(seen.size, NATURES.length);
  assert.equal(natureOf({ id: 42 }), natureOf({ id: 42 }));
  assert.equal(natureOf({ id: 42, nature: 'grumpy' }).id, 'grumpy');
});

test('like warms to like and clashing natures grate; a nature sets a pace', () => {
  assert.ok(natureFit(NATURE_BY_ID.cheerful, NATURE_BY_ID.jolly) > 0);
  assert.ok(natureFit(NATURE_BY_ID.cheerful, NATURE_BY_ID.gloomy) < 0);
  assert.ok(natureFit(NATURE_BY_ID.shy, NATURE_BY_ID.shy) > 0);
  const s = newGame('natures');
  const p = s.people[0];
  p.nature = 'stern';
  const stern = workFactor(s, p);
  p.nature = 'dreamy';
  assert.ok(stern > workFactor(s, p), 'the stern work faster than the dreamy');
});
