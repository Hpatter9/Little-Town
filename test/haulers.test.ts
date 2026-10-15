import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildableNow, deliveredShare } from '../src/shared/sim/buildings';
import { buildSkill } from '../src/shared/sim/property';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { Sim } from '../src/shared/sim/sim';
import { freeSpot, plainGame, priorities, put } from './helpers';
import { makePerson, maxHp } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';

// A builder works on with what's been brought, and the less skilled carry the rest to them.
test('a skilled builder builds while the unskilled haul', () => {
  const s = plainGame('haulers');
  const store = s.buildings.find((b) => b.store && (b.def === 'stockpile' || b.def === 'campfire'))!;
  store.store = { lumber: 40, stone: 30, cloth: 6 };
  const at = freeSpot(s, 'cottage');
  const site = put(s, 'cottage', at.x, at.y, { status: 'blueprint', progress: 0, delivered: { lumber: 7, stone: 4, cloth: 1 } });
  const need = buildSkill(BUILDING_BY_ID.cottage);
  const builder = s.people[0];
  builder.skills.construction.level = need + 2;
  builder.priorities = priorities({ haul: 2, construct: 2 });
  const hand = makePerson(new Rng(5), s.nextId++, 'hunter', builder, [builder.name]);
  hand.skills.construction.level = 0;
  hand.priorities = priorities({ haul: 2, construct: 2 });
  hand.hp = maxHp(hand);
  hand.needs = { food: 1, rest: 1 };
  hand.traits = [];
  s.people.push(hand);
  assert.ok(buildableNow(site), 'half the makings in: there is work for a builder');
  const sim = new Sim(s);
  let built = false;
  let hauled = false;
  for (let i = 0; i < 4000 && site.status === 'blueprint'; i++) {
    sim.step();
    if (builder.task?.type === 'build' && deliveredShare(site) < 1) built = true;
    if (hand.task?.type === 'fetch' || hand.task?.type === 'deliver') hauled = true;
    if (site.status === 'blueprint') assert.ok(site.progress <= deliveredShare(site) + 1e-9, 'the walls never outrun the makings');
  }
  assert.ok(built, 'the builder built before everything was in');
  assert.ok(hauled, 'the unskilled hand carried the makings');
});
