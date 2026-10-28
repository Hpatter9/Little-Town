import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { readPng } from '../tools/png';
import { BUILDING_BY_ID, BUILDINGS } from '../src/shared/data/buildings';
import { depthOf, isUnlocked } from '../src/shared/sim/buildings';
import { AWAITING_ART, fenceSeg, fitIn, gatePlan, gridPlan, isFencedPen, looseRec, penEdges, snapSpots, wallArms, wallSeg, yardCells, type GridRec } from '../src/renderer/iso/gridRules';
import { ISO_ART, kitOf, roleOf, SHARED_PIECES } from '../src/renderer/iso/isoKits';
import { propsFor, sceneryFor, stockHeaps } from '../src/renderer/iso/isoTown';
import { ISO_TW } from '../src/renderer/iso/isoMath';
import type { Biome } from '../src/shared/data/biomes';
import type { Role } from '../src/renderer/iso/isoKits';
import type { Ground } from '../src/shared/sim/land';

const ALL_GROUNDS: Ground[] = ['grass', 'forest', 'rock', 'marsh', 'hill', 'water', 'fertile', 'sand', 'mountain', 'hall', 'shallows'];

// The grid's rules (docs/notes/grid-audit.md), for the settlers (the people playable): every piece cut to the grid
// keeps them, every building is drawn by them, and a new piece that breaks them fails here.

const ART = 'src/renderer/art/iso';
const KIT_GRID = `${ART}/kits/settlers/grid`;
const SHARED_GRID = `${ART}/buildings/grid`;
const records = (dir: string) => JSON.parse(readFileSync(`${dir}/grid.json`, 'utf8')) as Record<string, GridRec>;
/** Px of the kit's own art to half a cell (a cell is 2 of these wide, 1 tall). */
const HC = ISO_TW / 2 / (kitOf('settlers').scale * ISO_ART);
const SOLID = 24;
const settlers = (id: string) => isUnlocked({ unlockAll: true, done: [], origin: 'settlers', relief: true }, BUILDING_BY_ID[id]) && !BUILDING_BY_ID[id].never;

/** What of a piece breaks the rules: drawn below its footprint's front edges (onto the cells in front), or wider than
 *  its sides allow (eaves a quarter cell; a tree's canopy a cell and a half across). */
function breaks(dir: string, id: string, r: GridRec): string[] {
  const png = readPng(`${dir}/${id}.png`);
  const [ax, ay] = r.anchor;
  const [w, h] = r.foot;
  const out: string[] = [];
  const lx = ax - w * HC, rx = ax + h * HC;
  const side = r.kind === 'loose' ? 0.25 * HC + (1.5 * HC - HC) : 0.5 * HC;
  let below = 0, wide = 0;
  for (let y = 0; y < png.h; y++)
    for (let x = 0; x < png.w; x++) {
      if (png.alpha[y * png.w + x] < SOLID) continue;
      const cx = x + 0.5, cy = y + 0.5;
      const edge = cx < lx ? ay - (w * HC) / 2 : cx <= ax ? ay - (ax - cx) / 2 : cx <= rx ? ay - (cx - ax) / 2 : ay - (h * HC) / 2;
      if (cy > edge + 1.5) below++;
      if (cx < lx - side || cx > rx + side) wide++;
    }
  if (below) out.push(`${below} px below its front edges`);
  if (wide) out.push(`${wide} px past its sides`);
  return out;
}

test('every settlers piece cut to the grid has a whole-cell footprint, an anchor on its picture, and its copy', () => {
  for (const [dir, recs] of [[KIT_GRID, records(KIT_GRID)], [SHARED_GRID, records(SHARED_GRID)]] as const)
    for (const [id, r] of Object.entries(recs)) {
      assert.ok(existsSync(`${dir}/${id}.png`), `${id}: its copy`);
      const png = readPng(`${dir}/${id}.png`);
      assert.ok(r.foot.every((n) => Number.isInteger(n) && n >= 1), `${id}: footprint ${r.foot}`);
      assert.ok(r.anchor.every(Number.isInteger), `${id}: anchor ${r.anchor}`);
      assert.ok(r.anchor[0] >= 0 && r.anchor[0] <= png.w && r.anchor[1] >= 0 && r.anchor[1] <= png.h + HC, `${id}: anchor ${r.anchor} on its ${png.w}x${png.h} picture`);
      if (r.kind === 'seg') assert.deepEqual(r.foot, [1, 1], `${id}: a wall or fence piece is one cell`);
    }
});

test('no building, tree, rock or prop is drawn onto the cells in front of it or far past its sides', () => {
  const bad: string[] = [];
  for (const [dir, recs] of [[KIT_GRID, records(KIT_GRID)], [SHARED_GRID, records(SHARED_GRID)]] as const)
    for (const [id, r] of Object.entries(recs)) {
      if (r.kind === 'seg' || r.kind === 'gate') continue; // (a run's piece reaches its neighbours by design)
      const why = breaks(dir, id, r);
      if (why.length) bad.push(`${id}: ${why.join(', ')}`);
    }
  assert.deepEqual(bad, []);
});

test('every settlers building is drawn on the grid: by a picture that fits, or a borrowed one waiting for its own', () => {
  const shrunk: string[] = [];
  const missing: string[] = [];
  for (const d of BUILDINGS) {
    if (!settlers(d.id) || !('role' in roleOf(d.id))) continue;
    const foot = { x: 0, y: 0, w: d.width, h: depthOf(d) };
    const role = (roleOf(d.id) as { role: Role }).role;
    if (role === 'wall_run' || role === 'wall_corner') {
      assert.ok(wallSeg('settlers', d.id), `${d.id}: a wall piece`);
      continue;
    }
    if (role === 'gate') {
      assert.ok(gatePlan('settlers', d.id, foot), `${d.id}: a gate piece`);
      continue;
    }
    if (role === 'stockade' || isFencedPen(d.id)) {
      assert.ok(wallSeg('settlers', d.id) && fenceSeg('settlers'), `${d.id}: its fence`);
      continue;
    }
    const plan = gridPlan('settlers', d.id, foot);
    // (a shared picture laid on the ground off the grid's angle is fitted to its footprint by iso/isoMath.ts groundFit)
    if (!plan) {
      if (!SHARED_PIECES.get(d.id)?.ground) missing.push(d.id);
      continue;
    }
    if (plan.shrink < 1) shrunk.push(d.id);
    else {
      const [pw, ph] = plan.flip ? [plan.rec.foot[1], plan.rec.foot[0]] : plan.rec.foot;
      assert.ok(pw === plan.sub.w && ph === plan.sub.h && plan.sub.w <= foot.w && plan.sub.h <= foot.h, `${d.id}: its picture's cells inside its footprint`);
    }
  }
  assert.deepEqual(missing, [], 'buildings with no cut picture at all');
  assert.deepEqual([...shrunk].sort(), [...AWAITING_ART].sort(), 'AWAITING_ART lists exactly the buildings drawn smaller (add a new one to the list, or give it a picture that fits)');
});

test('the herds pens are fenced, not ploughed', () => {
  for (const id of ['goat_pen', 'pig_sty', 'chicken_coop', 'sheep_fold', 'cattle_pasture']) if (BUILDING_BY_ID[id]) assert.ok(isFencedPen(id), id);
});

test("the land's trees, rocks and bushes and the buildings' props and heaps are all cut to one cell", () => {
  const ids = [...kitOf('settlers').pieces.keys()];
  const want = new Set<string>();
  const biomes: (Biome | undefined)[] = [undefined, 'desert', 'tundra', 'taiga', 'swamp', 'jungle', 'highlands', 'ashlands', 'steppe'];
  for (const g of ALL_GROUNDS)
    for (const b of biomes)
      for (let i = 0; i < 20; i++) {
        const p = sceneryFor(ids, g, b, i / 20, ((i * 7) % 20) / 20);
        if (p) want.add(p);
      }
  for (const role of ['workshop', 'stockpile', 'tavern', 'market', 'granary', 'cottage', 'longhouse', 'chapel', 'watchtower'] as Role[]) for (const p of propsFor(ids, role)) want.add(p);
  for (const h of stockHeaps(ids, { wood: 20, stone: 20, grain: 20, iron: 20, cloth: 20, milk: 20 }, 100, { x: 0, y: 0, w: 3, h: 2 })) want.add(h.piece);
  assert.deepEqual([...want].filter((p) => !looseRec('settlers', p)), []);
});

test('a picture fits a footprint either way round, on its middle, and the rest is its yard', () => {
  const f = { x: 10, y: 4, w: 5, h: 3 };
  const fit = fitIn([3, 3], f)!;
  assert.deepEqual(fit.sub, { x: 11, y: 4, w: 3, h: 3 });
  assert.equal(yardCells(f, fit.sub).length, 6);
  const turned = fitIn([2, 3], { x: 0, y: 0, w: 3, h: 2 })!;
  assert.equal(turned.flip, true);
  assert.deepEqual(turned.sub, { x: 0, y: 0, w: 3, h: 2 });
  assert.equal(fitIn([4, 4], f), null);
});

test("a pen's fence runs round its edges with a way in on the front-left; a wall cell joins its neighbours by arms", () => {
  const e = penEdges({ x: 0, y: 0, w: 3, h: 2 }, 1);
  assert.equal(e.segs.length, 3 + 2 + 2 + 2);
  assert.deepEqual(e.way, { x: 1.5, y: 2, cells: 1 });
  assert.deepEqual(wallArms({ n: false, e: true, s: false, w: true }), { whole: { alongY: false } });
  assert.deepEqual(wallArms({ n: true, e: false, s: false, w: false }), { whole: { alongY: true } });
  assert.deepEqual(wallArms({ n: true, e: true, s: false, w: false }), { arms: ['n', 'e'] });
  // (props: its yard first, then the free cells along its front)
  const spots = snapSpots(3, { x: 0, y: 0, w: 2, h: 2 }, [{ x: 0, y: 0 }], () => true);
  assert.deepEqual(spots, [{ x: 0.5, y: 0.5 }, { x: 2.5, y: 1.5 }, { x: 2.5, y: 0.5 }]);
});
