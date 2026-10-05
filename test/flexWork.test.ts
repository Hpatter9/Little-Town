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

test("the bar over someone's head shows how far along their work is, and only while they're at it", async () => {
  const { snapshot } = await import('../src/shared/sim/snapshot');
  const { put, camp } = await import('./helpers');
  const s = plainGame('workbar');
  const site = put(s, 'stockpile', camp(s).x + 3, camp(s).y + 3);
  site.status = 'blueprint';
  site.progress = 0.4;
  const p = s.people[0];
  p.task = { type: 'build', building: site.id };
  p.activity = 'build';
  assert.equal(snapshot(s).people[0].taskDone, 0.4);
  p.activity = 'walk'; // (on the way: no bar)
  assert.equal(snapshot(s).people[0].taskDone, null);
});

test('every calling says what it is, how it fights and its role', async () => {
  const { CLASS_ABOUT, ROLE_ABOUT } = await import('../src/shared/data/classAbout');
  const { CLASS_DEFS, CLASSES } = await import('../src/shared/data/classes');
  for (const c of CLASSES) {
    assert.ok(CLASS_ABOUT[c].what.length > 40 && CLASS_ABOUT[c].fights.length > 40, c);
    assert.ok(ROLE_ABOUT[CLASS_DEFS[c].role], c);
  }
});

test('everyone has a short story of their own', async () => {
  const { snapshot } = await import('../src/shared/sim/snapshot');
  const { makePerson } = await import('../src/shared/sim/state');
  const { Rng } = await import('../src/shared/rng');
  const s = plainGame('stories');
  const rng = new Rng(9);
  for (let i = 0; i < 40; i++) s.people.push(makePerson(rng, s.nextId++, ['wanderer', 'hunter', 'crafter', 'gatherer', 'hermit'][i % 5], s.people[0], s.people.map((p) => p.name)));
  const stories = snapshot(s).people.map((p) => p.story);
  assert.ok(stories.every((t) => t.length > 60), 'each a few sentences');
  assert.ok(new Set(stories).size === stories.length, 'no two alike');
});
