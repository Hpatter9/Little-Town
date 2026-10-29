import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bakeChunk, cellSurface, chunkPx, chunkSig, fillOut, shoreSurface, surfaceKey, GROUND_RANK, type Surface, type TilePx } from '../src/renderer/iso/groundBlend';
import type { Ground } from '../src/shared/sim/land';
import { ISO_TH, ISO_TW } from '../src/renderer/iso/isoMath';

/** Plain tiles, one flat colour each (red lowest), so a pixel says which tile it came from. */
const COLOURS = [0xff00ff00, 0xff004080, 0xff808080, 0xff00a0c0];
const flatTile = (tile: number, n: number): TilePx => {
  const w = n * ISO_TW;
  const h = n * ISO_TH;
  return { w, h, px: new Uint32Array(w * h).fill(COLOURS[tile]) };
};

/** A little land of grounds (rows of letters: g grass, m marsh, w water, s street) baked as one chunk. */
function bake(rows: string[]): { out: Uint32Array; surfaces: Surface[]; at: (x: number, y: number) => Surface } {
  const kinds: Record<string, [Ground, 'street' | null]> = { g: ['grass', null], m: ['marsh', null], w: ['water', null], s: ['grass', 'street'] };
  const surfaces: Surface[] = [];
  const idx = (s: Surface) => {
    const k = surfaceKey(s);
    const i = surfaces.findIndex((o) => surfaceKey(o) === k);
    return i >= 0 ? i : surfaces.push(s) - 1;
  };
  const size = rows.length;
  const grid = rows.map((r) => [...r].map((ch) => idx(cellSurface(kinds[ch][0], kinds[ch][1], 0, 'forest', 2))));
  const surfAt = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? -1 : grid[y][x]);
  const { w, h } = chunkPx(size);
  const out = new Uint32Array(w * h);
  const shore = shoreSurface('forest', 2);
  const done = bakeChunk(out, { x0: 0, y0: 0, size, landW: size, landH: size, surfAt, surfaces, shore, tileOf: flatTile });
  assert.ok(done);
  return { out, surfaces, at: (x, y) => surfaces[grid[y][x]] };
}
/** The pixel at a point of a cell (fractions of the cell along x and y). */
const px = (out: Uint32Array, size: number, x: number, y: number): number => {
  const { w } = chunkPx(size);
  const sx = Math.floor(((x - y) * ISO_TW) / 2 + (size * ISO_TW) / 2);
  const sy = Math.floor(((x + y) * ISO_TH) / 2);
  return out[sy * w + sx];
};

test('what lies over what: grass over marsh, sand, a field and a street; land over water; the woods on top', () => {
  assert.ok(GROUND_RANK.grass > GROUND_RANK.marsh);
  assert.ok(GROUND_RANK.marsh > GROUND_RANK.sand);
  assert.ok(GROUND_RANK.sand > GROUND_RANK.shallows && GROUND_RANK.shallows > GROUND_RANK.water);
  assert.ok(GROUND_RANK.forest > GROUND_RANK.grass);
  const grass = cellSurface('grass', null, 0, 'forest', 2);
  const field = cellSurface('grass', 'field', 0, 'forest', 2);
  const street = cellSurface('grass', 'street', 0, 'forest', 2);
  const yard = cellSurface('grass', 'yard', 0, 'forest', 2);
  assert.ok(grass.rank > yard.rank && yard.rank > street.rank && street.rank > field.rank);
  // (what the town lays is a tile to each cell, as before; the land's own ground a tile to every two)
  assert.equal(field.n, 1);
  assert.equal(grass.n, 2);
  // (a worn footpath sinks under the grass beside it, so the grass creeps over its edge)
  assert.ok(cellSurface('grass', null, 0.8, 'forest', 2).rank < grass.rank);
  // (nothing is laid on water; water has no sandy shore of its own, a marsh none either)
  assert.equal(cellSurface('water', 'street', 0, 'forest', 2).tile, cellSurface('water', null, 0, 'forest', 2).tile);
  assert.equal(cellSurface('water', null, 0, 'forest', 2).shore, false);
  assert.equal(cellSurface('marsh', null, 0, 'forest', 2).shore, false);
  // (two different surfaces never tie)
  const all = (['grass', 'forest', 'rock', 'marsh', 'hill', 'water', 'fertile', 'sand', 'mountain', 'hall', 'shallows'] as Ground[]).map((g) => cellSurface(g, null, 0, 'desert', 2));
  const ranks = new Map<number, string>();
  for (const s of all) {
    const k = surfaceKey(s);
    if (ranks.has(s.rank)) assert.equal(ranks.get(s.rank), k);
    ranks.set(s.rank, k);
  }
});

test('a lone marsh cell in a meadow shows as a round patch, its edge ragged; the meadow round it is untouched', () => {
  const rows = ['ggggg', 'ggggg', 'ggmgg', 'ggggg', 'ggggg'];
  const { out, at } = bake(rows);
  assert.equal(at(2, 2).tile, 1);
  const marshMid = px(out, 5, 2.5, 2.5);
  const grassMid = px(out, 5, 0.5, 0.5);
  assert.notEqual(marshMid, grassMid);
  // (its diamond's corners are grass: no hard diamond)
  for (const [x, y] of [[2.04, 2.04], [2.96, 2.04], [2.04, 2.96], [2.96, 2.96]]) assert.equal(px(out, 5, x, y), grassMid, `corner ${x},${y}`);
  // (round it the marsh fades into the grass over a dithered band, not a line)
  let mixed = 0;
  for (let r = 0.1; r < 0.5; r += 0.05) {
    const ring: number[] = [];
    for (let t = 0; t < Math.PI * 2; t += 0.02) ring.push(px(out, 5, 2.5 + Math.cos(t) * r, 2.5 + Math.sin(t) * r));
    if (ring.includes(grassMid) && ring.includes(marshMid)) mixed++;
  }
  assert.ok(mixed >= 2, 'a dithered, wandering edge');
  // (the grass cells two away are plain grass)
  for (let t = 0.05; t < 1; t += 0.1) assert.equal(px(out, 5, t, 2 + t), grassMid);
});

test('water meets the land with a strip of sand, then paler shallows', () => {
  const rows = ['gggggg', 'gggggg', 'gggggg', 'wwwwww', 'wwwwww', 'wwwwww'];
  const { out } = bake(rows);
  const grass = px(out, 6, 2.5, 0.5);
  const water = px(out, 6, 2.5, 5.5);
  const sand = new Set<number>();
  const pale = new Set<number>();
  for (let x = 0.5; x < 5.5; x += 0.07) {
    // (the land's side of the edge)
    const a = px(out, 6, x, 2.97);
    if (a !== grass) sand.add(a);
    // (the water's side)
    const b = px(out, 6, x, 3.05);
    if (b !== water) pale.add(b);
    const c = px(out, 6, x, 3.45);
    if (c !== water) pale.add(c);
  }
  assert.ok(sand.size > 0, 'sand along the land');
  assert.ok(pale.size > 0, 'something other than deep water along the shore');
  // (the sand strip is less green than the grass)
  const greenShare = (c: number) => ((c >> 8) & 255) / (1 + (c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255));
  assert.ok([...sand].every((c) => greenShare(c) < greenShare(grass)), 'the shore is sandier than the grass');
});

test('a street runs into the meadow: the grass lies a little over its edges; cells among their own kind are plain', () => {
  const rows = ['gggg', 'gggg', 'ssss', 'gggg', 'gggg'];
  const { out } = bake(rows);
  const cobble = px(out, 5, 1.5, 2.5);
  const grass = px(out, 5, 1.5, 4.5);
  assert.notEqual(cobble, grass);
  // (along the street's two edges, more grass on the street's side than street on the grass's: the grass lies over)
  let grassOnStreet = 0;
  let streetOnGrass = 0;
  for (let x = 0.5; x < 3.5; x += 0.01)
    for (const d of [0.02, 0.08, 0.14]) {
      if (px(out, 5, x, 2 + d) === grass) grassOnStreet++;
      if (px(out, 5, x, 2 - d) === cobble) streetOnGrass++;
    }
  assert.ok(grassOnStreet > streetOnGrass, `${grassOnStreet} > ${streetOnGrass}`);
  assert.equal(px(out, 5, 1.5, 0.5), grass);
});

test('outside the chunk\'s diamond the picture is clear, and the fingerprint follows the cells', () => {
  const { out } = bake(['gg', 'gg']);
  assert.equal(out[0], 0);
  assert.notEqual(px(out, 2, 1, 1), 0);
  const a = chunkSig({ x0: 0, y0: 0, size: 2, surfAt: () => 0 });
  const b = chunkSig({ x0: 0, y0: 0, size: 2, surfAt: (x, y) => (x === 2 && y === 2 ? 1 : 0) });
  assert.notEqual(a, b, 'a change in the ring round it counts');
});

test('a tile\'s see-through rim is filled from inside', () => {
  const px = new Uint32Array([0, 0, 0, 0, 0xff112233, 0, 0, 0, 0]);
  fillOut(px, 3, 3);
  assert.ok([...px].every((c) => c === 0xff112233));
});
