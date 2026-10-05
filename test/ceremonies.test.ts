import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FUNERAL_HOURS, GATHER_HOUR, GREAT_FUNERAL_DEATHS } from '../src/shared/data/ceremonies';
import { attending, ceremoniesHourly, victoryFeast, weddingFeast } from '../src/shared/sim/ceremonies';
import { killPerson } from '../src/shared/sim/health';
import { relationsChanged } from '../src/shared/sim/social';
import { addStock, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { storages } from '../src/shared/sim/buildings';
import { plainGame } from './helpers';

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, partner: null };
    p.hp = maxHp(p);
    s.people.push(p);
  }
  s.autopilot = undefined;
  return s;
}
/** On to the evening hour (the gathering's), hour by hour. */
function toEvening(s: GameState) {
  do {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
  } while (calendar(s.tick).hour !== GATHER_HOUR);
}

test('a death is mourned at the evening funeral by those who were close, and their grief is eased', () => {
  const s = town('fun1', 4);
  const [dead, friend, stranger] = [s.people[1], s.people[2], s.people[3]];
  s.relations[`${Math.min(dead.id, friend.id)}-${Math.max(dead.id, friend.id)}`] = 70;
  relationsChanged(s);
  killPerson(s, dead, 'of a fall');
  assert.ok(friend.grief, 'the friend grieves');
  const before = friend.grief!.value;
  toEvening(s);
  assert.equal(s.gathering?.kind, 'funeral');
  assert.ok(attending(s, friend), 'the friend comes');
  assert.ok(!attending(s, stranger), 'a stranger to them goes on working');
  for (let h = 0; h < FUNERAL_HOURS; h++) {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
  }
  assert.equal(s.gathering, undefined, 'over');
  assert.ok(Math.abs(friend.grief!.value) < Math.abs(before), 'grief eased');
  assert.ok(s.marks?.some((m) => m.text === 'Laid to rest'));
});

test('many dead at once: a great funeral for the whole town', () => {
  const s = town('fun2', 6);
  for (let i = 0; i < GREAT_FUNERAL_DEATHS; i++) killPerson(s, s.people[1], 'in the raid');
  toEvening(s);
  assert.equal(s.gathering?.kind, 'great_funeral');
  assert.equal(s.gathering?.ids.length, s.people.length, 'everyone');
});

test('a wedding is feasted that evening, and the feast eats from the stores', () => {
  const s = town('fun3', 4);
  const st = storages(s)[0];
  addStock(st.store, 'berries', 200);
  const before = st.store.berries!;
  weddingFeast(s, s.people[1], s.people[2]);
  toEvening(s);
  assert.equal(s.gathering?.kind, 'wedding');
  assert.ok(s.people.every((p) => attending(s, p)), 'all at the feast');
  assert.ok(st.store.berries! < before, 'food eaten');
});

test('no feast the stores cannot spare (but a victory is feasted when they can)', () => {
  const s = town('fun4', 4);
  for (const st of storages(s)) st.store = {};
  victoryFeast(s);
  toEvening(s);
  assert.equal(s.gathering, undefined, 'no feast on empty stores');
  addStock(storages(s)[0].store, 'berries', 300);
  victoryFeast(s);
  toEvening(s);
  assert.equal((s as GameState).gathering?.kind, 'feast');
});
