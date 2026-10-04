import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TAVERN_BASE, TAVERN_PER_LEVEL } from '../src/shared/data/operators';
import { killPerson } from '../src/shared/sim/health';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type Building, type GameState, type Person, campCell } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { mood } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { plainGame, row, campPx } from './helpers';

const camp = (s: GameState) => campCell(s).x;
function villager(s: GameState, social: number): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campPx(s), s.people.map((q) => q.name));
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
  const tavern: Building = { id: s.nextId++, def: 'tavern', tile: camp(s) + 4, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
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

test('town jobs: the best crafter holds the smithy, works its orders first and faster, and others leave them while the smith is free', () => {
  const sim = new Sim(plainGame('jobs'));
  const s = sim.state;
  s.cheats.unlockAll = true;
  const smith = villager(s, 2);
  smith.skills.crafting.level = 8;
  const hand = villager(s, 2);
  hand.skills.crafting.level = 3;
  for (const p of s.people) {
    p.priorities = { haul: 3, construct: 3, farm: 3, craft: 1, research: 3, gather: 3, defend: 0 };
    p.autoPriorities = false;
  }
  const smithy: Building = { id: s.nextId++, def: 'smithy', tile: camp(s) + 4, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(smithy);
  s.buildings[0].store = { iron: 20, wood: 20, stone: 20, leather: 10 };
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(smithy.operator, smith.id, 'the best crafter is the smith');
  sim.command({ type: 'queueCraft', item: 'iron_axe' });
  for (let i = 0; i < 20; i++) sim.step();
  const order = s.crafting[0];
  assert.ok(order, 'the order stands');
  const onIt = s.people.filter((p) => p.task?.type === 'craft' && p.task.order === order.id);
  assert.deepEqual(onIt.map((p) => p.id), [smith.id], 'only the smith takes it');
});
