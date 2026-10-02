import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUNGEON_BY_ID, DUNGEONS, QUIET_DAYS, DEEPER_ROOMS } from '../src/shared/data/dungeons';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { QUEST_UNIQUES } from '../src/shared/data/uniques';
import { delvesHourly } from '../src/shared/sim/delves';
import { destinationUnlocked, sendDelve } from '../src/shared/sim/expeditions';
import { questsDone, questsHourly } from '../src/shared/sim/quests';
import { attractiveness, TROPHY_RENOWN, treasuresHeld } from '../src/shared/sim/shop';
import { type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.cheats.unlockAll = true;
  s.regions = DUNGEONS.map((d) => d.region);
  return s;
}
const camp = (s: GameState) => Math.floor(s.tiles.length / 2);

test('of an evening, someone offers a quest on a dungeon the town knows; open quests lapse', () => {
  const s = town('quests');
  for (let h = 0; h < 24 * 20 && !(s.quests?.length); h++) {
    s.tick += TICKS_PER_HOUR;
    questsHourly(s);
  }
  assert.ok(s.quests?.length, 'a quest was offered');
  const q = s.quests![0];
  assert.ok(DUNGEON_BY_ID[q.dungeon], 'on a real dungeon');
  assert.ok(q.text.length > 20 && q.title.length > 5);
  if (q.kind === 'relic') assert.ok(QUEST_UNIQUES.includes(q.unique!));
  // and none stays open past its days
  s.tick = q.until;
  questsHourly(s);
  assert.ok(!s.quests!.some((x) => x.id === q.id), 'it lapsed');
});

test('a cleared dungeon pays every quest on it: a captive joins, a bounty, a relic, a fallen delver\'s gear', () => {
  const s = town('rewards');
  const until = s.tick + TICKS_PER_DAY;
  s.quests = [
    { id: 1, kind: 'rescue', dungeon: 'barrow_crypt', from: 'a widow', title: 't', text: 't', until },
    { id: 2, kind: 'bounty', dungeon: 'barrow_crypt', from: 'a merchant', title: 't', text: 't', coins: 80, until },
    { id: 3, kind: 'relic', dungeon: 'barrow_crypt', from: 'a scholar', title: 't', text: 't', unique: 'sunblade', until },
    { id: 4, kind: 'gear', dungeon: 'barrow_crypt', from: 'a squire', title: 't', text: 't', until },
    { id: 5, kind: 'bounty', dungeon: 'deep_mine', from: 'a hunter', title: 't', text: 't', coins: 50, until },
  ];
  const people = s.people.length;
  const coins = s.coins ?? 0;
  const items = Object.values(s.items).reduce((a, b) => a + b, 0);
  questsDone(s, 'barrow_crypt', camp(s) * 32, new Rng(3));
  assert.equal(s.people.length, people + 1, 'the captive joins');
  assert.equal((s.coins ?? 0) - coins, 80, 'the bounty');
  assert.ok(s.uniques?.includes('sunblade') && s.items.sunblade === 1, 'the relic');
  assert.equal(Object.values(s.items).reduce((a, b) => a + b, 0), items + 2, 'the relic and the gear');
  assert.deepEqual(s.quests!.map((q) => q.id), [5], 'the other dungeon\'s quest stays open');
});

test('a cleared dungeon lies quiet, then wakes deeper', () => {
  const s = town('respawn');
  s.delved = { gremlin_warren: 1 };
  s.dungeonQuiet = { gremlin_warren: s.tick + QUIET_DAYS * TICKS_PER_DAY };
  const d = DESTINATION_BY_ID.gremlin_warren;
  assert.equal(destinationUnlocked(s, d), false, 'quiet');
  s.tick += QUIET_DAYS * TICKS_PER_DAY;
  s.tick -= s.tick % TICKS_PER_HOUR;
  delvesHourly(s);
  assert.equal(destinationUnlocked(s, d), true, 'awake');
  assert.ok(s.journal.some((j) => /has woken, deeper/.test(j.text)));
  const p = s.people[0];
  for (const b of s.buildings) if (b.def === 'campfire') b.store.wood = 40;
  sendDelve(s, 'gremlin_warren', [p.id], 'safe');
  assert.equal(s.expeditions[0].delve!.rooms.length, DUNGEON_BY_ID.gremlin_warren.rooms + DEEPER_ROOMS + 1, 'two rooms deeper, and the boss');
});

test('now and then a rival party is down there too', () => {
  let rivals = 0;
  for (let i = 0; i < 30; i++) {
    const s = town(`rival${i}`);
    for (const b of s.buildings) if (b.def === 'campfire') b.store.wood = 40;
    sendDelve(s, 'fey_hollow', [s.people[0].id], 'safe');
    const v = s.expeditions[0].delve!;
    if (v.rival) {
      rivals++;
      assert.ok(v.rooms.includes('rival'), 'met at a room of their own');
    }
  }
  assert.ok(rivals >= 3 && rivals <= 20, `${rivals} of 30 had rivals`);
});

test('a Trophy Hall shows off the town\'s treasures, and each one draws more travellers', () => {
  const s = town('trophies');
  const shop: Building = { id: s.nextId++, def: 'trading_post', tile: camp(s) + 3, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(shop);
  s.items.black_blade = 1;
  s.uniques = ['masterless'];
  s.items.masterless = 1;
  assert.equal(treasuresHeld(s), 2);
  const before = attractiveness(s, shop);
  s.buildings.push({ id: s.nextId++, def: 'trophy_hall', tile: camp(s) - 6, status: 'done', delivered: {}, progress: 1, store: {} });
  assert.equal(attractiveness(s, shop), before + 2 * TROPHY_RENOWN);
});
