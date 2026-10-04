import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { CAMP_CLEAR, CELL, doorOf, findPath, fits, groundAt, isOpen, isRoad, LAND_H, LAND_W, makeLand, setGround, setRoad, stepCost, WILD } from '../src/shared/sim/land';

const count = (cells: string, c: string) => cells.split('').filter((x) => x === c).length;

test('the land is the same for the same seed, and differs by seed and biome', () => {
  const a = makeLand('one');
  const b = makeLand('one');
  assert.equal(a.cells, b.cells);
  assert.deepEqual(a.pools, b.pools);
  assert.notEqual(a.cells, makeLand('two').cells);
  assert.notEqual(a.cells, makeLand('one', 'desert').cells);
  assert.equal(a.cells.length, LAND_W * LAND_H);
});

test('every biome: a clear camp, a river with fertile banks, a fair share of wild land, water only on the coast and in rivers', () => {
  for (const biome of BIOMES) {
    const m = makeLand(`land-${biome}`, biome);
    for (let dy = -CAMP_CLEAR; dy <= CAMP_CLEAR; dy++)
      for (let dx = -CAMP_CLEAR; dx <= CAMP_CLEAR; dx++) {
        if (Math.hypot(dx, dy) > CAMP_CLEAR) continue;
        const g = groundAt(m, m.camp.x + dx, m.camp.y + dy);
        assert.ok(g === 'grass' || g === 'sand', `${biome}: the camp is clear (${g} at ${dx},${dy})`);
      }
    const water = count(m.cells, 'w');
    assert.ok(water >= LAND_W, `${biome}: a river crosses the map (${water} water cells)`);
    assert.ok(count(m.cells, 'F') > 50, `${biome}: fertile banks`);
    const wild = count(m.cells, 'f') + count(m.cells, 'r') + count(m.cells, 'm') + count(m.cells, 'h');
    assert.ok(wild > m.cells.length * 0.3 && wild < m.cells.length * 0.6, `${biome}: wild share ${(wild / m.cells.length).toFixed(2)}`);
    if (biome === 'coast') assert.ok(water > LAND_W * 8, 'the coast has a sea');
    if (biome === 'desert') assert.ok(count(m.cells, 's') > 1000, 'the desert is sandy');
    // every wild cell holds something to gather
    for (let i = 0; i < m.cells.length; i++) {
      const g = groundAt(m, i % m.w, Math.floor(i / m.w));
      if (WILD.includes(g)) assert.ok(Object.keys(m.pools[i] ?? {}).length > 0, `${biome}: a ${g} cell has a pool`);
      else assert.equal(m.pools[i], undefined);
    }
  }
});

test('footprints fit on open buildable ground only, not over each other, roads or the wild', () => {
  const m = makeLand('fit');
  const r = { x: m.camp.x - 1, y: m.camp.y - 1, w: 3, h: 2 };
  assert.ok(fits(m, r));
  assert.ok(!fits(m, r, [{ x: m.camp.x + 1, y: m.camp.y, w: 2, h: 2 }]), 'overlap');
  setRoad(m, m.camp.x, m.camp.y);
  assert.ok(!fits(m, r), 'a road under it');
  assert.ok(fits(m, r, [], { roads: true }));
  assert.ok(!fits(m, { x: 0, y: 0, w: 2, h: 2 }), 'beyond the open land');
  // a wild cell cleared becomes buildable
  let wildAt: { x: number; y: number } | null = null;
  for (let y = 0; y < m.h && !wildAt; y++) for (let x = 0; x < m.w && !wildAt; x++) if (isOpen(m, x, y) && WILD.includes(groundAt(m, x, y))) wildAt = { x, y };
  assert.ok(wildAt, 'some wild land is in reach');
  assert.ok(!fits(m, { ...wildAt!, w: 1, h: 1 }));
  setGround(m, wildAt!.x, wildAt!.y, 'grass');
  assert.ok(fits(m, { ...wildAt!, w: 1, h: 1 }));
  assert.deepEqual(doorOf({ x: 4, y: 6, w: 3, h: 2 }), { x: 5, y: 8 });
  assert.equal(CELL, 32);
});

test('paths go round water and buildings, and prefer roads', () => {
  const m = makeLand('path');
  const from = { x: m.camp.x, y: m.camp.y };
  const to = { x: m.camp.x + 8, y: m.camp.y };
  const open = findPath(m, from, to)!;
  assert.ok(open && open.length >= 8 && open.length <= 10);
  assert.deepEqual(open.at(-1), to);
  // a wall of "buildings" across the way: the path goes round it
  const blocked = (x: number, y: number) => x === m.camp.x + 4 && Math.abs(y - m.camp.y) <= 3;
  const round = findPath(m, from, to, blocked)!;
  assert.ok(round.length > open.length, 'longer, round the wall');
  assert.ok(!round.some((c) => blocked(c.x, c.y)), 'never through it');
  // a road laid along a detour: the path takes the road
  for (let x = m.camp.x; x <= m.camp.x + 8; x++) setRoad(m, x, m.camp.y + 2);
  for (let y = m.camp.y; y <= m.camp.y + 2; y++) {
    setRoad(m, m.camp.x, y);
    setRoad(m, m.camp.x + 8, y);
  }
  const byRoad = findPath(m, from, to)!;
  assert.ok(byRoad.filter((c) => isRoad(m, c.x, c.y)).length >= byRoad.length - 2, 'walks the road');
  // water can't be crossed (without a road)
  assert.equal(stepCost(m, -1, -1), Infinity);
  let water: { x: number; y: number } | null = null;
  for (let i = 0; i < m.cells.length && !water; i++) if (m.cells[i] === 'w') water = { x: i % m.w, y: Math.floor(i / m.w) };
  assert.equal(stepCost(m, water!.x, water!.y), Infinity);
  setRoad(m, water!.x, water!.y);
  assert.ok(stepCost(m, water!.x, water!.y) < 1, 'a bridge');
});

test('a four-way path never steps diagonally (roads join edge to edge)', () => {
  const m = makeLand('four');
  const from = { x: m.camp.x, y: m.camp.y };
  const to = { x: m.camp.x + 6, y: m.camp.y + 5 };
  const path = findPath(m, from, to, undefined, { four: true })!;
  assert.ok(path && path.length >= 11, 'the long way round, by edges');
  let last = from;
  for (const c of path) {
    assert.equal(Math.abs(c.x - last.x) + Math.abs(c.y - last.y), 1, `a straight step to ${c.x},${c.y}`);
    last = c;
  }
  assert.deepEqual(last, to);
});
