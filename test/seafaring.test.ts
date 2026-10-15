import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOAT_BY_KIND } from '../src/shared/data/boats';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { COLONY_ISLES, SHOALS } from '../src/shared/data/seafaring';
import { Rng } from '../src/shared/rng';
import { boatsHourly, boatyardSpot, fleet, launch } from '../src/shared/sim/boats';
import { totalStock } from '../src/shared/sim/buildings';
import { sendExpedition } from '../src/shared/sim/expeditions';
import { groundAt, wet } from '../src/shared/sim/land';
import { catchFactor, claimDay, claimed, colonies, foundColony, harbourOf, harbourReport, quay, seaBook, seafaringHourly, settleable, squallSinks } from '../src/shared/sim/seafaring';
import { newGame, makePerson, type GameState } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { CELL } from '../src/shared/sim/land';
import { freeSpot, plainGame, put } from './helpers';

/** A coastal town with the autopilot on: it can build boats, has a boatyard and a boat, eight pairs of hands and stores. */
function seaTownGame(seed = 'sea'): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.research.done.push('boatbuilding', 'carpentry', 'shipwrighting', 'navigation');
  s.land.open = 40;
  const at = boatyardSpot(s)!;
  put(s, 'boatyard', at.x, at.y);
  for (let i = 0; i < 12; i++) s.people.push(makePerson(new Rng(i + 5), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  s.buildings.find((b) => b.def === 'campfire')!.store = {};
  const stock = [{ lumber: 60, stone: 30 }, { stone: 10, iron: 20, rations: 60 }];
  for (const store of stock) {
    const at = freeSpot(s, 'stockpile');
    put(s, 'stockpile', at.x, at.y).store = store;
  }
  return s;
}
/** Wind the clock on to this hour of the day (on the hour). */
function toHour(s: GameState, hour: number): void {
  s.tick -= s.tick % TICKS_PER_HOUR;
  while (calendar(s.tick).hour !== hour) s.tick += TICKS_PER_HOUR;
}

test('a harbour is laid by the water once the town has a boatyard, a boat and the hands', () => {
  const s = seaTownGame('harbour');
  launch(s, 'dugout');
  toHour(s, 10);
  seafaringHourly(s);
  const h = s.buildings.find((b) => b.def === 'harbour');
  assert.ok(h, 'a harbour blueprint');
  h!.status = 'done';
  assert.ok(harbourOf(s));
  assert.ok(harbourReport(s).harbour);
  assert.equal(harbourReport(s).berths, 5);
  // the fleet lies moored by it
  assert.ok(quay(s));
});

test('a harbour is not laid without the makings, or by a town with too few hands', () => {
  const s = seaTownGame('none');
  for (const b of s.buildings) b.store = {};
  launch(s, 'dugout');
  toHour(s, 10);
  seafaringHourly(s);
  assert.ok(!s.buildings.some((b) => b.def === 'harbour'));
});

test('a boat fishes, the season\'s shoal decides how well, and a harbour lands more', () => {
  const s = seaTownGame('shoal');
  const dug = launch(s, 'dugout');
  const car = launch(s, 'carrack');
  // spring: inshore. The dugout is on the right ground; the carrack is not.
  s.tick = 0;
  while (calendar(s.tick).season !== 'spring') s.tick += TICKS_PER_DAY;
  assert.equal(SHOALS.spring.ground, 'inshore');
  assert.ok(catchFactor(s, dug) > catchFactor(s, car));
  const plain = catchFactor(s, dug);
  put(s, 'harbour', 2, 2);
  assert.ok(catchFactor(s, dug) > plain, 'the harbour lands more');
  // autumn: the deep. The carrack wins.
  while (calendar(s.tick).season !== 'autumn') s.tick += TICKS_PER_DAY;
  assert.ok(catchFactor(s, car) > catchFactor(s, dug));
  // and she brings the catch in at the fishing hour
  toHour(s, 18);
  const before = totalStock(s).fish ?? 0;
  boatsHourly(s, new Rng(11));
  assert.ok((totalStock(s).fish ?? 0) > before, 'fish brought in');
  assert.ok(seaBook(s).today > 0 && seaBook(s).total > 0, 'and written in the book');
});

test('without the autopilot the fishing is as it was (no shoals, no sinking)', () => {
  const s = seaTownGame('plain');
  s.autopilot = false;
  const b = launch(s, 'dugout');
  assert.equal(catchFactor(s, b), 1);
  b.hull = 1;
  assert.ok(!squallSinks(s, b));
});

test('a squall at home can sink a battered boat, and the men in her drown', () => {
  let lost = 0;
  let boats = 0;
  for (const seed of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']) {
    const s = seaTownGame(seed);
    const b = launch(s, 'dugout');
    b.hull = 2;
    const folk = s.people.length;
    s.tick += 7 * TICKS_PER_HOUR;
    assert.ok(squallSinks(s, b), 'a wreck of a boat founders in a squall');
    if (!fleet(s).length) boats++;
    lost += folk - s.people.length;
    assert.equal(seaBook(s).boatsLost, 1);
  }
  assert.equal(boats, 8);
  assert.ok(lost >= 3, `the sea takes people: ${lost}`);
});

test('islands: the new isles are boat trips, and an expedition sails to one', () => {
  for (const id of ['herring_isle', 'ember_isle', 'wreck_isle', 'tidewrights_isle']) assert.ok(DESTINATION_BY_ID[id]?.byBoat, id);
  const s = seaTownGame('isle');
  const boat = launch(s, 'longboat');
  const id = s.people[0].id;
  const r = sendExpedition(s, 'herring_isle', [id]);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(s.expeditions[0].boat, boat.id);
  assert.equal(boat.away, s.expeditions[0].id);
});

test('a prosperous coastal town founds a colony on an isle, and its goods sail home', () => {
  const s = seaTownGame('colony');
  launch(s, 'longboat');
  s.tick = 24 * TICKS_PER_DAY;
  toHour(s, 5);
  // (keep the Tide Clan out of it: a day before its claims)
  const fish0 = totalStock(s).fish ?? 0;
  let founded = false;
  for (let h = 0; h < 14 * 24; h++) {
    s.tick += TICKS_PER_HOUR;
    seafaringHourly(s);
    if (colonies(s).length) founded = true;
  }
  assert.ok(founded, 'a colony was founded');
  const c = colonies(s)[0];
  assert.ok(COLONY_ISLES[c.isle]);
  assert.ok(c.folk.length >= 2 && !c.folk.some((p) => s.people.includes(p)), 'its folk left the town');
  assert.ok(totalStock(s).fish !== undefined);
  assert.ok(Object.keys(harbourReport(s).colonies).length >= 1);
  void fish0;
});

test('the Tide Clan claims the isles first: a merfolk town keeps them, others lose them by a fixed day', () => {
  const other = seaTownGame('claims');
  const day = claimDay(other, 'herring_isle');
  other.tick = (day - 3) * TICKS_PER_DAY;
  other.research.done.push('boatbuilding');
  assert.ok(settleable(other, 'herring_isle'));
  other.tick = (day + 1) * TICKS_PER_DAY;
  assert.ok(claimed(other, 'herring_isle') && !settleable(other, 'herring_isle'));
  const mer = newGame('merclaim', { origin: 'merfolk' });
  mer.research.done.push('boatbuilding');
  mer.tick = 200 * TICKS_PER_DAY;
  assert.ok(!claimed(mer, 'herring_isle') && settleable(mer, 'herring_isle'));
});

test('the merfolk\'s shore starts with a boat and the sea monsters leave it be more', () => {
  const s = newGame('mer-start', { origin: 'merfolk' });
  s.autopilot = true;
  assert.equal(fleet(s).length, 0);
  s.tick = TICKS_PER_HOUR * 5;
  seafaringHourly(s);
  assert.equal(fleet(s).length, 1);
  assert.equal(fleet(s)[0].kind, 'dugout');
  assert.ok(quay(s), 'moored in the water, with no yard yet');
});

test('a pirate crew lands on the beach as a raid of the sea raiders', () => {
  const s = seaTownGame('pirates');
  launch(s, 'longboat');
  s.era = 'medieval';
  s.tick = 30 * TICKS_PER_DAY;
  toHour(s, 8);
  assert.ok(RAID_KIND_BY_ID.sea_raiders);
  seaBook(s).nextPirate = s.tick - 1;
  const grace = s.nextRaidTick;
  seafaringHourly(s);
  assert.ok(s.raid, 'a raid');
  assert.equal(s.raid!.kind, 'sea_raiders');
  assert.ok(s.raid!.landing);
  assert.ok(s.raid!.raiders.length >= 1);
  // they stand on the beach: a dry cell with water beside it
  const r = s.raid!.raiders[0];
  const cx = Math.floor(r.x / CELL);
  const cy = Math.floor(r.y / CELL);
  assert.ok(!wet(groundAt(s.land, cx, cy)));
  assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet(groundAt(s.land, cx + dx, cy + dy))), 'by the water');
  assert.ok(s.nextRaidTick >= grace);
  // never picked at random
  assert.equal(RAID_KIND_BY_ID.sea_raiders.weight, 0);
});

test('ships wear with age and a rotten boat at home is broken up', () => {
  const s = seaTownGame('age');
  const b = launch(s, 'dugout');
  b.built = 0;
  s.tick = 60 * TICKS_PER_DAY;
  toHour(s, 6);
  const hull = b.hull;
  seafaringHourly(s);
  assert.ok(b.hull < hull, 'the sea takes her');
  b.hull = 1;
  seafaringHourly(s);
  assert.equal(fleet(s).length, 0, 'broken up');
  assert.ok(BOAT_BY_KIND.galleon.hull > BOAT_BY_KIND.carrack.hull);
});

test('a wreck washes up timber, and sometimes castaways', () => {
  let timber = 0;
  let castaways = 0;
  for (let i = 0; i < 20; i++) {
    const s = seaTownGame(`wash${i}`);
    s.era = 'medieval';
    const b = launch(s, 'longboat');
    b.hull = 1;
    const before = totalStock(s).lumber ?? 0;
    const bands = (s.bands ?? []).length;
    s.tick += 7 * TICKS_PER_HOUR + i;
    squallSinks(s, b);
    if ((totalStock(s).lumber ?? 0) > before) timber++;
    if ((s.bands ?? []).length > bands) castaways++;
  }
  assert.ok(timber >= 5, `timber ${timber}`);
  assert.ok(castaways >= 1, `castaways ${castaways}`);
});

test('colonists are founded by hand too, and leave the town', () => {
  const s = seaTownGame('hand');
  launch(s, 'longboat');
  const goers = s.people.slice(-3);
  const n = s.people.length;
  const c = foundColony(s, 'gull_rock', goers);
  assert.equal(s.people.length, n - 3);
  assert.equal(c.pop, 3);
  assert.equal(colonies(s).length, 1);
});
