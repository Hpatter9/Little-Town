import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL } from '../src/shared/sim/land';
import { ISO_TH, ISO_TW, isoOrigin, isoToWorld, tileToIso, worldToIso } from '../src/renderer/iso/isoMath';
import { anyoneNear, doorSpot, gateSpan, HOLD, lightBox, swing, windowSpots, worldMatrix } from '../src/renderer/iso/isoLight';

test('the world matrix lays world px on the diamonds exactly as worldToIso does', () => {
  const ox = isoOrigin(64);
  const m = worldMatrix(ox);
  for (const [x, y] of [[0, 0], [100, 40], [333, 777], [2048, 5]]) {
    const w = worldToIso(x, y, ox);
    assert.ok(Math.abs(m.a * x + m.c * y + m.tx - w.x) < 1e-9);
    assert.ok(Math.abs(m.b * x + m.d * y + m.ty - w.y) < 1e-9);
  }
  assert.equal(m.a * CELL, ISO_TW / 2);
  assert.equal(m.b * CELL, ISO_TH / 2);
});

test('the light box covers every corner of the screen', () => {
  const ox = isoOrigin(192);
  for (const [w, h] of [[393, 852], [852, 393]]) {
    const view = { x: 1500, y: 900, w, h };
    const b = lightBox(view, ox);
    for (const [sx, sy] of [[view.x, view.y], [view.x + w, view.y], [view.x, view.y + h], [view.x + w, view.y + h]]) {
      const p = isoToWorld(sx, sy, ox);
      assert.ok(p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h, `${w}x${h} corner ${sx},${sy}`);
    }
  }
});

test('a door opens when someone is near and closes behind them after a moment', () => {
  const door = doorSpot({ x: 10, y: 10, w: 3, h: 2 });
  assert.deepEqual(door, { x: 11.5, y: 12 });
  assert.ok(anyoneNear([{ x: 11.5 * CELL, y: 12.5 * CELL }], door, 1.1));
  assert.ok(!anyoneNear([{ x: 20 * CELL, y: 20 * CELL }], door, 1.1));
  let s = { open: 0, held: 0 };
  for (let i = 0; i < 10; i++) s = swing(s.open, s.held, true, 0.1);
  assert.equal(s.open, 1);
  // (gone: held open a moment, then it closes)
  s = swing(s.open, s.held, false, HOLD / 2);
  assert.equal(s.open, 1);
  for (let i = 0; i < 40; i++) s = swing(s.open, s.held, false, 0.1);
  assert.equal(s.open, 0);
});

test('a gate runs along its long side; windows sit on the front faces', () => {
  assert.equal(gateSpan({ x: 0, y: 0, w: 3, h: 1 }).alongX, true);
  assert.equal(gateSpan({ x: 0, y: 0, w: 1, h: 3 }).alongX, false);
  const spots = windowSpots({ x: 4, y: 4, w: 3, h: 2 });
  assert.ok(spots.length >= 3);
  for (const p of spots) assert.ok(p.y === 6 || p.x === 7);
  assert.equal(tileToIso(1, 0, 0).x, ISO_TW / 2);
});
