import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { EVENT_SCENES } from '../src/renderer/panel/eventScenes';
import { foeSheets, withFoes } from '../src/renderer/panel/sceneFoes';
import { SLOT } from '../src/renderer/panel/eventCast';

const sheetOf = (id: string) => {
  const sp = ENEMIES[id].sprite;
  return 'sheet' in sp ? sp.sheet : undefined;
};

test("a fight's card plays its own foes where a pack sheet draws them", () => {
  const ogre = Object.keys(ENEMIES).find((id) => sheetOf(id) === 'hk_ogre')!;
  assert.ok(ogre, 'an ogre foe');
  const played = withFoes(EVENT_SCENES.battle, [ogre]);
  const creatures = played.actors.filter((a) => typeof a.who === 'string').map((a) => a.who);
  assert.ok(creatures.length > 0 && creatures.every((w) => w === 'hk_ogre'), creatures.join(', '));
  assert.equal(played.actors.filter((a) => typeof a.who === 'number').length, EVENT_SCENES.battle.actors.filter((a) => typeof a.who === 'number').length, 'the townsfolk stay');
});

test('foes who are people are played by strangers in people\'s looks, not orcs', () => {
  const played = withFoes(EVENT_SCENES.battle, ['rival_spear', 'rival_slinger']);
  assert.ok(!played.actors.some((a) => typeof a.who === 'string'), 'no creature left');
  assert.deepEqual(foeSheets(['rival_spear', 'rival_slinger']), [SLOT.stranger, SLOT.stranger2]);
});

test('foes no card sheet draws leave the scene as it is', () => {
  assert.deepEqual(foeSheets(['boar', 'wolf']), []);
  assert.equal(withFoes(EVENT_SCENES.battle, ['boar']), EVENT_SCENES.battle);
  assert.equal(withFoes(EVENT_SCENES.battle, undefined), EVENT_SCENES.battle);
});
