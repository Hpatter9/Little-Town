import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { Rng } from '../src/shared/rng';
import { canPlace } from '../src/shared/sim/buildings';
import { findPath, groundAt, idx, makeLand, OPEN_START, OPEN_START_SEA, SEA_FOOT, wet } from '../src/shared/sim/land';
import { inSea, replenishSea, seaBuild, seaTown, swims } from '../src/shared/sim/sea';
import { newGame } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_HOUR } from '../src/shared/sim/time';

test('a sea-shaped land: the south half sea, shallows along the shore, the camp dry on the strand', () => {
  const m = makeLand('tide', 'coast', 'sea');
  let water = 0;
  let shallows = 0;
  for (const c of m.cells) {
    if (c === 'w') water++;
    if (c === 'S') shallows++;
  }
  assert.ok(water + shallows > m.w * m.h * 0.38 && water + shallows < m.w * m.h * 0.6, `sea ${water + shallows}`);
  assert.ok(shallows > m.w * 2, `shallows ${shallows}`);
  // the camp's clearing is dry; straight below it the shore, then shallows, then open water
  assert.ok(!wet(groundAt(m, m.camp.x, m.camp.y)));
  assert.equal(groundAt(m, m.camp.x, m.camp.y + SEA_FOOT), 'shallows');
  assert.equal(groundAt(m, m.camp.x, m.h - 1), 'water');
  // the sea's cells hold fish
  const i = idx(m, m.camp.x, m.camp.y + SEA_FOOT);
  assert.ok((m.pools[i]?.fish ?? 0) > 0, 'fish in the shallows');
  // the same seed, the same sea
  assert.equal(makeLand('tide', 'coast', 'sea').cells, m.cells);
});

test('a shore town knows its land further out than a dry one', () => {
  assert.ok(OPEN_START_SEA > OPEN_START);
  assert.equal(makeLand('tide', 'coast', 'sea').open, OPEN_START_SEA);
  assert.equal(makeLand('tide', 'coast').open, OPEN_START);
});

test('the Tide Clan is a shore town on the coast whoever picked the forest; settlers are not', () => {
  const s = newGame('mer', { origin: 'merfolk', biome: 'forest' });
  assert.equal(s.biome, 'coast');
  assert.ok(seaTown(s) && swims(s, s.people[0]));
  assert.ok(s.land.cells.includes('S'));
  const t = newGame('dry', { origin: 'settlers', biome: 'coast' });
  assert.ok(!seaTown(t) && !swims(t, t.people[0]));
  assert.ok(!t.land.cells.includes('S'));
});

test('a swimmer crosses the sea; a walker wades the shallows and is stopped by open water', () => {
  const m = makeLand('swim', 'coast', 'sea');
  const from = { x: m.camp.x, y: m.camp.y };
  const to = { x: m.camp.x, y: m.h - 2 };
  assert.equal(findPath(m, from, to), null, 'no way on foot');
  const swum = findPath(m, from, to, undefined, { swim: 0.8 });
  assert.ok(swum && swum.length >= to.y - from.y, 'swum there');
  const shallow = { x: m.camp.x, y: m.camp.y + SEA_FOOT };
  assert.ok(findPath(m, from, shallow), 'waded to the shallows');
});

test('a shore town builds its homes in the sea, not its fields; a dry town builds in neither', () => {
  const s = newGame('build', { origin: 'merfolk' });
  const m = s.land;
  const y = m.camp.y + SEA_FOOT + 1;
  assert.equal(groundAt(m, m.camp.x, y), 'shallows');
  const home = BUILDING_BY_ID.lean_to;
  assert.ok(seaBuild(s, home) && inSea(m, { x: m.camp.x, y, w: 2, h: 1 }));
  assert.ok(canPlace(s, home, m.camp.x, y).ok, 'a lean-to in the shallows');
  assert.ok(!canPlace(s, BUILDING_BY_ID.garden_plot, m.camp.x, y).ok, 'no field in the sea');
  const t = newGame('dry2', { origin: 'settlers', biome: 'coast' });
  assert.ok(!seaBuild(t, home));
});

test('the sea gives again at dawn: fished-out cells get new pools', () => {
  const s = newGame('refill', { origin: 'merfolk' });
  const m = s.land;
  const i = idx(m, m.camp.x, m.camp.y + SEA_FOOT);
  delete m.pools[i];
  const rng = new Rng(1);
  let got = false;
  for (let d = 0; d < 12 && !got; d++) {
    s.tick = d * 24 * TICKS_PER_HOUR + (6 + 24 - START_HOUR) * TICKS_PER_HOUR;
    replenishSea(s, rng);
    got = !!m.pools[i];
  }
  assert.ok(got, 'the shallows filled again');
});

test('raiders from the sea: only against a shore town, out of the deep water, swimming ashore to the strand', async () => {
  const { RAID_KINDS, RAID_KIND_BY_ID } = await import('../src/shared/data/raids');
  const { startRaid } = await import('../src/shared/sim/raids');
  const { trail } = await import('../src/shared/sim/battle');
  const sea = RAID_KINDS.filter((k) => k.fromSea);
  assert.ok(sea.length >= 3, 'raids that come by sea');
  const s = newGame('sea-raid', { origin: 'merfolk' });
  assert.ok(seaTown(s));
  const r = startRaid(s, RAID_KIND_BY_ID.tide_beasts, 60, new Rng(3));
  for (const rd of r.raiders) assert.ok(wet(groundAt(s.land, Math.floor(rd.x / 32), Math.floor(rd.y / 32))), 'they start in the water');
  assert.ok(r.raiders.every((rd) => rd.side === undefined || rd.side === r.side), 'no party round the other end');
  const path = trail(s, r.side, true);
  const [fx, fy] = path[0];
  const [tx, ty] = path[path.length - 1];
  assert.ok(wet(groundAt(s.land, Math.floor(fx), Math.floor(fy))), 'the trail starts at sea');
  assert.ok(!wet(groundAt(s.land, Math.floor(tx), Math.floor(ty))), 'and ends on dry land');
});
