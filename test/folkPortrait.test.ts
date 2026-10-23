import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOLK_LOOKS, dressOf, lookPath, pickLook } from '../src/renderer/iso/folkRules';
import { tintOf } from '../src/renderer/iso/folkTint';
import { folkWho } from '../src/renderer/iso/folkWho';
import { ITEM_BY_ID } from '../src/shared/data/items';

const heavy = Object.values(ITEM_BY_ID).find((i) => i.slot === 'body' && i.weight === 'heavy')?.id;

test('the menu portrait and the map pick the same look and colours for a person', () => {
  const origins = [undefined, 'settlers', 'orcs', 'lich', 'dwarves', 'fae'] as const;
  for (const origin of origins) for (const gender of ['m', 'f'] as const) for (let id = 1; id <= 40; id++) {
    for (const gear of [{}, heavy ? { body: heavy } : {}]) {
      const st = { id, origin, look: { gender, outfit: 'leather' } as never, gear };
      const body = gear.body ? ITEM_BY_ID[gear.body] : undefined;
      const mapPick = pickLook(st, undefined, dressOf(body?.weight));
      const who = folkWho(st);
      assert.deepEqual(who.pick, mapPick);
      assert.deepEqual(who.tint, tintOf(st, mapPick.people));
      assert.equal(who.path, lookPath(mapPick, null));
    }
  }
});

test('a people without its own cast uses the settlers looks, as the map does', () => {
  const who = folkWho({ id: 3, origin: 'dwarves', look: { gender: 'm', outfit: 'base' } as never, gear: {} });
  assert.ok(who.pick.people === 'settlers');
  assert.ok(FOLK_LOOKS.settlers.includes(who.pick.look));
});
