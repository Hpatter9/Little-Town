import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { buildingCentre } from '../src/shared/sim/buildings';
import { litInside } from '../src/shared/sim/interiors';
import { snapshot } from '../src/shared/sim/snapshot';
import { calendarOf, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { flicker, flickerSize, phaseOf } from '../src/renderer/map/flicker';
import { BoxGrid, behind, coverBox, fadeAlpha, fadeStep, FADE_SECONDS, isWalker, markWalker, PICKED_ALPHA, SEE_ALPHA } from '../src/renderer/iso/seeThrough';
import { isLit, lightAt, lightsIn, lightTint, placed, PLACED } from '../src/renderer/iso/windowLights';
import { kitOf, SHARED_PIECES } from '../src/renderer/iso/isoKits';
import { freeSpot, plainGame, put } from './helpers';

/** The tick at an hour of the first day (hour = (tick / 600 + 7) mod 24). */
const atHour = (h: number) => ((h - 7 + 24) % 24) * TICKS_PER_HOUR;

test('a flame flickers smoothly: no jump between frames, and never past its strength', () => {
  for (const kind of ['torch', 'campfire', 'lantern', 'brazier', 'candle']) {
    let last = flicker(kind, 0, 1.3);
    let lo = 1;
    for (let t = 1 / 60; t < 30; t += 1 / 60) {
      const v = flicker(kind, t, 1.3);
      assert.ok(v <= 1 && v > 0.7, `${kind} ${v}`);
      // (at 60 frames a second a step is a small share of the waver: no strobing)
      assert.ok(Math.abs(v - last) < 0.02, `${kind} jumps ${Math.abs(v - last)} at ${t}`);
      last = v;
      lo = Math.min(lo, v);
    }
    assert.ok(lo < 0.97, `${kind} hardly wavers`);
  }
});

test('lights flicker out of phase, a flame grows a little as it flares, and "Reduce motion" is gentler', () => {
  const a = phaseOf(10.5, 4.5);
  const b = phaseOf(11.5, 4.5);
  let differ = 0;
  for (let t = 0; t < 10; t += 0.25) if (Math.abs(flicker('torch', t, a) - flicker('torch', t, b)) > 0.01) differ++;
  assert.ok(differ > 20, 'neighbours keep their own time');
  const spread = (gentle: boolean) => {
    let lo = 2, hi = 0;
    for (let t = 0; t < 60; t += 0.05) {
      const v = flicker('torch', t, 2, gentle);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return hi - lo;
  };
  assert.ok(spread(true) < spread(false) * 0.5, 'gentle');
  for (let t = 0; t < 20; t += 0.1) {
    const k = flickerSize('torch', t, 2);
    assert.ok(k > 0.95 && k < 1.05, `size ${k}`);
    assert.ok((k - 1) * (flicker('torch', t, 2) - 0.9) >= -1e-9, 'bigger as it flares');
  }
  assert.equal(flickerSize('electric lamp', 3, 1), 1);
});

test('someone drawn behind a picture and overlapping it fades it; in front, or beside it, they do not', () => {
  const tree = coverBox({ x0: 0, y0: 0, x1: 60, y1: 80 });
  const person = { x0: 20, y0: 40, x1: 40, y1: 70 };
  assert.ok(behind(person, 5, tree, 6));
  assert.ok(!behind(person, 7, tree, 6), 'in front');
  assert.ok(!behind({ x0: 70, y0: 40, x1: 90, y1: 70 }, 5, tree, 6), 'beside');
  // (the fade takes FADE_SECONDS, eased, to SEE_ALPHA; a picked building only to PICKED_ALPHA)
  let f = 0;
  for (let i = 0; i < 6; i++) f = fadeStep(f, true, FADE_SECONDS / 6);
  assert.ok(Math.abs(f - 1) < 1e-9);
  assert.ok(Math.abs(fadeAlpha(f, false) - SEE_ALPHA) < 1e-9);
  assert.ok(Math.abs(fadeAlpha(f, true) - PICKED_ALPHA) < 1e-9);
  assert.ok(fadeAlpha(0.5, false) < 1 && fadeAlpha(0.5, false) > SEE_ALPHA);
  f = fadeStep(f, false, FADE_SECONDS);
  assert.equal(fadeAlpha(f, false), 1);
  const o = {};
  assert.ok(!isWalker(o));
  markWalker(o);
  assert.ok(isWalker(o));
});

test('the grid finds the pictures near a person and only those', () => {
  const g = new BoxGrid();
  g.add(0, { x0: 0, y0: 0, x1: 50, y1: 50 });
  g.add(1, { x0: 500, y0: 500, x1: 700, y1: 650 });
  g.add(2, { x0: 40, y0: 0, x1: 300, y1: 30 });
  const out = new Set<number>();
  assert.deepEqual([...g.near({ x0: 10, y0: 10, x1: 20, y1: 30 }, out)].sort(), [0, 2]);
  assert.deepEqual([...g.near({ x0: 600, y0: 600, x1: 610, y1: 620 }, out)], [1]);
  assert.equal(g.near({ x0: 2000, y0: 2000, x1: 2010, y1: 2010 }, out).size, 0);
});

test('every window placed by hand lies on its piece, for each of the five peoples one can play', () => {
  for (const kit of ['settlers', 'dwarves', 'knights', 'liches', 'bloodcourt']) {
    const k = kitOf(kit);
    assert.ok(placed(kit, 'cottage', false), `${kit} cottage`);
    for (const key of PLACED.filter((p) => p.startsWith(`${kit}/`))) {
      const piece = k.pieces.get(key.split('/')[1]);
      assert.ok(piece, `${key} is a piece of the kit`);
      for (const l of lightsIn(kit, piece.id, false)) assert.ok(l.x > 0 && l.y > 0 && l.x < piece.w && l.y < piece.h && l.w > 0 && l.h > 0, `${key} ${JSON.stringify(l)}`);
    }
  }
  for (const key of PLACED.filter((p) => p.startsWith('buildings/'))) assert.ok(SHARED_PIECES.has(key.split('/')[1]), key);
  // (the necropolis glows ghost-green, a forge orange for any people)
  assert.notEqual(lightTint('liches', 'window'), lightTint('settlers', 'window'));
  assert.equal(lightTint('liches', 'forge'), lightTint('settlers', 'forge'));
});

test('a light lands where it is on the picture, mirrored with it', () => {
  const l = { x: 30, y: 40, w: 10, h: 12, kind: 'window' as const };
  assert.deepEqual(lightAt(l, 100, 80, 0.5, false, 200, 300), { x: 190, y: 280, w: 5, h: 6 });
  assert.deepEqual(lightAt(l, 100, 80, 0.5, true, 200, 300), { x: 210, y: 280, w: 5, h: 6 });
});

test('windows light while someone is in, a tavern of an evening; flames burn all night', () => {
  assert.ok(isLit('flame', false, false, 3));
  assert.ok(isLit('forge', false, false, 3));
  assert.ok(!isLit('window', false, false, 20));
  assert.ok(isLit('window', true, false, 20));
  assert.ok(isLit('window', false, true, 20));
  assert.ok(!isLit('window', false, true, 2));
});

test('the snapshot says which buildings have a light inside after dark: none by day, a candle until bedtime', () => {
  const s = plainGame('lit-inside');
  const spot = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', spot.x, spot.y);
  const p = s.people[0];
  p.bed = home.id;
  const c = buildingCentre(home);
  p.x = c.x;
  p.y = c.y;
  p.task = null;
  p.activity = 'idle';
  s.tick = atHour(12);
  assert.deepEqual(litInside(s), []);
  s.tick = atHour(20);
  assert.equal(calendarOf(s).hour, 20);
  assert.deepEqual(litInside(s), [home.id]);
  assert.deepEqual(snapshot(s).litInside, [home.id]);
  // asleep: the candle burns until bedtime, then the window goes dark
  p.task = { type: 'sleep', building: home.id };
  p.activity = 'sleep';
  s.tick = atHour(21);
  assert.deepEqual(litInside(s), [home.id]);
  s.tick = atHour(2);
  assert.deepEqual(litInside(s), []);
  // out of doors: dark
  p.task = null;
  p.activity = 'walk';
  s.tick = atHour(20);
  assert.deepEqual(litInside(s), []);
});
