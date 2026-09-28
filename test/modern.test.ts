import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { DESTINATION_BY_ID, TRUCK_CARRY, TRUCK_FUEL } from '../src/shared/data/expeditions';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { caravanGoods } from '../src/shared/data/trade';
import { totalStock } from '../src/shared/sim/buildings';
import { onBuilt } from '../src/shared/sim/era';
import { partyCarry, sendExpedition } from '../src/shared/sim/expeditions';
import { canQueue } from '../src/shared/sim/research';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/sim';
import type { Building, GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame, priorities } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

test('every Modern building, item and destination points at research that exists', () => {
  for (const b of Object.values(BUILDING_BY_ID)) if (b.research) assert.ok(TOPIC_BY_ID[b.research], `${b.id} -> ${b.research}`);
  for (const i of Object.values(ITEM_BY_ID)) if (!i.relic) for (const r of i.research) assert.ok(TOPIC_BY_ID[r], `${i.id} -> ${r}`);
  for (const d of Object.values(DESTINATION_BY_ID)) if (d.research) assert.ok(TOPIC_BY_ID[d.research], `${d.id} -> ${d.research}`);
  for (const t of Object.values(TOPIC_BY_ID)) for (const p of t.prereqs) assert.ok(TOPIC_BY_ID[p], `${t.id} needs ${p}`);
});

test('the Power Station opens the Modern era and its research', () => {
  const s = plainGame('modern');
  s.era = 'industrial';
  assert.equal(canQueue(s.research, 'oil_drilling', s.era).ok, false);
  onBuilt(s, addBuilding(s, 'power_station', camp(s) + 3));
  assert.equal(s.era, 'modern');
  assert.equal(canQueue(s.research, 'oil_drilling', s.era).ok, true);
  assert.ok(caravanGoods('modern').includes('electronics'));
});

test('a gatherer pumps oil at the derrick', () => {
  const sim = new Sim(plainGame('oil'));
  const s = sim.state;
  s.era = 'modern';
  addBuilding(s, 'oil_derrick', camp(s) + 3);
  addBuilding(s, 'stockpile', camp(s) + 6);
  s.people[0].priorities = priorities({ gather: 1 });
  for (let t = 0; t < 2 * TICKS_PER_DAY && (totalStock(s).oil ?? 0) < 8; t++) sim.step();
  assert.ok((totalStock(s).oil ?? 0) >= 8, `oil ${totalStock(s).oil ?? 0}`);
});

test('a truck needs fuel, burns it, carries more, gets there faster, and comes home', () => {
  const s = plainGame('truck');
  s.era = 'modern';
  s.research.done.push('oil_drilling');
  const walker = new Sim(JSON.parse(JSON.stringify(s)) as GameState);
  const [p] = s.people;
  s.items.truck = 1;
  campfire(s).store = { bread: 20, fuel: TRUCK_FUEL - 1 };
  assert.match(sendExpedition(s, 'oil_fields', [p.id], {}, 'balanced', 0, true).reason!, /fuel/);
  campfire(s).store = { bread: 20, fuel: TRUCK_FUEL };
  assert.equal(sendExpedition(s, 'oil_fields', [p.id], {}, 'balanced', 0, true).ok, true);
  assert.equal(s.items.truck, 0);
  assert.equal(totalStock(s).fuel ?? 0, 0);
  const e = s.expeditions[0];
  assert.ok(e.truck);
  assert.ok(partyCarry(s, e) >= TRUCK_CARRY);

  campfire(walker.state).store = { bread: 20 };
  sendExpedition(walker.state, 'oil_fields', [walker.state.people[0].id]);
  assert.ok(e.outTicks < walker.state.expeditions[0].outTicks * 0.5, `${e.outTicks} vs ${walker.state.expeditions[0].outTicks}`);

  // no fights: just see it home
  e.rolled = { outEvent: true, backEvent: true, ambush: true };
  addBuilding(s, 'stockpile', camp(s) + 4);
  const sim = new Sim(s);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  for (let t = 0; t < 8 * TICKS_PER_DAY && s.expeditions.length; t++) {
    if (s.expeditions[0]?.prompt) s.expeditions[0].prompt = null;
    sim.step();
  }
  assert.equal(s.expeditions.length, 0, JSON.stringify(s.expeditions[0] && { ...s.expeditions[0], battle: !!s.expeditions[0].battle }) + s.journal.slice(-5).map((n) => n.text).join('|'));
  assert.equal(s.items.truck, 1);
  assert.ok((totalStock(s).oil ?? 0) + (p.carrying.oil ?? 0) > 30, 'a truckload of oil');
});

test('a gun turret fires on raiders in range, and never runs out', () => {
  const sim = new Sim(plainGame('turret'));
  const s = sim.state;
  s.era = 'modern';
  s.people[0].priorities = priorities({});
  const turret = addBuilding(s, 'gun_turret', camp(s) + 1);
  addBuilding(s, 'stockpile', camp(s) + 3).store = { electronics: 10, fuel: 20 };
  const raid = startRaid(s, RAID_KIND_BY_ID.marauders, 60, new Rng(5));
  raid.arrivesTick = s.tick;
  const hp = () => raid.raiders.reduce((n, r) => n + r.hp, 0);
  const before = hp();
  for (let t = 0; t < 2 * TICKS_PER_DAY / 24 && s.raid; t++) sim.step();
  assert.ok(hp() < before, 'the turret hit something ' + JSON.stringify({ raid: !!s.raid, phase: raid.phase, xs: raid.raiders.map((r) => [Math.round(r.x), r.hp, r.gone]), tx: turret.tile * 32, tick: s.tick }));
  assert.ok(turret.readyTick, 'it fired');
});
test('a medkit gets someone straight back up; a phoenix feather brings back the dead; Death takes the coin instead of the founder', async () => {
  const { knockDown, killPerson } = await import('../src/shared/sim/health');
  const s = plainGame('relics');
  const p = s.people[0];
  s.items.medkit = 1;
  knockDown(s, p);
  assert.equal(p.downed, null);
  assert.ok(p.hp > 0);
  assert.equal(s.items.medkit ?? 0, 0);
  knockDown(s, p);
  assert.ok(p.downed, 'no medkit left');
  s.items.deaths_bargain = 1;
  killPerson(s, p, 'in a test');
  assert.ok(!s.gameOver);
  assert.equal(s.items.deaths_bargain ?? 0, 0);
  s.items.phoenix_feather = 1;
  killPerson(s, p, 'again');
  assert.ok(!s.gameOver);
  killPerson(s, p, 'for good');
  assert.ok(s.gameOver);
});