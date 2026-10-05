import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { CLASS_DEFS, type ClassId } from '../src/shared/data/classes';
import { ITEMS } from '../src/shared/data/items';
import { HAIR_STYLES, SKINS, type Look } from '../src/shared/data/people';
import { hkLayers, hkWhoOfLook, type HkWho } from '../src/renderer/art/hkFolk';
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
    // (a sling is too small for the pack's figures: bare-handed)
    if (it.slot !== 'weapon' || !it.family || it.family === 'sl' || families.has(it.family)) continue;
    families.add(it.family);
    const fighting = hkLayers(who({ look: look('m', SKINS[0], 'plain'), gear: { weapon: it.id } }), { fighting: true, activity: 'fight' });
    const plain = hkLayers(who({ look: look('m', SKINS[0], 'plain') }), { fighting: true, activity: 'fight' });
    assert.ok(fighting.length > plain.length, `${it.id} (${it.family}) is held`);
  }
  for (const activity of ['chop', 'build', 'reap', 'mine', 'till', 'forage']) {
    const keys = hkLayers(who({ look: look('f', SKINS[3], 'long') }), { fighting: false, activity });
    const idle = hkLayers(who({ look: look('f', SKINS[3], 'long') }), { fighting: false, activity: 'idle' });
    assert.ok(keys.length > idle.length, `${activity}: a tool in hand`);
  }
});

test('the raised dead are bone, and a founder is crowned', () => {
  assert.ok(hkLayers(who({ look: look('m', SKINS[0], 'plain'), monster: 'undead' }), { fighting: false, activity: 'idle' }).includes('skeleton'));
  assert.ok(hkLayers(who({ look: look('m', SKINS[0], 'plain'), founder: true, cls: 'knight' }), { fighting: false, activity: 'idle' }).some((k) => k.startsWith('helmcrown')));
});
