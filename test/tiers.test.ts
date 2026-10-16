import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { Rng } from '../src/shared/rng';
import { tierNames, TIER_RULES } from '../src/shared/data/tiers';
import { hasMilestone, markMilestone } from '../src/shared/sim/milestones';
import { tallyRaid } from '../src/shared/sim/annals';
import { generationLines, meetsTier, tierOf, tierPhrase, tiersHourly } from '../src/shared/sim/tiers';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

/** A town with `pop` living in it and `homes` buildings standing, on `day`, with the autopilot on. */
function town(pop: number, homes: number, day: number, extra: string[] = []): GameState {
  const s = plainGame('tier');
  s.autopilot = true;
  const rng = new Rng(3);
  while (s.people.length < pop) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name)));
  for (let i = 0; i < homes; i++) put(s, 'house', 100 + i * 4);
  for (const d of extra) put(s, d, 300);
  s.tick = (day - 1) * TICKS_PER_DAY + 4 * TICKS_PER_HOUR;
  s.tick -= s.tick % TICKS_PER_HOUR;
  return s;
}
const onlyHouses = (s: GameState) => s.buildings.filter((b) => b.def === 'house').length;

test('a rung asks for people, buildings and days together', () => {
  const s = town(6, 4, 3);
  assert.ok(onlyHouses(s) === 4);
  assert.equal(tierOf(s, 0) >= 1, true, 'a hamlet by six people, four roofs and three days');
  const young = town(6, 4, 1);
  assert.equal(tierOf(young, 0), 0, 'too early for a hamlet');
  const empty = town(6, 0, 20);
  assert.equal(tierOf(empty, 0), 0, 'people without buildings are still a camp');
});

test('a market town needs its market, a walled town its wall closed', () => {
  const s = town(30, 40, 40);
  assert.equal(tierOf(s, 0), 2, 'a village until it has a market');
  put(s, 'market', 400);
  assert.equal(tierOf(s, 0), 3);
  s.ring = { gen: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, wall: 'palisade_wall', gate: 'palisade_gate', gates: [], done: true };
  assert.equal(tierOf(s, 0), 4, 'walled town');
  assert.equal(meetsTier(s, 5), false, 'a town needs the seat at its second stage');
});

test('a rung falls only past its slack', () => {
  const s = town(30, 40, 40, ['market']);
  assert.equal(tierOf(s, 3), 3);
  s.people.length = 14; // (16 asked; 80% of it is 13)
  assert.equal(tierOf(s, 3), 3, 'a death or two does not drop it');
  s.people.length = 5;
  assert.equal(tierOf(s, 3), 1, 'but a disaster does');
});

test('each people may call the rungs its own names', () => {
  assert.equal(tierNames('dwarves')[3], 'Market Hold');
  assert.equal(tierNames('settlers')[3], 'Market Town');
  assert.equal(TIER_RULES.length, tierNames('vampire').length);
  const s = town(20, 20, 30, ['market']);
  assert.equal(tierPhrase(s, 3), 'a Market Town');
  s.origin = 'orcs';
  assert.equal(tierPhrase(s, 0), 'a War Camp');
  s.origin = 'robot';
  assert.equal(tierPhrase(s, 0), 'an Outpost');
});

test('the hourly look starts quietly, then celebrates a rise and tells a fall', () => {
  const s = town(2, 0, 1);
  tiersHourly(s);
  assert.equal(s.rank!.tier, 0);
  assert.equal(s.rank!.last, undefined);
  for (let i = 0; i < 12; i++) put(s, 'house', 200 + i * 4);
  const rng = new Rng(4);
  while (s.people.length < 12) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name)));
  s.tick += 20 * TICKS_PER_DAY;
  tiersHourly(s);
  assert.equal(s.rank!.tier, 2);
  assert.equal(s.rank!.last!.kind, 'rise');
  assert.match(s.rank!.last!.to, /Village/);
  assert.match(s.rank!.last!.memory ?? '', new RegExp(s.people[0].name));
  assert.ok(s.journal.some((e) => /Village/.test(e.text)));
  s.people.length = 3;
  s.tick += TICKS_PER_HOUR;
  tiersHourly(s);
  assert.equal(s.rank!.tier, 0, 'a disaster can drop it');
  assert.equal(s.rank!.last!.kind, 'fall');
  assert.equal(s.rank!.best, 2);
  // (a rank regained is noted, not made a new card)
  const key = s.rank!.last!.key;
  while (s.people.length < 12) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name)));
  s.tick += TICKS_PER_HOUR;
  tiersHourly(s);
  assert.equal(s.rank!.tier, 2);
  assert.equal(s.rank!.last!.key, key);
});

test('the rank takes no ids from the town', () => {
  const s = town(2, 0, 1);
  const next = s.nextId;
  tiersHourly(s);
  s.tick += TICKS_PER_HOUR;
  markMilestone(s, 'death');
  markMilestone(s, 'wedding');
  assert.equal(s.nextId, next);
  const ids = s.journal.slice(-2).map((e) => e.id);
  assert.ok(ids[0] < ids[1] && ids[1] < next, 'in order, before the next real id');
});

test('a first is recorded once, and only with the autopilot on', () => {
  const s = plainGame('first');
  s.autopilot = false;
  assert.equal(markMilestone(s, 'death'), false);
  assert.equal(s.milestones, undefined);
  s.autopilot = true;
  assert.equal(markMilestone(s, 'death'), true);
  assert.equal(markMilestone(s, 'death'), false);
  assert.deepEqual(s.milestones, [{ id: 'death', day: 1 }]);
  assert.equal(s.milestonesFrom, 1);
});

test('the firsts the state shows are found in the hourly look', () => {
  const s = town(3, 0, 1);
  tiersHourly(s);
  assert.equal(hasMilestone(s, 'child'), false);
  s.people[1].parents = [s.people[0].id];
  s.people[0].married = true;
  s.fallen = [{ id: 99, name: 'Old Tom', day: 1, cause: 'of old age', level: 1, calling: null, titles: [], felled: 0, trips: 0, founder: false }];
  s.tick += TICKS_PER_HOUR;
  tiersHourly(s);
  for (const id of ['child', 'wedding', 'death'] as const) assert.equal(hasMilestone(s, id), true, id);
  assert.equal(hasMilestone(s, 'day100'), false);
  s.tick += 100 * TICKS_PER_DAY;
  tiersHourly(s);
  assert.equal(hasMilestone(s, 'day100'), true);
});

test('raids won and lost are firsts of their own', () => {
  const s = plainGame('raids');
  s.autopilot = true;
  tallyRaid(s, 'driven');
  assert.equal(hasMilestone(s, 'raidWon'), true);
  assert.equal(hasMilestone(s, 'raidLost'), false);
  tallyRaid(s, 'pillaged');
  assert.equal(hasMilestone(s, 'raidLost'), true);
});

test('the founders gone is a first, and the Chronicle says so', () => {
  const s = town(3, 0, 1);
  tiersHourly(s);
  assert.deepEqual(generationLines(s).slice(1), ['All 3 who founded the town still live.']);
  const founders = [...s.rank!.founders];
  s.people = s.people.filter((p) => !founders.includes(p.id));
  s.people.push(makePerson(new Rng(9), s.nextId++, 'gatherer', { x: 0, y: 0 }, []));
  s.tick += TICKS_PER_HOUR;
  tiersHourly(s);
  assert.equal(hasMilestone(s, 'generation'), true);
  assert.ok(generationLines(s).includes('None who founded the town still live.'));
});

test('a rising generation is told', () => {
  const s = town(3, 0, 1);
  tiersHourly(s);
  const [a, b] = s.people;
  const kid = makePerson(new Rng(5), s.nextId++, 'gatherer', { x: 0, y: 0 }, []);
  kid.parents = [a.id, b.id];
  const grand = makePerson(new Rng(6), s.nextId++, 'gatherer', { x: 0, y: 0 }, []);
  grand.parents = [kid.id];
  s.people.push(kid, grand);
  s.kin = {
    [a.id]: { id: a.id, name: a.name, parents: [], born: 0, female: false },
    [b.id]: { id: b.id, name: b.name, parents: [], born: 0, female: true },
    [kid.id]: { id: kid.id, name: kid.name, parents: [a.id, b.id], born: 2, female: false },
    [grand.id]: { id: grand.id, name: grand.name, parents: [kid.id], born: 4, female: false },
  };
  s.tick += TICKS_PER_HOUR;
  tiersHourly(s);
  assert.equal(s.rank!.gen, 3);
  assert.ok(s.journal.some((e) => e.text === 'The third generation now works the fields.'));
});

test('the snapshot carries the rank and the milestones', () => {
  const s = town(3, 0, 1);
  tiersHourly(s);
  markMilestone(s, 'death');
  const v = snapshot(s);
  assert.equal(v.rank.phrase, 'a Camp');
  assert.equal(v.annals.milestones![0].id, 'death');
  assert.equal(v.annals.milestonesFrom, 1);
});
