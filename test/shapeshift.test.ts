import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGE_LEVELS } from '../src/shared/data/classes';
import { beastForm, shapeshifts } from '../src/shared/data/levels';
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

// The Shapeshifter calling: a greater beast at every stage, wolf to wyvern.
test('a shapeshifter changes shape at every stage: wolf, lion, bear, drake, wyvern', () => {
  const s = plainGame('shift2');
  const p = s.people[0];
  p.cls = 'shapeshifter';
  const seen = STAGE_LEVELS.map((lv) => {
    p.level = lv;
    assert.ok(shapeshifts(p), 'always in a beast\'s shape');
    return beastForm(p)!.name;
  });
  assert.deepEqual(seen, ['wolf', 'lion', 'bear', 'drake', 'wyvern']);
  assert.ok(!personFighter(p, 'fighter', 'front').ranged, 'tooth and claw');
  p.cls = 'druid';
  p.level = STAGE_LEVELS[4];
  assert.equal(beastForm(p)!.name, 'bear', 'a druid keeps to the bear');
});
