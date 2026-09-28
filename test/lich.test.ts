import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { answerRite, LICH_YES, offerLichRite, watchLich } from '../src/shared/sim/occult';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { generateWorld } from '../src/shared/world';
import { plainGame } from './helpers';

test('Lichcraft learned: the founder is offered the rite, and the offer stays open on the Plan tab if put off', () => {
  const s = plainGame('lich-offer');
  s.research.done.push('lichcraft');
  offerLichRite(s);
  assert.ok(s.prompts.some((p) => p.title.includes('Phylactery')));
  assert.equal(snapshot(s).lichOffer, true);
  answerRite(s, 'Not yet');
  assert.ok(!s.lichChosen);
  assert.equal(snapshot(s).theme, 'town');
});

test('chosen: the town builds the phylactery first; once it stands the founder is a lich, and the game looks it', () => {
  const s = newGame('lich-build');
  s.era = 'medieval';
  s.research.done.push('lichcraft', 'fire_keeping');
  s.buildings[0].store = { bone: 30, iron: 10, herbs: 10, cloth: 5, wood: 20, stone: 20, berries: 20 };
  answerRite(s, LICH_YES);
  assert.ok(s.lichChosen);
  assert.equal(snapshot(s).lichOffer, false, 'no longer on offer');
  s.tick = PLAN_TICKS * 10;
  runPlanner(s, generateWorld(s.seed).back);
  const phylactery = s.buildings.find((b) => b.def === 'phylactery');
  assert.ok(phylactery, s.buildings.map((b) => b.def).join(','));
  assert.match(s.plan!.build!.why, /soul/);
  phylactery!.status = 'done';
  watchLich(s);
  assert.ok(s.lich);
  assert.equal(snapshot(s).theme, 'lich');
  // (for good, whatever becomes of the phylactery)
  s.buildings = s.buildings.filter((b) => b !== phylactery);
  assert.equal(snapshot(s).theme, 'lich');
});

test('the Become a lich command binds the soul (only once Lichcraft is learned)', () => {
  const sim = new Sim(plainGame('lich-command'));
  sim.command({ type: 'becomeLich' });
  sim.step();
  assert.ok(!sim.state.lichChosen, 'not without Lichcraft');
  sim.state.research.done.push('lichcraft');
  sim.command({ type: 'becomeLich' });
  sim.step();
  assert.ok(sim.state.lichChosen);
});
