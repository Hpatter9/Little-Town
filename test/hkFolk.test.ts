import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { CLASS_DEFS, type ClassId } from '../src/shared/data/classes';
import { ITEMS } from '../src/shared/data/items';
import { HAIR_STYLES, SKINS, type Look } from '../src/shared/data/people';
import { hkLayers, hkWhoOfLook, nudgeOf, weaponPiece, type HkWho } from '../src/renderer/art/hkFolk';
import manifest from '../src/renderer/art/himeko.json';

const look = (gender: 'm' | 'f', skin: string, hair: string, hairColor = '#5a3a24', beard = false): Look =>
  ({ gender, skin, hair, hairColor, beard, outfit: 'tunic', shirt: '#888888', pants: '#444444' }) as unknown as Look;
const who = (o: Partial<HkWho> & { look: Look }): HkWho => ({ ...hkWhoOfLook(o.id ?? 1, o.look), ...o });

test('every layer the townsfolk are dressed from is a file beside the page', () => {
  for (const k of manifest.keys) assert.ok(existsSync(`src/renderer/art/himeko/${k}.png`), k);
});

test('everyone is dressed: a body, an outfit with its top, and their hair, whatever their calling, stage, skin or sex', () => {
  for (const cls of Object.keys(CLASS_DEFS) as ClassId[])
    for (const g of ['m', 'f'] as const)
      for (let stage = 0; stage < 5; stage++) {
        const keys = hkLayers(who({ look: look(g, SKINS[stage * 2], 'plain'), cls, stage }), { fighting: false, activity: 'idle' });
        assert.ok(keys.some((k) => k.startsWith('template')), `${cls} ${g}: a body`);
        assert.ok(keys.some((k) => !/^(template|hair|bangs|helm)/.test(k)), `${cls} ${g} stage ${stage}: dressed (${keys.join(' ')})`);
        if (g === 'm') assert.ok(!keys.some((k) => k.endsWith('female') || k.endsWith('femaletop')), `${cls}: a man wears a man's cut (${keys.join(' ')})`);
      }
  for (const skin of SKINS) assert.ok(hkLayers(who({ look: look('f', skin, 'long') }), { fighting: false, activity: 'idle' }).some((k) => k.startsWith('template')), skin);
});

test('every hairstyle and colour shows', () => {
  for (const hair of HAIR_STYLES)
    for (const colour of ['#1e1a18', '#d8b878', '#9a3822', '#e4e0d8'])
      for (const g of ['m', 'f'] as const) {
        if (g === 'm' && hair === 'shortknot') continue; // (a man's close crop: no bangs)
        const keys = hkLayers(who({ look: look(g, SKINS[0], hair, colour) }), { fighting: false, activity: 'idle' });
        assert.ok(keys.some((k) => /^(hair|bangs)/.test(k)), `${g} ${hair} ${colour}: ${keys.join(' ')}`);
      }
});

test('in a fight they hold their weapon, of its family; at work, the tool', () => {
  const families = new Set<string>();
  for (const it of ITEMS) {
    // (a sling, claws or knuckles, a whip: the pack has nothing like them, so bare-handed)
    if (it.slot !== 'weapon' || !it.family || !weaponPiece(it, 'male') || families.has(it.family)) continue;
    families.add(it.family);
    const fighting = hkLayers(who({ look: look('m', SKINS[0], 'plain'), gear: { weapon: it.id } }), { fighting: true, activity: 'fight' });
    const plain = hkLayers(who({ look: look('m', SKINS[0], 'plain') }), { fighting: true, activity: 'fight' });
    assert.ok(fighting.length > plain.length, `${it.id} (${it.family}) is held`);
  }
  const idle = hkLayers(who({ look: look('f', SKINS[3], 'long') }), { fighting: false, activity: 'idle' });
  for (const activity of ['chop', 'build', 'reap', 'mine', 'forage']) {
    const keys = hkLayers(who({ look: look('f', SKINS[3], 'long') }), { fighting: false, activity });
    assert.ok(keys.length > idle.length, `${activity}: a tool in hand`);
  }
  // (seed is sown by hand, and the well's bucket wound with both: nothing in hand)
  for (const activity of ['till', 'draw']) assert.equal(hkLayers(who({ look: look('f', SKINS[3], 'long') }), { fighting: false, activity }).filter(Boolean).length, idle.filter(Boolean).length, activity);
});

test('the raised dead are bone, and a founder is crowned', () => {
  assert.ok(hkLayers(who({ look: look('m', SKINS[0], 'plain'), monster: 'undead' }), { fighting: false, activity: 'idle' }).includes('skeleton'));
  assert.ok(hkLayers(who({ look: look('m', SKINS[0], 'plain'), founder: true, cls: 'knight' }), { fighting: false, activity: 'idle' }).some((k) => k.startsWith('helmcrown')));
});

test('they wear the armour they have on: its weight, in their calling\'s style where it fits; and carry their weapon about town', () => {
  const heavy = ITEMS.find((i) => i.slot === 'body' && i.weight === 'heavy')!;
  const light = ITEMS.find((i) => i.slot === 'body' && i.weight === 'light')!;
  const sword = ITEMS.find((i) => i.slot === 'weapon' && i.family === 'sw')!;
  const L = look('m', SKINS[0], 'plain');
  const outfit = (keys: string[]) => keys.find((k) => /^(plate|paladin|leather|ranger|mage|peasant|adventurer|barbarian|cleric|warlock|druid|illusion|gun|alch)\d/.test(k)) ?? '';
  // a knight with nothing on is in plain clothes, not a paladin's plate
  assert.match(outfit(hkLayers(who({ look: L, cls: 'knight', stage: 2 }), { fighting: false, activity: 'idle' })), /^adventurer/);
  // in heavy armour, the knight's own line
  assert.match(outfit(hkLayers(who({ look: L, cls: 'knight', stage: 2, gear: { body: heavy.id } }), { fighting: false, activity: 'idle' })), /^paladin/);
  // a mage in heavy armour wears plate, not robes; in nothing, their robes
  assert.match(outfit(hkLayers(who({ look: L, cls: 'mage', stage: 2, gear: { body: heavy.id } }), { fighting: false, activity: 'idle' })), /^plate/);
  assert.match(outfit(hkLayers(who({ look: L, cls: 'mage', stage: 2 }), { fighting: false, activity: 'idle' })), /^mage/);
  // a ranger in light armour, their own line
  assert.match(outfit(hkLayers(who({ look: L, cls: 'ranger', stage: 0, gear: { body: light.id } }), { fighting: false, activity: 'idle' })), /^ranger/);
  // a sword is carried walking about, put away for the axe at the woodpile
  const walking = hkLayers(who({ look: L, gear: { weapon: sword.id } }), { fighting: false, activity: 'walk' });
  assert.ok(walking.some((k) => k.startsWith('sword')), walking.join(' '));
  const chopping = hkLayers(who({ look: L, gear: { weapon: sword.id } }), { fighting: false, activity: 'chop' });
  assert.ok(!chopping.some((k) => k.startsWith('sword')) && chopping.some((k) => k.startsWith('axe')), chopping.join(' '));
});

test('the weapon drawn is the weapon carried: every weapon its own kind of piece, or none where the pack has nothing like it', () => {
  const kinds: [RegExp, RegExp][] = [
    [/katana/i, /katana/],
    [/claymore/i, /claymore/],
    [/great axe/i, /^greataxe0[1256]/],
    [/maul|sledge/i, /^greathammer/],
    [/morning star/i, /morningstar/],
    [/war hammer/i, /warhammer|impact/],
    [/quarterstaff/i, /^staff/],
    [/longbow/i, /bow03long/],
    [/crossbow|arbalest/i, /crossbow/],
    [/musket|^rifle/i, /arquebus/],
    [/^spear$|\bpike\b|javelin|trident/i, /^spear01/],
    [/halberd|glaive/i, /naginata/],
  ];
  const sword = /^(sword|greatsword)/;
  for (const it of Object.values(ITEMS)) {
    if (it.slot !== 'weapon' || !it.family) continue;
    for (const sex of ['male', 'female'] as const) {
      const k = weaponPiece(it, sex);
      if (k) assert.ok(manifest.keys.includes(k), `${it.name}: ${k} is a layer`);
      for (const [name, piece] of kinds) if (name.test(it.name)) assert.ok(k && piece.test(k), `${it.name} drawn as ${k}`);
      // (a club, mace or staff is never drawn as a blade, a knuckle or whip never as a weapon it isn't)
      if (/quarterstaff|club|mace|sceptre|crook/i.test(it.name)) assert.ok(!k || !sword.test(k), `${it.name} drawn as ${k}`);
      if (/knuckle|fist|whip|lash|sling/i.test(it.name)) assert.equal(k, null, `${it.name} drawn as ${k}`);
      // (a family's list draws the family: a bow's a bow, a gun's a gun)
      if (['bw', 'lb'].includes(it.family) && k) assert.match(k, /^bow/, `${it.name}`);
      if (['st', 'wd'].includes(it.family) && k) assert.match(k, /^(staff|wand)/, `${it.name}`);
    }
  }
});

test('hair stays on the head in the side lunges: hair and bangs moved with it, beards and hoods left as drawn', () => {
  assert.deepEqual(nudgeOf('hairshortbrownfront')?.[12], [10, 0]);
  assert.deepEqual(nudgeOf('hairlongbrownrear')?.[20], [-10, 0]);
  assert.deepEqual(nudgeOf('bangsbigred')?.[12], [10, 0]);
  assert.deepEqual(nudgeOf('hairlongwhitefront')?.[12], [20, 0]);
  assert.deepEqual(nudgeOf('sideburnsblack')?.[20], [-20, 0]);
  assert.equal(nudgeOf('beardbrown'), undefined);
  assert.equal(nudgeOf('helmhoodredmale'), undefined);
  assert.equal(nudgeOf('templatefemale'), undefined);
});
