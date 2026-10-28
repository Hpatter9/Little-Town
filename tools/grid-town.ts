// A settlers' town laid out for the grid audit (docs/notes/grid-audit.md): one of each picture-and-footprint the iso view
// draws, in rows on cleared ground beside the camp, with walls and a gate, a street, fields, pens, the God creature's
// pen and two buildings still going up; the land's woods left round it. Written as a save
// (out/grid-town.json) for tools/grid-shots.mjs to load into the phone page. Run through tools/grid-shots.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { BUILDINGS } from '../src/shared/data/buildings';
import { depthOf, isUnlocked } from '../src/shared/sim/buildings';
import { CELL, setGround, setRoad, WILD, groundAt } from '../src/shared/sim/land';
import { randomLook } from '../src/shared/data/people';
import { hashSeed, Rng } from '../src/shared/rng';
import { adoptCreature } from '../src/shared/sim/creature';
import { campCell, newGame, type Building } from '../src/shared/sim/state';
import { serialize } from '../src/shared/sim/save';
import { kitOf, pieceFor, roleOf, sharedPiece } from '../src/renderer/iso/isoKits';

const s = newGame('grid-audit');
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

// (townsfolk standing on the middles of cells beside the pens, grown and a child, and the God creature in its pen;
// the town paused so they stay put for the shots)
const a = s.people[0];
const rng = new Rng(hashSeed(`${s.seed}:grid-folk`));
for (let i = 0; i < 6; i++) {
  const p = { ...structuredClone(a), id: s.nextId++, name: `Villager ${i + 1}`, partner: null, task: null, gear: {}, carrying: {}, look: randomLook(rng) };
  if (i === 5) Object.assign(p, { type: 'child', bornTick: s.tick, parents: [a.id] });
  p.x = (x0 + 10 + i * 2 + 0.5) * CELL;
  p.y = (wy + 4 + 0.5) * CELL;
  s.people.push(p);
}
// (the autopilot off while it comes: no naming question over the shots)
const pilot = s.autopilot;
s.autopilot = false;
adoptCreature(s, 'bear');
s.autopilot = pilot;
if (s.creature) {
  s.creature.x = (x0 + 6 + 0.5) * CELL;
  s.creature.y = (wy + 9 + 0.5) * CELL;
}
s.paused = true;

mkdirSync('out', { recursive: true });
writeFileSync('out/grid-town.json', JSON.stringify({ save: serialize(s, Date.now()), camp: c, gallery: { x: x0, y: y0, w: W, h: H }, walls: { y: wy } }));
console.log(`grid town: ${picks.length} pictures, walls at row ${wy}`);
