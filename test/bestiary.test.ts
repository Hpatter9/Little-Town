import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BESTIARY_ENEMIES, BESTIARY_LAIRS, BESTIARY_RAIDS, BESTIARY_TROPHIES } from '../src/shared/data/bestiary';
import { ENEMIES } from '../src/shared/data/enemies';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { PACK_SHEETS } from '../src/shared/data/packSheets';
import { RAID_KINDS } from '../src/shared/data/raids';
import { ROUTES } from '../src/shared/data/scenes';
import { MAP_SPOTS } from '../src/shared/data/worldMap';

test('every new foe is drawn from a pack sheet, and every pack sheet is used', () => {
  const used = new Set<string>();
  for (const [id, e] of Object.entries(BESTIARY_ENEMIES)) {
    assert.equal(ENEMIES[id], e, `${id} is in the game's list`);
    assert.ok('sheet' in e.sprite && e.sprite.sheet in PACK_SHEETS, `${id} has a pack sheet`);
    if ('sheet' in e.sprite) used.add(e.sprite.sheet);
    assert.ok(e.hp > 0 && e.damage[0] <= e.damage[1]);
  }
  for (const sheet of Object.keys(PACK_SHEETS)) assert.ok(used.has(sheet), `${sheet} is used by some foe`);
});

test('the new raids and lairs bring foes that exist; every boss drops a trophy that exists', () => {
  for (const k of BESTIARY_RAIDS) {
    assert.ok(RAID_KINDS.includes(k));
    for (const id of Object.keys(k.enemies)) assert.ok(ENEMIES[id], `${k.id}: ${id}`);
  }
  for (const d of BESTIARY_LAIRS) {
    assert.ok(DESTINATIONS.includes(d));
    assert.ok(ROUTES[d.id], `${d.id} has its scenes`);
    assert.ok(MAP_SPOTS[d.id], `${d.id} is on the map`);
    for (const g of d.encounters.groups) for (const id of Object.keys(g.enemies)) assert.ok(ENEMIES[id], `${d.id}: ${id}`);
    assert.ok(Object.keys(d.encounters.groups[0].enemies).some((id) => ENEMIES[id].kit), `${d.id} has a boss`);
  }
  for (const e of Object.values(BESTIARY_ENEMIES)) {
    if (!e.kit) continue;
    assert.ok(ITEM_BY_ID[e.kit.trophy]?.relic, `${e.id}'s trophy ${e.kit.trophy}`);
    if (e.kit.summon) assert.ok(ENEMIES[e.kit.summon.kind], `${e.id} summons ${e.kit.summon.kind}`);
  }
  for (const t of BESTIARY_TROPHIES) assert.ok(Object.values(BESTIARY_ENEMIES).some((e) => e.kit?.trophy === t.id), `${t.id} drops from a boss`);
});
