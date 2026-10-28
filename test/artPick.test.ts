import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickArt, solidAt, SOLID_ALPHA, type ArtBox } from '../src/renderer/iso/artPick';

/** An isometric building's picture: a diamond of solid art in a box, empty in the corners. */
const diamond = (id: number, z: number, x0: number, y0: number, w = 40, h = 40, flip = false): ArtBox => ({
  id,
  z,
  x0,
  y0,
  x1: x0 + w,
  y1: y0 + h,
  flip,
  alphaAt: (u, v) => (Math.abs(u - 0.5) + Math.abs(v - 0.5) <= 0.5 ? 255 : 0),
});

test('a tap on solid art picks that building', () => {
  assert.equal(pickArt([diamond(1, 0, 0, 0)], 20, 20), 1);
});

test('a tap through the empty corner of the picture in front picks the building behind', () => {
  // (the one behind at the left, the one in front overlapping it to the right; the finger in the front one's box but
  // on its empty top-left corner, over the art behind)
  const behind = diamond(1, 0, 0, 0);
  const front = diamond(2, 5, 24, 4);
  assert.ok(!solidAt(front, 25, 8), 'the corner is empty');
  assert.ok(solidAt(behind, 25, 8));
  assert.equal(pickArt([behind, front], 25, 8), 1);
  // (on the front one's art it still wins, though the one behind is under it too)
  assert.equal(pickArt([behind, front], 36, 24), 2);
});

test('the front-most of overlapping solid art wins, whatever the list order', () => {
  const a = diamond(1, 0, 0, 0);
  const b = diamond(2, 9, 10, 10);
  assert.equal(pickArt([a, b], 22, 22), 2);
  assert.equal(pickArt([b, a], 22, 22), 2);
});

test('a tap just off the art still finds the nearest building; empty ground finds none', () => {
  const a = diamond(1, 0, 0, 0);
  // (a few px beyond the diamond's left point, inside the box's empty corner)
  assert.equal(pickArt([a], 2, 14), 1);
  // (far from any art)
  assert.equal(pickArt([a], 120, 120), null);
  assert.equal(pickArt([a], 120, 120, 0), null);
});

test('a mirrored picture is read mirrored, and art that cannot be read counts as solid in its box', () => {
  // (art only in the left half, as drawn unmirrored)
  const half: ArtBox = { id: 1, z: 0, x0: 0, y0: 0, x1: 40, y1: 40, flip: false, alphaAt: (u) => (u < 0.5 ? 255 : 0) };
  assert.ok(solidAt(half, 10, 20) && !solidAt(half, 30, 20));
  const flipped = { ...half, flip: true };
  assert.ok(!solidAt(flipped, 10, 20) && solidAt(flipped, 30, 20));
  const unread: ArtBox = { ...half, alphaAt: () => null };
  assert.ok(solidAt(unread, 30, 20));
  // (a faint shadow doesn't count)
  const faint: ArtBox = { ...half, alphaAt: () => SOLID_ALPHA - 1 };
  assert.ok(!solidAt(faint, 10, 20));
});
