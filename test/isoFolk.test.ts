import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOLK_DIRS, armedSuffix, facingFromVector, facingToward, frameAt, idHash, lookPath, dressOf, pickLook, play, wantedAnim, type FolkAnim, type FolkState } from '../src/renderer/iso/folkRules';
import { VARIANTS, hslToRgb, recolour, rgbToHsl, variantOf } from '../src/renderer/iso/folkTint';

const st = (o: Partial<FolkState> = {}): FolkState => ({
  id: 1, activity: 'idle', sinceHit: 999, sinceBlow: 999, defending: false, downed: null, hp: 10,
  look: { gender: 'f', outfit: 'leather' }, gear: {}, ...o,
});

test('facing follows the 2:1 diamond: east on the map is down-right on screen', () => {
  assert.equal(facingFromVector(1, 0), 'south-east');
  assert.equal(facingFromVector(0, 1), 'south-west');
  assert.equal(facingFromVector(-1, 0), 'north-west');
  assert.equal(facingFromVector(0, -1), 'north-east');
  assert.equal(facingFromVector(1, 1), 'south'); // straight down the screen
  assert.equal(facingFromVector(-1, -1), 'north');
  assert.equal(facingFromVector(1, -1), 'east');
  assert.equal(facingFromVector(-1, 1), 'west');
  assert.equal(facingFromVector(0, 0), null);
  assert.equal(facingToward(5, 5, 9, 5), 'south-east');
  assert.equal(new Set(FOLK_DIRS).size, 8);
});

test('animation follows what the snapshot says', () => {
  assert.equal(wantedAnim(st(), 0, undefined), 'idle');
  assert.equal(wantedAnim(st({ activity: 'walk' }), 30, undefined), 'walk');
  assert.equal(wantedAnim(st({ activity: 'walk' }), 120, undefined), 'run');
  assert.equal(wantedAnim(st({ activity: 'chop' }), 0, undefined), 'chop');
  assert.equal(wantedAnim(st({ activity: 'build' }), 0, undefined), 'hammer');
  assert.equal(wantedAnim(st({ activity: 'idle', work: { kind: 'craft', at: 'forge' } }), 0, undefined), 'hammer');
  assert.equal(wantedAnim(st({ activity: 'fight' }), 0, 'bw'), 'attack_bow');
  assert.equal(wantedAnim(st({ activity: 'fight' }), 0, 'st'), 'cast_2h');
  assert.equal(wantedAnim(st({ activity: 'fight' }), 0, 'gs'), 'attack_2h');
  assert.equal(wantedAnim(st({ sinceBlow: 2 }), 0, 'sw'), 'attack_1h');
  assert.equal(wantedAnim(st({ sinceHit: 2, activity: 'walk' }), 30, undefined), 'hurt');
  assert.equal(wantedAnim(st({ downed: 'bleeding', sinceHit: 2 }), 0, undefined), 'death');
});

test('a look without an animation falls back sensibly', () => {
  const only = (...have: FolkAnim[]) => (a: FolkAnim) => have.includes(a);
  const r = play('run', only('walk'));
  assert.equal(r.anim, 'walk');
  assert.ok(r.rate > 1);
  assert.equal(play('run', only('walk', 'run')).rate, 1);
  assert.equal(play('chop', only('hammer')).anim, 'hammer');
  assert.equal(play('hammer', only()).anim, 'stand');
  assert.equal(play('chop', only('attack_1h', 'idle')).anim, 'idle'); // (a cast with no tools idles at work, not punching)
  assert.equal(play('death', only('hurt')).anim, 'hurt');
  assert.equal(play('death', only('death')).loop, false);
  assert.equal(play('walk', only('walk')).loop, true);
});

test('armed looks match the work and the weapon', () => {
  assert.equal(armedSuffix({ activity: 'chop' }, undefined, false), 'axe');
  assert.equal(armedSuffix({ activity: 'build' }, undefined, false), 'hammer');
  assert.equal(armedSuffix({ activity: 'idle', work: { kind: 'craft', at: 'forge' } }, undefined, false), 'hammer');
  assert.equal(armedSuffix({ activity: 'fight' }, 'bw', true), 'bow');
  assert.equal(armedSuffix({ activity: 'fight' }, 'gs', true), 'greatsword');
  assert.equal(armedSuffix({ activity: 'idle' }, 'sw', false), null);
});

test('the look is stable, matches sex, and falls back to settlers', () => {
  const looks = { settlers: ['woman_leather', 'woman_wool', 'man_leather', 'man_wool'], dwarves: ['man_mail'] };
  const a = pickLook(st({ id: 5 }), looks);
  assert.deepEqual(a, pickLook(st({ id: 5 }), looks));
  assert.ok(a.look.startsWith('woman_'));
  assert.equal(pickLook(st({ id: 5, look: { gender: 'm', outfit: 'wool' } }), looks).look, 'man_wool');
  assert.equal(pickLook(st({ origin: 'dwarves' as never }), looks).people, 'dwarves');
  assert.equal(pickLook(st({ origin: 'orcs' as never }), looks).people, 'settlers');
  assert.equal(pickLook(st()).look, 'woman_leather');
  assert.equal(lookPath({ people: 'settlers', look: 'woman_leather' }, 'axe'), 'settlers/woman_leather+axe');
  const picks = new Set(Array.from({ length: 50 }, (_, i) => pickLook(st({ id: i, look: { gender: 'f', outfit: 'x' } }), looks).look));
  assert.equal(picks.size, 2);
  assert.notEqual(idHash(1), idHash(2));
});

test('frames loop or play once', () => {
  assert.equal(frameAt(6, 8, 0, true), 0);
  assert.equal(frameAt(6, 8, 0.2, true), 1);
  assert.equal(frameAt(6, 8, 1, true), 2);
  assert.equal(frameAt(6, 8, 5, false), 5);
  assert.equal(frameAt(1, 8, 3, true), 0);
  assert.equal(frameAt(6, 8, -1, true), 0);
});

test('recolouring turns clothes, shades skin, leaves outlines and clear pixels', () => {
  const [lr, lg, lb] = hslToRgb(100, 0.6, 0.4); // green cloth
  const [sr, sg, sb] = hslToRgb(25, 0.45, 0.6); // skin
  const px = new Uint8ClampedArray([lr, lg, lb, 255, sr, sg, sb, 255, 10, 8, 8, 255, 200, 50, 50, 0]);
  const before = Array.from(px);
  recolour(px, 0);
  assert.deepEqual(Array.from(px), before);
  recolour(px, 2);
  assert.notDeepEqual([px[0], px[1], px[2]], before.slice(0, 3));
  const [h] = rgbToHsl(px[4], px[5], px[6]);
  assert.ok(h < 40 || h > 350); // skin keeps its hue
  assert.deepEqual(Array.from(px.slice(8)), before.slice(8)); // outline and clear pixel untouched
  assert.ok(Array.from({ length: 100 }, (_, i) => variantOf(i)).every((v) => v >= 0 && v < VARIANTS));
});

test('dwarves wear dwarf looks, armour picks plate, and the rest wear human ones', () => {
  const looks = { settlers: ['woman_base', 'woman_plate', 'man_base', 'man_plate', 'dwarf_base', 'dwarf_plate'] };
  for (let i = 0; i < 20; i++) {
    assert.ok(pickLook(st({ id: i, origin: 'dwarves' as never }), looks).look.startsWith('dwarf_'));
    assert.ok(!pickLook(st({ id: i }), looks).look.startsWith('dwarf_'));
  }
  assert.equal(pickLook(st({ id: 3, look: { gender: 'm', outfit: 'x' } }), looks, 'plate').look, 'man_plate');
  assert.equal(pickLook(st({ id: 3, origin: 'dwarves' as never }), looks, 'plate').look, 'dwarf_plate');
  assert.equal(dressOf('heavy'), 'plate');
  assert.equal(dressOf(undefined), 'base');
});

test("a people with its own cast wears it, by sex", () => {
  const orc = (id: number, gender: 'f' | 'm') => pickLook({ id, origin: 'orcs', look: { gender, outfit: 'base' } as never });
  assert.equal(orc(3, 'f').people, 'orcs');
  assert.equal(orc(3, 'f').look, 'woman_orc');
  for (let id = 1; id < 20; id++) assert.ok(orc(id, 'm').look.startsWith('man_'));
  assert.equal(pickLook({ id: 3, origin: 'fae', look: { gender: 'f', outfit: 'base' } as never }).people, 'settlers');
});
