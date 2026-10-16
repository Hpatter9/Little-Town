import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { makeWorld } from '../src/shared/sim/conquest/world';
import { parseSave } from '../src/shared/sim/save';
import { warView, type WarView } from '../src/shared/sim/war/view';
import { islandOf, mapLabels, marchAt, piecesOf } from '../src/renderer/panel/warIsland';

const fixture = (): WarView => {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  const v = warView(r.save.state);
  assert.ok(v, 'the fixture has a realm');
  return v;
};
/** A bare view of a world made straight from a seed (the parts the map's projection reads). */
function bareView(seed: string, realms: number): WarView {
  const w = makeWorld(seed, ['town', ...Array.from({ length: realms - 1 }, (_, i) => `f${i}`)]);
  const owners = String.fromCharCode(...Array.from(w.owner, (o) => (o < 0 ? 32 : 33 + o)));
  const provinces = w.provinces.map((p) => ({ id: p.id, name: p.name, land: p.land, x: p.x, y: p.y, neighbours: p.neighbours, holder: null, holderName: 'Free', capitalOf: null, tier: '', fort: '', tierN: p.tier, fortN: p.fort, landmark: null, yields: { coins: 0, recruits: 0, material: '', amount: 0 }, coast: p.coast, garrison: 0 }));
  return { side: w.side, cells: w.cells, owners, provinces, realms: [], rivalArmies: [], home: w.realms[0].capital } as unknown as WarView;
}

test('the war map is one island: every place on its own land, the sea all round, nothing at the edge', () => {
  const views = [fixture(), ...['a', 'b', 'c', 'd'].flatMap((seed) => [2, 5, 9, 12].map((n) => bareView(seed, n)))];
  for (const v of views) {
    const isl = islandOf(v);
    const S = isl.side;
    assert.equal(S, v.side + 2 * isl.margin);
    // the realm's own land kept where it was (shifted by the ring), each cell's province with it
    for (let y = 0; y < v.side; y++)
      for (let x = 0; x < v.side; x++) {
        const i = y * v.side + x;
        if (v.cells[i] === '0') continue;
        const j = (y + isl.margin) * S + (x + isl.margin);
        assert.equal(isl.cells[j], v.cells[i]);
        assert.equal(isl.owners.charCodeAt(j), v.owners.charCodeAt(i));
      }
    // every province's place on land of its own
    for (const p of isl.provinces) {
      const j = p.y * S + p.x;
      assert.notEqual(isl.cells[j], '0', `${p.name} on land`);
      assert.equal(isl.owners.charCodeAt(j) - 33, p.id, `${p.name} on its own land`);
    }
    // the sea all round: two cells of open water at every edge
    for (let k = 0; k < S; k++)
      for (const d of [0, 1]) for (const j of [d * S + k, (S - 1 - d) * S + k, k * S + d, k * S + S - 1 - d]) assert.equal(isl.cells[j], '0', 'the edge is sea');
    // one landmass
    assert.equal(piecesOf(isl.cells, S).count, 1, 'the land is one island');
  }
});

test('the war map\'s labels never overlap, at phone sizes and zoomed in', () => {
  const v = fixture();
  // a few hosts on the march, so their strengths are placed too
  const ids = v.provinces.map((p) => p.id);
  const marching = { ...v, rivalArmies: [0, 1, 2, 3].map((k) => ({ realm: 'x', from: ids[k], to: v.provinces[ids[k]].neighbours[0], hours: 3, strength: 12 + k, t: 0.5, kind: 'border' as const })) };
  const isl = islandOf(marching);
  const measure = (text: string, size: number) => text.length * size * 0.62;
  for (const [cssWidth, dpr, zoom] of [[365, 3, 1], [360, 2.75, 1], [213, 2, 1], [365, 3, 2.5], [800, 1, 1]] as const) {
    const cell = Math.max(3, Math.floor((cssWidth * dpr) / isl.side)) * zoom;
    const size = isl.side * cell;
    const view = { x: 0, y: 0, w: size, h: size };
    const boxes = mapLabels(isl, cell, { selected: null, dpr, view }, measure);
    assert.ok(boxes.some((b) => b.id === `p${v.home}`), 'the town is named');
    for (const b of boxes) {
      assert.ok(b.size >= 11 * dpr, 'no label under 11px');
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= size && b.y + b.h <= size, 'inside the map');
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `${a.text} and ${b.text} overlap`);
      }
    // the hosts stand inside the map
    for (const ra of isl.rivalArmies) {
      const at = marchAt(isl, ra, cell);
      assert.ok(at.x > 0 && at.y > 0 && at.x < size && at.y < size);
    }
  }
});
