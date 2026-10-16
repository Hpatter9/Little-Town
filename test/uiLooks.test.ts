import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignRamp, alignStep, disabledRamp, gradientMap, hexRgb, lightness, nightDepth, pressedRamp, rampAt, RAMP_STOPS, UI_LOOKS, type Ramp } from '../src/renderer/ui/looks';
import { leadingNumber } from '../src/renderer/ui/motion';

const ALL = Object.keys(UI_LOOKS);
const lum = (h: string) => lightness(...hexRgb(h));

test('every people has its own frame set, ramps dark to light', () => {
  assert.equal(ALL.length, 13);
  for (const id of ['town', 'lich', 'vampire', 'robot', 'merfolk', 'druid', 'werewolf', 'nomads', 'knights', 'alchemists', 'orcs', 'dwarves', 'fae']) assert.ok(UI_LOOKS[id as never], id);
  assert.equal(new Set(Object.values(UI_LOOKS).map((l) => l.material)).size, 13, 'no two of the same stuff');
  for (const [id, l] of Object.entries(UI_LOOKS)) {
    for (const r of [l.face, l.accent, ...(l.rim ? [l.rim] : [])]) {
      assert.equal(r.length, 4, id);
      assert.ok(lum(r[0]) < lum(r[2]) && lum(r[2]) < lum(r[3]) + 1e-9, `${id}: shadow to light`);
    }
  }
  // (the settlers' rim is the carved wood as drawn)
  assert.equal(UI_LOOKS.town.rim, null);
  assert.equal(UI_LOOKS.town.frame, 'wood');
});

test('a gradient map keeps the bevels: the darkest pixel takes the shadow, the lightest the highlight', () => {
  const ramp: Ramp = ['#000000', '#404040', '#a0a0a0', '#ffffff'];
  const px = new Uint8ClampedArray([10, 10, 10, 255, 200, 200, 200, 255, 90, 90, 90, 0]);
  gradientMap(px, ramp);
  assert.deepEqual([...px.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...px.slice(4, 7)], [255, 255, 255]);
  assert.deepEqual([...px.slice(8, 12)], [90, 90, 90, 0], 'a clear pixel is left alone');
  const stops = ramp.map(hexRgb);
  assert.deepEqual(rampAt(stops, RAMP_STOPS[2]).map(Math.round), [160, 160, 160]);
});

test('alignment warms a good town\'s frames and cools an evil one\'s, a little; even towns are untouched', () => {
  const r = UI_LOOKS.town.face;
  assert.deepEqual(alignRamp(r, 0.1), r);
  const good = hexRgb(alignRamp(r, 1)[2]);
  const evil = hexRgb(alignRamp(r, -1)[2]);
  const was = hexRgb(r[2]);
  assert.ok(good[0] - good[2] > was[0] - was[2], 'warmer');
  assert.ok(evil[2] - evil[0] > was[2] - was[0], 'colder');
  assert.equal(alignStep(0.33), 0.4);
  assert.equal(alignStep(-2), -1);
});

test('held buttons are darker, buttons that can\'t be pressed are grey', () => {
  const r = UI_LOOKS.vampire.face;
  assert.ok(lum(pressedRamp(r)[2]) < lum(r[2]));
  const [cr, cg, cb] = hexRgb(disabledRamp(r)[2]);
  const [or, og, ob] = hexRgb(r[2]);
  assert.ok(Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < Math.max(or, og, ob) - Math.min(or, og, ob), 'less colour');
});

test('the menus follow the night: none by day, deepest at night, eased at dusk', () => {
  assert.equal(nightDepth(1), 0);
  assert.equal(nightDepth(0.5), 0);
  assert.equal(nightDepth(0), 1);
  const dusk = nightDepth(0.3);
  assert.ok(dusk > 0 && dusk < 1);
});

test('a changed number ticks from the number it starts with, keeping what\'s round it', () => {
  assert.deepEqual(leadingNumber('2.8 days'), { n: 2.8, pre: '', post: ' days', places: 1 });
  assert.deepEqual(leadingNumber('62/230'), { n: 62, pre: '', post: '/230', places: 0 });
  assert.equal(leadingNumber('Nothing'), null);
});
