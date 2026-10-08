import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { CUTSCENES, fillLine, sceneSeconds, STAGE_SCENES, STAGE_W, wakeSceneOf } from '../src/shared/data/cutscenes';
import { CALAMITY_KINDS } from '../src/shared/data/calamity';
import { ENEMIES } from '../src/shared/data/enemies';
import manifest from '../src/renderer/art/backdrops.json';
import { castFor, endScene, queueScene, sceneView, SCENE_WAIT_HOURS, scenesHourly, watchScene } from '../src/shared/sim/cutscenes';
import { wakeCalamity } from '../src/shared/sim/calamity';
import { actorsAt, cameraAt, next, shotLength, start, tick } from '../src/renderer/cutscene/sceneClock';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import type { GameState, Person } from '../src/shared/sim/state';
import { plainGame } from './helpers';

/** The words queueScene fills (and those the scenes' own triggers add). */
const VARS = new Set(['town', 'founder', 'hero', 'wit', 'worrier', 'elder', 'calamity', 'heart', 'cult', 'nest', 'folk', 'dragon', 'saga', 'deepest']);

test('every scene is well made: its speakers, actors, backdrops and words are all real, and it plays a fair while', () => {
  const ids = Object.keys(CUTSCENES);
  assert.ok(ids.length >= 16, `${ids.length} scenes`);
  for (const k of CALAMITY_KINDS) assert.ok(CUTSCENES[wakeSceneOf(k)], k);
  for (const id of Object.values(STAGE_SCENES)) assert.ok(CUTSCENES[id], id);
  for (const c of Object.values(CUTSCENES)) {
    const cast = new Set(Object.keys(c.cast));
    assert.ok(c.shots.length >= 4, `${c.id}: shots`);
    assert.ok(c.shots[0].look, `${c.id}: the first shot sets the scene`);
    for (const m of Object.values(c.cast)) if (m.role.startsWith('foe:') && !m.role.includes('{')) assert.ok(ENEMIES[m.role.slice(4)], `${c.id}: ${m.role}`);
    for (const s of c.shots) {
      if (s.look && s.look !== 'town') assert.ok(s.look in manifest, `${c.id}: ${s.look}`);
      for (const cam of [s.cam, s.to]) for (const on of cam?.on === undefined ? [] : [cam.on].flat()) assert.ok(cast.has(on), `${c.id}: camera on ${on}`);
      for (const a of s.acts ?? []) assert.ok(cast.has(a.who), `${c.id}: ${a.who} acts`);
      if (s.burst) assert.ok(cast.has(s.burst.on), `${c.id}: burst on ${s.burst.on}`);
      for (const l of s.lines ?? []) {
        assert.ok(l.who === 'narrator' || l.who === 'everyone' || cast.has(l.who), `${c.id}: ${l.who} speaks`);
        for (const m of l.text.matchAll(/\{(\w+)\}/g)) assert.ok(VARS.has(m[1].toLowerCase()), `${c.id}: {${m[1]}}`);
      }
    }
    const len = sceneSeconds(c);
    assert.ok(len > 15 && len < 150, `${c.id}: ${len.toFixed(0)} s`);
  }
});

test('lines are filled with the town\'s names, as written, capitalised or shouted', () => {
  const v = { hero: 'maud', town: 'the town' };
  assert.equal(fillLine('{Hero} says hi', v), 'Maud says hi');
  assert.equal(fillLine('FOR {TOWN}!', v), 'FOR THE TOWN!');
  assert.equal(fillLine('{hero} and {nobody}', v), 'maud and {nobody}');
});

const grow = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s.people.push({ ...structuredClone(s.people[0]), id: s.nextId++, name: `P${i}`, nature: (['jolly', 'gloomy', 'bold'] as const)[i % 3] } as Person);
};

test('a scene is cast from the town, offered, and played with the town held still; watched, its telling is dropped', () => {
  const s = plainGame('scenes');
  grow(s, 4);
  const town = castFor(s);
  assert.equal(town.founder?.id, s.mainId);
  assert.ok(town.hero && town.wit && town.worrier);
  assert.equal(new Set([town.founder!.id, town.hero!.id, town.wit!.id, town.worrier!.id]).size, 4, 'four different people');
  const fallback = { id: s.nextId++, kind: 'debrief', expedition: null, title: 'T', text: 't', options: ['ok'], defaultOption: 0, expiresTick: s.tick + 8 * TICKS_PER_HOUR } as never;
  const r = queueScene(s, 'calamity_spreading', { fallback })!;
  assert.ok(r && r.cast.founder.name === town.founder!.name && r.vars.hero === town.hero!.name);
  assert.equal(s.prompts.length, 0, 'the telling waits on the scene');
  assert.equal(sceneView(s)?.playing, false);
  assert.ok(watchScene(s, r.key));
  assert.ok(s.paused && sceneView(s)?.playing);
  endScene(s, r.key, true);
  assert.ok(!s.paused, 'the town goes on');
  assert.equal(s.prompts.length, 0, 'watched: no telling');
  assert.equal(s.scenesSeen?.length, 1, 'kept to watch again');
  assert.ok(watchScene(s, r.key), 'and watched again');
  endScene(s, r.key, true);
});

test('a scene skipped, or left too long, gives its telling instead', () => {
  const s = plainGame('scene-skip');
  const mk = () => ({ id: s.nextId++, kind: 'debrief', expedition: null, title: 'T', text: 't', options: ['ok'], defaultOption: 0, expiresTick: s.tick + 8 * TICKS_PER_HOUR }) as never;
  const a = queueScene(s, 'founding', { fallback: mk() })!;
  endScene(s, a.key, false);
  assert.equal(s.prompts.length, 1);
  queueScene(s, 'founding', { fallback: mk() });
  s.tick = Math.ceil((s.tick + SCENE_WAIT_HOURS * TICKS_PER_HOUR) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  scenesHourly(s);
  assert.equal(s.prompts.length, 2);
  assert.ok(s.prompts[1].expiresTick! > s.tick, 'with its time to answer');
  assert.equal(s.scenes?.length, 0);
});

test('the Calamity waking is played out, its telling waiting on it', () => {
  const s = plainGame('wake-scene');
  wakeCalamity(s, 'rot');
  assert.equal(s.scenes?.[0]?.id, 'calamity_wake_rot');
  assert.equal(s.scenes?.[0]?.cast.avatar?.foe, 'rot_mother');
  assert.ok(!s.prompts.some((p) => p.kind === 'debrief'));
});

test('the clock plays a scene through: shots in turn, actors walking on, the camera following', () => {
  const c = CUTSCENES.calamity_wake_tyrant;
  let cur = start();
  let seen = new Set<number>();
  for (let i = 0; i < 10000; i++) {
    seen.add(cur.shot);
    const n = tick(cur, c, 0.1);
    if (!n) break;
    cur = n;
  }
  assert.equal(seen.size, c.shots.length, 'every shot played');
  // (the avatar comes on in the second shot, from off the right)
  const s1 = { shot: 1, beat: 0, t: 0, shotT: 0 };
  assert.ok(actorsAt(c, s1).avatar.x > STAGE_W, 'off stage as it starts');
  const s1end = { ...s1, shotT: shotLength(c.shots[1]) };
  assert.equal(Math.round(actorsAt(c, s1end).avatar.x), 240);
  assert.equal(actorsAt(c, s1end).avatar.facing, 'left');
  // (a close-up follows its actor)
  const cam = cameraAt(c, { shot: 2, beat: 0, t: 0, shotT: 0 });
  assert.equal(Math.round(cam.x), 240);
  assert.ok(cam.zoom > 2);
  // (a tap moves to the next line; the last one ends it)
  seen = new Set();
  let t: ReturnType<typeof next> = start();
  let taps = 0;
  while (t && taps < 200) {
    t = next(t, c);
    taps++;
  }
  assert.ok(!t && taps > c.shots.length);
});
