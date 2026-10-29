// Settlers' towns laid out for the grid audit (docs/notes/grid-audit.md), written as a save with the spots to shoot
// (out/grid-town.json) for tools/grid-shots.mjs to load into the phone page. Run through tools/grid-shots.mjs.
//
//   (no argument)  the gallery: one of each picture-and-footprint the iso view draws, in rows on cleared ground beside
//                  the camp, with walls and a gate, a street, fields, pens, the God creature's pen and two buildings
//                  still going up; the land's woods left round it
//   town           a town as a player might build it: a street of houses inside a palisade with its gate, the
//                  workshops, a store, a granary and a temple, and fields and pens outside
//   polish         the grid polish's town (docs/notes/grid-polish.md): a palisade with its corners and gate round a
//                  street, the workshops and the bigger buildings with their yards, a stone wall with its corners and
//                  gate, and the pens; `night` after it sets the clock to ten at night
//   blend          the ground blend's patches (docs/notes/ground-blend.md): a meadow with marsh, sand and rock in it, a
//                  pond with its shore, and the town's edge with a street, a yard, fields and a worn footpath; a biome's
//                  name after it (`desert`, `tundra`) founds the land there, and `night` sets the clock as above

import { mkdirSync, writeFileSync } from 'node:fs';
import { BUILDINGS } from '../src/shared/data/buildings';
import { depthOf, isUnlocked } from '../src/shared/sim/buildings';
import { CELL, setGround, setRoad, WILD, groundAt } from '../src/shared/sim/land';
import { randomLook } from '../src/shared/data/people';
import { hashSeed, Rng } from '../src/shared/rng';
import { adoptCreature } from '../src/shared/sim/creature';
import { campCell, newGame, type Building } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { serialize } from '../src/shared/sim/save';
import { kitOf, pieceFor, roleOf, sharedPiece } from '../src/renderer/iso/isoKits';
import { BIOMES, type Biome } from '../src/shared/data/biomes';

const biome = process.argv.slice(3).find((a) => (BIOMES as readonly string[]).includes(a)) as Biome | undefined;
const s = newGame('grid-audit', biome ? { biome } : {});
s.cheats.unlockAll = true;
const c = campCell(s);
s.explored = '1'.repeat(s.land.w * s.land.h); // (the whole land seen: no fog over the gallery)
const put = (def: string, x: number, y: number, extra: Partial<Building> = {}): Building => {
  const b: Building = { id: s.nextId++, def, tile: x, row: y, status: 'done', delivered: {}, progress: 1, store: {}, ...extra };
  s.buildings.push(b);
  return b;
};

// (the ground east of the camp cleared to grass: the gallery stands there)
const x0 = c.x + 6, y0 = c.y - 14, W = 46, H = 64;
for (let y = y0; y < y0 + H; y++)
  for (let x = x0; x < x0 + W; x++) if (x >= 0 && y >= 0 && x < s.land.w && y < s.land.h && WILD.includes(groundAt(s.land, x, y))) setGround(s.land, x, y, 'grass');
s.land.open = Math.max(s.land.open, 60);

const scene = ['town', 'polish', 'blend'].includes(process.argv[2]) ? process.argv[2] : 'gallery';
const shots: Record<string, [string, number, number][]> = {};
/** Townsfolk standing on the middles of cells, grown and a child (`n` of them, along x from a cell). */
const folkAt = (x: number, y: number, n: number) => {
  const a = s.people[0];
  const rng = new Rng(hashSeed(`${s.seed}:grid-folk:${x}:${y}`));
  for (let i = 0; i < n; i++) {
    const p = { ...structuredClone(a), id: s.nextId++, name: `Villager ${s.people.length}`, partner: null, task: null, gear: {}, carrying: {}, look: randomLook(rng) };
    if (i === n - 1) Object.assign(p, { type: 'child', bornTick: s.tick, parents: [a.id] });
    p.x = (x + i * 2 + 0.5) * CELL;
    p.y = (y + 0.5) * CELL;
    s.people.push(p);
  }
};

if (scene === 'gallery') {
  // (one of each picture on each footprint size, biggest last so the rows stay even)
  const kit = kitOf('settlers');
  const seen = new Set<string>();
  const picks = BUILDINGS.filter((d) => !d.never && !d.seat && isUnlocked({ unlockAll: true, done: [], origin: 'settlers', relief: true }, d) && 'role' in roleOf(d.id))
    .filter((d) => {
      const piece = pieceFor(kit, d.id);
      const key = `${sharedPiece('settlers', piece) ? 's:' : ''}${piece}:${d.width}x${depthOf(d)}`;
      // (the phylactery left out: it turns the town into a necropolis, drawn with the liches' kit)
      if (seen.has(key) || /_(wall|grate)$/.test(d.id) || d.id === 'phylactery') return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.width * depthOf(a) - b.width * depthOf(b));
  let x = x0 + 1, y = y0 + 1, rowH = 0;
  for (const d of picks) {
    const w = d.width, h = depthOf(d);
    if (x + w > x0 + W - 1) {
      x = x0 + 1;
      y += rowH + 2;
      rowH = 0;
    }
    put(d.id, x, y);
    x += w + 2;
    rowH = Math.max(rowH, h);
  }

  // (walls: a palisade run along x with a corner and a run along y, a gate in it; a stone wall beside it)
  y += rowH + 3;
  const wy = y;
  for (let i = 0; i < 8; i++) if (i !== 3 && i !== 4) put('palisade_wall', x0 + 2 + i, wy);
  put('palisade_gate', x0 + 5, wy);
  for (let j = 1; j < 5; j++) put('palisade_wall', x0 + 2, wy + j);
  for (let i = 0; i < 6; i++) put('stone_wall', x0 + 14 + i, wy);
  for (let j = 1; j < 4; j++) put('stone_wall', x0 + 19, wy + j);
  put('stone_gate', x0 + 15, wy + 3);
  // (a street running past them)
  for (let i = 0; i < 30; i++) setRoad(s.land, x0 + 2 + i, wy + 6, true);
  // (fields and pens, the God creature's pen, and two buildings going up)
  put('garden_plot', x0 + 24, wy);
  put('goat_pen', x0 + 30, wy);
  put('cattle_pasture', x0 + 24, wy + 8);
  put('creature_pen', x0 + 4, wy + 8);
  put('cottage', x0 + 10, wy + 8, { status: 'blueprint', progress: 0.3 });
  put('longhouse', x0 + 15, wy + 8, { status: 'blueprint', progress: 0 });

  // (townsfolk standing on the middles of cells beside the pens, and the God creature in its pen)
  folkAt(x0 + 10, wy + 4, 6);
  // (the autopilot off while it comes: no naming question over the shots)
  const pilot = s.autopilot;
  s.autopilot = false;
  adoptCreature(s, 'bear');
  s.autopilot = pilot;
  if (s.creature) {
    s.creature.x = (x0 + 6 + 0.5) * CELL;
    s.creature.y = (wy + 9 + 0.5) * CELL;
  }
  // (numbered worst first, as docs/notes/grid-audit.md lists them; close-ups at twice the phone's zoom, the overviews at
  // its own)
  shots['2'] = [
    ['01-walls-gate', x0 + 6, wy + 2],
    ['02-folk-float', x0 + 14, wy + 5],
    ['04-creature-pen', x0 + 7, wy + 10],
    ['07-stone-wall', x0 + 17, wy + 2],
    ['08-street-fields-pens', x0 + 29, wy + 3],
    ['09-trees-rocks', c.x - 6, c.y],
    ['10-building-sites', x0 + 15, wy + 10],
  ];
  shots['1'] = [
    ['03-big-buildings', x0 + 22, y0 + 22],
    ['05-mid-buildings', x0 + 22, y0 + 12],
    ['06-small-buildings', x0 + 10, y0 + 4],
    ['11-overview-walls-pens', x0 + 14, wy + 5],
  ];
} else if (scene === 'blend') {
  // (west: a meadow with marsh in it, a lone cell, a pair and a ragged patch, and a patch each of sand and rock; middle: a
  // pond, shallows round deep water; east: the town's edge, a street out through a palisade past a yard and fields, a
  // footpath worn across the grass)
  const g = (x: number, y: number, k: Parameters<typeof setGround>[3]) => setGround(s.land, x, y, k);
  const mx = x0 + 2, my = y0 + 4;
  g(mx + 2, my + 2, 'marsh');
  g(mx + 6, my + 2, 'marsh');
  g(mx + 7, my + 2, 'marsh');
  for (const [dx, dy] of [[1, 6], [2, 6], [3, 6], [1, 7], [2, 7], [3, 7], [4, 7], [2, 8], [3, 8], [4, 8], [5, 8], [3, 9], [4, 9], [0, 7], [6, 8]])
    g(mx + dx, my + dy, 'marsh');
  for (const [dx, dy] of [[1, 12], [2, 12], [1, 13], [2, 13], [3, 13], [2, 14], [3, 14], [4, 14]]) g(mx + dx, my + dy, 'sand');
  for (const [dx, dy] of [[7, 12], [8, 12], [7, 13], [8, 13], [9, 13]]) g(mx + dx, my + dy, 'rock');
  const px0 = x0 + 15, py0 = y0 + 4;
  for (let dy = 0; dy < 9; dy++)
    for (let dx = 0; dx < 11; dx++) {
      const r = Math.hypot((dx - 5) / 5.5, (dy - 4) / 4.5);
      if (r < 0.62) g(px0 + dx, py0 + dy, 'water');
      else if (r < 1) g(px0 + dx, py0 + dy, 'shallows');
    }
  const ex = x0 + 30, ey = y0 + 2;
  for (let j = 0; j < 14; j++) if (j !== 6 && j !== 7) put('palisade_wall', ex, ey + j);
  put('palisade_gate', ex, ey + 6);
  for (let i = -6; i < 12; i++) setRoad(s.land, ex + i, ey + 7, true);
  put('cottage', ex - 5, ey + 3);
  put('smithy', ex - 5, ey + 9);
  put('garden_plot', ex + 3, ey + 2);
  put('vegetable_patch', ex + 3, ey + 9);
  put('goat_pen', ex + 8, ey + 2);
  s.land.wear = '0'.repeat(s.land.w * s.land.h);
  const wear = (x: number, y: number, n: number) => {
    const i = y * s.land.w + x;
    s.land.wear = s.land.wear!.slice(0, i) + String.fromCharCode(48 + n) + s.land.wear!.slice(i + 1);
  };
  for (let k = 0; k < 9; k++) wear(ex + 3 + k, ey + 13 - (k >> 1), k < 2 || k > 6 ? 10 : 30);
  for (let k = 0; k < 6; k++) wear(ex + 8, ey + 8 + k, 18);
  s.land.version++;
  shots['1.5'] = [
    ['meadow-marsh', mx + 4, my + 5],
    ['sand-rock', mx + 5, my + 12],
    ['shore', px0 + 5, py0 + 4],
    ['town-edge', ex + 3, ey + 8],
  ];
  shots['0.75'] = [['overview', x0 + 18, y0 + 9]];
  if (process.argv.includes('night')) {
    s.tick += 15 * TICKS_PER_HOUR;
    s.torches = [];
    for (let i = -5; i < 12; i += 4) s.torches.push({ id: s.nextId++, x: ex + i, y: ey + 8, fuel: 12 });
  }
} else if (scene === 'polish') {
  // (a palisade round a street: the workshops, the tavern and the town hall north of it, the houses along it, the store,
  // the stockpile, the granary and the temple south of it, the barracks and the elder lodge behind them; its gate east,
  // where the street goes out past a stone wall's corner to the pens)
  const tx = x0, ty = y0 + 6;
  const W2 = 24, H2 = 16;
  for (let i = 0; i <= W2; i++) {
    put('palisade_wall', tx + i, ty);
    put('palisade_wall', tx + i, ty + H2);
  }
  for (let j = 1; j < H2; j++) {
    put('palisade_wall', tx, ty + j);
    if (j !== 8 && j !== 9) put('palisade_wall', tx + W2, ty + j);
  }
  put('palisade_gate', tx + W2, ty + 8, { turned: true });
  for (let i = 1; i < W2 + 18; i++) setRoad(s.land, tx + i, ty + 8, true);
  for (const [id, dx] of [['smithy', 2], ['sawmill', 6]] as const) put(id, tx + dx, ty + 3);
  put('tavern', tx + 10, ty + 2);
  put('town_hall', tx + 16, ty + 1);
  for (const dx of [2, 6, 10, 14, 18]) put('cottage', tx + dx, ty + 6);
  put('general_store', tx + 2, ty + 9);
  put('stockpile', tx + 7, ty + 9, { store: { wood: 30, stone: 20, grain: 20 } });
  put('granary', tx + 11, ty + 9);
  put('well', tx + 15, ty + 9);
  put('temple', tx + 17, ty + 9);
  put('elder_lodge', tx + 2, ty + 12);
  put('barracks', tx + 8, ty + 12);
  put('steelworks', tx + 13, ty + 12);
  // (a stone wall's corner and its gate outside the palisade, north of the street)
  const sx = tx + W2 + 3, sy = ty + 1;
  for (let i = 0; i < 9; i++) if (i !== 3 && i !== 4) put('stone_wall', sx + i, sy);
  put('stone_gate', sx + 3, sy);
  for (let j = 1; j < 6; j++) put('stone_wall', sx, sy + j);
  for (let j = 1; j < 6; j++) put('stone_wall', sx + 8, sy + j);
  // (the pens south of the street)
  const fx = tx + W2 + 3, fy = ty + 10;
  put('goat_pen', fx, fy);
  put('pig_sty', fx + 4, fy);
  put('chicken_coop', fx + 8, fy);
  put('sheep_fold', fx, fy + 4);
  put('cattle_pasture', fx + 5, fy + 4);
  folkAt(tx + 3, ty + 8, 5);
  shots['1.5'] = [
    ['street', tx + W2 + 7, ty + 6],
    ['walls-gate', tx + W2, ty + 9],
    ['wall-corner', tx + W2 - 1, ty + H2 - 1],
    ['stone-wall', sx + 4, sy + 3],
    ['pens', fx + 5, fy + 4],
    ['yards-workshops', tx + 6, ty + 2],
    ['yards-tavern-hall', tx + 16, ty + 1],
    ['yards-store-barracks', tx + 8, ty + 10],
  ];
  shots['0.75'] = [['town', tx + 18, ty + 9]];
  if (process.argv[3] === 'night') {
    s.tick += 15 * TICKS_PER_HOUR;
    // (the street's torches, lit, as a town that has stood a few nights has them: the light map darkens the night
    // only where a town has its lights, map/lightMap.ts)
    s.torches = [];
    for (let i = 3; i < W2 + 14; i += 4) s.torches.push({ id: s.nextId++, x: tx + i, y: ty + 8, fuel: 12 });
    s.torches.push({ id: s.nextId++, x: tx + W2 + 1, y: ty + 10, fuel: 12 });
  }
} else {
  // (a palisade round a street of houses, the workshops behind them, a store, a granary, a well, a market and a temple
  // in front, its gate where the street goes out east to the fields and pens)
  const tx = x0, ty = y0 + 8;
  const W2 = 22, H2 = 14;
  for (let i = 0; i <= W2; i++) {
    put('palisade_wall', tx + i, ty);
    put('palisade_wall', tx + i, ty + H2);
  }
  for (let j = 1; j < H2; j++) {
    put('palisade_wall', tx, ty + j);
    if (j !== 7 && j !== 8) put('palisade_wall', tx + W2, ty + j);
  }
  put('palisade_gate', tx + W2, ty + 7, { turned: true });
  for (let i = 1; i < W2 + 16; i++) setRoad(s.land, tx + i, ty + 7, true);
  for (const dx of [2, 6, 10, 14, 18]) put('cottage', tx + dx, ty + 5);
  for (const [id, dx] of [['smithy', 2], ['sawmill', 6], ['bakery', 10], ['tannery', 14], ['windmill', 18]] as const) put(id, tx + dx, ty + 1);
  put('cottage', tx + 2, ty + 8);
  put('cottage', tx + 6, ty + 8);
  put('tavern', tx + 10, ty + 8);
  put('longhouse', tx + 16, ty + 8);
  put('stockpile', tx + 2, ty + 11);
  put('granary', tx + 6, ty + 11);
  put('well', tx + 10, ty + 11);
  put('market', tx + 12, ty + 11);
  put('temple', tx + 17, ty + 11);
  const fx = tx + W2 + 3;
  put('garden_plot', fx, ty + 1);
  put('vegetable_patch', fx + 5, ty + 1);
  put('goat_pen', fx, ty + 4);
  put('pig_sty', fx + 4, ty + 4);
  put('chicken_coop', fx + 8, ty + 4);
  put('sheep_fold', fx, ty + 9);
  put('cattle_pasture', fx + 5, ty + 9);
  folkAt(tx + 3, ty + 7, 5);
  shots['1.5'] = [
    ['camp', c.x, c.y],
    ['street', tx + 11, ty + 6],
    ['walls-gate', tx + W2, ty + 7],
    ['workshops', tx + 11, ty + 2],
    ['fields-pens', fx + 5, ty + 6],
  ];
}
s.paused = true;

mkdirSync('out', { recursive: true });
writeFileSync('out/grid-town.json', JSON.stringify({ save: serialize(s, Date.now()), shots }));
console.log(`grid town: the ${scene}, ${s.buildings.length} buildings`);
