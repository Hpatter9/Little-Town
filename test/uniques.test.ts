import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { QUEST_UNIQUES, UNIQUE_FROM, UNIQUES } from '../src/shared/data/uniques';
import { WEAPONS } from '../src/shared/data/weapons';
import { bossSlain, dropLoot } from '../src/shared/sim/bosses';
import { equipAll } from '../src/shared/sim/crafting';
import { type Building, type GameState, campCell } from '../src/shared/sim/state';
import { plainGame, row } from './helpers';

const camp = (s: GameState) => campCell(s).x;

test('every unique is a named weapon of a real family, harder-hitting than a made one of its tier, from real bosses', () => {
  assert.ok(UNIQUES.length >= 45, 'about fifty uniques');
  assert.equal(new Set(UNIQUES.map((u) => u.name)).size, UNIQUES.length, 'each has its own name');
  for (const u of UNIQUES) {
    assert.equal(ITEM_BY_ID[u.id], u, `${u.id} is an item`);
    assert.ok(u.unique && u.relic && u.slot === 'weapon' && u.family, `${u.id} is a unique weapon`);
    const made = WEAPONS.filter((w) => w.family === u.family && (w.tier ?? 0) <= (u.tier ?? 0)).sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
    if (made) assert.ok((u.effects.damage ?? 0) > (made.effects.damage ?? 0), `${u.id} outhits ${made.id}`);
    for (const b of UNIQUE_FROM[u.id]) assert.ok(ENEMIES[b]?.boss, `${u.id}: ${b} is a boss`);
  }
  assert.ok(QUEST_UNIQUES.length >= 5, 'some are kept for quests');
  // (most bosses carry at least one)
  const bosses = Object.values(ENEMIES).filter((e) => e.boss);
  const carrying = bosses.filter((e) => UNIQUES.some((u) => UNIQUE_FROM[u.id].includes(e.id)));
  assert.ok(carrying.length >= bosses.length - 2, `${carrying.length} of ${bosses.length} bosses carry a unique`);
});

test('a slain boss pays its purse, and gives up each of its uniques once in the world', () => {
  const s = plainGame('uniques');
  const kind = 'dragon'; // (two uniques: Dragonfang and Wyrmfire)
  const got: string[] = [];
  for (let i = 0; i < 40; i++) {
    s.tick += 997;
    const coins = s.coins ?? 0;
    const u = dropLoot(s, kind);
    assert.ok((s.coins ?? 0) > coins, 'its purse');
    if (u) got.push(u);
  }
  assert.deepEqual([...got].sort(), ['dragonfang', 'wyrmfire'], 'both, once each');
  assert.deepEqual(s.uniques?.slice().sort(), ['dragonfang', 'wyrmfire']);
  assert.equal(s.items.dragonfang, 1);
  // and a quest's unique never drops from a boss
  for (const q of QUEST_UNIQUES) assert.ok(!s.uniques?.includes(q));
});

test('bosses without a trophy still pay out, and the trophy still comes with the loot', () => {
  const s = plainGame('uniques2');
  bossSlain(s, 'black_knight');
  assert.equal(s.items.black_blade, 1, 'the trophy');
  assert.ok((s.coins ?? 0) > 0, 'the purse');
  const t = plainGame('uniques3');
  bossSlain(t, 'rogue_ai');
  assert.ok((t.coins ?? 0) > 0, 'a kitless boss still has a purse');
});

test('a town that buys its gear still hands its treasures to its fighters', () => {
  const s = plainGame('uniques4');
  const shop: Building = { id: s.nextId++, def: 'trading_post', tile: camp(s) + 3, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(shop);
  s.items.masterless = 1;
  equipAll(s);
  assert.equal(s.people[0].gear.weapon, 'masterless', 'the founder takes up the unique');
});
