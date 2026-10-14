import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOND_TRIPS } from '../src/shared/data/companies';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { companyOf, nameCompany, tidyCompanies } from '../src/shared/sim/companies';
import { sendExpedition, updateExpeditions } from '../src/shared/sim/expeditions';
import { boardDestinations, proposeParty, recruit, setVeto } from '../src/shared/sim/parties';
import { snapshot } from '../src/shared/sim/snapshot';
import { maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { relationsChanged } from '../src/shared/sim/social';
import { plainGame } from './helpers';

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition: 'farmer', partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.tick = TICKS_PER_HOUR;
  return s;
}

/** Send these few to the Berry Thicket and bring them home (quick legs). */
function trip(s: GameState, ids: number[], seed: number) {
  assert.ok(sendExpedition(s, 'berry_thicket', ids).ok);
  const e = s.expeditions.at(-1)!;
  e.leader = ids[0];
  e.outTicks = e.workTicks = e.backTicks = 1;
  const rng = new Rng(seed);
  for (let t = 0; t < TICKS_PER_DAY && s.expeditions.length; t++) {
    // (no fight on the road: this is about who goes, not how they fare)
    e.battle = null;
    e.prompt = null;
    updateExpeditions(s, rng);
  }
  assert.equal(s.expeditions.length, 0, `home: ${JSON.stringify(s.expeditions.map((x) => [x.phase, x.elapsed, !!x.battle, x.prompt, x.recalled]))}`);
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
    p.homeAt = undefined;
  }
}

test('the same few out and home twice become a named company, and its trips and deeds are remembered', () => {
  const s = town('company1', 5);
  const ids = [s.people[1].id, s.people[2].id, s.people[3].id];
  trip(s, ids, 1);
  assert.equal(s.companies?.length ?? 0, 0, 'one trip is not yet a bond');
  for (let i = 1; i < BOND_TRIPS; i++) trip(s, ids, i + 1);
  assert.equal(s.companies!.length, 1, 'a company formed');
  const c = s.companies![0];
  assert.deepEqual([...c.members].sort(), [...ids].sort());
  assert.ok(c.name.length > 3);
  assert.equal(companyOf(s, ids[0]), c);
  assert.equal(companyOf(s, s.people[4].id), undefined);
  // another trip with two of them and a newcomer: a company trip, and the newcomer joins
  trip(s, [ids[0], ids[1], s.people[4].id], 9);
  assert.equal(c.trips, BOND_TRIPS + 1);
  assert.ok(c.members.includes(s.people[4].id), 'the newcomer joined');
  assert.ok(c.deeds.length >= 2 && /Berry Thicket/.test(c.deeds.at(-1)!));
  // seen on the snapshot
  const v = snapshot(s).companies;
  assert.equal(v[0].name, c.name);
  assert.equal(v[0].members.length, 4);
});

test('the name is the seed\'s own: the same town names it the same', () => {
  const a = town('company2', 2);
  const b = town('company2', 2);
  assert.equal(nameCompany(a, 1, a.people[1], 'the Barrow Crypt'), nameCompany(b, 1, b.people[1], 'the Barrow Crypt'));
});

test('a company goes out together again: recruiting takes its members first', () => {
  const s = town('company3', 8);
  const lead = s.people[1];
  lead.ambition = 'adventurer';
  const mate = s.people[7];
  s.companies = [{ id: 1, name: 'The Test Band', members: [lead.id, mate.id], formed: 1, trips: 2, wins: 2, deeds: [] }];
  const d = DESTINATIONS.find((q) => q.id === 'berry_thicket')!;
  const party = recruit(s, lead, d, s.people.filter((p) => p.id !== s.mainId), 2);
  assert.deepEqual(party.map((p) => p.id), [lead.id, mate.id]);
  for (const x of boardDestinations(s)) if (x.id !== 'berry_thicket') setVeto(s, x.id, true);
  assert.ok(proposeParty(s)?.members.includes(mate.id));
});

test('too few left alive: the company breaks up and is remembered', () => {
  const s = town('company4', 3);
  const [a, b] = [s.people[1], s.people[2]];
  s.companies = [{ id: 1, name: 'The Test Band', members: [a.id, b.id], formed: 1, trips: 2, wins: 0, deeds: [] }];
  s.people = s.people.filter((p: Person) => p !== b);
  tidyCompanies(s);
  assert.ok(s.companies[0].ended);
  assert.equal(companyOf(s, a.id), undefined);
});

test('friends go together: of two alike, the one the party likes is asked along', () => {
  const s = town('company5', 4);
  const [lead, a, b] = [s.people[1], s.people[2], s.people[3]];
  for (const p of [a, b]) p.cls = lead.cls;
  const k = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  s.relations[k(lead.id, a.id)] = 0;
  s.relations[k(lead.id, b.id)] = 50;
  relationsChanged(s);
  const d = DESTINATIONS.find((q) => q.id === 'berry_thicket')!;
  assert.deepEqual(recruit(s, lead, d, [lead, a, b], 2).map((p) => p.id), [lead.id, b.id]);
});
