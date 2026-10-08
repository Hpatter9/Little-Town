import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { DEEP_H, DEEP_LEVELS, DEEP_RAIDS, DEEP_W, DEEPEST, FUNGUS_FOOD, OPEN_AFTER, RISE_AT, SHAFT } from '../src/shared/data/deep';
import { cellAt, cellIndex, deepFarms, deepHourly, deepOf, deepTarget, digDeep, ENTRY, frontier, isDiggable, makeLevel, workingLevel } from '../src/shared/sim/deep';
import { workMine } from '../src/shared/sim/farming';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { totalStock } from '../src/shared/sim/buildings';
import { plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

test('the Deep is wired in: a topic, the shaft, five levels, and a raid of real creatures for each', () => {
  assert.ok(TOPIC_BY_ID.delving, 'Delving');
  assert.equal(BUILDING_BY_ID[SHAFT].research, 'delving');
  assert.equal(DEEP_LEVELS.length, DEEPEST);
  for (const k of DEEP_RAIDS) {
    assert.ok(Object.keys(k.enemies).length > 0, `${k.id} has creatures`);
    for (const id of Object.keys(k.enemies)) assert.ok(ENEMIES[id], id);
  }
  for (const def of DEEP_LEVELS) assert.ok(RAID_KIND_BY_ID[def.raid], def.raid);
});

test('a level is made from the seed: rock with ore, its pockets, the way up in a little chamber', () => {
  for (const def of DEEP_LEVELS) {
    const a = makeLevel('deep-seed', def.depth);
    const b = makeLevel('deep-seed', def.depth);
    assert.equal(a.cells, b.cells, 'the same seed, the same level');
    assert.equal(a.cells.length, DEEP_W * DEEP_H);
    assert.equal(cellAt(a, cellIndex(ENTRY, 0)), '^');
    const count = (c: string) => [...a.cells].filter((x) => x === c).length;
    if (def.pockets.lake) assert.ok(count('~') > 0, `${def.name}: a lake`);
    if (def.pockets.ruin) assert.ok(count('R') > 0, `${def.name}: a ruin`);
    if (def.pockets.crystal) assert.ok(count('C') > 0, `${def.name}: crystal`);
    const ore = Object.values(a.pools).filter((st) => Object.keys(st).some((m) => m !== 'stone')).length;
    assert.ok(ore > 20, `${def.name}: ore in the rock (${ore})`);
    assert.ok(frontier(a).length >= 3, 'rock beside the chamber to dig');
  }
});

test('miners at the shaft carve the Deep out cell by cell, carry up what it held, and open the way down', () => {
  const s = plainGame('deep-dig');
  const shaft = put(s, SHAFT, s.land.camp.x + 4);
  shaft.status = 'done';
  const d = deepOf(s)!;
  assert.equal(d.levels.length, 1);
  const p = s.people[0];
  p.carrying = {};
  const task = { type: 'mine' as const, building: shaft.id, work: 0 } as { type: 'mine'; building: number; work: number; cell?: number; depth?: number };
  let loads = 0;
  for (let i = 0; i < 20000 && loads < 3; i++) if (workMine(s, p, shaft, task)) loads++;
  assert.equal(loads, 3, 'three cells dug');
  assert.ok((p.carrying.stone ?? 0) > 0, 'stone in hand');
  assert.equal(d.levels[0].dug, 3);
  // (dug on to the way down)
  for (let k = 0; d.levels.length < 2 && k < 200; k++) {
    const l = workingLevel(d);
    const cell = deepTarget(s, p, l)!;
    digDeep(s, p, l.depth, cell);
  }
  assert.equal(d.levels.length, 2, 'the next level opened');
  assert.ok(d.levels[0].down && d.levels[0].dug >= OPEN_AFTER);
  assert.ok(d.levels[0].cells.includes('>'), 'the way down on the map');
  assert.equal(workingLevel(d).depth, 2, 'the miners go on down');
});

test('a fungus grotto dug into is farmed: food at dawn', () => {
  const s = plainGame('deep-fungus');
  put(s, SHAFT, s.land.camp.x + 4).status = 'done';
  const d = deepOf(s)!;
  const l = d.levels[0];
  const f = [...l.cells].findIndex((c) => c === 'F');
  assert.ok(f >= 0, 'a grotto on the first level');
  digDeep(s, s.people[0], 1, f);
  assert.equal(cellAt(l, f), 'f');
  assert.equal(deepFarms(d).farms, 1);
  const before = totalStock(s).vegetables ?? 0;
  s.tick = at(2, 6);
  deepHourly(s);
  assert.equal((totalStock(s).vegetables ?? 0) - before, FUNGUS_FOOD);
});

test('the digging stirs what lives below: past its limit, something climbs up the shaft', () => {
  const s = plainGame('deep-rise');
  s.autopilot = true;
  const shaft = put(s, SHAFT, s.land.camp.x + 4);
  shaft.status = 'done';
  const d = deepOf(s)!;
  d.stir = RISE_AT + 1;
  s.tick = at(3, 12);
  deepHourly(s);
  assert.ok(s.raid, 'a raid');
  assert.ok(s.raid!.kind.startsWith('deep_'), s.raid!.kind);
  assert.ok(d.stir < RISE_AT, 'the stir spent');
});

test('only rock is dug: never the lake, never twice', () => {
  const s = plainGame('deep-water');
  put(s, SHAFT, s.land.camp.x + 4).status = 'done';
  const l = deepOf(s)!.levels[0];
  const w = [...l.cells].findIndex((c) => c === '~');
  assert.ok(!isDiggable(cellAt(l, w)));
  assert.deepEqual(digDeep(s, s.people[0], 1, w), {});
  assert.deepEqual(digDeep(s, s.people[0], 1, cellIndex(ENTRY, 1)), {}, 'the chamber is already dug');
});
