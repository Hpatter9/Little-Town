import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL_CODES, PROVINCES_PER_REALM, REALMS_DEFAULT, START_PROVINCES, worldSide } from '../src/shared/data/conquest';
import { pickRivals } from '../src/shared/data/factions';
import { hashSeed, Rng } from '../src/shared/rng';
import { foundConquest, holdings, worldOf } from '../src/shared/sim/conquest/conquest';
import { cellOf, makeWorld, provinceYield } from '../src/shared/sim/conquest/world';
import { realm } from '../src/shared/sim/factions';
import { newGame } from '../src/shared/sim/state';

const ids = (n: number) => ['town', ...pickRivals(new Rng(hashSeed('w:realm')), 'settlers', n - 1).map((d) => d.id)];

test('a world for every size: one province each way, whole, joined and named', () => {
  for (const n of [2, 5, 8, 12]) {
    const w = makeWorld('w', ids(n));
    assert.equal(w.side, worldSide(n));
    assert.equal(w.provinces.length, PROVINCES_PER_REALM * n, `${n} realms`);
    assert.equal(w.realms.length, n);
    // every dry cell belongs to a province, no sea cell does
    for (let i = 0; i < w.side * w.side; i++) {
      const cell = CELL_CODES[parseInt(w.cells[i], 12)];
      assert.equal(w.owner[i] >= 0, cell !== 'water', `cell ${i} ${cell}`);
    }
    const names = new Set<string>();
    for (const p of w.provinces) {
      assert.ok(p.cells.length > 0, `${p.name} has ground`);
      assert.ok(p.neighbours.length >= 1, `${p.name} has a neighbour`);
      for (const q of p.neighbours) assert.ok(w.provinces[q].neighbours.includes(p.id), 'neighbours both ways');
      assert.ok(p.name && !names.has(p.name), `name ${p.name} once`);
      names.add(p.name);
      assert.ok(p.cells.includes(p.y * w.side + p.x), 'the middle is its own');
      // a province is one piece of ground
      const seen = new Set<number>([p.cells[0]]);
      const stack = [p.cells[0]];
      const mine = new Set(p.cells);
      while (stack.length) {
        const c = stack.pop()!;
        const x = c % w.side;
        const y = (c - x) / w.side;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          const j = ny * w.side + nx;
          if (nx < 0 || ny < 0 || nx >= w.side || ny >= w.side || !mine.has(j) || seen.has(j)) continue;
          seen.add(j);
          stack.push(j);
        }
      }
      assert.equal(seen.size, p.cells.length, `${p.name} in one piece`);
      const y = provinceYield(p);
      assert.ok(y.coins > 0 && y.amount > 0 && y.material);
    }
    // everything reachable from the town's capital
    const reach = new Set<number>([w.realms[0].capital]);
    const stack = [w.realms[0].capital];
    while (stack.length) for (const q of w.provinces[stack.pop()!].neighbours) if (!reach.has(q)) (reach.add(q), stack.push(q));
    assert.equal(reach.size, w.provinces.length, 'one world');
    // the realms: distinct capitals, far apart, each with its start
    const caps = w.realms.map((r) => r.capital);
    assert.equal(new Set(caps).size, n);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = w.provinces[caps[i]];
        const b = w.provinces[caps[j]];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= w.side / (n + 2), `capitals ${a.name} and ${b.name} apart`);
      }
    for (const r of w.realms) {
      assert.equal(w.provinces[r.capital].capitalOf, w.realms.indexOf(r));
      assert.ok(r.starts.length >= 1 && r.starts.length <= START_PROVINCES);
      assert.equal(r.starts[0], r.capital);
    }
    assert.equal(w.realms[0].id, 'town');
    // the lands vary
    const lands = new Set(w.provinces.map((p) => p.land));
    assert.ok(lands.size >= 3, `lands ${[...lands].join(',')}`);
    assert.ok(w.provinces.some((p) => p.coast), 'some coast');
  }
});

test('a world replays from its seed and differs by seed', () => {
  const a = makeWorld('seed-a', ids(6));
  const b = makeWorld('seed-a', ids(6));
  const c = makeWorld('seed-b', ids(6));
  assert.equal(a.cells, b.cells);
  assert.deepEqual(a.provinces.map((p) => p.name), b.provinces.map((p) => p.name));
  assert.notEqual(a.cells, c.cells);
  assert.equal(cellOf(a, a.provinces[0].x, a.provinces[0].y) === 'water', false);
});

test('a new town founds a conquest: the realms are the realm\'s powers, the starts are held', () => {
  const s = newGame('conq');
  assert.ok(s.conquest);
  assert.equal(s.conquest!.realmIds.length, REALMS_DEFAULT);
  const fs = realm(s);
  assert.deepEqual(fs.map((f) => f.id), s.conquest!.realmIds.slice(1), 'the same powers');
  const w = worldOf(s)!;
  assert.equal(w.provinces.length, PROVINCES_PER_REALM * REALMS_DEFAULT);
  for (const r of w.realms) assert.deepEqual(holdings(s.conquest!, r.id).sort((x, y) => x - y), [...r.starts].sort((x, y) => x - y));
  assert.ok(s.conquest!.holder.filter((h) => h === null).length > w.provinces.length / 2, 'most provinces free');
  // a chosen size
  const big = newGame('conq2', { realms: 12 });
  assert.equal(big.conquest!.realmIds.length, 12);
  assert.equal(realm(big).length, 11);
  assert.equal(new Set(realm(big).map((f) => f.id)).size, 11);
  const small = newGame('conq3', { realms: 2, origin: 'knights' });
  assert.equal(realm(small).length, 1);
  assert.notEqual(realm(small)[0].id, 'brotherhood');
  assert.notEqual(realm(small)[0].id, 'knights');
  // the world's realms hold at the founding, and rebuilt from the seed they're the same
  const again = foundConquest('conq2', big.conquest!.realmIds);
  assert.deepEqual(again.holder, big.conquest!.holder);
});
