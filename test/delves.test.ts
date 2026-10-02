import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUNGEON_BY_ID, DUNGEONS } from '../src/shared/data/dungeons';
import { ENEMIES } from '../src/shared/data/enemies';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { HIDDEN_IN } from '../src/shared/data/regions';
import { ROUTES } from '../src/shared/data/scenes';
import { MAP_SPOTS } from '../src/shared/data/worldMap';
import { destinationHidden, sendDelve } from '../src/shared/sim/expeditions';
import { Sim } from '../src/shared/sim/sim';
import { addStock, makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function hero(s: GameState): Person {
  const p = makePerson(new Rng(s.nextId * 31), s.nextId++, 'gatherer', (Math.floor(s.tiles.length / 2) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = [];
  p.needs = { food: 1, rest: 1 };
  p.skills.melee.level = 25;
  p.skills.medicine.level = 5;
  p.hp = maxHp(p);
  s.people.push(p);
  return p;
}
function delveTown(seed: string, wood: number): { sim: Sim; s: GameState; party: Person[] } {
  const sim = new Sim(plainGame(seed));
  const s = sim.state;
  s.cheats.unlockAll = true;
  s.regions = DUNGEONS.map((d) => d.region);
  const party = [hero(s), hero(s), hero(s), hero(s)];
  for (const p of party) p.gear.weapon = 'masterless';
  addStock(campfire(s).store, 'wood', wood);
  addStock(campfire(s).store, 'dried_meat', 60);
  return { sim, s, party };
}
const runHome = (sim: Sim) => {
  for (let t = 0; sim.state.expeditions.length && t < 20000 * TICK_HZ; t++) sim.step();
};

test('every dungeon is a delve on the board, on the map, with scenes, hidden in its region, its foes and boss real', () => {
  for (const d of DUNGEONS) {
    assert.equal(DESTINATION_BY_ID[d.id]?.type, 'delve');
    assert.ok(MAP_SPOTS[d.id] && ROUTES[d.id], `${d.id} has a spot and scenes`);
    assert.equal(HIDDEN_IN[d.id], d.region);
    for (const g of [...d.foes, d.boss]) for (const id of Object.keys(g)) assert.ok(ENEMIES[id], `${d.id}: ${id} is a foe`);
    assert.ok(Object.keys(d.boss).some((id) => ENEMIES[id].boss), `${d.id} ends in a boss`);
  }
});

test('a strong party picked by the player delves room by room, kills the boss and brings the hoard home', () => {
  const { sim, s, party } = delveTown('delve', 30);
  assert.ok(!destinationHidden(s, 'barrow_crypt'));
  const r = sendDelve(s, 'barrow_crypt', party.map((p) => p.id), 'safe');
  assert.ok(r.ok, r.ok ? '' : (r.reason ?? ''));
  const e = s.expeditions[0];
  const d = DUNGEON_BY_ID.barrow_crypt;
  assert.equal(e.delve!.rooms.length, d.rooms + 1, 'its rooms, and the boss');
  assert.equal(e.delve!.rooms.at(-1), 'boss');
  assert.equal(e.delve!.torches, d.rooms + 3, 'a torch a room and two spare');
  runHome(sim);
  assert.equal(s.expeditions.length, 0, 'home again');
  assert.equal(s.delved?.barrow_crypt, 1, 'the crypt is cleared');
  assert.ok(s.journal.some((j) => /Barrow Crypt is cleared/.test(j.text)));
  assert.ok((s.coins ?? 0) > 0, 'the boss had a purse');
});

test('without torches a party turns back at the door', () => {
  const { sim, s, party } = delveTown('dark', 0);
  sendDelve(s, 'gremlin_warren', party.slice(0, 2).map((p) => p.id), 'safe');
  assert.equal(s.expeditions[0].delve!.torches, 0);
  runHome(sim);
  assert.equal(s.delved?.gremlin_warren, undefined);
  assert.ok(s.journal.some((j) => /last torch gutters out/.test(j.text)));
});

test('a delve rolls the same rooms each time for the same town and trip', () => {
  const a = delveTown('same', 30);
  const b = delveTown('same', 30);
  sendDelve(a.s, 'deep_mine', a.party.map((p) => p.id), 'risky');
  sendDelve(b.s, 'deep_mine', b.party.map((p) => p.id), 'risky');
  assert.deepEqual(a.s.expeditions[0].delve!.rooms, b.s.expeditions[0].delve!.rooms);
});

test('only dungeons can be delved, by up to five', () => {
  const { s, party } = delveTown('five', 30);
  assert.equal(sendDelve(s, 'berry_thicket', [party[0].id], 'safe').ok, false);
  const six = [...party, hero(s), hero(s)];
  assert.equal(sendDelve(s, 'fey_hollow', six.map((p) => p.id), 'safe').ok, false);
});
