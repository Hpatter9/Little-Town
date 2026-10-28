import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitOf, footDiamond, measureBase, pictureScale } from '../src/renderer/iso/gridAudit';
import { footBase, ISO_TH, ISO_TW, tileToIso } from '../src/renderer/iso/isoMath';

/** A made-up plinth: a 2:1 diamond `w` cells along x and `h` along y at `half` px a half-cell, with a slab `slab` px
 *  thick under it and `pad` empty rows under that, and a block standing on it `tall` px high. */
function plinth(w: number, h: number, half: number, slab: number, pad: number, tall: number) {
  const W = (w + h) * half;
  const top = tall;
  const dh = (w + h) * (half / 2);
  const H = top + dh + slab + pad;
  const a = new Uint8Array(W * H);
  // (the diamond's corners: back (h * half, top), right (W, top + h * half / 2), front (h * half, top + dh), left (0, ...))
  const inside = (x: number, y: number) => {
    // (in the diamond's own cells: u along x, v along y)
    const sx = (x - h * half) / half;
    const sy = (y - top) / (half / 2);
    const u = (sx + sy) / 2;
    const v = (sy - sx) / 2;
    return u >= 0 && v >= 0 && u <= w && v <= h;
  };
  for (let y = 0; y < H - pad; y++)
    for (let x = 0; x < W; x++) {
      // (the slab: the diamond pushed down a px at a time, so its sides stand upright)
      let solid = y < top + 2 && x > W / 2 - 4 && x < W / 2 + 4;
      for (let t = 0; t <= slab && !solid; t++) solid = inside(x + 0.5, y + 0.5 - t);
      if (solid) a[y * W + x] = 255;
    }
  return { a, W, H };
}

test('the plinth of a picture is found: its front corner, its sides and its slab', () => {
  const p = plinth(3, 2, 20, 6, 3, 30);
  const b = measureBase((x, y) => p.a[y * p.W + x], p.W, p.H)!;
  assert.ok(b);
  // (the front corner is w half-cells in from the left, the slab's bottom; the left and right corners at the sides)
  assert.ok(Math.abs(b.front.x - 3 * 20) <= 1.5, `front x ${b.front.x}`);
  assert.equal(b.y1, p.H - 3 - 1);
  assert.ok(b.left.x <= 1 && b.right.x >= p.W - 2, `sides ${b.left.x}, ${b.right.x}`);
  assert.ok(Math.abs(b.slab - 6) <= 2, `slab ${b.slab}`);
});

test('a picture drawn for its footprint fits it: no lift, no shift, the same cells', () => {
  // (a 3x2 plinth drawn at the view's own half-cell, no slab, no empty rows: it lands on its footprint exactly)
  const half = ISO_TW / 2;
  const p = plinth(3, 2, half, 0, 0, 40);
  const b = measureBase((x, y) => p.a[y * p.W + x], p.W, p.H)!;
  const f = fitOf(b, p.W, p.H, 1, false, { w: 3, h: 2 });
  assert.ok(Math.abs(f.artW - 3) < 0.15 && Math.abs(f.artH - 2) < 0.15, `${f.artW}x${f.artH}`);
  assert.ok(Math.abs(f.lift) <= 1, `lift ${f.lift}`);
  assert.ok(Math.abs(f.shiftX) <= 1.5, `shift ${f.shiftX}`);
  assert.ok(Math.abs(f.spread - 1) < 0.05);
  // (mirrored, it covers the cells the other way round)
  const m = fitOf(b, p.W, p.H, 1, true, { w: 2, h: 3 });
  assert.ok(Math.abs(m.artW - 2) < 0.15 && Math.abs(m.artH - 3) < 0.15, `${m.artW}x${m.artH}`);
});

test("a slab and empty rows under a picture lift it off its footprint's ground", () => {
  const half = ISO_TW / 2;
  const p = plinth(2, 2, half, 8, 4, 30);
  const b = measureBase((x, y) => p.a[y * p.W + x], p.W, p.H)!;
  const f = fitOf(b, p.W, p.H, 1, false, { w: 2, h: 2 });
  assert.ok(Math.abs(f.lift - 12) <= 2, `lift ${f.lift}`);
});

test("the footprint's diamond is the land's cells round its footBase", () => {
  const ox = 1000;
  for (const foot of [
    { x: 4, y: 7, w: 3, h: 2 },
    { x: 10, y: 3, w: 1, h: 1 },
    { x: 0, y: 0, w: 6, h: 4 },
  ]) {
    const at = footBase(foot, ox);
    const [back, right, front, left] = footDiamond(foot).map((q) => ({ x: at.x + q.x, y: at.y + q.y }));
    const want = [tileToIso(foot.x, foot.y, ox), tileToIso(foot.x + foot.w, foot.y, ox), tileToIso(foot.x + foot.w, foot.y + foot.h, ox), tileToIso(foot.x, foot.y + foot.h, ox)];
    for (const [got, w] of [[back, want[0]], [right, want[1]], [front, want[2]], [left, want[3]]] as const) {
      assert.ok(Math.abs(got.x - w.x) < 1e-9 && Math.abs(got.y - w.y) < 1e-9, `${JSON.stringify(got)} vs ${JSON.stringify(w)}`);
    }
  }
  assert.equal(ISO_TH * 2, ISO_TW);
});

test("a building's picture is drawn at its kit's size, shrunk only past the overhang; a fitted one to its footprint", () => {
  assert.equal(pictureScale(false, 0.5, 120, 200), 0.5);
  assert.equal(pictureScale(false, 0.5, 48, 200), (48 * 1.25) / 200);
  assert.equal(pictureScale(true, 0.5, 48, 200), 48 / 200);
});
