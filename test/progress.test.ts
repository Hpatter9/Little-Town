import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fightShare, raidShare, tripLabel, tripShare } from '../src/renderer/fight/progress';

// The progress bars over a watched trip and fight, and the raid's battle bar.
test('a trip fills a third out, a third there (a delve by its rooms), a third home', () => {
  assert.equal(tripShare({ phase: 'out', phaseProgress: 0 }), 0);
  assert.equal(tripShare({ phase: 'out', phaseProgress: 1 }), 1 / 3);
  assert.equal(tripShare({ phase: 'work', phaseProgress: 0.5 }), 0.5);
  assert.equal(tripShare({ phase: 'work', phaseProgress: 0.9, delve: { room: 2, rooms: 8, cleared: false } }), (1 + 0.25) / 3);
  assert.equal(tripShare({ phase: 'work', phaseProgress: 0, delve: { room: 3, rooms: 8, cleared: true } }), 2 / 3);
  assert.equal(tripShare({ phase: 'back', phaseProgress: 1 }), 1);
  assert.match(tripLabel({ phase: 'out', phaseProgress: 0.3 }, 'the Bear Cave'), /On the way to the Bear Cave · 10%/);
});

test('a fight fills as the foes lose health; an assault counts the waves before as done', () => {
  const foes = [{ hp: 50, maxHp: 100, down: false }, { hp: 0, maxHp: 100, down: true }];
  assert.equal(fightShare(foes), 0.75);
  assert.equal(fightShare([{ hp: 100, maxHp: 100, down: false }]), 0);
  assert.equal(fightShare(foes, 2, 4), (1 + 0.75) / 4);
  assert.equal(raidShare(3, 1, 8), 0.5);
  assert.equal(raidShare(0, 0, 0), 0);
});
