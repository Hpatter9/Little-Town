import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BEAST_TRAITS, HUNGRY_FLEE, LOOSE_ROOM, RANCH_HOUR, RANCH_ROOM } from '../src/shared/data/ranch';
import { Rng } from '../src/shared/rng';
import { totalStock } from '../src/shared/sim/buildings';
import { ally } from '../src/shared/sim/classes';
import { parseCommand } from '../src/shared/sim/commands';
import {
  addBeast, beastMight, buildRanch, mountFight, ranchAllies, ranchCommand, ranchHourly, ranchOf, ranchRaidOver, ranchRoom, ranchView, setJobs,
} from '../src/shared/sim/ranch';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState, type Raid } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** A self-running town of `n` grown-ups with a ranch standing and food in store. */
function town(seed: string, n = 6, ranch = true): GameState {
  const s = plainGame(seed);
  s.townBuilds = true;
  const rng = new Rng(7);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name)));
  if (ranch) put(s, 'beast_ranch', c.x / 32 + 6 | 0);
  s.buildings.find((b) => b.def === 'campfire')!.store = { meat: 20, grain: 15, berries: 5 };
  s.autopilot = true;
  return s;
}

/** Run the ranch's mornings for `days` days from `from`. */
function mornings(s: GameState, from: number, days: number): void {
  for (let d = from; d < from + days; d++) {
    s.tick = at(d, RANCH_HOUR);
    ranchHourly(s);
  }
}

const fakeRaid = (s: GameState, raiders: Raid['raiders']): Raid => ({ id: s.nextId++, kind: 'wolves', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 0, raiders, prompt: null }) as Raid;

test('a beast tamed in a raid and still standing comes home to the ranch; a fallen one does not', () => {
  const s = town('ranch-tame');
  const tamer = s.people[1];
  const wolf = ally(s, 'wolf', 0, 1);
  wolf.tamedBy = tamer.id;
  const dead = ally(s, 'boar', 0, 1);
  dead.tamedBy = tamer.id;
  dead.down = true;
  ranchRaidOver(s, fakeRaid(s, [wolf, dead]));
  const r = ranchOf(s);
  assert.equal(r.beasts.length, 1);
  assert.equal(r.beasts[0].kind, 'wolf');
  assert.equal(r.beasts[0].from, 'tamed');
  assert.equal(r.beasts[0].by, tamer.name);
  assert.ok(r.beasts[0].traits.length >= 1);
  assert.ok(r.beasts[0].name.length > 1);
});

test('without a ranch the town keeps only a couple of beasts by the fire, and lays out a ranch for them', () => {
  const s = town('ranch-loose', 6, false);
  s.research.done.push('domestication');
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 80, stone: 40, hide: 20, meat: 50 };
  assert.equal(ranchRoom(s), LOOSE_ROOM);
  const rng = new Rng(3);
  for (let i = 0; i < 5; i++) addBeast(s, 'wolf', 'tamed', rng);
  assert.equal(ranchOf(s).beasts.length, LOOSE_ROOM);
  buildRanch(s);
  assert.ok(s.buildings.some((b) => b.def === 'beast_ranch'), 'a ranch is laid out');
  const done = town('ranch-room');
  assert.equal(ranchRoom(done), RANCH_ROOM);
});

test('the beasts eat from the stores: meat-eaters meat, grazers grain; starved, one runs off', () => {
  const s = town('ranch-feed');
  const rng = new Rng(1);
  addBeast(s, 'wolf', 'tamed', rng);
  addBeast(s, 'boar', 'tamed', rng);
  const before = totalStock(s);
  mornings(s, 2, 1);
  const after = totalStock(s);
  assert.ok((after.meat ?? 0) < (before.meat ?? 0), 'the wolf ate meat');
  assert.ok((after.grain ?? 0) < (before.grain ?? 0), 'the boar ate grain');
  // (now nothing in store at all)
  for (const b of s.buildings) b.store = {};
  ranchOf(s).beasts.forEach((b) => ((b.sick = undefined), (b.keep = true))); // (kept: the town may not sell them off instead)
  const n = ranchOf(s).beasts.length;
  mornings(s, 3, HUNGRY_FLEE + 1);
  assert.ok(ranchOf(s).beasts.length < n, 'a starving beast ran off');
  assert.ok(ranchOf(s).lost + ranchOf(s).died > 0, 'it ran off (or died of it)');
  assert.equal(ranchOf(s).sold, 0);
});

test('a pair of one kind breeds, and the cub takes after its parents', () => {
  const s = town('ranch-breed');
  const rng = new Rng(2);
  const ma = addBeast(s, 'wolf', 'tamed', rng, { traits: ['strong', 'fertile'] })!;
  const pa = addBeast(s, 'wolf', 'tamed', rng, { traits: ['keen', 'fertile'] })!;
  ma.sex = 'f';
  pa.sex = 'm';
  for (let d = 2; d < 40 && ranchOf(s).bred === 0; d++) {
    for (const b of ranchOf(s).beasts) (b.sick = undefined), (b.hp = 1);
    mornings(s, d, 1);
  }
  const cub = ranchOf(s).beasts.find((b) => b.from === 'bred');
  assert.ok(cub, 'a cub was born');
  assert.deepEqual(cub!.parents, [ma.id, pa.id]);
  assert.equal(cub!.gen, 2);
  assert.equal(cub!.kind, 'wolf');
  for (const t of cub!.traits) assert.ok(BEAST_TRAITS[t]);
});

test('the Beastmaster trains the beasts, and the town sets them to work: guards, hunters, haulers and a mount', () => {
  const s = town('ranch-work', 7);
  const rng = new Rng(4);
  const ranch = s.buildings.find((b) => b.def === 'beast_ranch')!;
  const keeper = s.people[2];
  keeper.skills.animals.level = 10;
  ranch.operator = keeper.id;
  const wolf = addBeast(s, 'wolf', 'tamed', rng, { traits: ['fierce'] })!;
  const boar = addBeast(s, 'boar', 'tamed', rng, { traits: ['strong'] })!;
  const bear = addBeast(s, 'cave_bear', 'tamed', rng, { traits: ['gentle'] })!;
  s.people[3].guard = true;
  for (const b of ranchOf(s).beasts) (b.sick = undefined), (b.keep = true); // (kept: a short town would sell them)
  setJobs(s);
  assert.equal(wolf.job, 'guard');
  assert.equal(boar.job, 'haul');
  assert.equal(bear.job, 'ride');
  assert.equal(bear.rider, s.people[3].id, 'a guard rides first');
  assert.ok(mountFight(s, s.people[3]) > 1, 'a rider strikes harder');
  assert.equal(mountFight(s, s.people[4]), 1);
  const lv = wolf.level;
  const stock = totalStock(s);
  for (let d = 2; d < 8; d++) {
    for (const b of ranchOf(s).beasts) (b.sick = undefined), (b.hp = 1);
    mornings(s, d, 1);
  }
  assert.ok(wolf.level > lv, 'trained up');
  assert.ok((totalStock(s).wood ?? 0) + (totalStock(s).stone ?? 0) > (stock.wood ?? 0) + (stock.stone ?? 0), 'the hauler brought in wood or stone');
  assert.ok(beastMight(wolf).hp > 1 && beastMight(wolf).damage > 1);
  // (the guards come out in a raid)
  for (const b of ranchOf(s).beasts) (b.sick = undefined), (b.hp = 1);
  setJobs(s);
  const guards = ranchOf(s).beasts.filter((b) => b.job === 'guard');
  assert.ok(guards.length >= 1);
  const raid = fakeRaid(s, []);
  assert.equal(ranchAllies(s, raid, (k) => ally(s, k, 0, 1)), guards.length);
  assert.equal(raid.raiders[0].ranch, guards[0].id);
  assert.ok(raid.raiders[0].maxHp > 0);
});

test('over its room the town sells the least worth, never one the player has kept; the player names a beast', () => {
  const s = town('ranch-sell');
  const rng = new Rng(5);
  for (let i = 0; i < RANCH_ROOM; i++) addBeast(s, 'wolf', 'tamed', rng);
  const keep = ranchOf(s).beasts[0];
  keep.level = 1;
  keep.traits = ['skittish'];
  assert.ok(parseCommand({ type: 'ranch', id: keep.id, op: 'keep', keep: true }));
  assert.equal(parseCommand({ type: 'ranch', id: keep.id, op: 'name', name: '' }), null);
  ranchCommand(s, keep.id, 'keep', undefined, true);
  ranchCommand(s, keep.id, 'name', 'Duchess');
  assert.equal(keep.name, 'Duchess');
  // (one more than room: brought in past it, as a raid's catch might)
  ranchOf(s).beasts.push({ ...keep, id: 99, name: 'Extra', keep: false, named: false, traits: ['sickly', 'skittish'] });
  const coins = s.coins ?? 0;
  mornings(s, 2, 1);
  assert.ok(ranchOf(s).beasts.includes(keep), 'the kept beast stays');
  assert.ok(ranchOf(s).beasts.length <= RANCH_ROOM);
  assert.ok((s.coins ?? 0) > coins, 'sold for coins');
  const v = snapshot(s).ranch!;
  assert.ok(v.beasts.some((b) => b.name === 'Duchess' && b.keep && b.named));
});

test('beasts grow old and die; the ranch is quiet with the autopilot off', () => {
  const s = town('ranch-old');
  const b = addBeast(s, 'rat', 'tamed', new Rng(6))!;
  b.born = -200 * TICKS_PER_DAY;
  mornings(s, 2, 1);
  assert.equal(ranchOf(s).beasts.length, 0);
  assert.equal(ranchOf(s).died, 1);
  const off = town('ranch-off');
  off.autopilot = false;
  addBeast(off, 'wolf', 'tamed', new Rng(1));
  const food = totalStock(off).meat;
  mornings(off, 2, 3);
  assert.equal(totalStock(off).meat, food, 'nothing eaten');
  assert.ok(ranchView(off));
});

test('a town of six with Domestication lays out a ranch even before it holds a beast, to catch them', () => {
  const s = town('ranch-unasked', 6, false);
  s.research.done.push('domestication');
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 80, stone: 40, hide: 20 };
  buildRanch(s);
  assert.ok(s.buildings.some((b) => b.def === 'beast_ranch'));
  const small = town('ranch-small', 5, false);
  small.research.done.push('domestication');
  small.buildings.find((b) => b.def === 'campfire')!.store = { wood: 80, stone: 40, hide: 20 };
  buildRanch(small);
  assert.ok(!small.buildings.some((b) => b.def === 'beast_ranch'), 'five, and no beast: not yet');
});

test('a pack\'s person (a kunoichi) is never kept in the pens, and one in an old save is let out; a rat is still kept', () => {
  const s = town('ranch-people');
  assert.equal(addBeast(s, 'kunoichi', 'caught', new Rng(1)), null);
  assert.equal(addBeast(s, 'dart_ninja', 'tamed', new Rng(1)), null);
  assert.ok(addBeast(s, 'rat', 'caught', new Rng(1)));
  const old = ranchOf(s);
  old.beasts.push({ ...old.beasts[0], id: old.next++, kind: 'kunoichi' });
  s.tick = at(2, RANCH_HOUR);
  ranchHourly(s);
  assert.deepEqual(ranchOf(s).beasts.map((b) => b.kind), ['rat']);
  const raid = fakeRaid(s, [{ ...ally(s, 'kunoichi', 0, 1), ally: false, down: true }]);
  ranchRaidOver(s, raid);
  assert.equal(ranchOf(s).beasts.length, 1);
});
