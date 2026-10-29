import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREATURE_SAGA_DEF } from '../src/shared/data/creatureSaga';
import { Rng } from '../src/shared/rng';
import { sagaText } from '../src/shared/sim/sagas';
import { campXY, makePerson, type SagaRun } from '../src/shared/sim/state';
import { plainGame, put, row } from './helpers';

const run = { run: 1, id: CREATURE_SAGA_DEF.id, ch: 'first_deed', at: 0, log: [] } as unknown as SagaRun;
const words = (ch: string) => {
  const c = CREATURE_SAGA_DEF.chapters[ch] as { text: string; options?: { label: string }[] };
  return [c.text, ...(c.options ?? []).map((o) => o.label)];
};

test('the creature saga speaks of gardens and children only when the town has them', () => {
  const s = plainGame('saga-fit');
  const said = (ch: string) => words(ch).map((w) => sagaText(s, run, w)).join(' ');
  // a new town: no fields, no children
  assert.doesNotMatch(said('first_deed'), /cabbage|garden/);
  assert.match(said('first_deed'), /churned mud/);
  assert.doesNotMatch(said('growing'), /children/);
  assert.doesNotMatch(said('grown_good'), /children/);
  for (const ch of ['first_deed', 'growing', 'grown_good']) assert.doesNotMatch(said(ch), /\[\[|\]\]|\{|\}/, `no markup left (${ch})`);
  // a grown one: a field and a child
  put(s, 'garden_plot', campXY(s).x / 32 + 6, row(s));
  const kid = makePerson(new Rng(9), s.nextId++, 'child', campXY(s), []);
  s.people.push(kid);
  assert.match(said('first_deed'), /trampled cabbages/);
  assert.match(said('first_deed'), /keep out of the gardens/);
  assert.match(said('growing'), /the children climb on it/);
  assert.match(said('grown_good'), /The children ride it/);
});
