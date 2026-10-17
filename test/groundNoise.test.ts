import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash, latticeNoise, smooth } from '../src/renderer/map/groundNoise';

test('the lattice noise gives the very values of smooth noise', () => {
  for (const [seed, scale] of [[0x51, 20], [0x77, 20], [0x1ce, 18], [3, 7]] as const) {
    // (a chunk's box, as the base pass asks: from just off the map's corner)
    for (const [x0, y0] of [[-8, -8], [248, 504], [3000, 5100]] as const) {
      const noise = latticeNoise(seed, x0, y0, x0 + 272, y0 + 272, scale);
      for (let y = y0; y <= y0 + 272; y += 2) for (let x = x0; x <= x0 + 272; x += 2) assert.equal(noise(x, y), smooth(seed, x, y, scale), `${seed} at ${x},${y}`);
    }
  }
});

test('the hash stays in 0..1 and is the same each time', () => {
  for (let i = 0; i < 500; i++) {
    const h = hash(i, i * 3, -i);
    assert.ok(h >= 0 && h < 1);
    assert.equal(h, hash(i, i * 3, -i));
  }
});
