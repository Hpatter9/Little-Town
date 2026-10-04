import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BLOOD_PER_PRISONER, FARM_CELLS, TITHE_HOUR, TITHE_PER_THRALL, BLOOD_KEEP } from '../src/shared/data/vampires';
import { Rng } from '../src/shared/rng';
import { updateMonsters } from '../src/shared/sim/monsters';
import { updatePrisoners } from '../src/shared/sim/prisoners';
import { newGame, type Building, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { bloodHourly, bloodInStore, bloodTown, farmCells, tithed } from '../src/shared/sim/vampires';

const atHour = (day: number, hour: number) => day * TICKS_PER_DAY + ((hour + 24 - START_HOUR) % 24) * TICKS_PER_HOUR;
const thrall = (s: ReturnType<typeof newGame>, id: number): Person => {
  const p: Person = { ...s.people[s.people.length - 1], id, name: `Thrall ${id}`, monster: null, machine: false, bornTick: null, hp: 100, activity: 'sleep' } as Person;
  s.people.push(p);
  return p;
};

test('the Blood Court keeps the tithe from its founding, and at dusk the thralls, the pens and the celled prisoners give blood', () => {
  const s = newGame('court', { origin: 'vampire' });
  assert.ok(bloodTown(s) && tithed(s));
  for (let i = 0; i < 4; i++) thrall(s, 40 + i);
  const thralls = s.people.filter((p) => !p.monster && p.bornTick == null).length;
  s.buildings.push({ id: 900, def: 'blood_farm', tile: s.land.camp.x + 8, row: s.land.camp.y + 4, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  assert.equal(farmCells(s), FARM_CELLS);
  for (let i = 0; i < 6; i++) s.prisoners.push({ id: 700 + i, enemy: 'bandit', name: `Captive ${i}`, conviction: 0, since: 0, hungry: false });
  for (const b of s.buildings) b.store = {}; // (room in the stores for it)
  s.tick = atHour(2, TITHE_HOUR);
  bloodHourly(s);
  const got = bloodInStore(s);
  assert.equal(got, Math.floor(thralls * TITHE_PER_THRALL + FARM_CELLS * BLOOD_PER_PRISONER), `blood ${got}`);
  assert.ok(s.journal.some((j) => /tithe/.test(j.text)));
  // with the store full enough the thralls are spared; the cells still give
  for (const b of s.buildings) b.store = {};
  s.buildings[0].store.blood = BLOOD_KEEP;
  s.tick = atHour(3, TITHE_HOUR);
  bloodHourly(s);
  assert.ok(bloodInStore(s) <= BLOOD_KEEP + FARM_CELLS * BLOOD_PER_PRISONER); // (the stores may be full before that)
  assert.ok(s.journal.some((j) => /tithe: \d+ blood from 0 thralls/.test(j.text)));
  // a settlers' town has no tithe to take
  const t = newGame('plain');
  t.tick = atHour(2, TITHE_HOUR);
  bloodHourly(t);
  assert.equal(bloodInStore(t), 0);
});

test('a vampire drinks from the store before anyone is bitten; with the store dry the Court\'s tithe still feeds them', () => {
  const s = newGame('drink', { origin: 'vampire' });
  const lord = s.people.find((p) => p.id === s.mainId)!;
  assert.equal(lord.monster, 'vampire');
  for (let i = 0; i < 3; i++) thrall(s, 50 + i);
  const store = s.buildings.find((b) => b.def === 'campfire' || b.def === 'stockpile')!;
  store.store.blood = 2;
  lord.lastFed = -1e9;
  const before = s.people.map((p) => p.hp);
  s.tick = atHour(3, 2);
  updateMonsters(s, new Rng(1), () => {});
  assert.equal(store.store.blood, 1, 'one drunk');
  assert.deepEqual(s.people.map((p) => p.hp), before, 'nobody bitten');
  assert.ok(lord.lastFed > 0);
  // the store dry: the tithe feeds, still no bite
  store.store.blood = 0;
  lord.lastFed = -1e9;
  s.tick = atHour(4, 2);
  updateMonsters(s, new Rng(2), () => {});
  assert.deepEqual(s.people.map((p) => p.hp), before, 'the tithe feeds them');
});

test('the Court keeps its prisoners: none come round, and few get out of the cells', () => {
  const s = newGame('cells', { origin: 'vampire' });
  s.buildings.push({ id: 901, def: 'blood_farm', tile: s.land.camp.x + 8, row: s.land.camp.y + 4, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  s.prisoners.push({ id: 710, enemy: 'bandit', name: 'Captive', conviction: 0, since: 0, hungry: false });
  const rng = new Rng(9);
  for (let h = 1; h <= 24 * 20; h++) {
    s.tick = h * TICKS_PER_HOUR;
    updatePrisoners(s, rng);
  }
  const pr = s.prisoners.find((p) => p.id === 710);
  assert.ok(!pr || pr.conviction === 0, 'never won over');
  assert.ok(!s.people.some((p) => p.name === 'Captive'), 'never joined');
});

test('the blood farm is the Court\'s own, and blood wine is brewed from blood', () => {
  const farm = BUILDING_BY_ID.blood_farm;
  assert.equal(farm.origin, 'vampire');
  assert.equal(farm.era, 'medieval');
  const wine = ITEM_BY_ID.blood_wine;
  assert.equal(wine.cost.blood, 3);
  assert.ok(wine.ware && wine.ware.tier >= 2);
});
