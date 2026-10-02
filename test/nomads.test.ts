import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { circleWagons, moveCamp, nomadic, PITCHED, updateNomads, wantedCamp } from '../src/shared/sim/nomads';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, newGame } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { cheb, type Pt } from '../src/shared/sim/land';
import { put } from './helpers';

const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

test('a nomad tribe has a home ground and a summer pasture; other towns have neither', () => {
  const s = newGame('round', { origin: 'nomads' });
  assert.ok(s.nomad);
  assert.ok(same(s.nomad.camp, s.nomad.home));
  assert.ok(cheb(s.nomad.pasture, s.nomad.home) >= 30);
  assert.deepEqual(campXY(s), { x: (s.nomad.home.x + 0.5) * 32, y: (s.nomad.home.y + 0.5) * 32 });
  assert.equal(newGame('stay').nomad, undefined);
});

test('the camp moves with the seasons: tents go on the wagons, rooted things stay, and it all comes home in winter', () => {
  const sim = new Sim(newGame('seasons', { origin: 'nomads' }));
  const s = sim.state;
  const n = s.nomad!;
  // a rooted work on the home ground, and a tent
  const kiln = put(s, 'kiln', n.home.x - 6, n.home.y + 2);
  const tent = put(s, 'hide_tent', n.home.x + 4, n.home.y + 2);
  s.autopilot = false;
  while (calendar(s.tick).season !== 'summer') sim.step();
  // (they set out by day: not in the small hours)
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  assert.ok(same(n.camp, n.home), 'waiting for first light');
  while (same(n.camp, n.home) && calendar(s.tick).season === 'summer') sim.step();
  assert.ok(same(n.camp, n.pasture), 'at the summer pasture');
  const hour = calendar(s.tick).hour;
  assert.ok(hour >= 7 && hour < 16, `set out by day (${hour})`);
  assert.deepEqual([kiln.tile, kiln.row], [n.home.x - 6, n.home.y + 2], 'the kiln stayed');
  assert.ok(cheb({ x: tent.tile, y: tent.row }, { x: n.pasture.x + 4, y: n.pasture.y + 2 }) <= 14, `the tent went too (${tent.tile}, ${tent.row})`);
  assert.equal(tent.status, 'blueprint', 'to be pitched again');
  assert.equal(tent.progress, PITCHED);
  assert.deepEqual(tent.delivered, BUILDING_BY_ID.hide_tent.cost, 'with all its materials');
  const fire = s.buildings.find((b) => b.def === 'campfire')!;
  assert.ok(cheb({ x: fire.tile, y: fire.row }, n.pasture) <= 14 && fire.status === 'done', 'the fire lit again at once');
  assert.ok(snapshot(s).nomad?.site === 'pasture');
  while (calendar(s.tick).season !== 'winter') sim.step();
  while (!same(n.camp, n.home) && calendar(s.tick).season === 'winter') sim.step();
  assert.ok(same(n.camp, n.home), 'home for the winter');
});

test('the great works are built on the home ground, even from the pasture; no walls while the tribe wanders', () => {
  const sim = new Sim(newGame('works', { origin: 'nomads' }));
  const s = sim.state;
  moveCamp(s, s.nomad!.pasture);
  s.research.done.push('palisades', 'pottery');
  for (let t = 0; t < 3 * TICKS_PER_DAY; t++) sim.step();
  if (!same(s.nomad!.camp, s.nomad!.pasture)) return; // (the season turned: nothing to check)
  for (const b of s.buildings) {
    const d = BUILDING_BY_ID[b.def];
    assert.ok(!(d.hp && d.width === 1 && !d.defense && b.def !== 'wagon_circle'), `no ${b.def} while wandering`);
    if (b.def === 'kiln') assert.ok(cheb({ x: b.tile, y: b.row }, s.nomad!.home) < 30, 'the kiln is built at home');
  }
});

test('when raiders come the wagons are drawn up across the camp, and put away after', () => {
  const s = newGame('wagons', { origin: 'nomads' });
  startRaid(s, RAID_KIND_BY_ID.wolves, 20, new Rng(1));
  const wagons = s.buildings.filter((b) => b.def === 'wagon_circle');
  assert.equal(wagons.length, 2);
  assert.ok(wagons[0].tile < s.nomad!.camp.x && wagons[1].tile > s.nomad!.camp.x);
  s.raid = null;
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s);
  assert.ok(!s.buildings.some((b) => b.def === 'wagon_circle'));
  // (and a settled town builds real walls)
  s.nomad!.settled = true;
  circleWagons(s);
  assert.ok(!s.buildings.some((b) => b.def === 'wagon_circle'));
});

test('in the Industrial age the tribe comes home and settles for good', () => {
  const s = newGame('settle', { origin: 'nomads' });
  moveCamp(s, s.nomad!.pasture);
  s.era = 'industrial';
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s);
  assert.ok(same(s.nomad!.camp, s.nomad!.home));
  assert.equal(nomadic(s), false);
  // and it moves no more, whatever the season
  s.tick += 6 * TICKS_PER_DAY;
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s);
  assert.ok(same(s.nomad!.camp, s.nomad!.home));
  assert.ok(same(wantedCamp(s), s.nomad!.pasture) || same(wantedCamp(s), s.nomad!.home));
});
