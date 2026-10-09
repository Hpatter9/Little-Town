import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BLOOM_AT, BLOOM_DAYS, GROVE_HOUR } from '../src/shared/data/grove';
import { kinship } from '../src/shared/data/kinship';
import { realm } from '../src/shared/sim/factions';
import { groveMorning, groveOf } from '../src/shared/sim/grove';
import { stakeClaim, frontierOf, frontierHourly } from '../src/shared/sim/frontier';
import { CLAIMS_MOST, FRONTIER_HOUR, TAMED_TRICKS } from '../src/shared/data/frontier';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

test('old grudges and friendships between the peoples set a power\'s goodwill', () => {
  assert.ok(kinship('vampire', 'werewolf').value < 0);
  assert.equal(kinship('werewolf', 'vampire').value, kinship('vampire', 'werewolf').value, 'both ways');
  assert.equal(kinship('settlers', 'lich').value, 0);
  const s = plainGame('kin-realm');
  s.origin = 'vampire';
  for (const f of realm(s)) if (f.id === 'werewolf') assert.ok(f.attitude < 0);
});

test('the druids win when the grove is held high for ten mornings', () => {
  const s = plainGame('win-grove');
  s.origin = 'druid';
  s.autopilot = true;
  s.tick = at(5, GROVE_HOUR);
  const g = groveOf(s)!;
  for (let i = 0; i < BLOOM_DAYS; i++) {
    g.favour = BLOOM_AT + 15;
    groveMorning(s, g);
  }
  assert.ok(s.gameOver?.won);
});

test('the settlers win when the frontier is tamed', () => {
  const s = plainGame('win-frontier');
  s.autopilot = true;
  s.tick = at(5, FRONTIER_HOUR);
  const f = frontierOf(s)!;
  for (let i = 0; i < CLAIMS_MOST; i++) stakeClaim(s, f);
  f.tricks = ['dwarves', 'fae', 'druid', 'knights'].slice(0, TAMED_TRICKS) as never;
  assert.equal(f.claims.length, CLAIMS_MOST);
  frontierHourly(s);
  assert.ok(s.gameOver?.won);
});
