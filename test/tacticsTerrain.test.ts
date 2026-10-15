import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { Rng } from '../src/shared/rng';
import { shotCode, shotOf } from '../src/shared/data/projectiles';
import { makeBoard, shotReach, type TacTile } from '../src/shared/sim/tactics';
import { boardOk, canStep, CLIMB_MAX, coverChance, HILL_RISE, layTerrain, sightClear } from '../src/shared/sim/tacticsTerrain';
import { newGame } from '../src/shared/sim/state';

/** A bare grass field of the given heights (rows of numbers). */
function field(rows: number[][]) {
  const h = rows.length;
  const w = rows[0].length;
  const tiles: TacTile[] = [];
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) tiles.push({ h: rows[v][u], g: 'grass', lx: u, ly: v });
  return { w, h, tiles };
}
const flat = (w: number, h: number) => field(Array.from({ length: h }, () => Array(w).fill(1)));

test('every board of every land is connected: every tile can be walked to from the gate and back, the edge whole', () => {
  for (const biome of BIOMES)
    for (let k = 0; k < 3; k++) {
      const s = newGame(`terrain-${biome}-${k}`, { biome } as never);
      const b = makeBoard(s, k % 2 ? 1 : -1, k % 3 === 0, 500 + k * 131);
      assert.ok(boardOk(b, b.w - 4), `${biome} ${k}`);
    }
});

test('the board is laid from a side stream: the same seed and tick give the same field, another tick another', () => {
  const s = newGame('terrain-same');
  const a = makeBoard(s, -1, false, 100);
  const b = makeBoard(s, -1, false, 100);
  const c = makeBoard(s, -1, false, 101);
  assert.deepEqual(a.tiles, b.tiles);
  assert.notDeepEqual(a.tiles, c.tiles);
});

test('lands lay different pieces: hills, copses, logs and water turn up across seeds and biomes', () => {
  const seen = { hill: 0, ramp: 0, tree: 0, log: 0, pond: 0 };
  for (const biome of BIOMES)
    for (let k = 0; k < 5; k++) {
      const s = newGame(`mix-${biome}-${k}`, { biome } as never);
      for (const t of makeBoard(s, -1, false, 7 + k * 53).tiles) {
        if (t.hill === 'top') seen.hill++;
        if (t.hill === 'ramp') seen.ramp++;
        if (t.tree) seen.tree++;
        if (t.log) seen.log++;
        if (t.g === 'water') seen.pond++;
      }
    }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 0, `no ${k}`);
});

test('a hill climbs only from its ramp: the top is reached by the ramp alone, every other face is a cliff', () => {
  const g = flat(17, 14);
  layTerrain(g, 13, new Rng(5), 'highlands', { wood: 0, hill: 1, wet: 0 });
  const tops = g.tiles.map((t, i) => (t.hill === 'top' ? i : -1)).filter((i) => i >= 0);
  assert.ok(tops.length >= 9, 'a hill was laid');
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // walk from the foot of the field over the ground: which tiles can a nimble foot (jump 3) get to?
  const reach = (blockRamp: boolean) => {
    const seen = new Set<number>();
    const queue = [0];
    seen.add(0);
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      for (const [du, dv] of dirs) {
        const u = (i % g.w) + du;
        const v = Math.floor(i / g.w) + dv;
        if (u < 0 || v < 0 || u >= g.w || v >= g.h) continue;
        const j = v * g.w + u;
        if (seen.has(j) || (blockRamp && g.tiles[j].hill === 'ramp') || canStep(g.tiles[i], g.tiles[j], 3) === null) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    return seen;
  };
  assert.ok(tops.every((i) => reach(false).has(i)), 'the top is climbed by the ramp');
  assert.ok(tops.every((i) => !reach(true).has(i)), 'without the ramp there is no way up, even for the nimblest');
  // (up the ramp costs more than the flat: a hill is climbed slowly)
  const ramp = g.tiles.findIndex((t) => t.hill === 'ramp' && t.h === g.tiles[tops[0]].h - HILL_RISE + 1);
  assert.ok(ramp >= 0);
  const foot = [-1, 1, -g.w, g.w].map((d) => g.tiles[ramp + d]).find((t) => t && t.hill !== 'top' && t.h === g.tiles[ramp].h - 1)!;
  assert.equal(canStep(foot, g.tiles[ramp], 2), 2);
});

test('a step: climbing is limited to two and costs more, a log costs more, a cliff is too far down as up', () => {
  const t = (h: number, extra: Partial<TacTile> = {}): TacTile => ({ h, g: 'grass', lx: 0, ly: 0, ...extra });
  assert.equal(canStep(t(1), t(1), 2), 1);
  assert.equal(canStep(t(1), t(2), 2), 2);
  assert.equal(canStep(t(1), t(1 + CLIMB_MAX), 3), 3);
  assert.equal(canStep(t(1), t(1 + CLIMB_MAX + 1), 3), null);
  assert.equal(canStep(t(1), t(1, { log: true }), 2), 2);
  assert.equal(canStep(t(4), t(2), 2), 1, 'down two with a jump of two');
  assert.equal(canStep(t(5), t(2), 3), null, 'a cliff is a cliff both ways');
});

test('trees and boulders block a bow\'s line, a high shooter sees over them, walls are shot over', () => {
  const g = flat(9, 3);
  const a = { u: 1, v: 1 };
  const b = { u: 6, v: 1 };
  assert.ok(sightClear(g, a, b));
  g.tiles[1 * 9 + 3].tree = true;
  assert.ok(!sightClear(g, a, b), 'a tree stands in the way');
  g.tiles[1 * 9 + 1].h = 4; // (the shooter on a hill)
  assert.ok(sightClear(g, a, b), 'over the tree from a hill');
  const w = flat(9, 3);
  w.tiles[1 * 9 + 3].block = 'wall';
  w.tiles[1 * 9 + 3].h = 3;
  assert.ok(sightClear(w, a, b), 'a wall is shot over');
  const r = flat(9, 3);
  r.tiles[1 * 9 + 3].block = 'rock';
  assert.ok(!sightClear(r, a, b));
});

test('cover turns shots aside: a tree or bush the target stands in, one beside it; less from high ground', () => {
  const g = flat(9, 3);
  const from = { u: 1, v: 1 };
  const to = { u: 6, v: 1 };
  assert.equal(coverChance(g, from, to), 0);
  g.tiles[1 * 9 + 6].bush = true;
  const bush = coverChance(g, from, to);
  assert.ok(bush > 0);
  g.tiles[1 * 9 + 6].tree = true;
  delete g.tiles[1 * 9 + 6].bush;
  const tree = coverChance(g, from, to);
  assert.ok(tree > bush);
  g.tiles[1 * 9 + 5].block = 'rock';
  assert.ok(coverChance(g, from, to) > tree, 'a boulder in front adds to it');
  g.tiles[1 * 9 + 1].h = 4;
  assert.ok(coverChance(g, from, to) <= (tree + 0.15) / 2 + 1e-9, 'a shooter above finds the mark through it: half the cover');
});

test('height gives a shooter reach: a hill\'s top reaches two tiles further than level ground', () => {
  const s = newGame('reach');
  const st = { speed: 6, move: 3, jump: 2, reach: 4, shooter: true };
  const low: TacTile = { h: 1, g: 'grass', lx: 0, ly: 0 };
  const top: TacTile = { h: 1 + HILL_RISE, g: 'grass', lx: 0, ly: 0 };
  assert.ok(shotReach(s, st, top, low) >= shotReach(s, st, low, low) + 2);
  assert.equal(shotReach(s, { ...st, shooter: false, reach: 1 }, top, low), 1);
});

test('shots are named by what flies: a bow an arrow, a crossbow a bolt, a gun a bullet, a mage an orb of its element', () => {
  assert.equal(shotOf('Bow'), 'arrow');
  assert.equal(shotOf('Crossbow'), 'bolt');
  assert.equal(shotOf('Rifle'), 'bullet');
  assert.equal(shotOf('Sling'), 'stone');
  assert.equal(shotOf('Staff', { magic: true, caster: 'necromancer' }), 'orb:dark');
  assert.equal(shotOf('Fire Wizard'), 'orb:fire');
  assert.equal(shotCode({ ammo: 'orb', el: 'ice' }), 'orb:ice');
});
