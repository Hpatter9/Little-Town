import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CHILD_SCALE, FOLK_DIRS, FOLK_LOOKS, isChildLook, isFolkChild, armedSuffix, facingFromVector, facingToward, frameAt, idHash, lookPath, dressOf, pickLook, play, wantedAnim, type FolkAnim, type FolkState } from '../src/renderer/iso/folkRules';
import { FIXED_CASTS, VARIANTS, hslToRgb, isSkin, recolour, rgbToHsl, variantOf } from '../src/renderer/iso/folkTint';

const FOLK_ART = join('src', 'renderer', 'art', 'iso', 'folk');

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

test('recolouring is gentle: skin keeps its hue, browns stay brown, cloth turns a little, greys and outlines stay', () => {
  for (let v = 0; v < VARIANTS; v++) {
    for (let h = 0; h < 360; h += 5) for (const s of [0.3, 0.6, 0.9]) for (const l of [0.25, 0.45, 0.7]) {
      const [r, g, b] = hslToRgb(h, s, l);
      const px = new Uint8ClampedArray([r, g, b, 255]);
      recolour(px, v);
      const [h0, s0, l0] = rgbToHsl(r, g, b);
      const [h1, s1, l1] = rgbToHsl(px[0], px[1], px[2]);
      if (s0 < 0.2 || l0 < 0.12) { assert.deepEqual(Array.from(px.slice(0, 3)), [r, g, b]); continue; }
      const turn = Math.abs(((h1 - h0 + 540) % 360) - 180);
      if (isSkin(h0, s0, l0)) assert.ok(turn <= 6 && Math.abs(l1 - l0) <= 0.12, `skin ${h0} ${v}`); // (rounding aside) hue kept, lightness a little
      else if (h0 <= 56) assert.ok(h1 <= 60 || h1 >= 355, `brown ${h0} -> ${h1}`);
      else assert.ok(turn <= 30, `cloth ${h0} -> ${h1}`);
      assert.ok(s1 <= s0 + 0.08, 'never garishly more saturated');
    }
  }
  const px = new Uint8ClampedArray([10, 8, 8, 255, 200, 50, 50, 0]);
  const before = Array.from(px);
  recolour(px, 2);
  assert.deepEqual(Array.from(px), before); // outline and clear pixel untouched
  recolour(px, 0);
  assert.deepEqual(Array.from(px), before);
  assert.ok(Array.from({ length: 100 }, (_, i) => variantOf(i)).every((v) => v >= 0 && v < VARIANTS));
});

test('the peoples with colours of their own are not recoloured', () => {
  for (const people of FIXED_CASTS) for (let i = 0; i < 50; i++) assert.equal(variantOf(i, people), 0);
  assert.ok(Array.from({ length: 50 }, (_, i) => variantOf(i, 'settlers')).some((v) => v !== 0));
});

test('every people has a boy and a girl drawn, with walk, idle and death', () => {
  for (const people of Object.keys(FOLK_LOOKS)) {
    for (const kid of ['child_boy', 'child_girl']) {
      assert.ok(FOLK_LOOKS[people].includes(kid), `${people} lists ${kid}`);
      const dir = join(FOLK_ART, people, kid);
      const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { frame: [number, number]; directions: string[]; animations: Record<string, { frames: number }> };
      assert.deepEqual(index.directions, [...FOLK_DIRS], `${people}/${kid} faces every way`);
      for (const anim of ['walk', 'idle', 'death']) {
        assert.ok(index.animations[anim]?.frames > 0, `${people}/${kid} has ${anim}`);
        assert.ok(existsSync(join(dir, `${anim}.png`)), `${people}/${kid}/${anim}.png`);
      }
      assert.ok(existsSync(join(dir, 'rotations.png')));
    }
  }
});

test('a child wears a child look, and whatever they do they never show a grown look', () => {
  for (const people of Object.keys(FOLK_LOOKS)) for (const origin of [people, ...(people === 'settlers' ? ['dwarves'] : [])]) for (const gender of ['m', 'f']) for (let id = 0; id < 40; id++) {
    for (const dress of [undefined, 'plate', 'leather'] as const) {
      const p = pickLook(st({ id, origin: origin as never, look: { gender, outfit: 'base' } as never, lifeStage: 'child' }), FOLK_LOOKS, dress);
      assert.equal(p.people, people, `a ${origin} child wears ${people}' children`);
      assert.equal(p.look, gender === 'f' ? 'child_girl' : 'child_boy');
    }
  }
  // (only walk, idle and death drawn: every move a child is asked for falls back to one of those, never 'stand' alone
  // where a moving one exists, and run walks a little faster)
  const kid = (a: FolkAnim) => a === 'walk' || a === 'idle' || a === 'death';
  const FALLS: Record<FolkAnim, FolkAnim> = {
    stand: 'stand', walk: 'walk', run: 'walk', idle: 'idle', death: 'death', hurt: 'idle', cast_1h: 'idle', cast_2h: 'idle',
    chop: 'idle', hammer: 'idle', attack_1h: 'idle', attack_bow: 'idle', attack_2h: 'idle',
  };
  for (const [want, got] of Object.entries(FALLS)) assert.equal(play(want as FolkAnim, kid).anim, got, want);
  assert.ok(play('run', kid).rate > 1);
  assert.ok(isFolkChild({ lifeStage: 'child' }) && !isFolkChild({ lifeStage: 'prime', growsUpIn: 0 }) && !isFolkChild({}));
  assert.ok(CHILD_SCALE > 0.5 && CHILD_SCALE <= 1);
});

test('a grown person never wears a child look', () => {
  for (const people of Object.keys(FOLK_LOOKS)) for (const origin of [people, ...(people === 'settlers' ? ['dwarves'] : [])]) for (const gender of ['m', 'f']) for (let id = 0; id < 40; id++) {
    for (const stage of ['young', 'prime', 'elder', 'old', 'deathless', undefined] as const) for (const dress of [undefined, 'plate', 'leather', 'base'] as const) for (const outfit of ['base', 'leather', 'child_boy']) {
      const p = pickLook(st({ id, origin: origin as never, look: { gender, outfit } as never, lifeStage: stage as never }), FOLK_LOOKS, dress);
      assert.ok(!isChildLook(p.look), `${origin} ${gender} ${stage}: ${p.look}`);
    }
  }
  // (even from a folder holding nothing else)
  assert.ok(!isChildLook(pickLook(st({ look: { gender: 'm', outfit: 'base' } }), { settlers: ['child_boy', 'child_girl', 'woman_base'] }).look));
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
  assert.equal(pickLook({ id: 3, origin: 'knights', look: { gender: 'f', outfit: 'base' } as never }).look, 'woman_knight');
  assert.equal(pickLook({ id: 3, origin: 'settlers', look: { gender: 'f', outfit: 'base' } as never }).people, 'settlers');
  // (a lich with only its spell fights by casting it)
  assert.equal(play('attack_1h', (a) => a === 'cast_1h' || a === 'idle').anim, 'cast_1h');
});
