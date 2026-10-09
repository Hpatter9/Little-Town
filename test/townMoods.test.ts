import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { buildingDoor } from '../src/shared/sim/buildings';
import { CELL, makeLand, type LandMap } from '../src/shared/sim/land';
import { isHealer, pastimeFor, plagueOn, sickHomes } from '../src/shared/sim/pastimes';
import { newTickContext, SHELTER_RUN, updatePerson } from '../src/shared/sim/people';
import { startRaid } from '../src/shared/sim/raids';
import { snapshot } from '../src/shared/sim/snapshot';
import type { Building, GameState, Person } from '../src/shared/sim/state';
import { burning, coughing, COUGH_EVERY, COUGH_FOR, homeWealth, markedDoors, POOR_COINS, RICH_COINS, smokeRate, type Purse } from '../src/renderer/map/moodRules';
import { flagRate, millSide, sailSpeed } from '../src/renderer/map/machinery';
import { boardsFor, compass, crossroads, SIGN_APART, townBearing, type Place } from '../src/renderer/map/signRules';
import { clearAround, freeSpot, plainGame, put } from './helpers';

const twin = (s: GameState, extra: Partial<Person>): Person => {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, partner: null, ...extra };
  s.people.push(p);
  return p;
};
const home = (extra: Partial<Building> = {}): Building => ({ id: 7, def: 'lean_to', tile: 0, row: 0, status: 'done', delivered: {}, progress: 1, store: {}, ...extra });
const purse = (id: number, coins: number | null, extra: Partial<Purse> = {}): Purse => ({ id, coins, debt: 0, bedId: 7, child: false, ...extra });

test("a rich owner's home is dressed well; a home of the poor gathers clutter", () => {
  assert.equal(homeWealth(home({ owner: 1 }), [purse(1, RICH_COINS + 10)]), 'rich');
  assert.equal(homeWealth(home(), [purse(1, POOR_COINS - 1), purse(2, 0)]), 'poor', "the treasury's, everyone under it poor");
  assert.equal(homeWealth(home(), [purse(1, 50), purse(2, 0, { debt: 3 })]), 'plain', 'one of them getting by');
  assert.equal(homeWealth(home(), [purse(1, 50, { debt: 5 }), purse(2, 1)]), 'poor', 'in debt counts as poor');
  assert.equal(homeWealth(home({ owner: 1 }), [purse(1, 60), purse(2, 0)]), 'plain', 'an owner getting by keeps it tidy');
  assert.equal(homeWealth(home(), [purse(1, null)]), 'plain', 'no money in town yet');
  assert.equal(homeWealth(home({ status: 'blueprint' }), [purse(1, 0)]), 'plain');
  assert.equal(homeWealth(home({ def: 'smithy', owner: 1 }), [purse(1, 999)]), 'plain', 'only homes');
});

test('the sick cough now and then, oftener in a plague; their homes are marked in a plague', () => {
  let n = 0;
  let m = 0;
  for (let t = 0; t < COUGH_EVERY * 4; t += 100) {
    if (coughing(3, t, false)) n++;
    if (coughing(3, t, true)) m++;
  }
  assert.ok(n > 0 && n <= Math.ceil((4 * COUGH_FOR) / 100) + 1, `coughs ${n}`);
  assert.ok(m > n, 'oftener in a plague');
  const doors = markedDoors([{ sick: true, bedId: 5 }, { sick: false, bedId: 6 }, { sick: true, bedId: null }, { sick: true, bedId: 8, away: 'the Barrow' }]);
  assert.deepEqual([...doors], [5]);
});

test('a plague is a pestilence doom or many sick; the healer goes the rounds of the sick households', () => {
  assert.equal(plagueOn({ kind: 'plague', phase: 'active' }, 0), true);
  assert.equal(plagueOn({ kind: 'plague', phase: 'signs' }, 0), false);
  assert.equal(plagueOn({ kind: 'drought', phase: 'active' }, 1), false);
  assert.equal(plagueOn(null, 3), true);
  const s = plainGame('rounds');
  const healer = s.people[0];
  const hut = put(s, 'healers_hut', freeSpot(s, 'healers_hut').x, freeSpot(s, 'healers_hut').y, { operator: healer.id });
  const spot = freeSpot(s, 'lean_to');
  const house = put(s, 'lean_to', spot.x, spot.y);
  const sick = twin(s, { bed: house.id, sick: { until: 1e9 } });
  assert.ok(isHealer(s, healer));
  assert.notEqual(pastimeFor(s, healer, 0)?.pastime, 'rounds', 'no plague yet');
  s.doom = { kind: 'plague', phase: 'active', untilTick: s.tick + 1e6 };
  assert.deepEqual(sickHomes(s), [house.id]);
  const go = pastimeFor(s, healer, 0)!;
  assert.equal(go.pastime, 'rounds');
  const d = buildingDoor(house);
  assert.ok(Math.hypot(go.x - d.x, go.y - d.y) < CELL, 'to the sick household door');
  assert.notEqual(pastimeFor(s, sick, 0)?.pastime, 'rounds', 'only the healer');
  hut.operator = null;
  assert.equal(isHealer(s, healer), false);
  healer.task = { type: 'idle', untilTick: s.tick + 100, pastime: 'rounds' };
  assert.equal(snapshot(s).people.find((p) => p.id === healer.id)!.rounds, true, 'drawn masked');
});

test('at the alarm the children run for home faster than a walk', () => {
  const s = plainGame('run-home');
  clearAround(s, 14);
  const spot = { x: s.land.camp.x + 9, y: s.land.camp.y + 2 };
  const house = put(s, 'lean_to', spot.x, spot.y);
  const grown = s.people[0];
  grown.priorities = { ...grown.priorities, defend: 0 };
  grown.bed = house.id;
  const kid = twin(s, { bornTick: s.tick, bed: house.id, x: grown.x, y: grown.y, task: null });
  startRaid(s, RAID_KIND_BY_ID.bandits, 10, new Rng(3)).prompt = null; // (no bribe asked: the alarm goes up)
  grown.task = null;
  const ctx = newTickContext();
  const rng = new Rng(9);
  const d = buildingDoor(house);
  const from = (p: Person) => Math.hypot(p.x - d.x, p.y - d.y);
  const start = from(kid);
  for (let i = 0; i < 30; i++) {
    updatePerson(s, grown, rng, ctx);
    updatePerson(s, kid, rng, ctx);
  }
  assert.equal(kid.task?.type, 'shelter');
  assert.equal((grown.task as Person['task'])?.type, 'shelter');
  assert.ok(SHELTER_RUN > 1);
  assert.ok(from(kid) < from(grown) - 4 && from(kid) < start, `the child ahead (${from(kid).toFixed(0)} against ${from(grown).toFixed(0)})`);
});

test('smoke rises over every building alight, thinner on a slow phone', () => {
  assert.deepEqual(burning([home({ fire: 0.2 }), home({ id: 8 })]).map((b) => b.id), [7]);
  assert.ok(smokeRate(true) < smokeRate(false) && smokeRate(true) > 0);
});

test('the sails turn with the wind, the banners stir faster as it rises, a mill by the river has a wheel', () => {
  assert.equal(sailSpeed(0), 0);
  assert.ok(sailSpeed(2.2) > sailSpeed(0.45));
  assert.equal(flagRate(0), 0);
  assert.ok(flagRate(1) > flagRate(0.3));
  const land = makeLand('mill', 'forest');
  const blank = { ...land, cells: '.'.repeat(land.w * land.h) } as LandMap;
  const f = { x: 10, y: 10, w: 3, h: 2 };
  assert.equal(millSide(blank, f), null);
  const cells = blank.cells.split('');
  cells[11 * land.w + 13] = 'w';
  assert.equal(millSide({ ...blank, cells: cells.join('') }, f), 'e');
});

test('signposts at the crossroads name the country each way, and the rival towns', () => {
  assert.equal(compass(1, 0), 'east');
  assert.equal(compass(0, -1), 'north');
  assert.equal(compass(-1, 1), 'south-west');
  const land = makeLand('signs', 'forest');
  const c = land.camp;
  const roads = land.roads.split('');
  // a crossroads east of the camp, and another too near it to have a post of its own
  for (let x = c.x + 2; x <= c.x + 14; x++) roads[c.y * land.w + x] = '#';
  for (let y = c.y - 3; y <= c.y + 3; y++) {
    roads[y * land.w + c.x + 6] = '#';
    roads[y * land.w + c.x + 6 + SIGN_APART - 3] = '#';
  }
  const map = { ...land, roads: roads.join(''), open: 20 };
  const xs = crossroads(map, () => true);
  assert.equal(xs.length, 1, 'one post for two crossroads close together');
  assert.equal(xs[0].x, c.x + 6);
  assert.equal(xs[0].legs.length, 4);
  const places: Place[] = [
    { name: 'Larksmeadow', bearing: null, x: c.x + 60, y: c.y + 4, town: false },
    { name: 'the Grey Barrens', bearing: null, x: c.x, y: c.y - 70, town: false },
    { name: 'Gallows Hold', bearing: 0, x: 0, y: 0, town: true },
  ];
  const boards = boardsFor(xs[0], xs[0].legs, places);
  const east = boards.find((b) => b.dir === 'east')!;
  assert.deepEqual(east.names, ['Larksmeadow', 'Gallows Hold']);
  assert.deepEqual(boards.find((b) => b.dir === 'north')!.names, ['the Grey Barrens']);
  assert.equal(boards.find((b) => b.dir === 'south'), undefined, 'nothing that way: no board');
  assert.equal(townBearing('nowhere'), null);
  assert.ok(townBearing('druid')! < 0, "the druids' grove lies north-east");
});
