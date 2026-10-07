import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITIES } from '../src/shared/data/abilities';
import { actFx, PX_ELEMENT, PX_FAMILIES } from '../src/shared/data/actFx';
import { SPELLS } from '../src/shared/data/spells';
import index from '../src/renderer/art/effects/pixelfx.json';

const strips = (index as { strips: Record<string, unknown> }).strips;

test('every spell and skill has an effect that fits its element and shape, from the pixel effects atlas', () => {
  const ids = [...SPELLS.map((s) => s.id), ...ABILITIES.filter((a) => a.active).map((a) => a.id)];
  const families = new Map<string, number>();
  let px = 0;
  for (const id of ids) {
    const fx = actFx(id);
    assert.ok(fx, id);
    if (fx.startsWith('px:')) {
      px++;
      const [el, fam] = fx.slice(3).split('-');
      assert.ok(strips[`${el}-${fam}`], `${id}: ${fx} is in the atlas`);
      assert.ok(Object.values(PX_ELEMENT).includes(el), fx);
      assert.ok((PX_FAMILIES as readonly string[]).includes(fam), fx);
      families.set(fam, (families.get(fam) ?? 0) + 1);
    }
  }
  assert.ok(px > ids.length * 0.7, `most acts come from the atlas (${px} of ${ids.length})`);
  assert.ok(families.size >= 20, `a variety of shapes: ${[...families.keys()].join(', ')}`);
  assert.ok(Math.max(...families.values()) < px * 0.3, 'no one shape dominates');
  // the elements match: a fire bolt is fire, a mend is light's sparkle, a summons opens a circle, rain rains
  assert.equal(actFx('fire_bolt').split(':')[1].split('-')[0], 'fire');
  assert.equal(actFx('mend'), 'px:light-sparkle');
  assert.equal(actFx('call_spirit'), 'px:star-circle');
  assert.ok(/px:ice-/.test(actFx('blizzard')), actFx('blizzard'));
  // ultimates keep the big sheets; a plain weapon art is a slash
  assert.ok(!actFx('judgement_art').startsWith('px:'));
  assert.ok(/^slash_/.test(actFx('execute')), actFx('execute'));
});
