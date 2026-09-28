import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { circleWagons, moveCamp, nomadic, PITCHED, updateNomads, wantedCamp } from '../src/shared/sim/nomads';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campX, newGame, tileCentreX } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';

test('a nomad tribe has a home ground and a summer pasture; other towns have neither', () => {
  const s = newGame('round', { origin: 'nomads' });
  assert.ok(s.nomad);
  assert.equal(s.nomad.camp, s.nomad.home);
  assert.ok(Math.abs(s.nomad.pasture - s.nomad.home) >= 30);
  assert.equal(campX(s), tileCentreX(s.nomad.home));
  assert.equal(newGame('stay').nomad, undefined);
});

test('the camp moves with the seasons: tents go on the wagons, rooted things stay, and it all comes home in winter', () => {
  const sim = new Sim(newGame('seasons', { origin: 'nomads' }));
  const s = sim.state;
  const n = s.nomad!;
  // a rooted work on the home ground, and a tent
  const kiln = { id: s.nextId++, def: 'kiln', tile: n.home - 6, status: 'done' as const, delivered: {}, progress: 1, store: {} };
  const tent = { id: s.nextId++, def: 'hide_tent', tile: n.home + 4, status: 'done' as const, delivered: {}, progress: 1, store: {} };
  s.buildings.push(kiln, tent);
  s.autopilot = false;
  while (calendar(s.tick).season !== 'summer') sim.step();
  // (they set out by day: not in the small hours)
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(n.camp, n.home, 'waiting for first light');
  while (n.camp === n.home && calendar(s.tick).season === 'summer') sim.step();
  assert.equal(n.camp, n.pasture, 'at the summer pasture');
  const hour = calendar(s.tick).hour;
  assert.ok(hour >= 7 && hour < 16, `set out by day (${hour})`);
  assert.equal(kiln.tile, n.home - 6, 'the kiln stayed');
  assert.ok(Math.abs(tent.tile - (n.pasture + 4)) <= 3, `the tent went too (${tent.tile})`);
  assert.equal(tent.status, 'blueprint', 'to be pitched again');
  assert.equal(tent.progress, PITCHED);
  assert.deepEqual(tent.delivered, BUILDING_BY_ID.hide_tent.cost, 'with all its materials');
  const fire = s.buildings.find((b) => b.def === 'campfire')!;
  assert.ok(Math.abs(fire.tile - n.pasture) <= 3 && fire.status === 'done', 'the fire lit again at once');
  assert.ok(snapshot(s).nomad?.site === 'pasture');
  while (calendar(s.tick).season !== 'winter') sim.step();
  while (n.camp !== n.home && calendar(s.tick).season === 'winter') sim.step();
  assert.equal(n.camp, n.home, 'home for the winter');
});

test('the great works are built on the home ground, even from the pasture; no walls while the tribe wanders', () => {
  const sim = new Sim(newGame('works', { origin: 'nomads' }));
  const s = sim.state;
  moveCamp(s, [], s.nomad!.pasture);
  s.research.done.push('palisades', 'pottery');
  for (let t = 0; t < 3 * TICKS_PER_DAY; t++) sim.step();
  if (s.nomad!.camp !== s.nomad!.pasture) return; // (the season turned: nothing to check)
  for (const b of s.buildings) {
    const d = BUILDING_BY_ID[b.def];
    assert.ok(!(d.hp && d.width === 1 && !d.defense && b.def !== 'wagon_circle'), `no ${b.def} while wandering`);
    if (d.layer === 'mid' && !['kiln'].includes(b.def)) continue;
    if (b.def === 'kiln') assert.ok(Math.abs(b.tile - s.nomad!.home) < 30, 'the kiln is built at home');
  }
});

test('when raiders come the wagons are drawn up across the camp, and put away after', () => {
  const s = newGame('wagons', { origin: 'nomads' });
  startRaid(s, RAID_KIND_BY_ID.wolves, 20, new Rng(1));
  const wagons = s.buildings.filter((b) => b.def === 'wagon_circle');
  assert.equal(wagons.length, 2);
  assert.ok(wagons[0].tile < s.nomad!.camp && wagons[1].tile > s.nomad!.camp);
  s.raid = null;
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s, []);
  assert.ok(!s.buildings.some((b) => b.def === 'wagon_circle'));
  // (and a settled town builds real walls)
  s.nomad!.settled = true;
  circleWagons(s, []);
  assert.ok(!s.buildings.some((b) => b.def === 'wagon_circle'));
});

test('in the Industrial age the tribe comes home and settles for good', () => {
  const s = newGame('settle', { origin: 'nomads' });
  moveCamp(s, [], s.nomad!.pasture);
  s.era = 'industrial';
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s, []);
  assert.equal(s.nomad!.camp, s.nomad!.home);
  assert.equal(nomadic(s), false);
  // and it moves no more, whatever the season
  s.tick += 6 * TICKS_PER_DAY;
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateNomads(s, []);
  assert.equal(s.nomad!.camp, s.nomad!.home);
  assert.equal(wantedCamp(s) === s.nomad!.pasture || wantedCamp(s) === s.nomad!.home, true);
});
