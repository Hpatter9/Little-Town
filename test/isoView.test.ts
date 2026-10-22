import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { CELL } from '../src/shared/sim/land';
import { BUILDINGS } from '../src/shared/data/buildings';
import { cellsInView, footBase, footDepth, footWidth, isoBounds, isoOrigin, isoToTile, isoToWorld, ISO_TH, ISO_TW, pointDepth, standingDepth, tileToIso, worldToIso } from '../src/renderer/iso/isoMath';
import { groundTile, kitNameFor, kitOf, KIT_NAMES, pieceFor, roleOf, ISO_ART } from '../src/renderer/iso/isoKits';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('the iso grid is a 2:1 diamond grid: a step along x goes down-right, along y down-left', () => {
  assert.equal(ISO_TW, ISO_TH * 2);
  const ox = isoOrigin(10);
  const o = tileToIso(0, 0, ox);
  const ex = tileToIso(1, 0, ox);
  const ey = tileToIso(0, 1, ox);
  assert.deepEqual([ex.x - o.x, ex.y - o.y], [ISO_TW / 2, ISO_TH / 2]);
  assert.deepEqual([ey.x - o.x, ey.y - o.y], [-ISO_TW / 2, ISO_TH / 2]);
  // (the whole land sits in its box: the left corner at x 0, the right at the box's width, the bottom at its height)
  const b = isoBounds(12, 10);
  near(tileToIso(0, 10, isoOrigin(10)).x, 0);
  near(tileToIso(12, 0, isoOrigin(10)).x, b.w);
  near(tileToIso(12, 10, isoOrigin(10)).y, b.h);
});

test('screen to tile undoes tile to screen, and world px go through the cells', () => {
  const ox = isoOrigin(192);
  for (const [x, y] of [
    [0, 0],
    [3.25, 7.5],
    [191.9, 0.1],
    [100, 150],
  ]) {
    const s = tileToIso(x, y, ox);
    const t = isoToTile(s.x, s.y, ox);
    near(t.x, x);
    near(t.y, y);
    const w = isoToWorld(worldToIso(x * CELL, y * CELL, ox).x, worldToIso(x * CELL, y * CELL, ox).y, ox);
    near(w.x, x * CELL);
    near(w.y, y * CELL);
  }
});

test('further back draws first: depth grows towards the viewer', () => {
  assert.ok(pointDepth(2, 2) < pointDepth(3, 2));
  assert.ok(pointDepth(2, 2) < pointDepth(2, 3));
  const house = { x: 10, y: 10, w: 5, h: 3 };
  // behind the house (inside its far edges) is drawn before it; in front of the middle of its long face, after
  assert.ok(standingDepth(12, 9.5, [house]) < footDepth(house));
  assert.ok(standingDepth(15.2, 11, [house]) > footDepth(house));
  assert.ok(standingDepth(12.5, 13.3, [house]) > footDepth(house));
  // (a house far away doesn't lift anyone)
  assert.equal(standingDepth(40, 40.5, [house]), pointDepth(40, 40.5));
});

test('a building stands on its footprint: its base on the front corner, centred across it', () => {
  const ox = isoOrigin(50);
  const f = { x: 4, y: 6, w: 3, h: 2 };
  const at = footBase(f, ox);
  near(at.y, tileToIso(7, 8, ox).y);
  near(at.x, tileToIso(5.5, 7, ox).x);
  // (the cottage, 3 by 2, is as wide as the kits' cottages are drawn: 240 px at the kit's scale, halved)
  assert.equal(footWidth(f), 240 * ISO_ART);
});

test('the cells in view cover the view and stay on the land', () => {
  const ox = isoOrigin(192);
  const mid = tileToIso(96, 96, ox);
  const view = { x: mid.x - 200, y: mid.y - 400, w: 400, h: 800 };
  const r = cellsInView(view, ox, 192, 192);
  for (const [sx, sy] of [
    [view.x, view.y],
    [view.x + view.w, view.y + view.h],
    [view.x + view.w, view.y],
    [view.x, view.y + view.h],
  ]) {
    const t = isoToTile(sx, sy, ox);
    assert.ok(t.x >= r.x0 && t.x <= r.x1 + 1 && t.y >= r.y0 && t.y <= r.y1 + 1);
  }
  const all = cellsInView({ x: -1e5, y: -1e5, w: 2e5, h: 2e5 }, ox, 192, 192);
  assert.deepEqual(all, { x0: 0, y0: 0, x1: 191, y1: 191 });
});

test('every kit has its ground tiles, its pieces on disk and a cottage the same size as every other', () => {
  for (const name of KIT_NAMES) {
    const kit = kitOf(name);
    assert.ok(kit.pieces.has('cottage') && kit.pieces.has('scale_tile'), name);
    for (const t of kit.tiles) assert.ok(t && kit.pieces.has(t), `${name}: ${t}`);
    assert.ok(kit.tileCells >= 1 && kit.tileCells <= 3, `${name}: ${kit.tileCells}`);
    const cottage = kit.pieces.get('cottage')!;
    assert.ok(Math.abs(cottage.w * kit.scale - 240) < 2, `${name}: cottage ${cottage.w * kit.scale}`);
    for (const b of BUILDINGS) {
      const piece = pieceFor(kit, b.id);
      assert.ok(kit.pieces.has(piece), `${name}: ${b.id} -> ${piece}`);
      assert.ok(existsSync(`src/renderer/art/iso/kits/${name}/${piece}.png`), `${name}/${piece}.png`);
    }
  }
});

test('the game buildings map to kit pieces, falling back to the cottage', () => {
  const settlers = kitOf('settlers');
  assert.equal(pieceFor(settlers, 'cottage'), 'cottage');
  assert.equal(pieceFor(settlers, 'tavern'), 'tavern');
  assert.equal(pieceFor(settlers, 'well'), 'well');
  assert.equal(pieceFor(settlers, 'granary'), 'granary');
  assert.equal(pieceFor(settlers, 'stockpile'), 'stockpile');
  assert.equal(pieceFor(settlers, 'longhouse'), 'longhouse');
  assert.equal(pieceFor(settlers, 'smithy'), 'workshop');
  assert.equal(pieceFor(settlers, 'temple'), 'chapel');
  assert.equal(pieceFor(settlers, 'watchtower'), 'watchtower');
  assert.equal(pieceFor(settlers, 'palisade_wall'), 'palisade_run');
  assert.equal(pieceFor(settlers, 'palisade_gate'), 'palisade_gate');
  assert.equal(pieceFor(settlers, 'statue'), 'cottage');
  assert.equal(pieceFor(kitOf('dwarves'), 'tavern'), 'ale_hall');
  assert.equal(pieceFor(kitOf('knights'), 'barracks'), 'barracks');
  assert.deepEqual(roleOf('garden_plot'), { field: true });
  assert.equal(pieceFor(settlers, 'garden_plot'), 'field_tile');
});

test('each people has its kit, and the grounds their tiles', () => {
  assert.equal(kitNameFor('settlers'), 'settlers');
  assert.equal(kitNameFor('vampire'), 'bloodcourt');
  assert.equal(kitNameFor('werewolf'), 'moonpack');
  assert.equal(kitNameFor('alchemists'), 'settlers');
  assert.equal(kitNameFor('knights', 'lich'), 'liches');
  assert.equal(groundTile('grass', false, false).tile, 0);
  assert.equal(groundTile('grass', true, false).tile, 2);
  assert.equal(groundTile('grass', true, true).tile, 3);
  assert.notEqual(groundTile('water', false, false).tint, 0xffffff);
});

test('walls join: runs along either axis, corners where both axes have a neighbour, gates lie along their long side', async () => {
  const { wallShape, gateFlip, wallPieceFor, wallMaskAt } = await import('../src/renderer/iso/isoTown');
  const m = (n: boolean, e: boolean, s: boolean, w: boolean) => ({ n, e, s, w });
  assert.deepEqual(wallShape(m(false, true, false, true)), { part: 'run', flip: false });
  assert.deepEqual(wallShape(m(true, false, true, false)), { part: 'run', flip: true });
  assert.deepEqual(wallShape(m(false, false, false, false)), { part: 'run', flip: false });
  assert.equal(wallShape(m(true, false, false, true)).part, 'corner');
  assert.equal(wallShape(m(true, true, true, true)).part, 'corner');
  assert.equal(gateFlip({ w: 2, h: 1 }), false);
  assert.equal(gateFlip({ w: 1, h: 2 }), true);
  const cells = new Set(['3,4', '4,4']);
  assert.deepEqual(wallMaskAt((x, y) => cells.has(`${x},${y}`), 3, 4), m(false, true, false, false));
  const ids = [...kitOf('settlers').pieces.keys()];
  assert.equal(wallPieceFor(ids, 'run', 'stone_wall'), 'stone_wall_run');
  assert.equal(wallPieceFor(ids, 'run', 'palisade_wall'), 'palisade_run');
  assert.equal(wallPieceFor(ids, 'gate', 'stone_gate'), 'stone_gate');
  assert.equal(wallPieceFor(ids, 'corner', 'stone_wall'), 'palisade_corner');
  // every kit has a run, a corner and a gate for the walls to use
  for (const name of KIT_NAMES) {
    const k = [...kitOf(name).pieces.keys()];
    for (const part of ['run', 'corner', 'gate'] as const) assert.ok(wallPieceFor(k, part, 'palisade_wall'), `${name} ${part}`);
  }
});

test('scenery and props are picked the same every time, from pieces the kit has', async () => {
  const { sceneryFor, propFor, cellHash, BIOME_GROUND } = await import('../src/renderer/iso/isoTown');
  assert.equal(cellHash(5, 9, 1), cellHash(5, 9, 1));
  for (const name of KIT_NAMES) {
    const ids = [...kitOf(name).pieces.keys()];
    for (let i = 0; i < 40; i++) {
      for (const g of ['forest', 'rock', 'hill', 'marsh', 'mountain', 'grass'] as const) {
        const p = sceneryFor(ids, g, 'forest', cellHash(i, 1), cellHash(i, 2));
        if (p) assert.ok(ids.includes(p), `${name} ${p}`);
      }
      const pr = propFor(ids, 'workshop', i, { x: 4, y: 4, w: 3, h: 2 });
      if (pr) assert.ok(ids.includes(pr.piece));
    }
    assert.ok(ids.some((id) => sceneryFor(ids, 'forest', 'forest', 0.5, 0.5) === id), `${name} has a tree`);
    assert.ok(sceneryFor(ids, 'rock', 'forest', 0.1, 0.5), `${name} has rocks`);
  }
  assert.equal(sceneryFor(['oak_tree'], 'grass', 'forest', 0.1, 0.1), null);
  assert.deepEqual(propFor(['barrels'], 'workshop', 7, { x: 1, y: 1, w: 2, h: 2 }), propFor(['barrels'], 'workshop', 7, { x: 1, y: 1, w: 2, h: 2 }));
  // a desert's open ground is not a forest's
  assert.notDeepEqual(groundTile('grass', false, false, 'desert'), groundTile('grass', false, false));
  assert.deepEqual(groundTile('grass', false, false, 'forest'), groundTile('grass', false, false));
  assert.deepEqual(groundTile('water', false, false, 'desert'), groundTile('water', false, false));
  assert.deepEqual(groundTile('grass', true, false, 'desert'), groundTile('grass', true, false));
  assert.ok(Object.keys(BIOME_GROUND).length >= 6);
});

test('traps, turrets and the halls of learning are not drawn as cottages', () => {
  const settlers = kitOf('settlers');
  assert.deepEqual(roleOf('spike_trap'), { role: 'trap' });
  assert.equal(pieceFor(settlers, 'spike_trap'), 'rocks');
  assert.equal(pieceFor(settlers, 'ballista'), 'watchtower');
  assert.equal(pieceFor(settlers, 'library'), 'longhouse');
  assert.equal(pieceFor(kitOf('orcs'), 'wolf_trap'), 'thorn_bush');
  assert.equal(pieceFor(settlers, 'hold_hallway'), 'cottage');
  assert.equal(pieceFor(settlers, 'storytellers_circle'), 'campfire');
  assert.equal(pieceFor(kitOf('knights'), 'stable'), 'stable');
  assert.equal(pieceFor(kitOf('orcs'), 'beast_ranch'), 'warg_pen');
});
