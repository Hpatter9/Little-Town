import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MARK_CLEAR_CAP, parseCommand } from '../src/shared/sim/commands';
import { isMarked } from '../src/shared/sim/land';
import { bestGatherTile } from '../src/shared/sim/people';
import { Sim } from '../src/shared/sim/sim';
import { camp, clearAround, makeWild, plainGame } from './helpers';

test('markClear marks wild cells, skips bare ground, and unmarks', () => {
  const sim = new Sim(plainGame('mark-clear'));
  const s = sim.state;
  clearAround(s, 20);
  const c = camp(s);
  const a = makeWild(s, c.x + 5, c.y + 5, 'forest', { wood: 5 });
  const b = makeWild(s, c.x + 6, c.y + 5, 'rock', { stone: 5 });
  const bare = (c.y + 8) * s.land.w + c.x + 5;
  sim.command({ type: 'markClear', cells: [a, b, bare], on: true });
  sim.step();
  assert.ok(isMarked(s.land, a) && isMarked(s.land, b), 'wild cells marked');
  assert.ok(!isMarked(s.land, bare), 'bare ground is not');
  sim.command({ type: 'markClear', cells: [a], on: false });
  sim.step();
  assert.ok(!isMarked(s.land, a) && isMarked(s.land, b), 'only the named cell unmarked');
});

test('a drag is capped, and the old toggleGather still works', () => {
  assert.equal(parseCommand({ type: 'markClear', cells: Array(MARK_CLEAR_CAP + 1).fill(1), on: true }), null);
  assert.ok(parseCommand({ type: 'markClear', cells: [1, 2], on: true }));
  const sim = new Sim(plainGame('mark-cap'));
  const s = sim.state;
  clearAround(s, 20);
  const c = camp(s);
  const cells: number[] = [];
  for (let i = 0; i < MARK_CLEAR_CAP + 20; i++) cells.push(makeWild(s, c.x + 3 + (i % 20), c.y + 3 + Math.floor(i / 20), 'forest', { wood: 3 }));
  sim.command({ type: 'markClear', cells, on: true });
  sim.step();
  assert.equal(s.land.marked.length, MARK_CLEAR_CAP, 'only the first cap-ful');
  sim.command({ type: 'toggleGather', cell: cells[MARK_CLEAR_CAP + 1] });
  sim.step();
  assert.ok(isMarked(s.land, cells[MARK_CLEAR_CAP + 1]));
});

test('gatherers go to the marked cell, and its mark goes when it is bare', () => {
  const sim = new Sim(plainGame('mark-go'));
  const s = sim.state;
  clearAround(s, 20);
  const c = camp(s);
  const far = makeWild(s, c.x + 9, c.y + 6, 'forest', { wood: 2 });
  makeWild(s, c.x + 2, c.y + 6, 'forest', { wood: 2 }); // (nearer, but not marked)
  sim.command({ type: 'markClear', cells: [far], on: true });
  sim.step();
  assert.equal(bestGatherTile(s, s.people[0]), far);
  for (let i = 0; i < 600 * 30 && isMarked(s.land, far); i++) sim.step();
  assert.ok(!isMarked(s.land, far), 'unmarked once bare');
  assert.equal(s.land.pools[far], undefined);
});
