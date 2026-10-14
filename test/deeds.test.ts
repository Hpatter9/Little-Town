import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEED_TITLES } from '../src/shared/data/deeds';
import { finishPiece } from '../src/shared/sim/crafting';
import { addDeed, awardDeedTitles, deedLines, deedTitles } from '../src/shared/sim/deeds';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

test('deeds count toward a ladder of titles, each taken once, with the news', () => {
  const s = plainGame('deeds-ladder');
  const p = s.people[0];
  const [first, second] = DEED_TITLES.built.steps;
  addDeed(p, 'built', first[0] - 1);
  awardDeedTitles(s);
  assert.ok(!(p.titles ?? []).includes(first[1]), 'not yet');
  addDeed(p, 'built');
  awardDeedTitles(s);
  awardDeedTitles(s);
  assert.deepEqual(p.titles!.filter((t) => t === first[1]), [first[1]], 'the first step, once');
  assert.ok(s.journal.some((j) => j.text.includes(first[1])));
  addDeed(p, 'built', second[0]);
  assert.ok(deedTitles(p).includes(second[1]));
  const line = deedLines(p).find((d) => d.label === DEED_TITLES.built.label)!;
  assert.equal(line.n, first[0] + second[0]);
});

test('a piece made is a crafting deed, and the People page carries the deeds', () => {
  const s = plainGame('deeds-craft');
  const p = s.people[0];
  finishPiece(s, { id: 1, item: 'spear', count: 1, delivered: {}, itemsTaken: true, progress: 1, made: 0 }, p);
  assert.equal(p.deeds?.crafted, 1);
  const view = snapshot(s).people.find((q) => q.id === p.id)!;
  assert.equal(view.deeds[0].label, DEED_TITLES.crafted.label);
});
