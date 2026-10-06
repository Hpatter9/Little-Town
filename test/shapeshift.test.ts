import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGE_LEVELS } from '../src/shared/data/classes';
import { shapeshifts } from '../src/shared/data/levels';
import { personFighter } from '../src/shared/sim/combat';
import { defenderReach } from '../src/shared/sim/raids';
import { THROW_RANGE } from '../src/shared/data/raids';
import { plainGame } from './helpers';

// A druid who reaches the Shapeshifter stage fights as a bear: up close, tougher, harder hitting.
test('a druid takes a bear\'s shape from the Shapeshifter stage: holding the trail, tougher and fiercer', () => {
  const s = plainGame('shift');
  const p = s.people[0];
  p.cls = 'druid';
  p.level = STAGE_LEVELS[2] - 1;
  assert.ok(!shapeshifts(p), 'not yet');
  assert.equal(defenderReach(p), THROW_RANGE, 'a druid casts from afar');
  const before = personFighter(p, 'fighter', 'front');
  assert.ok(before.ranged);
  p.level = STAGE_LEVELS[2];
  assert.ok(shapeshifts(p));
  assert.notEqual(defenderReach(p), THROW_RANGE, 'a bear holds the trail');
  const after = personFighter(p, 'fighter', 'front');
  assert.ok(!after.ranged, 'tooth and claw');
  assert.ok(after.maxHp > before.maxHp, 'tougher');
  assert.ok(after.armor > before.armor, 'a thick hide');
});
