import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

test('the player can follow a townsperson (and stop); only the living can be followed', () => {
  const sim = new Sim(plainGame('follow'));
  const s = sim.state;
  const p = s.people[0];
  sim.command({ type: 'follow', person: p.id });
  sim.step();
  assert.equal(snapshot(s).hero, p.id);
  sim.command({ type: 'follow', person: 9999 });
  sim.step();
  assert.equal(snapshot(s).hero, null);
  sim.command({ type: 'follow', person: p.id });
  sim.command({ type: 'follow', person: null });
  sim.step();
  assert.equal(snapshot(s).hero, null);
});
