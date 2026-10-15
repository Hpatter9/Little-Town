import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUZZ, BUZZ_GAP_MS, buzzesBetween, buzzOfCue, collapsesBetween, mayBuzz, vibrateOn, type BuzzTown } from '../src/renderer/vibration';

const hut = { id: 7, def: 'lean_to', status: 'done', tile: 10, row: 10 };
const town = (over: Partial<BuzzTown> = {}): BuzzTown => ({ buildings: [hut], disaster: null, raid: null, bossShake: -1, ...over });

test('each big moment has its own short, soft pattern', () => {
  for (const [k, p] of Object.entries(BUZZ)) {
    assert.ok(p.length % 2 === 1, `${k} ends on a buzz`);
    assert.ok(p.every((ms) => ms > 0 && ms <= 400), `${k} pulses are short`);
    assert.ok(p.reduce((a, b) => a + b, 0) < 1000, `${k} is under a second`);
  }
  assert.equal(new Set(Object.values(BUZZ).map((p) => p.join())).size, Object.keys(BUZZ).length, 'no two alike');
  assert.equal(buzzOfCue('horn'), 'horn');
  assert.equal(buzzOfCue('thunder'), 'thunder');
  assert.equal(buzzOfCue('rumble'), 'quake');
  assert.equal(buzzOfCue('roar'), 'roar');
  assert.equal(buzzOfCue('collapse'), 'collapse');
  assert.equal(buzzOfCue('chop'), null);
});

test('the setting is on unless turned off, and buzzes keep their distance', () => {
  assert.equal(vibrateOn(null), true);
  assert.equal(vibrateOn('1'), true);
  assert.equal(vibrateOn('0'), false);
  assert.equal(mayBuzz(-Infinity, 0), true);
  assert.equal(mayBuzz(1000, 1000 + BUZZ_GAP_MS - 1), false);
  assert.equal(mayBuzz(1000, 1000 + BUZZ_GAP_MS), true);
});

test('the horn as a raid comes on, the ground as a quake begins and shakes again', () => {
  assert.deepEqual(buzzesBetween(town(), town({ raid: { phase: 'active' } })), ['horn']);
  assert.deepEqual(buzzesBetween(town({ raid: { phase: 'active' } }), town({ raid: { phase: 'active' } })), []);
  assert.deepEqual(buzzesBetween(town(), town({ raid: { phase: 'warning' } })), [], 'not at the warning');
  assert.deepEqual(buzzesBetween(town(), town({ disaster: { kind: 'quake' } })), ['quake']);
  assert.deepEqual(buzzesBetween(town({ disaster: { kind: 'quake' }, bossShake: 5 }), town({ disaster: { kind: 'quake' }, bossShake: 5 })), []);
  assert.deepEqual(buzzesBetween(town({ disaster: { kind: 'quake' }, bossShake: 5 }), town({ disaster: { kind: 'quake' }, bossShake: 90 })), ['quake'], 'an aftershock');
  assert.deepEqual(buzzesBetween(town(), town({ disaster: { kind: 'flood' } })), []);
  assert.deepEqual(buzzesBetween(null, town({ raid: { phase: 'active' } })), []);
});

test('a building that comes down buzzes; one taken down in a quiet time, or upgraded, does not', () => {
  const gone = town({ buildings: [] });
  assert.equal(collapsesBetween(town(), gone).length, 0, 'pulled down to make room, or a tent struck');
  assert.equal(collapsesBetween(town({ buildings: [{ ...hut, fire: 0.8 }] }), gone).length, 1, 'burned down');
  assert.equal(collapsesBetween(town({ disaster: { kind: 'tornado' } }), gone).length, 1, 'thrown down by a tornado');
  assert.equal(collapsesBetween(town(), town({ buildings: [], disaster: { kind: 'quake' } })).length, 1, 'shaken down');
  assert.equal(collapsesBetween(town({ raid: { phase: 'active' } }), gone).length, 1, 'broken in a raid');
  assert.equal(collapsesBetween(town({ disaster: { kind: 'quake' } }), town({ disaster: { kind: 'quake' }, buildings: [{ ...hut, def: 'longhouse' }] })).length, 0, 'upgraded: the same id');
  assert.equal(collapsesBetween(town({ disaster: { kind: 'quake' }, buildings: [{ ...hut, status: 'blueprint' }] }), gone).length, 0, 'a site, not a building');
  assert.deepEqual(buzzesBetween(town({ buildings: [{ ...hut, fire: 0.9 }] }), gone), ['collapse']);
});
