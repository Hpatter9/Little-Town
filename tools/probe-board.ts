// Prints tactics boards for a few seeds and biomes (a by-hand check of the lay of the land). Run: node tools/probe-board.mjs [count]
import { BIOMES } from '../src/shared/data/biomes';
import { newGame } from '../src/shared/sim/state';
import { makeBoard } from '../src/shared/sim/tactics';
import { boardOk } from '../src/shared/sim/tacticsTerrain';

const n = Number(process.argv[2] ?? 20);
const show = process.argv[3] === 'show';
let bad = 0, total = 0;
const feat: Record<string, number> = {};
for (const biome of BIOMES) {
  for (let k = 0; k < n; k++) {
    const s = newGame(`probe-${biome}-${k}`, { biome } as never);
    const b = makeBoard(s, k % 2 ? 1 : -1, false, 1000 + k * 977);
    const along = b.w - 4;
    total++;
    if (!boardOk(b, along)) bad++;
    for (const t of b.tiles) {
      if (t.hill) feat.hill = (feat.hill ?? 0) + 1;
      if (t.log) feat.log = (feat.log ?? 0) + 1;
      if (t.tree) feat.tree = (feat.tree ?? 0) + 1;
      if (t.g === 'water') feat.water = (feat.water ?? 0) + 1;
    }
    if (show && k < 2) {
      console.log(`--- ${biome} ${k}`);
      for (let v = 0; v < b.h; v++) console.log(Array.from({ length: b.w }, (_, u) => { const t = b.tiles[v * b.w + u]; return t.gate ? 'G' : t.block === 'wall' ? '#' : t.block === 'rock' ? 'R' : t.tree ? 'T' : t.log ? 'l' : t.bush ? 'b' : t.g === 'water' ? '~' : t.g === 'shallows' ? '-' : t.hill === 'ramp' ? '/' : t.hill === 'top' ? '^' : String(Math.min(9, t.h)); }).join(''));
    }
  }
}
console.log(`failed after fallback (plain board kept): ${bad}/${total}`, feat);
