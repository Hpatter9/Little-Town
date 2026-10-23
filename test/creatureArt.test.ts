import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { adoptCreature, creatureView, doDeed, teachCreature } from '../src/shared/sim/creature';
import { CREATURE_ENEMIES, CREATURE_KINDS, creatureTint, creatureUnit } from '../src/shared/data/creature';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { CREATURE_SAGA_DEF } from '../src/shared/data/creatureSaga';
import {
  CREATURE_RUN, GETUP_SHOW, HURT_SHOW, JOY_SHOW, LINEUP_MOVE, creatureMoves, creaturePlay, gentleTint, turnFrame, type CreatureAnim, type CreatureSeen,
} from '../src/renderer/iso/creatureRules';
import { plainGame } from './helpers';

const calm: CreatureSeen = { speed: 0, sinceHurt: Infinity, sincePraised: Infinity, sinceWoke: Infinity };
const view = (o: Partial<Parameters<typeof creatureMoves>[0]> = {}) => ({ doing: 'wander' as const, asleep: false, mood: 'happy' as const, hp: 100, maxHp: 100, dead: null, ...o });

test('the God creature walks, runs, works, eats and fights by what the sim says it is doing', () => {
  assert.deepEqual(creatureMoves(view(), calm), ['idle']);
  assert.deepEqual(creatureMoves(view(), { ...calm, speed: 40 }), ['walk']);
  assert.deepEqual(creatureMoves(view(), { ...calm, speed: CREATURE_RUN }), ['run']);
  assert.deepEqual(creatureMoves(view({ doing: 'hunt' }), { ...calm, speed: 40 }), ['run'], 'it hurries to a hunt');
  assert.deepEqual(creatureMoves(view({ doing: 'haul' }), calm), ['pickup', 'throw']);
  assert.deepEqual(creatureMoves(view({ doing: 'build' }), calm), ['push', 'pull']);
  assert.deepEqual(creatureMoves(view({ doing: 'eat' }), calm), ['eat']);
  assert.deepEqual(creatureMoves(view({ doing: 'eat_crops' }), calm), ['eat']);
  assert.deepEqual(creatureMoves(view({ doing: 'hunt' }), calm), ['punch', 'uppercut']);
  assert.deepEqual(creatureMoves(view({ doing: 'heal' }), calm), ['miracle']);
});

test('the God creature is hurt, sleeps, wakes, mopes, rejoices and dies', () => {
  assert.deepEqual(creatureMoves(view({ doing: 'haul' }), { ...calm, sinceHurt: HURT_SHOW / 2 }), ['hit']);
  assert.deepEqual(creatureMoves(view({ doing: 'sleep', asleep: true }), calm), ['death'], 'asleep it lies down');
  assert.deepEqual(creatureMoves(view(), { ...calm, sinceWoke: GETUP_SHOW / 2 }), ['getup']);
  assert.deepEqual(creatureMoves(view({ mood: 'lonely' }), calm), ['sad']);
  assert.deepEqual(creatureMoves(view({ hp: 10 }), calm), ['sad'], 'badly hurt');
  assert.deepEqual(creatureMoves(view({ doing: 'haul' }), { ...calm, sincePraised: JOY_SHOW / 2 }), ['joy']);
  assert.deepEqual(creatureMoves(view({ dead: 'starved' }), { ...calm, speed: 50 }), ['death']);
});

test('a move its sheet lacks falls back: joy to the miracle, then idle; a missing run is a faster walk', () => {
  const wolf = new Set<CreatureAnim>(['walk', 'idle', 'miracle', 'punch']);
  assert.equal(creaturePlay('joy', (a) => wolf.has(a)).anim, 'miracle');
  assert.equal(creaturePlay('joy', () => false).anim, 'stand');
  const run = creaturePlay('run', (a) => wolf.has(a));
  assert.equal(run.anim, 'walk');
  assert.ok(run.rate > 1);
  assert.equal(creaturePlay('uppercut', (a) => wolf.has(a)).anim, 'punch');
  assert.equal(creaturePlay('death', () => true).loop, false, 'a fall is played once');
  for (const k of CREATURE_KINDS) assert.ok(['miracle', 'punch', 'throw'].includes(LINEUP_MOVE[k]));
});

test('a turn of moves plays each through once, then the next; a one-off holds its last frame', () => {
  const frames = (i: number) => [4, 6][i];
  assert.deepEqual(turnFrame(frames, [4, 6], 2, 0.5, true), { i: 0, frame: 2 });
  assert.deepEqual(turnFrame(frames, [4, 6], 2, 1.5, true), { i: 1, frame: 3 });
  assert.deepEqual(turnFrame(frames, [4, 6], 2, 2.25, true), { i: 0, frame: 1 }, 'and round again');
  assert.deepEqual(turnFrame(() => 7, [8], 1, 30, false), { i: 0, frame: 6 });
  assert.deepEqual(turnFrame(() => 4, [4], 1, 1.25, true), { i: 0, frame: 1 });
});

test('the tint on its own sheet is gentler: a good one stays near its colours, a cruel one goes darker', () => {
  const good = gentleTint(creatureTint(100), 100);
  const evil = gentleTint(creatureTint(-100), -100);
  assert.equal(gentleTint(creatureTint(0), 0), 0xffffff);
  const ch = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  assert.ok(ch(good).every((v) => v > 200), 'good: barely tinted, warm');
  assert.ok(ch(good)[2] < ch(good)[0], 'warm');
  assert.ok(ch(evil)[0] > ch(evil)[1] && ch(evil)[0] < 200, 'cruel: darker and red');
  assert.ok(ch(evil)[1] > (creatureTint(-100) >> 8 & 255), 'but gentler than the stand-in');
});

test('praise is seen: the view tells how long since it was praised', () => {
  const s = plainGame('creature-art');
  const c = adoptCreature(s, 'wolf');
  assert.equal(creatureView(s)!.praisedAgo, undefined);
  doDeed(s, c, 'hunt', new Rng(1));
  s.tick += 30;
  teachCreature(s, true);
  s.tick += 12;
  assert.equal(creatureView(s)!.praisedAgo, 12);
});

test('it is called the God creature in the game text', () => {
  assert.equal(TOPIC_BY_ID.great_beasts.name, 'God Creatures');
  assert.equal(CREATURE_SAGA_DEF.title, 'The God Creature');
  assert.equal(CREATURE_ENEMIES[creatureUnit('wolf')].name, 'God Wolf');
});
