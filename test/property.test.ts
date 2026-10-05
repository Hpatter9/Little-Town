import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { BUILD_SKILL_BY_ERA } from '../src/shared/data/economy';
import { buildSkill, canWork, collectRent, skillPace, landPrice, materialsPrice, planHomes, rentOf } from '../src/shared/sim/property';
import { Sim } from '../src/shared/sim/sim';
import { type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { assignBeds } from '../src/shared/sim/townsfolk';
import { camp, clearAround, plainGame, row } from './helpers';

function addBuilding(s: GameState, def: string, tile: number, extra: Partial<Building> = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {}, ...extra };
  s.buildings.push(b);
  return b;
}

test('building needs skill: anyone lends a hand, the unskilled slower; the founder works any site at full pace', () => {
  const s = plainGame('skill');
  assert.equal(buildSkill(BUILDING_BY_ID.lean_to), BUILD_SKILL_BY_ERA.neolithic);
  assert.ok(buildSkill(BUILDING_BY_ID.cottage) >= BUILD_SKILL_BY_ERA.medieval);
  const founder = s.people[0];
  const p = { ...structuredClone(founder), id: s.nextId++, name: 'Hand' };
  s.people.push(p);
  p.skills.construction.level = 1;
  founder.skills.construction.level = 1;
  const hut = addBuilding(s, 'lean_to', camp(s).x + 3, { status: 'blueprint', progress: 0 });
  const cottage = addBuilding(s, 'cottage', camp(s).x + 6, { status: 'blueprint', progress: 0 });
  assert.ok(canWork(s, p, hut) && canWork(s, p, cottage), 'nobody is turned away');
  assert.equal(skillPace(s, p, hut), 1);
  assert.ok(skillPace(s, p, cottage) < 0.5, 'but the unskilled go slower');
  assert.equal(skillPace(s, founder, cottage), 1, 'the founder can turn their hand to anything');
  p.skills.construction.level = 30;
  assert.equal(skillPace(s, p, cottage), 1);
});

test('a person with coins enough buys a plot and the makings of a home from the town, and owns the site', () => {
  const s = plainGame('plot');
  clearAround(s, 14);
  s.research.done.push('basic_shelter');
  addBuilding(s, 'stockpile', camp(s).x - 6, { store: { wood: 60, fiber: 30, stone: 20 } });
  s.coins = 30;
  const p = s.people[0];
  const def = BUILDING_BY_ID.lean_to;
  const price = landPrice(s, def) + materialsPrice(def);
  p.coins = price - 1;
  planHomes(s);
  assert.ok(!s.buildings.some((b) => b.owner === p.id), 'a coin short: no plot');
  p.coins = price + 5;
  planHomes(s);
  const site = s.buildings.find((b) => b.owner === p.id);
  assert.ok(site, 'bought and placed');
  assert.equal(site!.def, 'lean_to');
  assert.equal(p.coins, 5, 'the plot and the materials were paid for');
  assert.equal(s.coins, 30 + price, 'to the treasury');
  planHomes(s);
  assert.equal(s.buildings.filter((b) => b.owner === p.id).length, 1, 'one home a person');
  // finished, it is their bed
  site!.status = 'done';
  site!.progress = 1;
  assignBeds(s);
  assert.equal(p.bed, site!.id);
});

test('rent at dawn: a bed in the town\'s home costs a coin a day; short of it, arrears and a grudge', () => {
  const s = plainGame('rent');
  const home = addBuilding(s, 'lean_to', camp(s).x + 3);
  const p = s.people[0];
  p.bed = home.id;
  s.coins = 0;
  p.coins = 10;
  const morale = p.morale;
  collectRent(s);
  assert.equal(p.coins, 10 - rentOf(s));
  assert.equal(s.coins, rentOf(s));
  assert.equal(p.morale, morale);
  p.coins = 0;
  collectRent(s);
  assert.equal(p.debt, rentOf(s));
  assert.ok(p.morale < morale);
  // their own home is free
  home.owner = p.id;
  p.coins = 10;
  collectRent(s);
  assert.equal(p.coins, 10);
});

test('an owner pays the builders they hire by the hour, and works on their own site for nothing', () => {
  const s = plainGame('hire');
  clearAround(s, 14);
  const owner = s.people[0];
  const worker = { ...JSON.parse(JSON.stringify(owner)), id: s.nextId++, name: 'Hal', coins: 0, partner: null };
  s.people.push(worker);
  owner.coins = 40;
  s.coins = 0;
  const site = addBuilding(s, 'lean_to', camp(s).x + 3, { status: 'blueprint', progress: 0, owner: owner.id, delivered: { wood: 8, fiber: 4 } });
  const sim = new Sim(s);
  worker.task = { type: 'build', building: site.id };
  worker.skills.construction.level = 5;
  owner.task = { type: 'idle', untilTick: s.tick + 10 * TICKS_PER_HOUR };
  for (let k = 0; k < 2 * TICKS_PER_HOUR && site.status === 'blueprint'; k++) sim.step();
  assert.ok((worker.coins ?? 0) > 0, `the hired builder was paid (${worker.coins})`);
  assert.ok((owner.coins ?? 0) < 40, 'by the owner');
});
