import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundsBetween } from '../src/renderer/sfx';
import type { Snapshot } from '../src/shared/sim/snapshot';

const person = (o: Record<string, unknown> = {}) => ({ id: 1, x: 100, y: 100, away: null, indoors: false, sinceBlow: 999, sinceHit: 999, level: 3, ageYears: 30, activity: 'idle', cls: null, ...o });
const snap = (o: Record<string, unknown> = {}) =>
  ({ people: [person()], raid: null, spells: [], coins: 10, prompts: [], raidRecap: null, calendar: { hour: 9 }, gathering: null, disaster: null, workingAt: [], buildings: [], travellers: [], theme: 'town', ...o }) as unknown as Snapshot;
const view = { x: 0, y: 0, w: 400, h: 400 };
const cues = (a: Snapshot, b: Snapshot) => soundsBetween(a, b, view, () => 0.5).map((s) => s.cue);

test('the town is heard: blows, levels, coins, questions, a raid won, the dawn', () => {
  assert.deepEqual(cues(snap(), snap()), []);
  assert.ok(cues(snap(), snap({ people: [person({ sinceBlow: 1 })] })).includes('clash'));
  assert.ok(cues(snap(), snap({ people: [person({ level: 4 })] })).includes('levelup'));
  assert.ok(cues(snap(), snap({ coins: 40 })).includes('coin'));
  assert.ok(cues(snap(), snap({ prompts: [{ id: 5 }] })).includes('chime'));
  assert.ok(cues(snap(), snap({ raidRecap: { tick: 9, outcome: 'victory' } })).includes('fanfare'));
  assert.ok(cues(snap({ calendar: { hour: 5 } }), snap({ calendar: { hour: 6 } })).includes('rooster'));
  // the dead keep no roosters
  assert.ok(!cues(snap({ calendar: { hour: 5 }, theme: 'lich' }), snap({ calendar: { hour: 6 }, theme: 'lich' })).includes('rooster'));
  // out of view, a blow isn't heard
  assert.deepEqual(cues(snap(), snap({ people: [person({ sinceBlow: 1, x: 900 })] })), []);
});

test('a big fight is not a wall of noise', () => {
  const many = Array.from({ length: 30 }, (_, i) => person({ id: i + 1, sinceBlow: 1 }));
  const quiet = Array.from({ length: 30 }, (_, i) => person({ id: i + 1 }));
  assert.ok(soundsBetween(snap({ people: quiet }), snap({ people: many }), view, () => 0.5).length <= 2);
});
