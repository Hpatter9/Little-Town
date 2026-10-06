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

test('at a feast the town dances: half the ring turns round the spot; at a funeral they mourn, still', async () => {
  const { gatheringPlace, gatheringRadius } = await import('../src/shared/sim/ceremonies');
  const s = town('dance1', 9);
  const ids = s.people.map((p) => p.id);
  s.gathering = { kind: 'feast', ids, until: s.tick + 10 * TICKS_PER_HOUR, text: 'At the feast', x: 1000, y: 1000, from: s.tick };
  // (the ring has room for everyone: it grows with the guests)
  assert.ok(gatheringRadius(s.gathering) > gatheringRadius({ ...s.gathering, ids: ids.slice(0, 2) }));
  const a0 = gatheringPlace(s.gathering, 0, s.tick);
  const a1 = gatheringPlace(s.gathering, 0, s.tick + 50);
  const b0 = gatheringPlace(s.gathering, 1, s.tick);
  const b1 = gatheringPlace(s.gathering, 1, s.tick + 50);
  assert.ok(Math.hypot(a1.x - a0.x, a1.y - a0.y) > 5, 'a ring dancer goes round');
  assert.deepEqual([b0.x, b0.y], [b1.x, b1.y], 'the others dance where they stand');
  // (the guests at their places take up the dance, and the ring dancers go round with it)
  const { newTickContext, updatePerson } = await import('../src/shared/sim/people');
  const { Rng } = await import('../src/shared/rng');
  const g = s.gathering;
  s.people.forEach((p, i) => Object.assign(p, gatheringPlace(g, i, s.tick), { task: null, needs: { ...p.needs, food: 1, rest: 1 } }));
  const first = { x: s.people[0].x, y: s.people[0].y };
  const rng = new Rng(3);
  for (let t = 0; t < 40; t++) {
    s.tick++;
    const ctx = newTickContext();
    for (const p of s.people) updatePerson(s, p, rng, ctx);
  }
  assert.ok(s.people.every((p) => p.activity === 'dance'), s.people.map((p) => p.activity).join());
  assert.ok(Math.hypot(s.people[0].x - first.x, s.people[0].y - first.y) > 5, 'round they go');
  const funeral = { ...s.gathering, kind: 'funeral' as const };
  const f0 = gatheringPlace(funeral, 0, s.tick);
  const f1 = gatheringPlace(funeral, 0, s.tick + 50);
  assert.deepEqual([f0.x, f0.y], [f1.x, f1.y], 'mourners stand still');
});

test('the dance steps: on the beat, off the ground and back; mourners kneel or stand', async () => {
  const { BEAT, danceMove, danceStep, mournStep } = await import('../src/renderer/map/dance');
  const moves = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(danceMove));
  assert.ok(moves.size >= 4, 'a town dances many ways');
  for (const id of [1, 2, 3, 4, 5]) {
    const lifts = [0, 0.25, 0.5, 0.75, 1.25, 1.5, 1.75].map((k) => danceStep(id, 10 * BEAT + k * BEAT, false).lift);
    assert.equal(lifts[0], 0, 'on the ground on the beat');
    assert.ok(Math.max(...lifts) > 0 && Math.max(...lifts) <= 5, 'and up between');
  }
  assert.ok(danceStep(2, BEAT * 1.5, true).lift > 0, 'the ring skips');
  assert.equal(mournStep(3).col, 7, 'some kneel');
  assert.equal(mournStep(4).lift, 0);
});
