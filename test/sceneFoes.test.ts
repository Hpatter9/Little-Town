import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { EVENT_SCENES } from '../src/renderer/panel/eventScenes';
import { foeSheets, parseCreatureWho, withFoes } from '../src/renderer/panel/sceneFoes';
import { sheetFrame } from '../src/renderer/art/creatureSheets';
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

test('beasts on the creature sheets (wolves, boars, bears, the menagerie) play themselves, side-on from their frames', () => {
  const [boar, wolf] = foeSheets(['boar', 'wolf']) as string[];
  assert.equal(boar, 'cr:boar:0:1');
  assert.ok(wolf === 'pl_wolf' || wolf === 'cr:wolf:1:1', wolf);
  const played = withFoes(EVENT_SCENES.battle, ['boar']);
  const creatures = played.actors.filter((a) => typeof a.who === 'string').map((a) => a.who as string);
  assert.ok(creatures.length > 0 && creatures.every((w) => w === 'cr:boar:0:1'), creatures.join(', '));
  assert.deepEqual(parseCreatureWho('cr:boar:0:1'), { sheet: 'boar', block: 0, scale: 1 });
  assert.equal(parseCreatureWho('hk_ogre'), null);
  // (DawnLike's menagerie: its two-frame pairs, facing left, mirrored to face right)
  const dawn = Object.keys(ENEMIES).find((id) => sheetOf(id) === 'dawn')!;
  const who = foeSheets([dawn])[0] as string;
  assert.match(who, /^cr:dawn:\d+:/);
  const cr = parseCreatureWho(who)!;
  const l = sheetFrame(cr.sheet, cr.block, 'left', 0);
  const r = sheetFrame(cr.sheet, cr.block, 'right', 1);
  assert.ok(!l.flip && r.flip && r.x === l.x + 16 && r.y === l.y, 'its two frames side by side');
  // (a block sheet: a row for each facing, so a wolf walks left and right without mirroring)
  const wl = sheetFrame('wolf', 1, 'left', 0);
  const wr = sheetFrame('wolf', 1, 'right', 0);
  assert.ok(!wl.flip && !wr.flip && wr.y === wl.y + 48 && wl.x === 3 * 48);
});

test('the beast and bear cards show a wolf and a bear, not a werewolf', () => {
  const beast = EVENT_SCENES.beast.actors.find((a) => typeof a.who === 'string')!.who as string;
  const bear = EVENT_SCENES.bear.actors.find((a) => typeof a.who === 'string')!.who as string;
  assert.ok(beast === 'pl_wolf' || parseCreatureWho(beast)?.sheet === 'wolf', beast);
  assert.ok(bear === 'pl_bear' || parseCreatureWho(bear)?.sheet === 'bear', bear);
});

test('foes no card can draw leave the scene as it is', () => {
  const still = Object.keys(ENEMIES).find((id) => 'still' in ENEMIES[id].sprite)!;
  assert.deepEqual(foeSheets([still]), []);
  assert.equal(withFoes(EVENT_SCENES.battle, [still]), EVENT_SCENES.battle);
  assert.equal(withFoes(EVENT_SCENES.battle, undefined), EVENT_SCENES.battle);
});
