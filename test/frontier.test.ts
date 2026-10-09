import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { FRONTIER_HOUR, TRICKS } from '../src/shared/data/frontier';
import { Rng } from '../src/shared/rng';
import { totalStock } from '../src/shared/sim/buildings';
import { frontierHourly, frontierOf, learnTricks, stakeClaim, teach } from '../src/shared/sim/frontier';
import { markMult } from '../src/shared/sim/origin';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function frontier(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.tick = at(5, FRONTIER_HOUR);
  return s;
}

test('a stranger of another people teaches the settlers their trick, and their trade', () => {
  const s = frontier('fr-trick');
  const f = frontierOf(s)!;
  const rng = new Rng(2);
  const c = s.people[0];
  const dwarf = makePerson(rng, s.nextId++, 'crafter', { x: c.x, y: c.y }, s.people.map((q) => q.name));
  dwarf.origin = 'dwarves';
  dwarf.skills.construction.level = 20;
  s.people.push(dwarf);
  assert.deepEqual(learnTricks(s, f), ['dwarves']);
  frontierHourly(s);
  assert.ok(markMult(s, TRICKS.dwarves!.lever) > 1, 'the hold\'s stonecraft');
  assert.ok(teach(s, f) > 0, 'taught');
});

test('a claim is staked at the edge of the known land and homesteaded', () => {
  const s = frontier('fr-claim');
  const f = frontierOf(s)!;
  const open = s.land.open;
  const before = Object.values(totalStock(s)).reduce((a, b) => a + (b ?? 0), 0);
  const cl = stakeClaim(s, f);
  assert.ok(cl);
  assert.ok(s.land.open > open, 'the land reaches further');
  assert.ok(Object.values(totalStock(s)).reduce((a, b) => a + (b ?? 0), 0) > before, 'the first haul');
  assert.ok(snapshot(s).heritage?.frontier?.claims.length === 1);
  assert.equal(frontierOf({ ...s, origin: 'lich' } as GameState), null, 'only the settlers');
});
