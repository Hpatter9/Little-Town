// A finished stockpile keeps its own iso picture (it used to be swapped for the old top-down heaps once built) and
// shows how full it is: the kit's logs, rocks, bales, barrels and crates heaped beside it, more as it fills.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { STOCK_HEAPS, fillOf, heapCount, stockHeaps } from '../src/renderer/iso/isoTown';
import { pieceFor, kitOf, SHARED_PIECES } from '../src/renderer/iso/isoKits';

const SETTLERS: string[] = JSON.parse(readFileSync(join('src', 'renderer', 'art', 'iso', 'kits', 'settlers', 'index.json'), 'utf8')).map((p: { id: string }) => p.id);
const foot = { x: 10, y: 10, w: 3, h: 2 };

test('the stockpile is drawn with its own kit piece, built or not', () => {
  assert.equal(pieceFor(kitOf('settlers'), 'stockpile'), 'stockpile');
});

test('an empty stockpile has no heaps; one fills in stages to all of them', () => {
  assert.equal(heapCount({}, 100), 0);
  assert.equal(heapCount({ wood: 1 }, 100), 1, 'the first log shows');
  assert.equal(heapCount({ wood: 50 }, 100), STOCK_HEAPS / 2);
  assert.equal(heapCount({ wood: 100 }, 100), STOCK_HEAPS);
  assert.equal(heapCount({ wood: 400 }, 100), STOCK_HEAPS, 'never more than full');
  assert.equal(fillOf({ wood: 30, stone: 20 }, 100), 0.5);
  let last = 0;
  for (let n = 0; n <= 100; n += 5) {
    const h = stockHeaps(SETTLERS, { wood: n }, 100, foot).length;
    assert.ok(h >= last, 'it only grows as it fills');
    last = h;
  }
  assert.equal(last, STOCK_HEAPS);
});

test("the heaps are of what it holds, from the settlers' own kit, beside the shelter", () => {
  const h = stockHeaps(SETTLERS, { wood: 15, stone: 15, grain: 15, milk: 15, cloth: 15 }, 100, foot);
  const pieces = h.map((x) => x.piece);
  // (grain in the kit's grain sacks and stone on its ore heap once PixelLab's are in: docs/notes/pixellab-plan.md)
  for (const p of ['woodpile', SETTLERS.includes('ore_pile') ? 'ore_pile' : 'rocks', SETTLERS.includes('grain_sacks') ? 'grain_sacks' : 'hay_bales', 'barrels', 'crates']) assert.ok(pieces.includes(p), p);
  for (const p of pieces) assert.ok(SETTLERS.includes(p));
  for (const x of h) assert.ok(x.x >= foot.x + foot.w || x.y >= foot.y + foot.h || x.x < foot.x, 'outside the shelter, along its front');
  assert.deepEqual(stockHeaps(SETTLERS, { wood: 40, stone: 20 }, 100, foot), stockHeaps(SETTLERS, { wood: 40, stone: 20 }, 100, foot), 'the same every time');
});

test("the stockade is a closed square of the kit's palisade with its gate in front, not one stretched run", async () => {
  const { roleOf, fitted } = await import('../src/renderer/iso/isoKits');
  const { PEN_EDGE, penSides } = await import('../src/renderer/iso/isoTown');
  assert.deepEqual(roleOf('stockade'), { role: 'stockade' });
  assert.ok(fitted('stockade'));
  // (its gate, until a picture of its own is in: iso/gridRules.ts ownPlan)
  assert.equal(pieceFor(kitOf('settlers'), 'stockade'), SHARED_PIECES.has('stockade') ? 'stockade' : 'palisade_gate');
  const f = { x: 4, y: 6, w: 3, h: 2 };
  const sides = penSides(f);
  assert.equal(sides.filter((s) => s.part === 'gate').length, 1, 'one gate');
  const gate = sides.find((s) => s.part === 'gate')!;
  assert.ok(gate.foot.y + gate.foot.h === f.y + f.h && gate.foot.x === f.x + 1, 'in the middle of the front');
  // (a run on every cell of every edge, each a cell long, so every stake stands as tall as the next)
  for (const s of sides) assert.equal(Math.max(s.foot.w, s.foot.h), 1);
  const on = (x: number, y: number) => sides.some((s) => x >= s.foot.x - 1e-9 && x <= s.foot.x + s.foot.w + 1e-9 && y >= s.foot.y - 1e-9 && y <= s.foot.y + s.foot.h + 1e-9);
  for (let x = f.x + 0.5; x < f.x + f.w; x++) assert.ok(on(x, f.y) && on(x, f.y + f.h), `x ${x}`);
  for (let y = f.y + 0.5; y < f.y + f.h; y++) assert.ok(on(f.x, y) && on(f.x + f.w, y), `y ${y}`);
  assert.ok(!on(f.x + 1.5, f.y + 1), 'the middle is open, for the prisoners');
  assert.ok(PEN_EDGE < 0.5);
});
