import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TAVERN_BASE, TAVERN_PER_LEVEL } from '../src/shared/data/operators';
import { killPerson } from '../src/shared/sim/health';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { mood } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function villager(s: GameState, social: number): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', (camp(s) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = [];
  p.hp = maxHp(p);
  p.skills.social.level = social;
  s.people.push(p);
  return p;
}

test('the best-suited person runs the tavern, their skill sets its morale, and the player can switch them', () => {
  const sim = new Sim(plainGame('tavern'));
  const s = sim.state;
  s.people[0].skills.social.level = 1;
  const star = villager(s, 9);
  const other = villager(s, 3);
  const tavern: Building = { id: s.nextId++, def: 'tavern', tile: camp(s) + 4, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(tavern);
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(tavern.operator, star.id);
  const drink = (p: Person) => mood(s, p).reasons.find((r) => r.text === 'A drink at the tavern')!.value;
  assert.equal(drink(other), Math.round(TAVERN_BASE + 9 * TAVERN_PER_LEVEL));

  sim.command({ type: 'cycleOperator', building: tavern.id });
  sim.step();
  assert.equal(tavern.operator, other.id, 'next best');
  assert.equal(drink(star), Math.round(TAVERN_BASE + 3 * TAVERN_PER_LEVEL));

  killPerson(s, other, 'suddenly');
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(tavern.operator, star.id, 'filled again');
});
