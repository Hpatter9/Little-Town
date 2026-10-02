import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATION_BY_ID, MAX_PARTY } from '../src/shared/data/expeditions';
import { totalStock } from '../src/shared/sim/buildings';
import { canSend } from '../src/shared/sim/expeditions';
import { Sim } from '../src/shared/sim/sim';
import { addStock, makePerson, poolSize, type GameState, type Person } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, campPx, nearestWild, poolOf } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 7200) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
  return t / TICK_HZ;
};
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addPerson(s: GameState, type = 'gatherer'): Person {
  const p = makePerson(new Rng(s.nextId * 31), s.nextId++, type, campPx(s), s.people.map((q) => q.name));
  p.traits = [];
  p.needs = { food: 1, rest: 1 };
  s.people.push(p);
  return p;
}

test('a party goes to the Berry Thicket and comes home with loot it can carry', () => {
  const sim = new Sim(plainGame('thicket'));
  const s = sim.state;
  const a = s.people[0];
  const b = addPerson(s);
  addStock(campfire(s).store, 'berries', 6);
  sim.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [a.id, b.id] });
  sim.step();
  assert.equal(s.expeditions.length, 1);
  assert.ok(a.away !== null && b.away !== null, 'both away');
  assert.ok(poolSize(s.expeditions[0].supplies) >= 1, 'packed food');

  const d = DESTINATION_BY_ID.berry_thicket;
  const took = runUntil(sim, () => s.expeditions.length === 0);
  const min = d.outSeconds * 2 + 1;
  assert.ok(took >= min && took <= d.outSeconds * 2.5 + d.workSeconds + 2, `took ${took}s`);
  assert.equal(a.away, null);
  const carried = poolSize(a.carrying) + poolSize(b.carrying);
  assert.ok(carried > 0, 'brought something back');
  assert.ok(s.scouted.includes('berry_thicket'));
  assert.match(s.notices.at(-1)!.text, /Berry Thicket party is back/);
  // site loot, packed food coming back, a boar's drops, or a road find
  const possible = new Set([...Object.keys(d.loot), 'berries', 'meat', 'hide', 'bone', 'stone', 'flint', 'fiber']);
  for (const m of Object.keys({ ...a.carrying, ...b.carrying })) assert.ok(possible.has(m), `unexpected ${m}`);

  // ...and hauls it into storage
  const before = poolSize(totalStock(s));
  runUntil(sim, () => poolSize(a.carrying) + poolSize(b.carrying) === 0, 600);
  assert.equal(poolSize(totalStock(s)), before + carried);
});

test('loot is limited by what the party can carry', () => {
  const sim = new Sim(plainGame('carry-2')); // (a seed whose quarry is quiet: no fight sends them home early)
  const s = sim.state;
  const p = s.people[0];
  p.skills.gathering.level = 20; // works very fast: the carry limit is what stops it
  sim.command({ type: 'sendExpedition', dest: 'old_quarry', members: [p.id] });
  s.cheats.unlockAll = true;
  sim.step();
  sim.step();
  runUntil(sim, () => s.expeditions[0]?.phase === 'back');
  assert.equal(poolSize(s.expeditions[0].loot), 10, 'one person carries 10');
});

test('a recalled party turns around and comes back empty-handed', () => {
  const sim = new Sim(plainGame('recall'));
  const s = sim.state;
  sim.command({ type: 'sendExpedition', dest: 'riverbank', members: [s.people[0].id] });
  sim.step();
  const id = s.expeditions[0].id;
  runUntil(sim, () => false, 30);
  sim.command({ type: 'recallExpedition', expedition: id });
  const back = runUntil(sim, () => s.expeditions.length === 0);
  assert.ok(back > 25 && back < 45, `walked back in ${back}s`);
  assert.equal(poolSize(s.people[0].carrying), 0);
  assert.match(s.notices.at(-1)!.text, /recalled/);
});

test('sending: locked destinations, party size, people already away, expedition limit', () => {
  const s = plainGame('rules');
  const ids = [s.people[0].id, ...[1, 2, 3, 4].map(() => addPerson(s).id)];
  assert.equal(canSend(s, 'deep_woods', [ids[0]]).ok, false, 'needs Spear Hunting');
  s.research.done.push('spear_hunting');
  assert.equal(canSend(s, 'deep_woods', [ids[0]]).ok, true);
  assert.equal(canSend(s, 'berry_thicket', ids.slice(0, MAX_PARTY + 1)).ok, false, 'too many');
  assert.equal(canSend(s, 'berry_thicket', []).ok, false);
  const sim = new Sim(s);
  sim.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [ids[0]] });
  sim.step();
  assert.match(canSend(s, 'riverbank', [ids[0]]).reason!, /already away/);
  sim.command({ type: 'sendExpedition', dest: 'riverbank', members: [ids[1]] });
  sim.step();
  assert.match(canSend(s, 'riverbank', [ids[2]]).reason!, /At most 2/);
});

test('away members do no town work and eat from their packs', () => {
  const sim = new Sim(plainGame('away'));
  const s = sim.state;
  const p = s.people[0];
  p.needs.food = 0.45;
  addStock(campfire(s).store, 'berries', 10);
  const forest = nearestWild(s, 'forest');
  sim.command({ type: 'toggleGather', cell: forest });
  sim.command({ type: 'sendExpedition', dest: 'riverbank', members: [p.id] });
  const pool = poolSize(poolOf(s, forest));
  runUntil(sim, () => s.expeditions[0]?.phase === 'back');
  assert.equal(poolSize(poolOf(s, forest)), pool, 'nobody gathered');
  assert.ok(p.needs.food > 0.4, `ate on the road (food ${p.needs.food})`);
});

test('the Bear Cave yields the totem the Elder Lodge needs, once the bear is beaten', () => {
  const sim = new Sim(plainGame('bear'));
  const s = sim.state;
  s.research.done.push('scouting');
  const party = [s.people[0], addPerson(s, 'hunter'), addPerson(s, 'hunter')];
  for (const p of party) {
    p.skills.melee.level = 14;
    p.traits = ['tough'];
    p.hp = 80;
  }
  sim.command({ type: 'sendExpedition', dest: 'bear_cave', members: party.map((p) => p.id), stance: 'bold' });
  runUntil(sim, () => s.expeditions.length === 0 && s.tick > 10, 4000);
  assert.equal(party.reduce((n, p) => n + (p.carrying.totem ?? 0), 0), 1);
});
