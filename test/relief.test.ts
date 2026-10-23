import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { BIOME_DEFS, BIOMES } from '../src/shared/data/biomes';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { QUARRY } from '../src/shared/data/hills';
import { canPlace, depthOf, footprint, isUnlocked, placeBlueprint, unlockInfo } from '../src/shared/sim/buildings';
import { quarryLoad } from '../src/shared/sim/farming';
import { hillHarvest } from '../src/shared/sim/hills';
import { findPath, groundAt, idx, isPlannedRoad, makeLand, setGround, type LandMap } from '../src/shared/sim/land';
import { rockSpot } from '../src/shared/sim/planner';
import { climbs, cutInto, HIGH, isHigh, RAMP, RANGE, reliefShares, rockBeside, QUARRY_ROCK } from '../src/shared/sim/relief';
import { Sim } from '../src/shared/sim/sim';
import { campCell, newGame, type GameState } from '../src/shared/sim/state';
import { pave } from '../src/shared/sim/streets';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { drawPath, pathRefusal } from '../src/shared/sim/pathPlans';
import { clearAround, plainGame } from './helpers';

const setRelief = (m: LandMap, x: number, y: number, c: string) => {
  const i = idx(m, x, y);
  m.relief = m.relief!.slice(0, i) + c + m.relief!.slice(i + 1);
};

test('a level land is laid exactly as before relief (the lands of towns founded earlier, and the hash towns)', () => {
  // (digests of each land's cells, pools and roads as the game made them before relief came in)
  const was: [string, Parameters<typeof makeLand>[1], Parameters<typeof makeLand>[2], string][] = [
    ['digest-a', 'forest', undefined, '3d5a4f0e73bbb8e0'],
    ['digest-b', 'highlands', undefined, 'f4e4fba161f0f4aa'],
    ['digest-c', 'tundra', 'mountain', 'e30f81c9b21f3b03'],
    ['digest-d', 'coast', 'sea', 'd448a511156cb59c'],
    ['digest-e', 'ashlands', undefined, 'c474b2660d947db0'],
  ];
  for (const [seed, biome, shape, digest] of was) {
    const m = makeLand(seed, biome, shape);
    assert.equal(m.relief, undefined);
    assert.equal(createHash('sha1').update(m.cells + JSON.stringify(m.pools) + m.roads).digest('hex').slice(0, 16), digest, seed);
  }
  assert.equal(newGame('digest-f', { relief: false }).land.relief, undefined);
  assert.ok(newGame('digest-f').land.relief, 'a new town has relief');
});

test('relief changes the ground only where it lays rock or cuts a pass: everything else is the land the seed always made', () => {
  for (const biome of ['forest', 'highlands', 'desert'] as const) {
    const flat = makeLand('same-land', biome);
    const hilly = makeLand('same-land', biome, undefined, true);
    for (let i = 0; i < flat.cells.length; i++) {
      if (flat.cells[i] === hilly.cells[i]) continue;
      // (rock laid, or a pass cut through it to a pocket of open ground: a range or rocky hill)
      assert.ok(hilly.relief![i] === RANGE || hilly.relief![i] === '2', `${biome} cell ${i} changed under '${hilly.relief![i]}'`);
    }
  }
});

test("every land's relief is near its table: hills everywhere, ranges in the mountain lands, least in the sea, fens and plains", () => {
  for (const biome of BIOMES) {
    const t = BIOME_DEFS[biome].relief;
    assert.ok(t.downs > 0, `${biome} has hills`);
    for (const seed of ['share-1', 'share-2']) {
      const got = reliefShares(makeLand(seed, biome, undefined, true));
      for (const k of ['downs', 'rocky', 'high', 'range'] as const) {
        const want = t[k];
        assert.ok(got[k] >= want * 0.6 - 0.006 && got[k] <= want * 1.5 + 0.01, `${biome} ${seed} ${k}: ${got[k].toFixed(3)} for ${want}`);
      }
    }
  }
  const most = (b: (typeof BIOMES)[number]) => BIOME_DEFS[b].relief.range + BIOME_DEFS[b].relief.high;
  assert.ok(most('highlands') > most('forest') && most('forest') > most('steppe') && most('steppe') >= most('swamp'));
  assert.equal(BIOME_DEFS.coast.relief.range, 0);
});

test('every open cell can be walked to from the camp and back: the ranges have passes, every shelf of high ground a ramp', () => {
  for (const [seed, biome] of [['reach-1', 'highlands'], ['reach-2', 'ashlands'], ['reach-3', 'taiga'], ['reach-4', 'desert']] as const) {
    const m = makeLand(seed, biome, undefined, true);
    const n = m.w * m.h;
    const pass = (i: number) => m.cells[i] !== 'M' && m.cells[i] !== 'H';
    const nb = (i: number) => [i % m.w ? i - 1 : -1, i % m.w < m.w - 1 ? i + 1 : -1, i - m.w, i + m.w].filter((j) => j >= 0 && j < n);
    const flood = (back: boolean) => {
      const seen = new Uint8Array(n);
      const start = m.camp.y * m.w + m.camp.x;
      const q = [start];
      seen[start] = 1;
      for (let k = 0; k < q.length; k++)
        for (const j of nb(q[k])) {
          if (seen[j] || !pass(j)) continue;
          if (back ? climbs(m.relief!, m.roads, j, q[k]) : climbs(m.relief!, m.roads, q[k], j)) continue;
          seen[j] = 1;
          q.push(j);
        }
      return seen;
    };
    const out = flood(false);
    const back = flood(true);
    let lost = 0;
    for (let i = 0; i < n; i++) if (pass(i) && !(out[i] && back[i])) lost++;
    assert.equal(lost, 0, `${biome}: ${lost} cells cut off`);
    assert.ok([...m.relief!].some((c) => c === RAMP), `${biome} has ramps`);
  }
});

test('a path never crosses rock, and never climbs a cliff but at a ramp or a street (a drop off one is a jump)', () => {
  const s = newGame('paths-hills', { biome: 'highlands' });
  s.townBuilds = true;
  const m = s.land;
  const c = campCell(s);
  let found = 0;
  let jumped = 0;
  for (let k = 0; k < 40; k++) {
    const a = { x: c.x + ((k * 37) % 61) - 30, y: c.y + ((k * 53) % 61) - 30 };
    const b = { x: c.x + ((k * 17 + 11) % 61) - 30, y: c.y + ((k * 29 + 7) % 61) - 30 };
    if (groundAt(m, a.x, a.y) === 'mountain' || groundAt(m, b.x, b.y) === 'mountain') continue;
    const way = findPath(m, a, b, undefined, 40000);
    if (!way) continue;
    found++;
    let prev = idx(m, a.x, a.y);
    for (const p of way) {
      const i = idx(m, p.x, p.y);
      assert.notEqual(groundAt(m, p.x, p.y), 'mountain', 'a step on rock');
      assert.equal(climbs(m.relief!, m.roads, prev, i), false, 'a cliff climbed');
      if (isHigh(m.relief![prev]) && !isHigh(m.relief![i])) jumped++;
      prev = i;
    }
  }
  assert.ok(found >= 10, `${found} ways found`);
  assert.ok(jumped >= 0);
});

/** A ridge of rock three cells thick, the whole land's height, a few cells east of the camp: there's no way round. */
function ridge(s: GameState): number {
  const m = s.land;
  const c = campCell(s);
  const x0 = c.x + 5;
  for (let y = 0; y < m.h; y++)
    for (let x = x0; x < x0 + 3; x++) {
      setGround(m, x, y, 'mountain');
      setRelief(m, x, y, RANGE);
    }
  return x0;
}

test('a path drawn through a thin ridge is a tunnel, cut slowly, and walkers then take it; thick rock and a level land are refused', () => {
  const s = plainGame('tunnel-1');
  clearAround(s, 10);
  const x0 = ridge(s);
  const c = campCell(s);
  const m = s.land;
  const row = [-1, 0, 1, 2, 3].map((k) => ({ x: x0 + k, y: c.y + 2 }));
  assert.equal(findPath(m, row[0], row[4]), null, 'no way through before it is cut');
  assert.equal(drawPath(s, row.map((p) => idx(m, p.x, p.y)), true), 5, 'the path is laid through the rock');
  for (const p of row) assert.ok(isPlannedRoad(m, p.x, p.y));
  for (const p of row) pave(s, idx(m, p.x, p.y));
  for (const p of row.slice(1, 4)) assert.equal(groundAt(m, p.x, p.y), 'hall', 'the rock dug out');
  const way = findPath(m, { x: c.x, y: c.y + 2 }, { x: x0 + 5, y: c.y + 2 });
  assert.ok(way, 'a way through the tunnel');
  assert.ok(way!.some((p) => p.x === x0 + 1 && p.y === c.y + 2), 'the way goes through it');
  for (const p of way!) assert.notEqual(groundAt(m, p.x, p.y), 'mountain');
  // (a ridge too thick to tunnel)
  const t2 = plainGame('tunnel-2');
  clearAround(t2, 10);
  const c2 = campCell(t2);
  for (let y = 0; y < t2.land.h; y++) for (let x = c2.x + 5; x < c2.x + 15; x++) {
    setGround(t2.land, x, y, 'mountain');
    setRelief(t2.land, x, y, RANGE);
  }
  assert.equal(pathRefusal(t2, c2.x + 8, c2.y), 'Solid rock');
  // (a level land never tunnels)
  const flat = newGame('tunnel-3', { relief: false });
  const cf = campCell(flat);
  setGround(flat.land, cf.x + 3, cf.y, 'mountain');
  assert.equal(pathRefusal(flat, cf.x + 3, cf.y), 'Solid rock');
});

/** A face of rock north of the camp: three rows of it, thirteen cells wide, its foot `foot` rows above the camp. */
function face(s: GameState, foot = 6): number {
  const m = s.land;
  const c = campCell(s);
  for (let y = c.y - foot - 2; y <= c.y - foot; y++)
    for (let x = c.x - 6; x <= c.x + 6; x++) {
      setGround(m, x, y, 'mountain');
      setRelief(m, x, y, RANGE);
    }
  return c.y - foot;
}

test('a building that may be cut into the rock is placed with its back row in the cliff and rock behind its door', () => {
  const s = plainGame('into-rock');
  s.townBuilds = true;
  clearAround(s, 10);
  s.cheats.unlockAll = true;
  const top = face(s);
  const def = BUILDING_BY_ID.cottage;
  assert.ok(def.intoRock);
  const at = rockSpot(s, def, 'into');
  assert.ok(at, 'a spot in the face');
  const r = { x: at!.x, y: at!.y, w: def.width, h: depthOf(def) };
  assert.ok(cutInto(s.land, r));
  assert.equal(r.y, top, 'its back row is the foot of the face');
  for (let x = r.x; x < r.x + r.w; x++) {
    assert.equal(groundAt(s.land, x, r.y - 1), 'mountain', 'rock behind it');
    assert.equal(groundAt(s.land, x, r.y), 'mountain', 'its back row in the rock');
  }
  assert.ok(placeBlueprint(s, def.id, r.x, r.y).ok);
  const b = s.buildings[s.buildings.length - 1];
  assert.equal(b.cut, true);
  // (a building that may not be cut into rock is not, and nothing is on a level land)
  assert.equal(canPlace(s, BUILDING_BY_ID.workbench, r.x + 4, r.y).ok, false);
});

test('a quarry needs rock beside it, and only a land with relief has one; its loads hold the land\'s vein', () => {
  const s = plainGame('quarry-1');
  s.townBuilds = true;
  clearAround(s, 10);
  const def = BUILDING_BY_ID[QUARRY];
  assert.ok(isUnlocked(unlockInfo(s), def));
  const c = campCell(s);
  // (on open ground with no rock near)
  assert.equal(canPlace(s, def, c.x + 2, c.y + 2).ok, false);
  face(s);
  const at = rockSpot(s, def, 'beside');
  assert.ok(at && rockBeside(s.land, { ...at, w: def.width, h: depthOf(def) }) >= QUARRY_ROCK, 'a spot against the face');
  assert.ok(canPlace(s, def, at!.x, at!.y).ok);
  // (the same spot a row further off the face: no rock beside it)
  assert.equal(rockBeside(s.land, { x: at!.x, y: at!.y + 1, w: def.width, h: depthOf(def) }), 0);
  assert.equal(canPlace(s, def, at!.x, at!.y + 1).ok, false);
  assert.ok(placeBlueprint(s, QUARRY, at!.x, at!.y).ok);
  const q = s.buildings[s.buildings.length - 1];
  const load = quarryLoad(s, q);
  assert.ok((load.stone ?? 0) >= 3);
  assert.equal(load.flint, 1, "the forest's rock holds flint");
  assert.equal(isUnlocked(unlockInfo(newGame('quarry-2', { relief: false })), def), false, 'no quarry on a level land');
  // (a highland quarry turns up a gem now and then)
  const hs = newGame('quarry-3', { biome: 'highlands' });
  hs.townBuilds = true;
  let gems = 0;
  for (let k = 0; k < 12; k++) gems += quarryLoad(hs, q).gems ?? 0;
  assert.equal(gems, 2);
});

test('fields on the hills yield less, orchards more; a level land is the same everywhere', () => {
  const s = plainGame('hill-fields');
  s.townBuilds = true;
  const c = campCell(s);
  for (let y = c.y + 3; y < c.y + 8; y++) for (let x = c.x - 4; x < c.x + 4; x++) setRelief(s.land, x, y, '1');
  const field = { id: 900, def: 'garden_plot', tile: c.x - 3, row: c.y + 4, status: 'done', delivered: {}, progress: 1, store: {} } as GameState['buildings'][number];
  const orchard = { ...field, id: 901, def: 'orchard' };
  assert.ok(hillHarvest(s, field) < 1);
  assert.ok(hillHarvest(s, orchard) > 1);
  const flat = newGame('hill-fields', { relief: false });
  flat.townBuilds = true;
  assert.equal(hillHarvest(flat, field), 1);
  assert.equal(footprint(field).x, c.x - 3);
});

test('a town founded in a bowl of hills, a ring of cliffs about it with a few ramps, still grows (the planner does not stall)', () => {
  const run = (bowl: boolean) => {
    const s = newGame('bowl-town', { biome: 'forest' });
    s.townBuilds = true;
    const m = s.land;
    const c = campCell(s);
    if (bowl) {
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const d = Math.hypot(x - c.x, y - c.y);
          if (groundAt(m, x, y) === 'water' || groundAt(m, x, y) === 'mountain') continue;
          if (d >= 9 && d < 12) setRelief(m, x, y, HIGH);
          else if (d >= 6 && d < 9) setRelief(m, x, y, '1');
        }
      // (a ramp up from inside on each side, and one up from outside)
      for (const [dx, dy] of [[9, 0], [-9, 0], [0, 9], [0, -9], [11, 0], [-11, 0]]) setRelief(m, c.x + dx, c.y + dy, RAMP);
    }
    const sim = new Sim(s);
    for (let i = 0; i < 4 * TICKS_PER_DAY; i++) sim.step();
    return { built: s.buildings.filter((b) => b.status === 'done').length, people: s.people.length };
  };
  const bowl = run(true);
  const plain = run(false);
  assert.ok(bowl.built >= Math.max(4, Math.floor(plain.built * 0.6)), `bowl ${bowl.built} built, plain ${plain.built}`);
  assert.ok(bowl.people >= 1);
});
