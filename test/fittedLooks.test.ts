// The settlers' six new looks (tools/pixellab/batch_nov.py `LOOKS`: farmer, smith, hunter, the two elders, the young
// woman): picked only once their art is in, for the folk they fit, and never switching while a person's facts stay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FITTED_LOOKS, FOLK_LOOKS, fittedLook, pickLook, type FolkState } from '../src/renderer/iso/folkRules';
import { LOOK_DYES, tintOf } from '../src/renderer/iso/folkTint';
import { folkWho } from '../src/renderer/iso/folkWho';
import { ITEM_BY_ID } from '../src/shared/data/items';

type Who = Parameters<typeof pickLook>[0];
const st = (o: Partial<FolkState> = {}): Who => ({ id: 1, look: { gender: 'm', outfit: 'base' }, lifeStage: 'prime', ...o });
const made: string[] = JSON.parse(readFileSync(join('src', 'renderer', 'art', 'iso', 'made.json'), 'utf8')).looks ?? [];
// (the settlers' looks as the build has them, and with all six drawn)
const WITHOUT = { ...FOLK_LOOKS, settlers: FOLK_LOOKS.settlers.filter((l) => !(FITTED_LOOKS as readonly string[]).includes(l)) };
const WITH = { ...FOLK_LOOKS, settlers: [...WITHOUT.settlers, ...FITTED_LOOKS] };
const ids = Array.from({ length: 300 }, (_, i) => i + 1);

test('a fitted look is only drawn once assemble_nov.py has put its art in', () => {
  for (const l of FITTED_LOOKS) assert.equal(FOLK_LOOKS.settlers.includes(l), made.includes(l), `${l}: listed only when made.json says so`);
  // (with none drawn, nobody wears one, whoever they are)
  for (const id of ids) {
    for (const gender of ['m', 'f'] as const) {
      for (const lifeStage of ['young', 'prime', 'elder', 'old'] as const) {
        for (const typeName of ['Crafter', 'Gatherer', 'Hunter', 'Child', undefined]) {
          const look = pickLook(st({ id, look: { gender, outfit: 'base' }, lifeStage, typeName }), WITHOUT, 'base').look;
          assert.ok(!(FITTED_LOOKS as readonly string[]).includes(look), `${id} ${gender} ${lifeStage} ${typeName}: ${look}`);
        }
      }
    }
  }
});

test('once drawn, each look goes to the folk it fits', () => {
  assert.equal(pickLook(st({ lifeStage: 'elder' }), WITH, 'base').look, 'man_elder');
  assert.equal(pickLook(st({ lifeStage: 'old', look: { gender: 'f', outfit: 'base' } }), WITH, 'base').look, 'woman_elder');
  assert.equal(pickLook(st({ typeName: 'Crafter' }), WITH, 'base').look, 'man_smith');
  assert.equal(pickLook(st({ typeName: 'Gatherer' }), WITH, 'base').look, 'man_farmer');
  assert.equal(pickLook(st({ typeName: 'Hunter', look: { gender: 'f', outfit: 'base' } }), WITH, 'base').look, 'woman_hunter');
  // (the young woman by a share of the women; about a third of the town-born wear a new look)
  const women = ids.map((id) => pickLook(st({ id, typeName: 'Child', look: { gender: 'f', outfit: 'base' } }), WITH, 'base').look);
  assert.ok(women.includes('woman_maiden'));
  const fitted = women.filter((l) => (FITTED_LOOKS as readonly string[]).includes(l)).length;
  assert.ok(fitted > ids.length * 0.2 && fitted < ids.length * 0.5, `${fitted} of ${ids.length}`);
  // (never a look of the other sex, a child's, a dwarf's or one in armour)
  for (const id of ids) {
    assert.ok(!pickLook(st({ id, typeName: 'Child' }), WITH, 'base').look.startsWith('woman_'));
    assert.ok(pickLook(st({ id, lifeStage: 'child', growsUpIn: 9 }), WITH).look.startsWith('child_'));
    assert.ok(pickLook(st({ id, origin: 'dwarves', lifeStage: 'elder' }), WITH, 'base').look.startsWith('dwarf_'));
    assert.ok(pickLook(st({ id, lifeStage: 'elder' }), WITH, 'plate').look.endsWith('_plate'));
  }
});

test('a look, once chosen, never switches: the same person gets the same look, and the new art moves only its own folk', () => {
  for (const id of ids) {
    for (const typeName of ['Crafter', 'Gatherer', 'Hunter', 'Child']) {
      const who = st({ id, typeName, look: { gender: id % 2 ? 'm' : 'f', outfit: 'base' } });
      const a = pickLook(who, WITH, 'base').look;
      // (asked again, or about what they're doing now: the pick rests on none of it)
      assert.equal(pickLook({ ...who }, WITH, 'base').look, a);
      assert.equal(pickLook({ ...who, activity: 'chop', work: { kind: 'craft', at: 'smithy' } } as Who, WITH, 'base').look, a);
      assert.equal(fittedLook(who), fittedLook({ ...who }));
      // (someone not meant for a fitted look keeps exactly the look they wore before the art came)
      const before = pickLook(who, WITHOUT, 'base').look;
      if (!(FITTED_LOOKS as readonly string[]).includes(a)) assert.equal(a, before, `${id} ${typeName}`);
    }
  }
});

test("a fitted look's dyes are its wearer's, set once the art is in, the same in armour or out", () => {
  const heavy = Object.values(ITEM_BY_ID).find((i) => i.slot === 'body' && i.weight === 'heavy')!.id;
  const maid = (id: number) => ({ id, typeName: 'Child', look: { gender: 'f' as const, outfit: 'base', skin: '#e0b090', hairColor: '#2a1c14' }, lifeStage: 'prime' as const, gear: {} });
  const maidens = ids.filter((id) => fittedLook(maid(id)) === 'woman_maiden');
  assert.ok(maidens.length > 0);
  const before = maidens.map((id) => folkWho(maid(id)).tint);
  const kept = FOLK_LOOKS.settlers;
  FOLK_LOOKS.settlers = WITH.settlers;
  try {
    maidens.forEach((id, i) => {
      const bare = folkWho(maid(id)), armoured = folkWho({ ...maid(id), gear: { body: heavy } });
      assert.equal(bare.pick.look, 'woman_maiden');
      assert.ok(armoured.pick.look.endsWith('_plate'));
      assert.ok(bare.tint?.cloth && LOOK_DYES.woman_maiden.includes(bare.tint.cloth), `${id}: ${bare.tint?.cloth}`);
      assert.deepEqual(armoured.tint, bare.tint);
      // (only the cloth's dye is the look's: skin, hair and the second cloth are as they were)
      assert.deepEqual({ ...bare.tint, cloth: undefined }, { ...before[i], cloth: undefined });
    });
    // (someone with no fitted look keeps the people's dyes)
    const plain = ids.find((id) => !fittedLook({ id, typeName: 'Child', look: { gender: 'm', outfit: 'base' }, lifeStage: 'prime' }))!;
    assert.deepEqual(tintOf({ id: plain, look: { gender: 'm' }, lifeStage: 'prime', typeName: 'Child' }), tintOf({ id: plain, look: {}, lifeStage: 'prime' }));
  } finally {
    FOLK_LOOKS.settlers = kept;
  }
});
