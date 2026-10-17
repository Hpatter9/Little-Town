// Prints a land's relief as a map, for looking at what sim/relief.ts lays. Run: node tools/relief-map.mjs [biome] [seed] [shape]
import { makeLand, groundAt } from '../src/shared/sim/land';
import { reliefShares } from '../src/shared/sim/relief';
import type { Biome } from '../src/shared/data/biomes';

const biome = (process.argv[2] ?? 'highlands') as Biome;
const seed = process.argv[3] ?? 'relief-1';
const shape = process.argv[4] as 'mountain' | 'sea' | undefined;
const t = performance.now();
const m = makeLand(seed, biome, shape, true);
const ms = performance.now() - t;
const step = Number(process.env.STEP ?? 2);
for (let y = 0; y < m.h; y += step) {
  let row = '';
  for (let x = 0; x < m.w; x += step) {
    const c = m.relief![y * m.w + x];
    const g = groundAt(m, x, y);
    row += x === m.camp.x && y === m.camp.y ? '@' : g === 'water' || g === 'shallows' ? '~' : c === '5' ? 'M' : g === 'mountain' ? 'o' : c === '4' ? '^' : c === '3' ? '#' : c === '2' ? ':' : c === '1' ? '-' : '.';
  }
  console.log(row);
}
console.log(biome, seed, reliefShares(m), `${ms.toFixed(0)} ms`);
