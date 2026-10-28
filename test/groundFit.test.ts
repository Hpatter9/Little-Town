import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groundFit, ISO_TH, ISO_TW, type GroundCorners } from '../src/renderer/iso/isoMath';
import { SHARED_PIECES } from '../src/renderer/iso/isoKits';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { depthOf } from '../src/shared/sim/buildings';

// A picture drawn off the grid's angle laid over its footprint (isoMath.ts groundFit; the archery range).

const apply = (m: ReturnType<typeof groundFit>, [x, y]: readonly [number, number]) => [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
const near = (a: number[], b: number[]) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6, `${a} vs ${b}`);

test("the plinth's corners land on the footprint's corners, either way round, and upright stays upright", () => {
  // (a plinth whose across proportions are the footprint's, two to three, drawn steeper than the diamonds)
  const g: GroundCorners = [[0, 100], [80, 150], [200, 20]];
  const texW = 210;
  for (const [w, h, flip] of [[2, 3, false], [3, 2, true]] as const) {
    const m = groundFit(g, texW, { w, h }, flip);
    // (relative to the footprint's front corner: the left corner is w cells back along x, the right h cells back along y)
    const left = [-(w * ISO_TW) / 2, -(w * ISO_TH) / 2];
    const right = [(h * ISO_TW) / 2, -(h * ISO_TH) / 2];
    const [l, f, r] = flip ? [[texW - g[2][0], g[2][1]], [texW - g[1][0], g[1][1]], [texW - g[0][0], g[0][1]]] : g;
    const unflip = (p: readonly number[]) => (flip ? ([texW - p[0], p[1]] as const) : ([p[0], p[1]] as const));
    near(apply(m, unflip(f)), [0, 0]);
    near(apply(m, unflip(l)), left);
    near(apply(m, unflip(r)), right);
    assert.equal(m.c, 0, 'an upright line stays upright');
    assert.ok(m.d > 0, 'heights stay the right way up');
  }
});

test('the archery range lies on a footprint its picture fits: three cells by two, laid by its ground corners', () => {
  const def = BUILDING_BY_ID.archery_range;
  assert.deepEqual([def.width, depthOf(def)], [3, 2]);
  const p = SHARED_PIECES.get('archery_range')!;
  assert.ok(p.ground && p.along_y);
  for (const [x, y] of p.ground) assert.ok(x >= 0 && x <= p.w && y >= 0 && y <= p.h);
  // (its corners land within a few px of the footprint's: the plinth's across proportions are the footprint's)
  const m0 = groundFit(p.ground, p.w, { w: 3, h: 2 }, true);
  const at = (q: readonly [number, number]) => [m0.a * q[0] + m0.tx, m0.b * q[0] + m0.d * q[1] + m0.ty];
  const left = at(p.ground[2]);
  const right = at(p.ground[0]);
  assert.ok(Math.abs(left[0] + (3 * ISO_TW) / 2) < 4 && Math.abs(left[1] + (3 * ISO_TH) / 2) < 1e-6, `${left}`);
  assert.ok(Math.abs(right[0] - ISO_TW) < 4 && Math.abs(right[1] + ISO_TH) < 1e-6, `${right}`);
  // (the heights are squashed a little, not crushed: the targets still stand)
  assert.ok(m0.d / Math.abs(m0.a) > 0.6 && m0.d / Math.abs(m0.a) < 1.1, `${m0.d / Math.abs(m0.a)}`);
});
