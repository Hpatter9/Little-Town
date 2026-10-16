import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MYTHIC_CALLINGS, mythicId } from '../src/shared/data/mythic';
import { UNIQUES } from '../src/shared/data/uniques';
import type { RareView } from '../src/shared/sim/rare';
import { freshReveals, haulOrder, revealsOf } from '../src/renderer/mobile/reveals';

const empty = (): RareView => ({ mythics: [], uniques: [], specials: [], sagas: [], dwellers: [], dragon: null, bosses: [], deeds: [] });

test('each rare thing gives one card, keyed so it comes once', () => {
  const r = empty();
  r.mythics.push({ id: 7, road: mythicId(MYTHIC_CALLINGS[0].base.id), who: 'Maud', tick: 1 });
  r.uniques.push(UNIQUES[0].id);
  r.specials.push({ id: 'archmage', who: 'Bran' }, { id: 'plague', who: 'Ned' });
  r.dwellers.push({ depth: 1, tick: 3 });
  r.dragon = { kind: 'dragon', phase: 'slain' };
  const all = revealsOf(r);
  const keys = all.map((w) => w.key);
  assert.equal(new Set(keys).size, keys.length, 'no two alike');
  assert.ok(keys.includes('mythic:7') && keys.includes(`unique:${UNIQUES[0].id}`) && keys.includes('dweller:1'));
  assert.ok(keys.includes('dragon:dragon') && keys.includes('dragon-slain:dragon'), 'sighted, then slain');
  assert.ok(keys.includes('special:archmage') && !keys.includes('special:plague'), 'only a legend at the gate is a reveal');
  assert.equal(all.find((w) => w.key === 'mythic:7')!.tone, 'mythic');
  assert.ok(all.every((w) => w.rarity), 'every card says how rare');
  assert.deepEqual(freshReveals(all, new Set(keys.slice(1))).map((w) => w.key), [keys[0]]);
});

test('a haul opens commonest first, the best last, glowing when it is rare', () => {
  const h = haulOrder({ wood: 5, gems: 2, stone: 3 });
  assert.deepEqual(h.map((x) => x.id), ['stone', 'wood', 'gems']);
  assert.ok(h[2].rare && !h[0].rare);
  const plain = haulOrder({ wood: 5, stone: 1 });
  assert.ok(!plain.some((x) => x.rare), 'nothing dear: no glow');
  const u = haulOrder({ wood: 1, gems: 1 }, [UNIQUES[0].id]);
  assert.equal(u[u.length - 1].id, UNIQUES[0].id);
  assert.ok(u[u.length - 1].rare && u[u.length - 1].unique && !u[1].rare, 'a unique comes last of all');
  assert.deepEqual(haulOrder({}), []);
});
