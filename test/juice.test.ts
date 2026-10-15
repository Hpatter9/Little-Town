import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bannerMotion, comboText, fadeTrauma, ghostStep, GHOST_HOLD, killCallout, popScale, shakeOf, traumaFor } from '../src/renderer/battle/juiceRules';

test('the raid screen juice: heavier blows and kills shake harder, and the shake fades', () => {
  assert.ok(traumaFor(0.5) > traumaFor(0.05));
  assert.ok(traumaFor(0.1, true) > traumaFor(0.1));
  assert.ok(traumaFor(0.1, false, true) > traumaFor(0.1, true));
  assert.ok(traumaFor(5, true, true) <= 1);
  assert.ok(shakeOf(1) > shakeOf(0.5) * 2, 'the shake goes as trauma squared');
  assert.equal(fadeTrauma(0.2, 1), 0);
});

test('kills in a row and blows in a combo have their callouts', () => {
  assert.equal(killCallout(1), null);
  assert.equal(killCallout(2), 'DOUBLE KILL!');
  assert.equal(killCallout(3), 'TRIPLE KILL!');
  assert.ok(killCallout(9));
  assert.equal(comboText(2), null);
  assert.match(comboText(5)!, /5 HIT COMBO/);
});

test("banners slide in, hold and slide out; numbers pop and settle; a bar's ghost holds, then drains", () => {
  assert.ok(bannerMotion(0, 2).x > 0.9 && bannerMotion(0, 2).alpha === 0);
  assert.equal(bannerMotion(1, 2).x, 0);
  assert.ok(bannerMotion(1.99, 2).x < -0.5);
  assert.ok(popScale(0) > 1.5 && popScale(1) === 1);
  assert.equal(ghostStep(0.8, 0.5, 0, 0.1), 0.8, 'held');
  const g = ghostStep(0.8, 0.5, GHOST_HOLD + 0.1, 0.1);
  assert.ok(g < 0.8 && g >= 0.5, 'draining');
  assert.equal(ghostStep(0.6, 0.7, 1, 0.1), 0.7, 'healing: no ghost');
});
