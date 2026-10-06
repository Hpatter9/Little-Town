// Dynasties and legacy: a town that has stood a while becomes a legend; a descendant founds the next with its
// heirloom, coin and renown, and the line counts its generations.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inherit, legendOf, INHERIT_COINS, LEGEND_LEAST_HOURS } from '../src/shared/sim/legacy';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { UNIQUES } from '../src/shared/data/uniques';
import { plainGame } from './helpers';

test('a town only just begun is not remembered', () => {
  const s = plainGame('legend-young');
  s.tick = (LEGEND_LEAST_HOURS - 1) * TICKS_PER_HOUR;
  assert.equal(legendOf(s, 0), null);
});

test('a town becomes a legend, and its descendant inherits the heirloom, coin and the line', () => {
  const s = plainGame('legend-old');
  s.tick = 12 * TICKS_PER_DAY;
  const unique = UNIQUES[0].id;
  s.people[0].gear.weapon = unique;
  const l = legendOf(s, 123)!;
  assert.ok(l, 'remembered');
  assert.equal(l.days, 12);
  assert.equal(l.fate, 'retired');
  assert.equal(l.heirloom, unique);
  assert.equal(l.generation, 1);
  assert.ok(l.heroes.length >= 1);

  const next = newGame('legend-next');
  const coins = next.coins ?? 0;
  inherit(next, l);
  assert.equal(next.items[unique], 1, 'the heirloom came down');
  assert.equal(next.coins, coins + INHERIT_COINS);
  assert.equal(next.lineage?.founder, l.founder);
  assert.ok(next.notices.some((n) => /line/.test(n.text)));
  // and the line goes on
  next.tick = 3 * TICKS_PER_DAY;
  next.gameOver = { text: 'fell', won: false } as never;
  const l2 = legendOf(next, 456)!;
  assert.equal(l2.generation, 2);
  assert.equal(l2.fate, 'fell');
  assert.equal(l2.of, `${l.founder}'s line`, "the line is named for its first founder");
});
