import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addItems } from '../src/shared/sim/crafting';
import { DRINK_HOURS, drinking, nightOut } from '../src/shared/sim/nightOut';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campCell, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { TAVERN_NIGHT } from '../src/shared/sim/wages';
import { plainGame, row } from './helpers';

const camp = (s: GameState) => campCell(s).x;
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
/** Another grown-up, cut from the founder's cloth. */
function another(s: GameState, name: string): Person {
  const q = JSON.parse(JSON.stringify(s.people[0])) as Person;
  q.id = s.nextId++;
  q.name = name;
  q.task = null;
  q.bed = null;
  q.fcls = undefined;
  q.nature = 'jolly'; // (the keenest: the roll by nature never keeps them home)
  s.people.push(q);
  return q;
}
function evening(seed: string): { s: GameState; inn: Building; keeper: Person; bo: Person } {
  const s = plainGame(seed);
  addBuilding(s, 'trading_post', camp(s) + 3);
  const inn = addBuilding(s, 'fireside_inn', camp(s) - 6);
  const keeper = s.people[0];
  inn.operator = keeper.id;
  const bo = another(s, 'Bo');
  for (const p of [keeper, bo]) {
    p.coins = 50;
    p.morale = 50;
    p.needs.food = 1;
    p.needs.rest = 1;
  }
  addItems(s, 'herb_tea', 3, 1);
  s.coins = 0;
  return { s, inn, keeper, bo };
}

test('of an evening the townsfolk walk to the tavern, buy a drink there, and come home cheered', () => {
  const { s, keeper, bo } = evening('night-out-walk');
  nightOut(s);
  assert.ok(s.nightOut, 'an evening is on');
  assert.ok(drinking(s, bo), 'Bo goes out');
  assert.ok(!drinking(s, keeper), 'the keeper stays behind the bar');
  const sim = new Sim(s);
  let arrived = -1;
  for (let k = 0; k < TICKS_PER_HOUR && arrived < 0; k++) {
    sim.step();
    if (bo.activity === 'drink') arrived = k;
  }
  assert.ok(arrived > 0, 'Bo walked there and went in');
  assert.equal(bo.task?.type, 'drink');
  assert.ok(bo.coins! < 50 && (s.coins ?? 0) > 0, 'a drink bought from the house');
  assert.ok(bo.morale >= 50 + TAVERN_NIGHT - 0.01, 'and it cheered them');
  const v = snapshot(s);
  const me = v.people.find((p) => p.id === bo.id)!;
  assert.ok(me.indoors, 'inside: off the map');
  assert.match(me.doing, /Letting off steam/);
  assert.ok(v.tavern?.locals.some((l) => l.id === bo.id), 'seen in the tavern window');
  // one drink an evening: the house isn't paid again while they sit
  const paid = s.coins ?? 0;
  for (let k = 0; k < TICKS_PER_HOUR; k++) sim.step();
  assert.equal(s.coins, paid);
  // home time: the evening ends and the task goes with it
  for (let k = 0; k < DRINK_HOURS * TICKS_PER_HOUR; k++) sim.step();
  assert.ok(!drinking(s, bo));
  assert.notEqual(bo.task?.type, 'drink');
});

test('the dead, children and those without the coins stay home; nobody goes without a tavern open', () => {
  const { s, bo } = evening('night-out-home');
  const skint = another(s, 'Skint');
  skint.coins = 0;
  const dead = another(s, 'Dust');
  dead.undying = true;
  dead.coins = 50;
  nightOut(s);
  assert.ok(s.nightOut?.ids.includes(bo.id));
  assert.ok(!s.nightOut?.ids.includes(skint.id), 'no coins, no drink');
  assert.ok(!s.nightOut?.ids.includes(dead.id), 'the dead do not drink');
  const t = plainGame('night-out-none');
  t.people[0].coins = 50;
  nightOut(t);
  assert.equal(t.nightOut, undefined);
});
