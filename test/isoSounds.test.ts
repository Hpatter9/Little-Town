import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BURN_FLOOR, burnLevel, DOOR_GAP, doorSound } from '../src/renderer/isoSounds';
import { zoneMix, zoneSources, type ZoneTown } from '../src/renderer/soundZones';
import { workCue } from '../src/renderer/sfx';

const view = { x: 0, y: 0, w: 1000, h: 1000 };

test('a burning building is louder near the middle and the more it has burned; none when nothing burns', () => {
  assert.equal(burnLevel([], view), 0);
  const mid = burnLevel([{ x: 500, y: 500, fire: 0.5 }], view);
  const edge = burnLevel([{ x: 950, y: 500, fire: 0.5 }], view);
  const far = burnLevel([{ x: 5000, y: 5000, fire: 1 }], view);
  assert.ok(mid > edge && edge > 0 && far === 0);
  assert.ok(burnLevel([{ x: 500, y: 500, fire: 1 }], view) > burnLevel([{ x: 500, y: 500, fire: 0 }], view));
  assert.ok(burnLevel([{ x: 500, y: 500, fire: 0 }], view) >= BURN_FLOOR * 0.99 * 0.9);
  assert.ok(burnLevel([{ x: 500, y: 500, fire: 1 }, { x: 520, y: 500, fire: 1 }], view) <= 1);
});

test('doors creak only near the middle, and not twice within the gap', () => {
  assert.ok(doorSound(view, 500, 500, 10));
  assert.equal(doorSound(view, 500, 500, DOOR_GAP - 0.1), null);
  assert.equal(doorSound(view, 5000, 500, 10), null);
  assert.ok(doorSound(view, 700, 500, 10)!.pan > 0 && doorSound(view, 300, 500, 10)!.pan < 0);
});

test('a festival is heard as a crowd and a fiddle at its ring, only when the view is near', () => {
  const t: ZoneTown = { calendar: { hour: 14, daylight: 1 }, buildings: [], workingAt: [], market: null, gathering: { kind: 'festival', x: 500, y: 500 }, people: [], raid: null };
  const src = zoneSources(t);
  assert.ok(src.some((s) => s.kind === 'festival') && src.some((s) => s.kind === 'fiddle'));
  assert.ok(zoneMix(src, view).festival.level > 0);
  assert.equal(zoneMix(src, { x: 9000, y: 9000, w: 1000, h: 1000 }).festival.level, 0);
  assert.ok(!zoneSources({ ...t, gathering: { kind: 'funeral', x: 500, y: 500 } }).some((s) => s.kind === 'festival'));
  assert.equal(zoneSources({ ...t, raid: { phase: 'active' } }).length, 0);
});

test('drawing water at a well splashes', () => {
  assert.equal(workCue('draw'), 'splash');
});
