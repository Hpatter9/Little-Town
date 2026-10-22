import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { FORGED_UNIQUES, UNIQUES } from '../src/shared/data/uniques';
import { finishPiece } from '../src/shared/sim/crafting';
import { killPerson } from '../src/shared/sim/health';
import { noteBossFelled, noteUnique, uniquesHourly } from '../src/shared/sim/provenance';
import { credit } from '../src/shared/sim/raidRecap';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type CraftOrder, type Raid, type Raider } from '../src/shared/sim/state';
import { TICKS_PER_DAY, calendarOf } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

/** A plain game with a few more townsfolk. */
function town(seed: string) {
  const s = plainGame(seed);
  for (let i = 0; i < 2; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  s.autopilot = true;
  return s;
}

const order = (item: string): CraftOrder => ({ id: 1, item, count: 1, delivered: {}, itemsTaken: true, progress: 0, made: 0 });

test('a forged unique keeps its maker, the day, the station and its piece', () => {
  const s = plainGame('prov-forge');
  s.autopilot = true;
  s.tick = 3 * TICKS_PER_DAY;
  const id = FORGED_UNIQUES[0];
  const smith = s.people[0];
  const o = order(id);
  s.crafting.push(o);
  finishPiece(s, o, smith, new Rng(5));
  const r = s.uniqueLog?.[id];
  assert.ok(r, 'a story is kept');
  assert.equal(r.how, 'forged');
  assert.deepEqual(r.by, [{ id: smith.id, name: smith.name }]);
  assert.equal(r.day, calendarOf(s).day);
  assert.ok(r.where, 'the station is named');
  assert.equal(typeof r.qn, 'number');
});

test('a plain game (no autopilot) keeps no story', () => {
  const s = plainGame('prov-plain');
  const id = FORGED_UNIQUES[0];
  const o = order(id);
  s.crafting.push(o);
  finishPiece(s, o, s.people[0], new Rng(5));
  assert.equal(s.uniqueLog, undefined);
});

test('each bearer is added as they take it up, once each turn', () => {
  const s = town('prov-bearers');
  const id = UNIQUES[0].id;
  (s.uniques ??= []).push(id);
  noteUnique(s, id, 'found', { where: 'the Brood Mother' });
  const [a, b] = s.people;
  a.gear.weapon = id;
  uniquesHourly(s);
  uniquesHourly(s);
  assert.deepEqual(s.uniqueLog![id].bearers!.map((x) => x.id), [a.id]);
  delete a.gear.weapon;
  b.gear.weapon = id;
  s.tick += TICKS_PER_DAY;
  uniquesHourly(s);
  assert.deepEqual(s.uniqueLog![id].bearers!.map((x) => x.id), [a.id, b.id]);
  assert.equal(s.uniqueLog![id].bearers![1].day, calendarOf(s).day);
});

test('a unique found before the log starts one when someone takes it up, its coming unknown', () => {
  const s = plainGame('prov-old');
  s.autopilot = true;
  const id = UNIQUES[1].id;
  s.uniques = [id];
  s.people[0].gear.weapon = id;
  uniquesHourly(s);
  const r = s.uniqueLog![id];
  assert.equal(r.how, undefined);
  assert.equal(r.day, 0);
  assert.equal(r.bearers!.length, 1);
});

test('raiders felled and bosses brought down with it in hand are its deeds', () => {
  const s = town('prov-deeds');
  const id = UNIQUES[0].id;
  s.uniques = [id];
  const p = s.people[0];
  p.gear.weapon = id;
  const foe = Object.values(ENEMIES).find((e) => !e.boss && !e.kit)!.id;
  const boss = Object.values(ENEMIES).find((e) => e.boss && e.kit)!;
  const raider = (kind: string, hp: number): Raider => ({ kind, hp, down: false } as unknown as Raider);
  const a = raider(foe, 10);
  const b = raider(boss.id, 10);
  s.raid = { tally: {} } as unknown as Raid;
  const was: [Raider, number, boolean][] = [[a, 10, false], [b, 10, false]];
  a.hp = 0;
  a.down = true;
  b.hp = 0;
  b.down = true;
  credit(s, p.id, was);
  assert.equal(s.uniqueLog![id].felled, 2);
  assert.deepEqual(s.uniqueLog![id].bosses, [boss.name]);
  noteBossFelled(s, [p, s.people[1]], 'the Dragon');
  assert.deepEqual(s.uniqueLog![id].bosses, [boss.name, 'the Dragon']);
});

test('a bearer dying on the road takes it with them; at home it goes back to the armoury', () => {
  const s = town('prov-death');
  const [far, near] = s.people.slice(0, 2);
  const lost = UNIQUES[0].id;
  const kept = UNIQUES[1].id;
  s.uniques = [lost, kept];
  far.gear.weapon = lost;
  near.gear.weapon = kept;
  far.away = 1;
  uniquesHourly(s);
  killPerson(s, far, 'the road');
  killPerson(s, near, 'old age');
  uniquesHourly(s);
  assert.equal(s.uniqueLog![lost].gone?.how, 'lost on the road');
  assert.equal(s.uniqueLog![lost].gone?.with, far.name);
  assert.equal(s.uniqueLog![kept].gone, undefined);
  assert.equal(s.items[kept], 1);
});

test('the snapshot tells each unique\'s story, and copes with an older save', () => {
  const s = plainGame('prov-snap');
  s.autopilot = true;
  const id = UNIQUES[0].id;
  s.uniques = [id];
  s.items[id] = 1;
  let v = snapshot(s).uniques.find((u) => u.id === id)!;
  assert.equal(v.story, undefined, 'none kept: nothing told');
  noteUnique(s, id, 'found', { where: ITEM_BY_ID[id].name });
  v = snapshot(s).uniques.find((u) => u.id === id)!;
  assert.equal(v.story?.how, 'found');
  assert.equal(v.at, 'armoury');
});
