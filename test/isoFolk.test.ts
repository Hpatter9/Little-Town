import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CHILD_SCALE, FOLK_DIRS, FOLK_LOOKS, isChildLook, isFolkChild, armedSuffix, otherTool, facingFromVector, facingToward, frameAt, idHash, lookPath, dressOf, pickLook, play, wantedAnim, type FolkAnim, type FolkState } from '../src/renderer/iso/folkRules';
import { DYES, FIXED_CASTS, FOLK_ROLES, OLD_HAIR, PLAIN_DYES, hexRgb, hslToRgb, recolour, rgbToHsl, shade, sheetMap, tintKey, tintOf, type FolkRole, type FolkRoles } from '../src/renderer/iso/folkTint';
import { folkWho } from '../src/renderer/iso/folkWho';
import { HAIR_COLORS, SKINS } from '../src/shared/data/people';
import { ITEM_BY_ID } from '../src/shared/data/items';

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
  // (a cast with no tools still moves at work: its punch, else its thrown spell; idle only when it has neither)
  assert.equal(play('chop', only('attack_1h', 'idle')).anim, 'attack_1h');
  assert.equal(play('hammer', only('cast_1h', 'idle')).anim, 'cast_1h');
  assert.equal(play('hammer', only('idle')).anim, 'idle');
  assert.equal(play('death', only('hurt')).anim, 'hurt');
  assert.equal(play('death', only('death')).loop, false);
  assert.equal(play('walk', only('walk')).loop, true);
});

test("a look without the tool wanted holds its other tool", () => {
  assert.equal(otherTool('axe'), 'hammer');
  assert.equal(otherTool('hammer'), 'axe');
  assert.equal(otherTool('sword'), null);
  assert.equal(otherTool(null), null);
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

const PEOPLES_TINTED = ['settlers', 'druid', 'nomads', 'alchemists', 'knights'];
const roleFile = (path: string): FolkRoles | null => {
  const f = join(FOLK_ART, path, 'roles.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as FolkRoles) : null;
};
const hueGap = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

test("a person's colours are their own: skin and hair from their look, cloth from their people's dyes, all natural", () => {
  const keys = new Set<string>();
  for (const people of PEOPLES_TINTED) for (let id = 1; id <= 300; id++) {
    const look = { skin: SKINS[idHash(id, 3) % SKINS.length], hairColor: HAIR_COLORS[idHash(id, 5) % HAIR_COLORS.length], outfit: '#8a6a48' };
    for (const lifeStage of ['child', 'young', 'prime', 'elder', 'old'] as const) {
      const t = tintOf({ id, look, lifeStage }, people)!;
      assert.equal(t.skin, look.skin);
      if (lifeStage === 'old') assert.ok(OLD_HAIR.includes(t.hair!), 'the old are grey');
      else if (lifeStage === 'elder') assert.ok(t.hair === look.hairColor || OLD_HAIR.includes(t.hair!));
      else {
        // (their own hair, but never grey while young: a grey rolled at birth turns a colour of youth)
        const [, hs, hl] = rgbToHsl(...hexRgb(t.hair!));
        assert.ok(HAIR_COLORS.includes(t.hair!) && !(hs < 0.12 && hl > 0.4), `young hair ${t.hair}`);
        if (!(rgbToHsl(...hexRgb(look.hairColor))[1] < 0.12 && rgbToHsl(...hexRgb(look.hairColor))[2] > 0.4)) assert.equal(t.hair, look.hairColor);
      }
      assert.ok(DYES[people].includes(t.cloth!));
      assert.ok(PLAIN_DYES.includes(t.cloth2!));
      // (the same person, asked again, gets the same colours)
      assert.deepEqual(tintOf({ id, look, lifeStage }, people), t);
      keys.add(tintKey(t));
    }
  }
  assert.ok(keys.size > 1000, `many combinations (${keys.size})`);
  // (every colour a person can be given is a natural one: skins warm, pale to deep; hair a real hair colour; dyes muted)
  for (const c of SKINS) { const [h, s, l] = rgbToHsl(...hexRgb(c)); assert.ok(h >= 10 && h <= 40 && s <= 0.9 && l >= 0.15 && l <= 0.95, `skin ${c}`); }
  for (const c of [...HAIR_COLORS, ...OLD_HAIR]) { const [h, s] = rgbToHsl(...hexRgb(c)); assert.ok(s < 0.15 || h <= 45, `hair ${c}`); }
  for (const c of [...Object.values(DYES).flat(), ...PLAIN_DYES]) assert.ok(rgbToHsl(...hexRgb(c))[1] <= 0.65, `dye ${c}`);
  // (a stray colour in a save snaps to the nearest natural one)
  assert.ok(SKINS.includes(tintOf({ id: 1, look: { skin: '#00ff00' } })!.skin!));
});

test("recolouring keeps the art's shading and lands each role near its target", () => {
  // (the blend lies between a skin and a hair colour: the skins stand in for it)
  const targets: Record<FolkRole, readonly string[]> = { skin: SKINS, hair: [...HAIR_COLORS, ...OLD_HAIR], cloth: Object.values(DYES).flat(), cloth2: PLAIN_DYES, blend: SKINS };
  let checked = 0;
  for (const people of PEOPLES_TINTED) for (const look of FOLK_LOOKS[people]) {
    const roles = roleFile(`${people}/${look}`);
    if (!roles) continue;
    for (const role of FOLK_ROLES) {
      const ref: [number, number, number] | undefined = roles.ref[role];
      const hexes: string[] = roles.sheets.rotations?.[role] ?? [];
      if (!ref) continue;
      for (const target of targets[role]) {
        const [th, ts, tl] = rgbToHsl(...hexRgb(target));
        for (const hx of hexes) {
          const n = parseInt(hx, 16);
          const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
          const [h, s, l] = rgbToHsl(...shade(r, g, b, ref, target));
          assert.ok(l >= 0.02 && l <= 0.96, `${people}/${look} ${role} lightness`);
          if (ts > 0.15 && s > 0.12 && l > 0.08 && l < 0.92) assert.ok(hueGap(h, th) <= 50, `${people}/${look} ${role} ${hx} -> ${target}: hue ${h} vs ${th}`);
          checked++;
        }
        // (the look's own average colour for the role lands on the target itself)
        const [rh, rs, rl] = rgbToHsl(...shade(...hslToRgb(...ref), ref, target));
        assert.ok(Math.abs(rl - tl) < 0.02 && (ts < 0.1 || hueGap(rh, th) < 4) && Math.abs(rs - ts) < 0.05, `${people}/${look} ${role} ${target}: the average lands on it`);
      }
      // (lighter in the art stays lighter after: the ramp keeps its order)
      const ls: [number, number][] = hexes.map((hx): [number, number] => { const n = parseInt(hx, 16); return [rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255)[2], rgbToHsl(...shade((n >> 16) & 255, (n >> 8) & 255, n & 255, ref, targets[role][0]))[2]]; });
      for (const [a0, a1] of ls) for (const [b0, b1] of ls) if (a0 < b0 - 0.02) assert.ok(a1 <= b1 + 0.01, `${people}/${look} ${role} order`);
    }
  }
  assert.ok(checked > 10000);
  // (a clear pixel and a colour without a role stay as drawn)
  const px = new Uint8ClampedArray([10, 8, 8, 255, 200, 50, 50, 0]);
  recolour(px, new Map([[(200 << 16) | (50 << 8) | 50, 0]]));
  assert.deepEqual(Array.from(px), [10, 8, 8, 255, 200, 50, 50, 0]);
});

test('the tinted looks are labelled: skin and hair (or a hood) for every look, and the same labels on its armed copies', () => {
  for (const people of PEOPLES_TINTED) for (const look of FOLK_LOOKS[people]) {
    const roles = roleFile(`${people}/${look}`);
    assert.ok(roles, `${people}/${look} has roles.json`);
    const index = JSON.parse(readFileSync(join(FOLK_ART, people, look, 'index.json'), 'utf8')) as { animations: Record<string, unknown> };
    for (const anim of ['rotations', ...Object.keys(index.animations)]) assert.ok(roles.sheets[anim], `${people}/${look} labels ${anim}`);
    for (const suffix of ['axe', 'bow', 'greatsword', 'hammer', 'staff', 'sword']) {
      const armed = roleFile(`${people}/${look}+${suffix}`);
      if (!armed) continue;
      // (the same reference, so the same tint makes the same colours, armed or bare)
      assert.deepEqual(armed.ref, roles.ref, `${people}/${look}+${suffix}`);
      for (const role of Object.keys(roles.ref) as FolkRole[]) {
        assert.ok(Object.values(armed.sheets).some((sh) => (sh[role]?.length ?? 0) > 0), `${people}/${look}+${suffix} paints ${role}`);
      }
    }
  }
  // (and the settlers' everyday looks have their hair, skin and a cloth to dye)
  for (const look of ['man_base', 'woman_base', 'man_leather', 'woman_leather', 'child_boy', 'child_girl']) {
    const ref = roleFile(`settlers/${look}`)!.ref;
    assert.ok(ref.skin && ref.hair && ref.cloth, look);
  }
});

test('the peoples with colours of their own are not recoloured', () => {
  for (const people of FIXED_CASTS) {
    for (let i = 0; i < 50; i++) assert.equal(tintOf({ id: i, look: { skin: SKINS[0], hairColor: HAIR_COLORS[0] } }, people), null);
    for (const look of FOLK_LOOKS[people]) assert.equal(roleFile(`${people}/${look}`), null, `${people}/${look} has no labels`);
  }
  assert.equal(tintKey(null), '0');
  assert.equal(sheetMap(null, 'walk', { hair: '#000000' }).size, 0);
});

test("picking up a tool or armour never changes a person's colours", () => {
  const heavy = Object.values(ITEM_BY_ID).find((i) => i.slot === 'body' && i.weight === 'heavy')!.id;
  const axe = Object.values(ITEM_BY_ID).find((i) => i.slot === 'weapon' && i.family === 'ax')!.id;
  for (let id = 1; id <= 60; id++) {
    const look = { gender: (id % 2 ? 'm' : 'f') as 'm' | 'f', outfit: '#8a6a48', skin: SKINS[id % SKINS.length], hairColor: HAIR_COLORS[id % HAIR_COLORS.length] };
    const bare = folkWho({ id, look, gear: {} });
    const armed = folkWho({ id, look, gear: { weapon: axe, body: heavy } });
    assert.deepEqual(armed.tint, bare.tint);
    assert.equal(armed.variant, bare.variant);
  }
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
