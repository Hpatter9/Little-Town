import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundsBetween } from '../src/renderer/sfx';
import type { Snapshot } from '../src/shared/sim/snapshot';

const person = (o: Record<string, unknown> = {}) => ({ id: 1, x: 100, y: 100, away: null, indoors: false, sinceBlow: 999, sinceBlock: 999, sinceHit: 999, level: 3, ageYears: 30, activity: 'idle', cls: null, ...o });
const snap = (o: Record<string, unknown> = {}) =>
  ({ people: [person()], raid: null, spells: [], coins: 10, prompts: [], raidRecap: null, calendar: { hour: 9 }, gathering: null, disaster: null, workingAt: [], buildings: [], travellers: [], theme: 'town', ...o }) as unknown as Snapshot;
const view = { x: 0, y: 0, w: 400, h: 400 };
const cues = (a: Snapshot, b: Snapshot) => soundsBetween(a, b, view, () => 0.5).map((s) => s.cue);

test('the town is heard: blows, levels, coins, questions, a raid won, the dawn', () => {
  assert.deepEqual(cues(snap(), snap()), []);
  assert.ok(cues(snap(), snap({ people: [person({ sinceBlow: 1 })] })).includes('bash'));
  assert.ok(cues(snap(), snap({ people: [person({ sinceBlow: 1, gear: { weapon: 'iron_sword' } })] })).some((c) => c === 'slash' || c === 'bash'));
  assert.ok(cues(snap(), snap({ people: [person({ sinceBlock: 1 })] })).includes('block'));
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

import { fightSounds, foeCue, stationCue, tacticsSounds, weaponCue, workCue, workSounds } from '../src/renderer/sfx';
import { ITEMS } from '../src/shared/data/items';
import type { ExpeditionView } from '../src/shared/sim/snapshot';

const weaponOf = (fam: string) => ITEMS.find((i) => i.family === fam)!.id;

test('each weapon is heard as itself', () => {
  assert.equal(weaponCue(weaponOf('sw'), 'warrior'), 'slash');
  assert.equal(weaponCue(weaponOf('mc'), 'warrior'), 'bash');
  assert.equal(weaponCue(weaponOf('sp'), 'warrior'), 'stab');
  assert.equal(weaponCue(weaponOf('bw'), 'archer'), 'arrow');
  assert.equal(weaponCue(weaponOf('cb'), 'archer'), 'crossbow');
  assert.equal(weaponCue(weaponOf('pi'), 'archer'), 'gunshot');
  assert.equal(weaponCue(weaponOf('st'), 'mage'), 'zap');
  // bare hands: a caster's bolt, a fighter's fists; a beast's shape bites
  assert.equal(weaponCue(undefined, 'mage'), 'zap');
  assert.equal(weaponCue(undefined, 'warrior'), 'bash');
  assert.equal(weaponCue(weaponOf('sw'), 'shapeshifter', { beast: true }), 'bite');
  // the foes: beasts bite, archers shoot
  assert.equal(foeCue('wolf'), 'bite');
  assert.equal(foeCue('bandit_archer', true), 'arrow');
});

test('the work sounds like itself: a crafter at the loom is no builder', () => {
  assert.equal(stationCue('smithy'), 'anvil');
  assert.equal(stationCue('sawmill'), 'saw');
  assert.equal(stationCue('loom'), 'loom');
  assert.equal(stationCue('bakery'), 'pound');
  assert.equal(stationCue('apothecary'), 'bubble');
  assert.equal(stationCue('nanoforge'), 'machine');
  assert.equal(workCue('build', { kind: 'craft', at: 'loom' }), 'loom');
  assert.equal(workCue('build', { kind: 'build', at: 'cottage' }), 'build');
  assert.equal(workCue('build', { kind: 'pave', at: null }), 'chisel');
  assert.equal(workCue('reap'), 'reap');
  assert.equal(workCue('till'), 'till');
  assert.equal(workCue('chop'), 'chop');
  assert.equal(workCue('idle'), null);
  // a few workers at most, and only those in view
  const crowd = Array.from({ length: 9 }, (_, i) => person({ id: i + 1, activity: 'chop' }));
  assert.equal(workSounds(snap({ people: crowd }), view, () => 0).length, 3);
  assert.equal(workSounds(snap({ people: [person({ activity: 'chop', x: 900 })] }), view, () => 0).length, 0);
});

const fighter = (o: Record<string, unknown>) => ({ side: 'party', ref: 1, kind: 'person', down: false, sinceAction: 99, sinceHit: 99, gear: {}, cls: 'warrior', ranged: false, wolf: false, hitFx: null, pop: null, ...o });
const watch = (battle: unknown[], o: Record<string, unknown> = {}) => ({ id: 7, battle, acts: [], result: null, ...o }) as unknown as ExpeditionView;
const fcues = (a: ExpeditionView, b: ExpeditionView) => fightSounds(a, b, 2, () => 0.5).map((s) => s.cue);

test('a watched fight is heard: the party by their weapons, the foes by what they are', () => {
  const spear = weaponOf('sp');
  const before = watch([fighter({ gear: { weapon: spear } }), fighter({ side: 'enemy', ref: 2, kind: 'wolf' })]);
  assert.deepEqual(fcues(before, before), []);
  assert.ok(fcues(before, watch([fighter({ gear: { weapon: spear }, sinceAction: 0 }), fighter({ side: 'enemy', ref: 2, kind: 'wolf' })])).includes('stab'));
  assert.ok(fcues(before, watch([fighter({ gear: { weapon: spear } }), fighter({ side: 'enemy', ref: 2, kind: 'wolf', sinceAction: 0 })])).includes('bite'));
  assert.ok(fcues(before, watch([fighter({ gear: { weapon: spear } }), fighter({ side: 'enemy', ref: 2, kind: 'wolf', down: true })])).includes('fall'));
  // a spell cast and an ultimate are heard as such, not as the weapon
  const cast = fcues(before, watch([fighter({ gear: { weapon: spear }, sinceAction: 0 }), fighter({ side: 'enemy', ref: 2, kind: 'wolf' })], { acts: [{ age: 0, side: 'party', ref: 1, name: 'Fireball', spell: true, ult: false }] }));
  assert.ok(cast.includes('spell') && !cast.includes('stab'));
  assert.ok(fcues(before, watch(before.battle!, { acts: [{ age: 0, side: 'party', ref: 1, name: 'Heavens Fall', spell: false, ult: true }] })).includes('ult'));
  assert.ok(fcues(before, watch(before.battle!, { result: { outcome: 'won' } })).includes('fanfare'));
});

test('the tactics board is heard: traps, towers, chests, blows landing', () => {
  const board = (fx: unknown[], hits: unknown[] = []) => snap({ tick: 100, tactics: { w: 17, h: 14, units: [], fx, hits } });
  const before = snap({ tick: 95, tactics: { w: 17, h: 14, units: [], fx: [], hits: [] } });
  const t = (b: Snapshot) => tacticsSounds(before, b, () => 0.5).map((s) => s.cue);
  assert.ok(t(board([{ kind: 'trap', from: [3, 4], to: [], age: 1 }])).includes('snap'));
  assert.ok(t(board([{ kind: 'tower', from: [3, 4], to: [], age: 1 }])).includes('ballista'));
  assert.ok(t(board([{ kind: 'chest', from: [3, 4], to: [], age: 1 }])).includes('coin'));
  assert.ok(t(board([], [{ u: 2, v: 2, foe: true, age: 0 }])).includes('thud'));
  // what happened before the last snapshot isn't heard again
  assert.deepEqual(t(board([{ kind: 'trap', from: [3, 4], to: [], age: 9 }])), []);
});
