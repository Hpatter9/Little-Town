import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { DUNGEON_BY_ID } from '../src/shared/data/dungeons';
import { addItems, hourlyItems } from '../src/shared/sim/crafting';
import { fellHeartwood, rareFind } from '../src/shared/sim/chains';
import { noteFugitives } from '../src/shared/sim/chase';
import { pickFloor } from '../src/shared/sim/delveFloors';
import { restockKits } from '../src/shared/sim/kit';
import { boardsFor } from '../src/shared/sim/raidBoards';
import { startRaid } from '../src/shared/sim/raids';
import { BOARD_H, BOARD_W } from '../src/shared/sim/tactics';
import { buyKit } from '../src/shared/sim/wages';
import { campCell, type Building, type Expedition, type GameState, type Raid } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, row } from './helpers';

// `GameState.autopilot` is on when left out, and a real game leaves it out: a system guarded with `!s.autopilot` never
// runs on the phone, only in tests that set it (docs/notes/autopilot-guard.md).

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('no system reads the autopilot as off when it is left out', () => {
  const bad: string[] = [];
  for (const file of sources('src/shared')) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      // (only `=== false` and `!== false` read an unset autopilot as on; setting it is fine)
      for (const _ of code.matchAll(/\.autopilot\b(?!\s*[!=]==\s*false)(?!\s*=[^=])/g)) bad.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(bad, [], 'guard with `s.autopilot === false` (unset is on)');
});

/** A town as a real game holds it: the autopilot left out. */
function realGame(seed: string): GameState {
  const s = plainGame(seed);
  delete s.autopilot;
  return s;
}

test('a real game (the autopilot left out) runs the systems once guarded wrongly', () => {
  // battle items: handed out from the stores, and bought at the shop
  const s = realGame('real-kit');
  s.people[0].cls = 'warrior';
  s.items = { healing_potion: 1 };
  s.tick = TICKS_PER_HOUR;
  restockKits(s);
  assert.deepEqual(s.people[0].kit, ['healing_potion'], 'handed out');
  s.buildings.push({ id: s.nextId++, def: 'trading_post', tile: campCell(s).x + 3, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  s.people[0].coins = 500;
  addItems(s, 'antidote', 1);
  buyKit(s);
  assert.equal(s.people[0].kit!.length, 2, 'bought');

  // tools wear with work
  const w = realGame('real-wear');
  const p = w.people[0];
  p.gear.tool = 'stone_axe';
  p.activity = 'chop';
  w.tick = TICKS_PER_HOUR;
  hourlyItems(w, new Rng(1));
  assert.equal(p.toolWear, 1, 'an hour of wear');

  // a raid's fugitives offered for a chase, and a hand-made board to fit
  const c = realGame('real-chase');
  const r = startRaid(c, RAID_KIND_BY_ID.bandits, 40, new Rng(3));
  r.raiders = r.raiders.slice(0, 2);
  for (const rd of r.raiders) rd.gone = true;
  c.raid = null;
  noteFugitives(c, r, 'Bandits');
  assert.ok(c.chaseOffer, 'a chase offered');
  assert.ok(boardsFor(c, { kind: 'bandits', side: -1 } as unknown as Raid, BOARD_W, BOARD_H).length > 0, 'boards to fit');

  // chains: heartwood from old trees, rare finds from quests
  const h = realGame('real-chains');
  h.era = 'medieval';
  let wood = 0;
  let found = 0;
  for (let t = 0; t < 2000; t++) {
    h.tick = t;
    h.people[0].carrying = {};
    fellHeartwood(h, h.people[0]);
    wood += h.people[0].carrying.heartwood ?? 0;
    const e = { id: t, loot: {}, recalled: false } as unknown as Expedition;
    rareFind(h, e, 'legendary');
    found += Object.keys(e.loot).length;
  }
  assert.ok(wood > 0 && found > 0, `heartwood ${wood}, finds ${found}`);

  // a delve down a hand-made floor
  const d = DUNGEON_BY_ID.barrow_crypt;
  const f = realGame('real-floor');
  let hand = 0;
  for (let id = 1; id <= 20; id++) if (pickFloor(f, { id, dest: d.id } as Expedition, d, d.rooms + 1)) hand++;
  assert.ok(hand > 0, 'some delves go down a drawn floor');
});
