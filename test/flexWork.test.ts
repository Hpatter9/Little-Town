import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeAct, describePassive, SKILL_TEXT } from '../src/shared/data/describe';
import { ABILITIES } from '../src/shared/data/abilities';
import { SPELLS } from '../src/shared/data/spells';
import { SKILLS } from '../src/shared/data/skills';
import { battleSpeedNow, setGameSpeed } from '../src/shared/sim/battle';
import { autoPriorities, newGame } from '../src/shared/sim/state';
import { JOBS } from '../src/shared/data/people';
import { plainGame } from './helpers';

test('the founder turns their hand to anything: building and study never below normal, no job left off', () => {
  const s = newGame('flex');
  const f = s.people.find((p) => p.id === s.mainId)!;
  for (const k of ['construction', 'research'] as const) f.skills[k].level = 1;
  const pr = autoPriorities(f.skills, true);
  assert.ok(pr.construct <= 2 && pr.construct > 0);
  assert.ok(pr.research <= 2 && pr.research > 0);
  for (const j of JOBS) if (j !== 'defend') assert.notEqual(pr[j], 0, j);
  // (anyone else: what they're good at first, but never off, so nobody stands idle while there's work)
  const other = autoPriorities(f.skills, false);
  for (const j of JOBS) if (j !== 'defend') assert.notEqual(other[j], 0, j);
});

test('the town runs at 1, 2 or 3 times; a battle keeps its own speed', () => {
  const s = plainGame('speed');
  assert.equal(battleSpeedNow(s), 1);
  setGameSpeed(s, 3);
  assert.equal(battleSpeedNow(s), 3);
  setGameSpeed(s, 7);
  assert.equal(battleSpeedNow(s), 1, 'only 1, 2 or 3');
});

test('every skill, spell and fighting skill has words for what it does', () => {
  for (const k of SKILLS) assert.ok(SKILL_TEXT[k].length > 20, k);
  for (const sp of SPELLS) assert.ok(describeAct(sp.effects, sp.cooldown).length > 10, sp.id);
  for (const a of ABILITIES) {
    if (a.active) assert.ok(describeAct(a.active.effects, a.active.cooldown, a.ultimate).length > 10, a.id);
    if (a.passive) assert.ok(describePassive(a.passive).length > 8, a.id);
    assert.ok(!(a.active ? describeAct(a.active.effects) : '').includes('undefined'), a.id);
  }
});
