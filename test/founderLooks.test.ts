import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FOLK_LOOKS, FOUNDER_LOOKS, armedSuffix, isFounderLook, lookPath, pickLook, type FolkState } from '../src/renderer/iso/folkRules';
import { folkWho, setFolkFounder } from '../src/renderer/iso/folkWho';
import { FEET_UP, HEAD_UP, markAt, markLift } from '../src/renderer/iso/founderMark';
import { worldToIso } from '../src/renderer/iso/isoMath';

const st = (o: Partial<FolkState> = {}): FolkState => ({
  id: 1, activity: 'idle', sinceHit: 999, sinceBlow: 999, defending: false, downed: null, hp: 10,
  look: { gender: 'm', outfit: 'leather' }, gear: {}, ...o,
});
/** A stub of the drawn looks with the founder's art in it. */
const DRAWN: Record<string, readonly string[]> = { ...FOLK_LOOKS, settlers: [...FOLK_LOOKS.settlers, FOUNDER_LOOKS.m, FOUNDER_LOOKS.f] };

test('the founder wears the founder look of their sex, and nobody else does', () => {
  assert.equal(pickLook(st({ founder: true }), DRAWN).look, 'founder_hero');
  assert.equal(pickLook(st({ founder: true, look: { gender: 'f', outfit: 'leather' } }), DRAWN).look, 'founder_heroine');
  for (const dress of [undefined, 'plate', 'leather', 'base'] as const) assert.equal(pickLook(st({ founder: true }), DRAWN, dress).look, 'founder_hero');
  for (let id = 0; id < 300; id++) for (const gender of ['m', 'f'] as const) for (const dress of [undefined, 'plate', 'leather', 'base'] as const) {
    assert.ok(!isFounderLook(pickLook(st({ id, look: { gender, outfit: 'base' } }), DRAWN, dress).look), `townsperson ${id} wears an everyday look`);
  }
});

test('a founder who is a child keeps the child look; a dwarf or another people keeps their own', () => {
  assert.equal(pickLook(st({ founder: true, lifeStage: 'child' }), DRAWN).look, 'child_boy');
  assert.equal(pickLook(st({ founder: true, origin: 'dwarves' }), DRAWN).look.startsWith('dwarf_'), true);
  assert.equal(pickLook(st({ founder: true, origin: 'orcs' }), DRAWN).people, 'orcs');
});

test('a missing founder look falls back to the everyday pick', () => {
  const stub: Record<string, readonly string[]> = { settlers: ['man_base', 'woman_base', FOUNDER_LOOKS.f] };
  assert.equal(pickLook(st({ founder: true }), stub).look, 'man_base');
  assert.equal(pickLook(st({ founder: true, look: { gender: 'f', outfit: 'base' } }), stub).look, 'founder_heroine');
  // (the build's own list, before the art is found: the founder's pick is anyone's)
  assert.deepEqual(pickLook(st({ founder: true })), pickLook(st()));
});

test('an armed founder wears the armed founder look', () => {
  const pick = pickLook(st({ founder: true }), DRAWN);
  assert.equal(lookPath(pick, armedSuffix(st({ activity: 'chop' }), undefined, false)), 'settlers/founder_hero+axe');
  assert.equal(lookPath(pick, armedSuffix(st({ activity: 'build' }), undefined, false)), 'settlers/founder_hero+hammer');
  assert.equal(lookPath(pick, armedSuffix(st(), 'sw', true)), 'settlers/founder_hero+sword');
  const her = pickLook(st({ founder: true, look: { gender: 'f', outfit: 'base' } }), DRAWN);
  assert.equal(lookPath(her, armedSuffix(st(), 'bw', true)), 'settlers/founder_heroine+bow');
});

test("the founder is the snapshot's mainId, their look is never tinted, and an heir takes it up", () => {
  const saved = FOLK_LOOKS.settlers;
  FOLK_LOOKS.settlers = DRAWN.settlers;
  try {
    const look = { gender: 'm' as const, outfit: 'leather', skin: '#c08a60', hairColor: '#3a2a1a' };
    setFolkFounder(7);
    const me = folkWho({ id: 7, look, gear: {} });
    assert.equal(me.path, 'settlers/founder_hero');
    assert.equal(me.tint, null);
    assert.equal(me.variant, folkWho({ id: 7, look: { ...look, skin: '#5a3a2a' }, gear: {} }).variant); // (the same costume, whatever their colours)
    const other = folkWho({ id: 8, look, gear: {} });
    assert.ok(!isFounderLook(other.pick.look));
    assert.notEqual(other.tint, null);
    // (said outright, the flag wins over the id)
    assert.equal(folkWho({ id: 8, look, gear: {}, founder: true }).path, 'settlers/founder_hero');
    assert.ok(!isFounderLook(folkWho({ id: 7, look, gear: {}, founder: false }).pick.look));
    // (the founder dies and their daughter takes over: she is the founder from the next snapshot)
    setFolkFounder(9);
    assert.equal(folkWho({ id: 9, look: { ...look, gender: 'f' }, gear: {} }).path, 'settlers/founder_heroine');
    assert.ok(!isFounderLook(folkWho({ id: 7, look, gear: {} }).pick.look));
    // (a child founder: the child look, in their own colours)
    const kid = folkWho({ id: 9, look, gear: {}, lifeStage: 'child' });
    assert.equal(kid.path, 'settlers/child_boy');
    assert.notEqual(kid.tint, null);
  } finally {
    FOLK_LOOKS.settlers = saved;
    setFolkFounder(null);
  }
});

test("the founder's art, where it's in, has every move and faces every way", () => {
  for (const look of Object.values(FOUNDER_LOOKS)) {
    const dir = join('src', 'renderer', 'art', 'iso', 'folk', 'settlers', look);
    if (!existsSync(join(dir, 'index.json'))) continue; // (not drawn yet: the founder wears an everyday look)
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { directions: string[]; animations: Record<string, { frames: number }> };
    assert.equal(index.directions.length, 8, look);
    assert.ok(existsSync(join(dir, 'rotations.png')), `${look}/rotations.png`);
    for (const anim of ['walk', 'idle', 'death']) {
      assert.ok(index.animations[anim]?.frames > 0, `${look} has ${anim}`);
      assert.ok(existsSync(join(dir, `${anim}.png`)), `${look}/${anim}.png`);
    }
  }
});

test("the founder's marks stand on the figure's own spot and are lifted on the screen, so they stay over the head", () => {
  for (const scale of [0.25, 0.5, 1]) {
    const l = markLift(scale, 0);
    assert.equal(l.ringDy, -FEET_UP * scale, 'the ring at the feet');
    assert.ok(l.crownDy < -HEAD_UP * scale + 1 && l.crownDy > -HEAD_UP * scale - 8, 'the crown just over the head');
    assert.deepEqual(markAt(200, scale, 1.3), { crownY: 200 + markLift(scale, 1.3).crownDy, ringY: 200 + l.ringDy });
  }
  // (why on the screen: a mark lifted on the map before the view carries it onto the diamonds lands down and to the
  // side of the figure, the bug this fixes; the same spot projected, then lifted, is straight over them)
  const [wx, wy, ox] = [400, 300, 1000];
  const feet = worldToIso(wx, wy, ox);
  const liftedOnMap = worldToIso(wx, wy + markLift(0.5, 0).crownDy, ox);
  assert.notEqual(liftedOnMap.x, feet.x, 'lifted on the map: off to the side');
  const onScreen = { x: feet.x, y: feet.y + markLift(0.5, 0).crownDy };
  assert.equal(onScreen.x, feet.x);
  assert.ok(onScreen.y < feet.y);
});
