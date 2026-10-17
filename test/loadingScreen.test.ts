import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { CELL } from '../src/shared/sim/land';
import { byLook, FIRST_BUDGET, FIRST_REACH, loadPlan, styleOf, type LookTables, type PlanTown } from '../src/renderer/loading/loadPlan';
import { lightsLit, loadLine, loadShare, loadStage, MIN_SHOW_MS, STALL_MS } from '../src/renderer/loading/loadProgress';
import { townSketch } from '../src/renderer/loading/sketch';

const lateTown = () => {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('the fixture would not load');
  return snapshot(r.save.state);
};

/** Pictures named for what they stand for: a building's by its def and look (two each, one shared by every house), a
 *  person's two layers (one shared by all). */
const TABLES: LookTables = {
  ground: (biome, season, era) => [`ground/${biome}`, `ground/${season}`, `road/${era}`],
  building: (def, style) => [`b/${def}/${style}`, `b/${def}/${style}/door`, 'b/shared'],
  person: (p) => [`p/${p.id}`, 'p/body'],
};

test('the preload list: the ground first, then the nearest buildings, wall and townsfolk, each picture once', () => {
  const s = lateTown();
  const { first, later } = loadPlan(s, TABLES);
  const all = [...first, ...later];
  // (every picture once)
  assert.equal(new Set(all.map((i) => i.url)).size, all.length);
  // (the ground before anything else)
  assert.deepEqual(first.slice(0, 3).map((i) => i.look), ['ground', 'ground', 'ground']);
  // (nearest first, the first set within the first view's reach and the budget)
  for (let i = 1; i < first.length; i++) assert.ok(first[i].far >= first[i - 1].far);
  assert.ok(first.length <= FIRST_BUDGET);
  assert.ok(first.every((i) => i.far <= FIRST_REACH));
  // (what lies past the first view is warmed after the reveal)
  const near = loadPlan(s, TABLES, 6 * CELL);
  assert.ok(near.later.length > 0 && near.later.every((i) => i.far > 6 * CELL));
  // (by look: the ring wall's pieces apart from the buildings, everyone's layers)
  const looks = byLook(all);
  assert.ok(looks.wall.length > 0, 'the late town has a ring wall');
  assert.ok(looks.buildings.length > 0);
  assert.equal(looks.people.length, s.people.length + 1);
  // (the buildings are wanted in the town's own look)
  const style = styleOf(s);
  assert.ok(looks.buildings.every((u) => u === 'b/shared' || u.split('/')[2] === style));
});

test('the preload list: a smaller budget moves the farther pictures to after the reveal, in order', () => {
  const s = lateTown();
  const whole = loadPlan(s, TABLES);
  const small = loadPlan(s, TABLES, FIRST_REACH, 20);
  assert.equal(small.first.length, 20);
  assert.deepEqual(small.first, whole.first.slice(0, 20));
  assert.equal(small.first.length + small.later.length, whole.first.length + whole.later.length);
});

test('the preload list: a new town wants its few buildings and its founders, a settled nomad tribe its caravan city', () => {
  const s = snapshot(newGame('loading-new'));
  const plan = loadPlan(s, TABLES);
  assert.equal(plan.later.length, 0, 'a new town fits in the first view');
  assert.ok(byLook(plan.first).people.length >= 2);
  const town: Omit<PlanTown, 'people'> & { people: PlanTown['people'] } = { ...s, theme: 'nomads', nomad: { settled: true } };
  const asked: string[] = [];
  loadPlan(town, { ...TABLES, building: (_def, style) => (asked.push(style), []) });
  assert.ok(asked.length > 0 && asked.every((st) => st === 'nomads_city'));
});

test('the bar is files loaded over files wanted, never more than full', () => {
  assert.equal(loadShare([]), 0);
  assert.equal(loadShare([{ wanted: 0, done: 0 }]), 0);
  assert.equal(loadShare([{ wanted: 3, done: 3 }, { wanted: 0, done: 0 }]), 1);
  assert.equal(loadShare([{ wanted: 3, done: 1 }, { wanted: 7, done: 4 }]), 0.5);
  assert.equal(loadShare([{ wanted: 2, done: 5 }]), 1);
});

test('the screen stays long enough to read, leaves as soon as the first view is in, and offers a tap when stalled', () => {
  const shownAt = 1000;
  // (ready at once: it waits out the least time, then goes)
  assert.equal(loadStage({ shownAt, now: shownAt + MIN_SHOW_MS - 1, ready: true, movedAt: shownAt }), 'loading');
  assert.equal(loadStage({ shownAt, now: shownAt + MIN_SHOW_MS, ready: true, movedAt: shownAt }), 'reveal');
  // (still loading and moving: no tap)
  assert.equal(loadStage({ shownAt, now: shownAt + 20_000, ready: false, movedAt: shownAt + 19_000 }), 'loading');
  // (nothing has come for a while: the player may tap through)
  assert.equal(loadStage({ shownAt, now: shownAt + STALL_MS + 3000, ready: false, movedAt: shownAt + 3000 }), 'stalled');
  assert.equal(loadStage({ shownAt, now: shownAt + STALL_MS - 1, ready: false, movedAt: 0 }), 'loading');
});

test('the town wakes as the bar fills: no lights at the start, all of them at the end, never fewer as it goes', () => {
  assert.equal(lightsLit(0, 40), 0);
  assert.equal(lightsLit(1, 40), 40);
  let last = 0;
  for (let i = 0; i <= 100; i++) {
    const n = lightsLit(i / 100, 40);
    assert.ok(n >= last);
    last = n;
  }
  assert.match(loadLine('wall'), /walls/);
  assert.notEqual(loadLine('people', 0), loadLine('people', 1));
});

test('the scene: a new town is still being founded; the late town is painted from its own map', () => {
  assert.equal(townSketch(snapshot(newGame('loading-sketch'))).founding, true);
  const s = lateTown();
  const k = townSketch(s);
  assert.equal(k.founding, false);
  assert.equal(k.ground.length, k.w * k.h);
  assert.equal(k.roads.length, k.w * k.h);
  assert.ok(k.buildings.length > 20);
  assert.ok(k.buildings.some((b) => b.kind === 'wall'));
  // (the lights come on from the camp outward)
  const cx = Math.floor(s.camp.x / CELL) - k.x;
  const cy = Math.floor(s.camp.y / CELL) - k.y;
  const far = k.buildings.map((b) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
  for (let i = 1; i < far.length; i++) assert.ok(far[i] >= far[i - 1] - 1e-9);
  // (a phone on its side gets a wider cut)
  const side = townSketch(s, 852 / 393);
  assert.ok(side.w / side.h > k.w / k.h);
});
