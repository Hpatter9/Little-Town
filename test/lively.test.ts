import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, STATIONS } from '../src/shared/data/items';
import { RESEARCH_STATIONS } from '../src/shared/data/research';
import { CELL } from '../src/shared/sim/land';
import { pastimeFor, STROLL_FROM } from '../src/shared/sim/pastimes';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { HAUL_LEAST, hauls, heapColour, mainLoad } from '../src/renderer/map/haul';
import { workLook } from '../src/renderer/map/workLooks';
import { plainGame } from './helpers';

const twin = (s: GameState, extra: Partial<Person>): Person => {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, partner: null, ...extra };
  s.people.push(p);
  return p;
};

test('a heavy load goes in a wheelbarrow heaped with it', () => {
  const s = plainGame('haul');
  const v = snapshot(s).people[0];
  assert.equal(hauls({ ...v, carrying: { wood: HAUL_LEAST + 1 } }, true), true);
  assert.equal(hauls({ ...v, carrying: { wood: HAUL_LEAST + 1 } }, false), false, 'not while standing');
  assert.equal(hauls({ ...v, carrying: { wood: 1 } }, true), false, 'a light load is carried by hand');
  assert.deepEqual(mainLoad({ wood: 2, stone: 5 }), ['stone', 7]);
  assert.notDeepEqual(heapColour('wood'), heapColour('stone'));
});

test('every workshop and study shows its work', () => {
  for (const st of STATIONS) assert.ok(workLook(st), st);
  for (const st of Object.keys(RESEARCH_STATIONS)) assert.ok(workLook(st), st);
  assert.equal(workLook('smithy'), 'sparks');
  assert.equal(workLook('lean_to'), null);
});

test('idle children play together, elders sit by the fire, couples walk out of an evening', () => {
  const s = plainGame('pastime');
  const kid = twin(s, { bornTick: 0 });
  const kid2 = twin(s, { bornTick: 0 });
  const play = pastimeFor(s, kid, 0)!;
  assert.equal(play.pastime, 'play');
  assert.ok(Math.hypot(play.x - kid2.x, play.y - kid2.y) < 3 * CELL, 'beside the other child');
  const old = twin(s, { grownAt: 0 });
  s.tick = 90 * TICKS_PER_DAY;
  const sit = pastimeFor(s, old, 0)!;
  assert.equal(sit.pastime, 'sit');
  const c = campXY(s);
  assert.ok(Math.hypot(sit.x - c.x, sit.y - c.y) < 2 * CELL, 'by the fire');
  const a = twin(s, { grownAt: s.tick });
  const b = twin(s, { grownAt: s.tick, partner: a.id });
  a.partner = b.id;
  s.tick = 91 * TICKS_PER_DAY + ((STROLL_FROM + 1 - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  assert.equal(pastimeFor(s, a, 3)?.pastime, 'stroll');
  assert.equal(pastimeFor(s, b, 3)?.pastime, 'stroll');
  s.tick = 91 * TICKS_PER_DAY + ((10 - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
  assert.equal(pastimeFor(s, a, 3), null, 'not at mid-morning');
});

test('the snapshot names the buildings at work and the latest news', () => {
  const s = plainGame('working');
  const st = s.buildings.find((b) => b.def === 'campfire')!;
  const p = s.people[0];
  const item = ITEMS.find((i) => i.station === 'campfire')!;
  s.crafting.push({ id: 900, item: item.id, count: 1, delivered: {}, itemsTaken: true, progress: 0.3, made: 0 });
  p.task = { type: 'craft', order: 900, phase: 'work', from: null };
  p.activity = 'build';
  assert.deepEqual(snapshot(s).workingAt, [st.id]);
  s.journal.push({ id: 9999, tick: s.tick, text: 'The well is built.', key: true });
  assert.equal(snapshot(s).news?.text, 'The well is built.');
});
