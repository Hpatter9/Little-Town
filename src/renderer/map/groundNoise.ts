// The ground's noise: a quick hash of a point and smooth value noise over world px, the same across chunks (groundArt.ts).
// Pure, so the tests can import it.

/** Smooth value noise over world px (0..1), the same across chunks. */
export function smooth(seed: number, x: number, y: number, scale: number): number {
  const gx = x / scale;
  const gy = y / scale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(seed, ix, iy);
  const b = hash(seed, ix + 1, iy);
  const c = hash(seed, ix, iy + 1);
  const d = hash(seed, ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** `smooth` over a box of world px, its lattice hashed once: the same values, for sampling many points of a chunk. */
export function latticeNoise(seed: number, x0: number, y0: number, x1: number, y1: number, scale: number): (x: number, y: number) => number {
  const ix0 = Math.floor(x0 / scale);
  const iy0 = Math.floor(y0 / scale);
  const nx = Math.floor(x1 / scale) - ix0 + 2;
  const ny = Math.floor(y1 / scale) - iy0 + 2;
  const lattice = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) lattice[j * nx + i] = hash(seed, ix0 + i, iy0 + j);
  return (x, y) => {
    const gx = x / scale;
    const gy = y / scale;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const o = (iy - iy0) * nx + ix - ix0;
    const a = lattice[o];
    const b = lattice[o + 1];
    const c = lattice[o + nx];
    const d = lattice[o + nx + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** A quick deterministic hash of a point (0..1). */
export function hash(seed: number, x: number, y: number): number {
  let h = (seed * 374761393 + x * 668265263 + y * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
