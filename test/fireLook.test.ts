// The fires on the iso map crackle and flicker (the owner: "the fires need to look like a crackling fire with a
// flickering light"): the hearth's painted flame sways and flares, embers rise off it, its glow wavers, and it is heard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMBERS, EMBER_RISE, emberAt, flameBox, hearthGlow, tongueAt } from '../src/renderer/iso/fireLook';
import { roleOf } from '../src/renderer/iso/isoKits';
import { HEARTH, hearthLevel } from '../src/renderer/isoSounds';

test("a hearth's flame moves: it stretches, sways and brightens over a second, never jumping", () => {
  const sy = new Set<number>(), skews: number[] = [];
  let last = tongueAt(0, 1.2);
  for (let t = 0; t <= 3; t += 0.05) {
    const l = tongueAt(t, 1.2);
    sy.add(Math.round(l.sy * 100));
    skews.push(l.skew);
    assert.ok(l.sy > 0.8 && l.sy < 1.2 && l.sx > 0.9 && l.sx < 1.1, 'stays a flame');
    assert.ok(Math.abs(l.sy - last.sy) < 0.06, 'smooth, no strobing');
    assert.ok(l.bright >= 0.55 && l.bright <= 1);
    last = l;
  }
  assert.ok(sy.size > 5, 'it flares and sinks');
  assert.ok(Math.max(...skews) - Math.min(...skews) > 0.02, 'it sways');
  // (with "Reduce motion" on it moves less)
  const calm = [...Array(60).keys()].map((i) => tongueAt(i * 0.05, 1.2, true).sy);
  assert.ok(Math.max(...calm) - Math.min(...calm) < Math.max(...sy) / 100 - Math.min(...sy) / 100);
});

test('embers rise off the flame and go out, each on its own beat', () => {
  for (let i = 0; i < EMBERS; i++) {
    let prev = emberAt(i, 0, 0.4);
    let fell = 0;
    for (let t = 0.02; t < 3; t += 0.02) {
      const e = emberAt(i, t, 0.4);
      assert.ok(e.dy <= 0 && e.dy >= -EMBER_RISE, 'above the flame');
      assert.ok(e.alpha >= 0 && e.alpha <= 1);
      if (e.dy > prev.dy + 1) fell++;
      prev = e;
    }
    assert.ok(fell <= 3, 'it only goes back down to start again');
  }
  assert.notDeepEqual(emberAt(0, 1, 0.4), emberAt(1, 1, 0.4));
});

test('a hearth glows a little by day and fully after dark, wavering', () => {
  const day = hearthGlow(1, 0.5, false), night = hearthGlow(1, 0.5, true);
  assert.ok(day > 0 && day < night && night <= 1);
  assert.notEqual(hearthGlow(1, 0.5, true), hearthGlow(1.7, 0.5, true));
});

test("the settlers' campfire is drawn as a hearth, its flame cut from its own picture", () => {
  assert.deepEqual(roleOf('campfire'), { role: 'hearth' });
  const [x0, y0, x1, y1] = flameBox('settlers/campfire', 109, 99);
  assert.ok(x0 < 54 && x1 > 54 && y0 >= 0 && y1 <= 99 && y1 > y0);
  const g = flameBox('orcs/bonfire', 100, 100);
  assert.ok(g[2] > g[0] && g[3] > g[1], 'any other hearth has its flame guessed');
});

test("the town's hearths crackle where they stand, the nearest loudest; a blueprint is silent", () => {
  const view = { x: 0, y: 0, w: 1000, h: 1000 };
  assert.ok(HEARTH.test('campfire') && HEARTH.test('storytellers_circle') && !HEARTH.test('cottage'));
  assert.equal(hearthLevel([], view), 0);
  assert.equal(hearthLevel([{ def: 'campfire', status: 'blueprint', x: 500, y: 500 }], view), 0);
  const mid = hearthLevel([{ def: 'campfire', status: 'done', x: 500, y: 500 }], view);
  const edge = hearthLevel([{ def: 'campfire', status: 'done', x: 950, y: 500 }], view);
  assert.ok(mid > edge && edge >= 0);
  assert.equal(hearthLevel([{ def: 'cottage', status: 'done', x: 500, y: 500 }], view), 0);
});
