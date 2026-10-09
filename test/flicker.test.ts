import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flicker, flickers, phaseOf } from '../src/renderer/map/flicker';

test('flames flicker, electric light holds steady', () => {
  assert.ok(flickers('torch') && flickers('campfire') && flickers('lantern'));
  assert.ok(!flickers('electric lamp') && !flickers('light panel'));
  for (let t = 0; t < 20; t += 0.37) {
    assert.equal(flicker('electric lamp', t, 1), 1);
    const v = flicker('torch', t, 1);
    assert.ok(v <= 1 && v >= 0.8 - 1e-9, `torch ${v}`);
  }
});

test('a torch wavers more than a gas lamp, and neighbours keep their own time', () => {
  const spread = (kind: string, ph: number) => {
    let lo = 1, hi = 0;
    for (let t = 0; t < 30; t += 0.05) {
      const v = flicker(kind, t, ph);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return hi - lo;
  };
  assert.ok(spread('torch', 0.4) > spread('gas lamp', 0.4) * 2);
  assert.notEqual(phaseOf(10.5, 4.5), phaseOf(11.5, 4.5));
  assert.notEqual(flicker('torch', 3, phaseOf(10.5, 4.5)), flicker('torch', 3, phaseOf(11.5, 4.5)));
});
