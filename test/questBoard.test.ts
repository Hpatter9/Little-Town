import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUNGEONS } from '../src/shared/data/dungeons';
import { HUNT_DAYS } from '../src/shared/data/hunts';
import { postHunt, huntDestinations } from '../src/shared/sim/hunts';
import { acceptQuest, AUTO_ACCEPT_HOURS, declineQuest, OFFER_HOURS, questBoardHourly } from '../src/shared/sim/questBoard';
import { questsDone, questsHourly, QUEST_DAYS } from '../src/shared/sim/quests';
import type { GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { campPx, plainGame } from './helpers';

/** A town that runs itself (offers wait for an answer), with every dungeon known and no raids. */
function town(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.cheats.unlockAll = true;
  s.regions = DUNGEONS.map((d) => d.region);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  for (const p of s.people) p.ambition = 'homebody';
  return s;
}

function offer(s: GameState) {
  for (let h = 0; h < 24 * 30 && !s.quests?.length; h++) {
    s.tick += TICKS_PER_HOUR;
    questsHourly(s);
  }
  assert.ok(s.quests?.length, 'a quest was offered');
  return s.quests![0];
}

test('a quest is first an offer; accepted, its time limit starts', () => {
  const s = town('board-accept');
  const q = offer(s);
  assert.equal(q.accepted, undefined, 'an offer');
  assert.equal(q.until - s.tick, OFFER_HOURS * TICKS_PER_HOUR, 'up for the offer window');
  assert.ok(acceptQuest(s, 'quest', q.id));
  assert.equal(q.accepted, s.tick);
  assert.equal(q.until - s.tick, QUEST_DAYS * TICKS_PER_DAY, 'the time limit');
  assert.equal(acceptQuest(s, 'quest', q.id), false, 'not twice');
});

test('an offer unanswered lapses; declined, it is gone at once; both are logged', () => {
  const s = town('board-lapse');
  const q = offer(s);
  s.tick = q.until;
  questBoardHourly(s);
  assert.ok(!s.quests!.length, 'lapsed');
  assert.equal(s.questLog![0].end, 'lapsed');
  const q2 = offer(s);
  assert.ok(declineQuest(s, 'quest', q2.id));
  assert.ok(!s.quests!.length);
  assert.equal(s.questLog![0].end, 'declined');
});

test('an accepted quest out of time fails, and the town feels it', () => {
  const s = town('board-fail');
  const q = offer(s);
  acceptQuest(s, 'quest', q.id);
  s.tick = q.until;
  questBoardHourly(s);
  assert.ok(!s.quests!.length);
  assert.equal(s.questLog![0].end, 'failed');
  assert.ok(s.marks?.some((m) => m.lever === 'morale' && m.value < 0 && /failed/.test(m.text ?? '')));
});

test('only an accepted quest pays', () => {
  const s = town('board-pay');
  const until = s.tick + TICKS_PER_DAY;
  s.quests = [
    { id: 1, kind: 'bounty', dungeon: 'barrow_crypt', from: 'a', title: 'Offer', text: 't', coins: 80, until },
    { id: 2, kind: 'bounty', dungeon: 'barrow_crypt', from: 'b', title: 'Taken', text: 't', coins: 50, until, accepted: s.tick },
  ];
  const coins = s.coins ?? 0;
  questsDone(s, 'barrow_crypt', campPx(s), new Rng(1));
  assert.equal((s.coins ?? 0) - coins, 50);
  assert.deepEqual(s.quests.map((q) => q.id), [1], 'the offer stays');
  assert.equal(s.questLog![0].end, 'done');
});

test('with an adventurer at home, the town takes an unanswered offer up itself', () => {
  const s = town('board-auto');
  s.people[0].ambition = 'adventurer';
  const q = offer(s);
  for (let h = 0; h < AUTO_ACCEPT_HOURS && q.accepted === undefined; h++) {
    s.tick += TICKS_PER_HOUR;
    questBoardHourly(s);
  }
  assert.ok(q.accepted !== undefined, 'taken up');
});

test('a hunt is an offer too, and only an accepted one is on the board for the parties', () => {
  const s = town('board-hunt');
  const h = postHunt(s, new Rng(2), 'wolf_pack') ?? postHunt(s, new Rng(2));
  assert.ok(h);
  assert.equal(huntDestinations(s).length, 0, 'not on the board yet');
  acceptQuest(s, 'hunt', h!.id);
  assert.equal(huntDestinations(s).length, 1);
  assert.equal(h!.until - s.tick, HUNT_DAYS * TICKS_PER_DAY);
});
