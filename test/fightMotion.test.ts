import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corpseAlpha, LUNGE_TICKS, lungeAt, MELEE_LAND, motionOf, moveSprite, TickClock, type MotionIn } from '../src/renderer/fight/fightMotion';

const base: MotionIn = { toward: 1, sinceAction: 999, sinceHit: 999, down: false, ranged: false, hard: 0, friendDown: 999, wide: false, cheering: false, now: 0, ref: 0 };

test('a close blow winds up, lunges to its peak as it lands, and is back in place when it ends', () => {
  assert.ok(lungeAt(1)[0] < 0, 'steps back first');
  assert.ok(lungeAt(MELEE_LAND)[0] > 10, 'the lunge peaks as the blow lands');
  assert.equal(lungeAt(LUNGE_TICKS)[0], 0);
  assert.equal(lungeAt(50)[0], 0);
});

test('the lunge goes toward the foes on either side', () => {
  const right = motionOf({ ...base, toward: 1, sinceAction: MELEE_LAND });
  const left = motionOf({ ...base, toward: -1, sinceAction: MELEE_LAND });
  assert.ok(right.dx > 5 && left.dx < -5);
});

test('a struck fighter flashes, is knocked away from the striker and settles', () => {
  const hit = motionOf({ ...base, toward: -1, sinceHit: 0 });
  assert.equal(hit.flash, 1);
  assert.ok(hit.dx > 0, 'a party member (facing left) is pushed right');
  const later = motionOf({ ...base, toward: -1, sinceHit: 20 });
  assert.equal(later.flash, 0);
  assert.ok(Math.abs(later.dx) < 1.5);
});

test('a heavy blow knocks harder than a light one', () => {
  assert.ok(Math.abs(motionOf({ ...base, sinceHit: 2, hard: 0.5 }).dx) > Math.abs(motionOf({ ...base, sinceHit: 2, hard: 0.05 }).dx));
});

test('the fallen hold a beat, then topple away from the foes and lie', () => {
  assert.equal(motionOf({ ...base, down: true, sinceHit: 0 }).rot, 0);
  const lying = motionOf({ ...base, down: true, sinceHit: 30, toward: 1 });
  assert.ok(Math.abs(lying.rot) > 1.4 && lying.rot < 0, 'a foe (facing right) falls back to the left');
  const flat = motionOf({ ...base, down: true, sinceHit: 30, wide: true });
  assert.ok(flat.sy < 0.6 && flat.rot > -0.2, 'a long, low body flattens instead of toppling');
});

test('a foe leaves a body that dims and stays; a party member does not fade', () => {
  assert.equal(corpseAlpha(0, 'enemy'), 1);
  assert.ok(corpseAlpha(200, 'enemy') > 0.4);
  assert.ok(corpseAlpha(200, 'enemy') < 1);
  assert.equal(corpseAlpha(200, 'party'), 1);
});

test('a friend falling makes the others flinch; a won fight makes them hop', () => {
  assert.notEqual(motionOf({ ...base, friendDown: 1 }).dx, motionOf({ ...base }).dx);
  const hops = [0, 300, 600, 900].map((now) => motionOf({ ...base, cheering: true, now }).dy);
  assert.ok(Math.max(...hops) > 0.5);
});

test('the tick clock gives fractions of a tick between the whole ones, and follows how fast ticks come', () => {
  const c = new TickClock();
  assert.equal(c.fine('a', 0, 0), 0);
  assert.ok(Math.abs(c.fine('a', 0, 50) - 0.5) < 0.01);
  assert.ok(c.fine('a', 0, 5000) < 1, 'never a whole tick over');
  for (let t = 1; t <= 12; t++) c.fine('a', t, 5000 + t * 30); // fast: 30 ms a tick
  assert.ok(c.fine('a', 12, 5000 + 12 * 30 + 15) > 12.4, 'half a tick is soon at the faster rate');
});

test('moving a sprite about its feet keeps the feet where they were when it only squashes', () => {
  const s = { x: 90, y: 40, rotation: 0, scale: { x: 1, y: 1, set(a: number, b = a) { this.x = a; this.y = b; } }, position: { set(a: number, b: number) { s.x = a; s.y = b; } } };
  moveSprite(s, 100, 100, { dx: 0, dy: 0, rot: 0, sx: 1, sy: 0.5, flash: 0, alpha: 1 });
  assert.equal(s.y, 70); // (its top half-way down to the feet)
  assert.equal(s.scale.y, 0.5);
});
