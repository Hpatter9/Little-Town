import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUARRY_BY_ID } from '../src/shared/data/hunts';
import { DUNGEON_BY_ID } from '../src/shared/data/dungeons';
import { postHunt } from '../src/shared/sim/hunts';
import { beginSaga } from '../src/shared/sim/sagas';
import { snapshot } from '../src/shared/sim/snapshot';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

// The menus' "tap for more" (renderer/panel/details.ts) reads what it shows from the snapshot and the data: these are
// the pieces the snapshot carries for it.

test('a quest carries who asked and what it pays, for its details', () => {
  const s = plainGame('details-quests');
  const until = s.tick + 1000;
  s.quests = [
    { id: 1, kind: 'rescue', dungeon: 'barrow_crypt', from: 'a weeping widow', title: 'Rescue', text: '…', until },
    { id: 2, kind: 'bounty', dungeon: 'barrow_crypt', from: 'a merchant', title: 'Bounty', text: '…', coins: 75, until },
    { id: 3, kind: 'relic', dungeon: 'barrow_crypt', from: 'a scholar', title: 'Relic', text: '…', unique: 'black_blade', until },
    { id: 4, kind: 'gear', dungeon: 'barrow_crypt', from: 'a squire', title: 'Gear', text: '…', until },
  ];
  const q = snapshot(s).quests;
  assert.equal(q.length, 4);
  for (const v of q) {
    assert.ok(v.from.length > 0, 'who asked');
    assert.ok(v.reward.length > 10, `what it pays: ${v.reward}`);
    assert.ok(DUNGEON_BY_ID[v.dungeon], 'its dungeon is known to the details');
  }
  assert.match(q[1].reward, /75 coins/);
  assert.match(q[2].reward, /Black Blade/);
});

test("a hunt carries its quarry, and a saga its whole story so far, for their details", () => {
  const s = plainGame('details-hunts');
  const h = postHunt(s, new Rng(4), 'dire_pack');
  assert.ok(h, 'a hunt posted');
  const hv = snapshot(s).hunts.hunts[0];
  assert.equal(hv.quarry, 'dire_pack');
  assert.ok(QUARRY_BY_ID[hv.quarry].foes, 'its foes are known to the details');
  const run = beginSaga(s, 'burnt_cart');
  assert.ok(run, 'a saga begun');
  run!.log.push('One.', 'Two.', 'Three.', 'Four.', 'Five.');
  const g = snapshot(s).sagas.open[0];
  assert.ok(g.story.length >= 5, 'the whole story, not just the last lines');
  assert.ok(g.began >= 1, 'the day it began');
  assert.ok(g.blurb.length > 0);
});
