import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { ABILITIES } from '../src/shared/data/abilities';
import { actArrow, actCue, actElement, actFx, familyOf, MELEE_FX, meleeLook, PROC_CUE, PX_ELEMENT, PX_FAMILIES, STATUS_CUE } from '../src/shared/data/actFx';
import { KIT_ITEMS } from '../src/shared/data/kitItems';
import { SPELLS } from '../src/shared/data/spells';
import { LOOKS, SHEET_FILES } from '../src/renderer/town/spellLooks';
import index from '../src/renderer/art/effects/pixelfx.json';

const strips = (index as { strips: Record<string, unknown> }).strips;
const DIR = 'src/renderer/art/effects';
/** Whether an effect id has its picture: a strip of the atlas, or an older sheet whose file is there. */
function drawable(fx: string): boolean {
  if (fx.startsWith('px:')) return !!strips[fx.slice(3)];
  const file = (SHEET_FILES as Record<string, string>)[fx];
  return !!file && existsSync(`${DIR}/${file}`);
}
const ids = [...SPELLS.map((s) => s.id), ...ABILITIES.filter((a) => a.active).map((a) => a.id), ...KIT_ITEMS.map((k) => k.id)];

test('every spell, skill and battle item has an effect whose picture exists', () => {
  for (const id of ids) assert.ok(drawable(actFx(id)), `${id}: ${actFx(id)}`);
  assert.ok(existsSync(`${DIR}/pixelfx.png`));
  for (const file of Object.values(SHEET_FILES)) assert.ok(existsSync(`${DIR}/${file}`), file);
  // (the town's spells and the gods' signs too)
  for (const [k, l] of Object.entries(LOOKS)) if (l.sprite) assert.ok(drawable(l.sprite), `${k}: ${l.sprite}`);
  // (and every cue: the statuses' and the procs', and the close blows')
  for (const c of [...Object.values(STATUS_CUE), ...Object.values(PROC_CUE)]) assert.ok(drawable(c.fx), c.fx);
  for (const fx of Object.values(MELEE_FX)) assert.ok(drawable(fx), fx);
});

test('the effects come in many shapes and colours, none dominant', () => {
  const families = new Map<string, number>();
  let px = 0;
  for (const id of ids) {
    const fx = actFx(id);
    if (!fx.startsWith('px:')) continue;
    px++;
    const [el, fam] = fx.slice(3).split('-');
    assert.ok(Object.values(PX_ELEMENT).includes(el), fx);
    assert.ok((PX_FAMILIES as readonly string[]).includes(fam), fx);
    families.set(fam, (families.get(fam) ?? 0) + 1);
  }
  assert.ok(px > ids.length * 0.6, `most acts come from the atlas (${px} of ${ids.length})`);
  assert.ok(families.size >= 20, `a variety of shapes: ${[...families.keys()].join(', ')}`);
  assert.ok(Math.max(...families.values()) < px * 0.25, 'no one shape dominates');
  // (the old catch-all: an act with no element of its own no longer defaults to the arcane star)
  const star = ids.filter((id) => actFx(id).startsWith('px:star-'));
  assert.ok(star.length < ids.length * 0.12, `few star effects (${star.length})`);
});

test('an effect reads as what its act does', () => {
  const el = (id: string) => actFx(id).slice(3).split('-')[0];
  const fam = (id: string) => familyOf(actFx(id));
  // elements: fire is fire, a poison cloud poison, bone armour dark, a sleep the moon's, a blood shield blood
  assert.equal(el('fire_bolt'), 'fire');
  assert.equal(actFx('poison_cloud'), 'px:poison-smoke');
  assert.equal(el('bone_armour'), 'dark');
  assert.equal(el('sanguine_shield'), 'blood');
  assert.equal(el('barkskin'), 'forest');
  assert.equal(el('winters_grasp'), 'ice');
  assert.equal(el('divine_ward'), 'light');
  assert.ok(/px:ice-/.test(actFx('blizzard')), actFx('blizzard'));
  // shapes: a mend sparkles, a raising is a pillar, a summons a circle, a ward a dome (not the solid disc), a doom a glyph
  assert.equal(actFx('mend'), 'px:light-sparkle');
  assert.equal(fam('raise'), 'pillar');
  assert.equal(actFx('call_spirit'), 'px:star-circle');
  assert.equal(fam('ward'), 'aura');
  assert.equal(fam('doom_curse'), 'glyph');
  assert.equal(fam('fireball'), 'orb');
  assert.equal(actFx('entangle_art'), 'roots');
  assert.equal(fam('war_cry'), 'nova');
  // no act is drawn as the pack's solid shield disc (it hid the one it guarded)
  for (const id of ids) assert.notEqual(fam(id), 'shield', id);
  // a "Warden" is no ward: Warden's Wrath strikes
  assert.notEqual(fam('wardens_wrath'), 'aura');
  // blows by their arms: blades slash, fists thud, claws scratch, arrows land (and fly)
  assert.ok(/^slash_/.test(actFx('execute')), actFx('execute'));
  assert.equal(fam('palm_strike'), 'hit');
  assert.equal(fam('rending_claws'), 'cross');
  assert.equal(el('rending_claws'), 'blood');
  assert.equal(el('poison_arrow'), 'poison');
  assert.ok(actArrow('aimed_shot') && !actArrow('execute'));
  // ultimates keep the big sheets, by what they do
  assert.ok(!actFx('judgement_art').startsWith('px:'));
  assert.ok(['life_fountain', 'suture'].includes(actFx('divine_grace')), actFx('divine_grace'));
  assert.ok(['mg_spikes', 'spines'].includes(actFx('titan_wall')), actFx('titan_wall')); // (it strikes the foes with earth too)
  assert.equal(actFx('storm_of_arrows'), 'missile');
  // the orb in flight is the effect's own element
  assert.equal(actElement('frost_shard'), 'ice');
  // the cue over the head: the status it lays on
  assert.equal(actCue('thunder_jolt'), 'stun');
  assert.equal(actCue('battle_cry'), 'inspired');
});

test('a close blow looks like the arms that struck it', () => {
  assert.equal(meleeLook('Iron Sword'), 'blade');
  assert.equal(meleeLook('Oak Club'), 'blunt');
  assert.equal(meleeLook('fists'), 'blunt');
  assert.equal(meleeLook(' Dire Wolf wolf'), 'claw');
  assert.equal(meleeLook('axe Orc Raider orc'), 'blade');
});

test('every status and proc has a short word', () => {
  for (const c of [...Object.values(STATUS_CUE), ...Object.values(PROC_CUE)]) assert.ok(c.word.length > 0 && c.word.length <= 9, c.word);
  assert.equal(PROC_CUE.crit.word, 'Crit!');
});
