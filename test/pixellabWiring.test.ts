// The places November's PixelLab art drops into (docs/notes/pixellab-plan.md), checked before the art exists: each one
// keeps today's look until its picture is in, and takes the picture up by itself once it is.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creatureWho } from '../src/renderer/panel/sceneFoes';
import { join } from 'node:path';
import { test } from 'node:test';
import { AWAITING_ART, gridPlan, hasOwnPicture, ownPlan, penCorners, stillWaiting } from '../src/renderer/iso/gridRules';
import { FOLK_DIRS, facingFromVector, play, sleepDir, sleepPose, wantedAnim, type FolkAnim, type FolkState } from '../src/renderer/iso/folkRules';
import { FLAME_URL, flameFrame, stripFrames } from '../src/renderer/iso/fireLook';
import { BARROWS_MADE, barrowLoad, barrowPlace, isoBarrowUrl } from '../src/renderer/map/haul';
import { stockHeaps } from '../src/renderer/iso/isoTown';
import { EVENT_SCENES, made, sceneFor } from '../src/renderer/panel/eventScenes';
import { EVENT_BY_ID } from '../src/shared/data/events';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { depthOf } from '../src/shared/sim/buildings';

const st = (o: Partial<FolkState> = {}): FolkState => ({
  id: 1, activity: 'idle', sinceHit: 999, sinceBlow: 999, defending: false, downed: null, hp: 10,
  look: { gender: 'f', outfit: 'leather' }, gear: {}, ...o,
});
// (the kit as it was before November's heaps, whether or not they are in yet)
const SETTLERS: string[] = JSON.parse(readFileSync(join('src', 'renderer', 'art', 'iso', 'kits', 'settlers', 'index.json'), 'utf8'))
  .map((p: { id: string }) => p.id)
  .filter((id: string) => !['grain_sacks', 'lumber_stack', 'ore_pile'].includes(id));

test('a building leaves the waiting list once its own picture is in, and only then', () => {
  assert.deepEqual(stillWaiting(['kiln', 'smithy', 'mine'], (id) => id === 'smithy'), ['kiln', 'mine']);
  // (none of the waiting ones has its own picture yet; the launch site's first one lies the wrong way, so it waits)
  for (const id of AWAITING_ART) {
    const d = BUILDING_BY_ID[id];
    assert.ok(!hasOwnPicture(id, [d.width, depthOf(d)]), `${id} has its picture but still waits`);
  }
  assert.equal(AWAITING_ART.includes('kiln'), !hasOwnPicture('kiln', [2, 2]));
  assert.ok(!hasOwnPicture('no_such_building', [2, 2]));
});

test("the stockade is built of palisade until a picture of its own fits it", () => {
  const foot = { x: 0, y: 0, w: 3, h: 2 };
  const own = ownPlan('settlers', 'stockade', foot);
  assert.equal(own !== null, hasOwnPicture('stockade', [3, 2]));
  assert.deepEqual(gridPlan('settlers', 'stockade', foot), own);
  if (own) assert.equal(own.shrink, 1);
  assert.deepEqual(penCorners({ x: 2, y: 3, w: 3, h: 2 }), [{ x: 2, y: 3 }, { x: 5, y: 3 }, { x: 2, y: 5 }, { x: 5, y: 5 }]);
});

test('asleep out of doors: the look\'s own sleep loop when drawn, else its fall held in a calm facing', () => {
  const both = (a: FolkAnim) => a === 'sleep' || a === 'death';
  const own = sleepPose(7, both)!;
  assert.equal(own.anim, 'sleep');
  assert.equal(own.breathe, false, 'the loop breathes in its own frames');
  assert.ok(FOLK_DIRS.includes(own.dir));
  const held = sleepPose(7, (a) => a === 'death')!;
  assert.deepEqual([held.anim, held.dir, held.breathe], ['death', sleepDir(7), true]);
  assert.equal(sleepPose(7, () => false), null);
});

test('someone hauling a heavy load walks in the push, and a look with no push walks', () => {
  assert.equal(wantedAnim(st({ activity: 'haul' as never }), 30, undefined, true), 'push');
  assert.equal(wantedAnim(st({ activity: 'haul' as never }), 30, undefined, false), 'walk');
  assert.notEqual(wantedAnim(st({ activity: 'haul' as never }), 0, undefined, true), 'push', 'standing still: no push');
  assert.equal(wantedAnim(st({ activity: 'fight', sinceBlow: 0 }), 30, undefined, true) === 'push', false, 'a fight comes first');
  assert.equal(play('push', (a) => a === 'walk').anim, 'walk');
  assert.equal(play('push', (a) => a === 'push').anim, 'push');
});

test('the barrow goes ahead of whoever pushes it, in the view for their facing, mirrored to the left', () => {
  for (const dir of FOLK_DIRS) {
    const p = barrowPlace(dir);
    assert.ok(Math.abs(Math.hypot(p.dx, p.dy) - 1) < 1e-9, dir);
    // (the step ahead turns back into the same facing)
    assert.equal(facingFromVector(p.dx, p.dy), dir);
    assert.equal(p.flip, dir.endsWith('west'), dir);
    assert.equal(p.view, dir.startsWith('north') ? 'ne' : 'se', dir);
  }
  assert.equal(barrowLoad('wood'), 'logs');
  assert.equal(barrowLoad('stone'), 'stone');
  assert.equal(barrowLoad('grain'), 'sacks');
  assert.equal(barrowLoad('milk'), 'crates', 'barrels ride as crates');
  assert.equal(barrowLoad(null), 'crates');
  // (until a view is made, no picture is asked for: the old barrow stands in)
  assert.equal(isoBarrowUrl('se', 'logs'), BARROWS_MADE.has('se_logs') ? 'iso/kits/settlers/barrow_se_logs.png' : null);
});

test("the torches' flame strip: its frames, each torch on its own beat, held still for gentle motion", () => {
  assert.equal(stripFrames(72, 12), 6);
  assert.equal(stripFrames(10, 12), 1);
  const seen = new Set<number>();
  for (let t = 0; t < 2; t += 0.05) {
    const f = flameFrame(t, 1.3, 6);
    assert.ok(f >= 0 && f < 6);
    seen.add(f);
  }
  assert.equal(seen.size, 6, 'it runs through every frame');
  assert.equal(flameFrame(1.7, 1.3, 6, true), 0);
  assert.equal(flameFrame(1.7, 1.3, 1), 0);
  assert.ok(FLAME_URL === null || FLAME_URL.endsWith('flame.png'));
});

test("the stockpile's grain sacks, ore heap and planks are used once the kit has them, the stand-ins until then", () => {
  const foot = { x: 0, y: 0, w: 3, h: 2 };
  const pieces = (ids: string[], store: Record<string, number>) => stockHeaps(ids, store, 60, foot).map((h) => h.piece);
  assert.deepEqual([...new Set(pieces(SETTLERS, { grain: 60 }))], ['hay_bales']);
  assert.deepEqual([...new Set(pieces([...SETTLERS, 'grain_sacks'], { grain: 60 }))], ['grain_sacks']);
  assert.deepEqual([...new Set(pieces([...SETTLERS, 'ore_pile'], { coal: 60 }))], ['ore_pile']);
  assert.deepEqual([...new Set(pieces(SETTLERS, { wood: 60 }))], ['woodpile']);
  assert.deepEqual(pieces([...SETTLERS, 'lumber_stack'], { wood: 60 }).slice(0, 4), ['woodpile', 'lumber_stack', 'woodpile', 'lumber_stack']);
});

test('the event cards draw the PixelLab beasts once their sheets are in, the stand-ins until then; the bear has a scene', () => {
  assert.equal(made('pl_no_such_sheet', 'werewolf_black'), 'werewolf_black');
  // (the stand-in until then is the creature sheets' own brown bear, drawn side-on: panel/sceneFoes.ts)
  assert.ok(EVENT_SCENES.bear.actors.some((a) => a.who === creatureWho({ sheet: 'bear', block: 0, scale: 1.3 })));
  assert.ok(EVENT_SCENES.bear.actors.some((a) => a.who === 'pl_bear' || (typeof a.who === 'string' && a.who.startsWith('cr:bear:'))));
  assert.ok(EVENT_SCENES.dragon.actors.some((a) => a.who === made('pl_dragon', 'hk_demon_lord')));
  assert.equal(EVENT_BY_ID.bear.scene, 'bear');
  assert.equal(sceneFor({ kind: 'event', title: 'A bear', text: 'A bear is sleeping under the stockpile.', eventId: 'bear' }), 'bear');
});
