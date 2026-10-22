import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BIOMES, type Biome } from '../src/shared/data/biomes';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { START_VALLEYS } from '../src/shared/data/startValleys';
import { fieldList, fieldStr } from '../src/shared/sim/handMaps';
import { CAMP_CLEAR, buildable, groundAt, makeLand, MIN_KIND_NEAR, OPEN_START, WILD } from '../src/shared/sim/land';
import { findSpot } from '../src/shared/sim/planner';
import {
  HAND_VALLEY_SHARE,
  LANDMARK_KINDS,
  pickValley,
  valleyCamp,
  valleyCells,
  valleyLandmarks,
  valleyOrigin,
  valleysFor,
  VALLEY_KEEP,
  VALLEY_SPEC,
} from '../src/shared/sim/startValleys';
import { newGame } from '../src/shared/sim/state';
import { mapsFromLdtk, mapsSource } from '../tools/ldtkMaps';

const project = JSON.parse(readFileSync(VALLEY_SPEC.project, 'utf8'));

test('the committed valleys are what the converter makes of the committed LDtk project (they never drift apart)', () => {
  assert.equal(mapsSource(VALLEY_SPEC, mapsFromLdtk(project, VALLEY_SPEC)), readFileSync(VALLEY_SPEC.out, 'utf8'), 'run `node tools/ldtk-maps.mjs` after editing the valleys');
});

test('the valleys project is LDtk 1.5 JSON: its tileset by a relative path, unique uids, the game’s own lists', () => {
  assert.equal(project.__header__.fileType, 'LDtk Project JSON');
  assert.match(project.jsonVersion, /^1\.5\./);
  for (const ts of project.defs.tilesets) assert.ok(!ts.relPath.startsWith('/') && existsSync(`maps/${ts.relPath}`), ts.relPath);
  const uids = new Set<number>();
  const all = [...project.defs.layers, ...project.defs.entities, ...project.defs.tilesets, ...project.defs.enums, ...project.defs.levelFields, ...project.defs.entities.flatMap((e: { fieldDefs: unknown[] }) => e.fieldDefs), ...project.levels];
  for (const d of all) {
    assert.ok(!uids.has(d.uid) && d.uid < project.nextUid, `uid ${d.uid}`);
    uids.add(d.uid);
  }
  const values = (id: string) => project.defs.enums.find((e: { identifier: string }) => e.identifier === id).values.map((v: { id: string }) => v.id);
  assert.deepEqual(values('Landmark'), [...LANDMARK_KINDS]);
  assert.deepEqual([...values('Biome')].sort(), [...BIOMES].sort());
});

test('every valley: one camp in an open meadow, its relief whole, landmarks on its own ground', () => {
  assert.deepEqual(START_VALLEYS.map((m) => m.id), ['River_Valley', 'Old_Ruin', 'Mountain_Shelf', 'Coastal_Cove']);
  for (const m of START_VALLEYS) {
    assert.ok(fieldStr(m, 'name') && fieldList(m, 'biomes').length, m.id);
    assert.equal(m.things.filter((t) => t[2] === 'Camp').length, 1, `${m.id}: one camp`);
    const c = valleyCamp(m);
    const g = m.grids.Ground;
    const r = m.grids.Relief;
    for (let v = 0; v < m.h; v++)
      for (let u = 0; u < m.w; u++) {
        // (the camp's meadow: open, level ground the town can build on)
        if (Math.hypot(u - c.u, v - c.v) <= CAMP_CLEAR + 0.5) {
          assert.ok('.Fs'.includes(g[v][u]), `${m.id}: ${u},${v} by the camp is ${g[v][u]}`);
          assert.ok(r[v][u] === '.' || r[v][u] === '0', `${m.id}: ${u},${v} by the camp is level`);
        }
        // (a range is mountain rock; a ramp leads up onto high ground; no relief where the land's own is kept)
        if (r[v][u] === '5') assert.equal(g[v][u], 'M', `${m.id}: the range at ${u},${v}`);
        if (r[v][u] === '4') assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => r[v + dv]?.[u + du] === '3'), `${m.id}: the ramp at ${u},${v} leads up`);
        if (g[v][u] === VALLEY_KEEP) assert.equal(r[v][u], '.', `${m.id}: ${u},${v} kept`);
      }
    for (const t of m.things.filter((x) => x[2] === 'Landmark')) assert.notEqual(g[t[1]][t[0]], VALLEY_KEEP, `${m.id}: ${t[3]} on the valley's own ground`);
    // (the edge is frayed into the land's own: some of its edge cells keep the land's)
    const edge = [...g[0], ...g[m.h - 1], ...g.map((row) => row[0]), ...g.map((row) => row[m.w - 1])];
    assert.ok(edge.filter((ch) => ch === VALLEY_KEEP).length > edge.length / 3, `${m.id}: its edge blends into the land`);
  }
});

/** The cells of a land the town can walk to from the camp (not water, not solid rock, not a range). */
function reach(land: ReturnType<typeof makeLand>): number {
  const seen = new Uint8Array(land.w * land.h);
  const q = [land.camp.y * land.w + land.camp.x];
  seen[q[0]] = 1;
  for (let k = 0; k < q.length; k++) {
    const x = q[k] % land.w;
    const y = (q[k] - x) / land.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= land.w || ny >= land.h) continue;
      const i = ny * land.w + nx;
      const g = groundAt(land, nx, ny);
      if (seen[i] || g === 'water' || g === 'mountain' || land.relief?.[i] === '5') continue;
      seen[i] = 1;
      q.push(i);
    }
  }
  return q.length;
}

test('a valley laid on the land of each of its lands stands as drawn, every wild kind near, and the land beyond reached', () => {
  for (const m of START_VALLEYS)
    for (const biome of fieldList(m, 'biomes') as Biome[]) {
      const seed = `valley-${m.id}-${biome}`;
      const land = makeLand(seed, biome, undefined, true, m);
      // its ground as drawn (nothing the land does after, its wild kinds or its hills, changes a cell of it)
      for (const [i, g] of valleyCells(m, land.w, land.h, land.camp)) assert.equal(groundAt(land, i % land.w, Math.floor(i / land.w)), g, `${m.id} on ${biome}: cell ${i}`);
      // its camp on the land's
      const o = valleyOrigin(m, land.camp);
      const c = valleyCamp(m);
      assert.deepEqual([o.x + c.u, o.y + c.v], [land.camp.x, land.camp.y]);
      // every wild kind within reach of the camp, and what each wild cell holds
      for (const k of WILD) {
        let n = 0;
        for (let y = land.camp.y - OPEN_START; y <= land.camp.y + OPEN_START; y++)
          for (let x = land.camp.x - OPEN_START; x <= land.camp.x + OPEN_START; x++) if (Math.hypot(x - land.camp.x, y - land.camp.y) <= OPEN_START && groundAt(land, x, y) === k) n++;
        assert.ok(n >= MIN_KIND_NEAR, `${m.id} on ${biome}: ${n} ${k} near the camp`);
      }
      for (const [i, g] of valleyCells(m, land.w, land.h, land.camp)) if (WILD.includes(g)) assert.ok(land.pools[i], `${m.id}: what ${i} holds`);
      // (the town isn't shut in: most of the wide land is walked to)
      assert.ok(reach(land) > land.w * land.h * 0.4, `${m.id} on ${biome}: the land beyond is reached (${reach(land)})`);
      // (its relief level by the camp)
      if (land.relief) assert.equal(land.relief[land.camp.y * land.w + land.camp.x], '0');
    }
});

test('a town founded from the New town panel may start in a valley that fits; the pick is the seed’s side stream', () => {
  let hand = 0;
  const seen = new Set<string>();
  for (let n = 0; n < 200; n++) {
    const m = pickValley(`seed${n}`, 'forest', 'lone');
    assert.equal(pickValley(`seed${n}`, 'forest', 'lone'), m, 'the same seed, the same valley');
    if (!m) continue;
    hand++;
    seen.add(m.id);
    assert.ok(fieldList(m, 'biomes').includes('forest'));
  }
  assert.ok(Math.abs(hand / 200 - HAND_VALLEY_SHARE) < 0.1, `about ${HAND_VALLEY_SHARE} (${hand / 200})`);
  assert.deepEqual([...seen].sort(), ['Old_Ruin', 'River_Valley'], 'the forest’s two');
  // (by the scenario: the ruin isn't a start for a lost tribe)
  assert.deepEqual(valleysFor('forest', 'tribe').map((m) => m.id), ['River_Valley']);
  assert.deepEqual(valleysFor('coast', 'lone').map((m) => m.id), ['Coastal_Cove']);
  // the tests' towns, and every town but one founded from the panel, are on the seed's own land
  for (let n = 0; n < 20; n++) assert.equal(newGame(`plain${n}`).valley, undefined);
  // a town founded with one: the valley kept, its land laid with it, and the rest of the town as the seed makes it
  const plain = newGame('valley town', { biome: 'forest' });
  const s = newGame('valley town', { biome: 'forest', valley: 'Old_Ruin' });
  assert.equal(s.valley, 'Old_Ruin');
  assert.equal(s.people[0].name, plain.people[0].name, 'the founder the seed makes');
  assert.deepEqual(s.land.camp, plain.land.camp);
  const m = START_VALLEYS.find((x) => x.id === 'Old_Ruin')!;
  for (const [i, g] of valleyCells(m, s.land.w, s.land.h, s.land.camp)) assert.equal(groundAt(s.land, i % s.land.w, Math.floor(i / s.land.w)), g);
  assert.ok(valleyLandmarks(m, s.land.w, s.land.camp).length >= 10, 'the old walls, the statue, the well');
  // (the town finds spots for its buildings in it, and its regions and its known land are laid as on any land)
  assert.ok(s.land.regions?.length);
  for (const id of ['lean_to', 'stockpile', 'garden_plot', 'workbench', 'longhouse']) assert.ok(findSpot(s, BUILDING_BY_ID[id]), `a spot for a ${id}`);
  assert.ok(buildable(groundAt(s.land, s.land.camp.x, s.land.camp.y)));
  // (a hold or a shore town has its own shape: never a valley)
  assert.equal(newGame('hold', { origin: 'dwarves', valley: 'Mountain_Shelf' }).valley, undefined);
  assert.equal(newGame('shore', { origin: 'merfolk', valley: 'Coastal_Cove' }).valley, undefined);
});
