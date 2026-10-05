import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BEASTS, DAWN_ACROSS, DUNGEON_HABITATS, MENAGERIE, MENAGERIE_QUARRIES, MENAGERIE_RAIDS, TIERS_BY_ERA, beastsOf, placeHabitats } from '../src/shared/data/menagerie';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { DUNGEONS } from '../src/shared/data/dungeons';
import { COMPONENTS, QUARRY_BY_ID } from '../src/shared/data/hunts';
import { ERAS } from '../src/shared/data/eras';
import { BIOMES } from '../src/shared/data/biomes';
import { meet } from '../src/shared/sim/state';
import { plainGame } from './helpers';

test('at least 250 new creatures, each a foe with its own name and a cell of the composed sheet', () => {
  assert.ok(BEASTS.length >= 250, `${BEASTS.length}`);
  const png = readFileSync('src/renderer/art/creatures/dawn.png');
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert.equal(w, DAWN_ACROSS * 2 * 16, 'two 16px frames a creature');
  assert.ok(h >= Math.ceil(BEASTS.length / DAWN_ACROSS) * 16, 'every creature has its row');
  const names = new Set<string>();
  for (const b of BEASTS) {
    const e = ENEMIES[b.id];
    assert.equal(e, MENAGERIE[b.id], `${b.id} is a foe`);
    assert.ok(!names.has(e.name), `${e.name} once`);
    names.add(e.name);
    assert.ok(e.hp > 0 && e.damage[1] >= e.damage[0], b.id);
    assert.ok(b.tier >= 1 && b.tier <= 10);
  }
  // (stronger with the tier)
  const avg = (t: number) => { const xs = BEASTS.filter((b) => b.tier === t).map((b) => ENEMIES[b.id].hp); return xs.reduce((a, b) => a + b, 0) / xs.length; };
  assert.ok(avg(8) > avg(4) && avg(4) > avg(1));
});

test('every creature turns up somewhere: a raid, a lair or cave, a dungeon, or a hunt', () => {
  const where = new Set<string>();
  for (const k of MENAGERIE_RAIDS) {
    assert.equal(RAID_KIND_BY_ID[k.id], k, `${k.id} is a raid kind`);
    for (const [id, cost] of Object.entries(k.enemies)) {
      assert.ok(ENEMIES[id] && cost > 0);
      where.add(id);
    }
  }
  for (const d of DUNGEONS) for (const g of d.foes) for (const id of Object.keys(g)) where.add(id);
  for (const era of ERAS) for (const biome of BIOMES) for (const kind of ['beast', 'cave', 'reef'] as const) for (const b of beastsOf(placeHabitats(kind, biome), TIERS_BY_ERA[era])) where.add(b.id);
  for (const q of MENAGERIE_QUARRIES) {
    assert.equal(QUARRY_BY_ID[q.id], q, `${q.id} is a hunt`);
    for (const m of Object.keys(q.parts)) assert.ok((COMPONENTS as readonly string[]).includes(m), `${q.id}: ${m}`);
    for (const id of Object.keys(q.foes)) where.add(id);
  }
  const lost = BEASTS.filter((b) => !where.has(b.id)).map((b) => b.id);
  assert.deepEqual(lost, []);
  // (each dungeon type's habitats are real)
  for (const d of DUNGEONS) assert.ok(DUNGEON_HABITATS[d.type], d.type);
});

test('the town remembers each kind of foe it meets, once', () => {
  const s = plainGame('menagerie-meet');
  meet(s, ['razorfin', 'wolf', 'razorfin']);
  meet(s, ['wolf', 'hydra']);
  assert.deepEqual(s.met, ['razorfin', 'wolf', 'hydra']);
});
