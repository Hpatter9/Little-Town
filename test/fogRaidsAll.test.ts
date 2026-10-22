import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPOTTED_LEAD_TICKS } from '../src/shared/data/raidSight';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { launchHost, musterHost, realm } from '../src/shared/sim/factions';
import { leadAfterSeen, raidNews, raidPromptWords } from '../src/shared/sim/raidSight';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { Rng } from '../src/shared/rng';
import { updateFog } from '../src/shared/sim/fog';
import type { GameState } from '../src/shared/sim/state';
import { clearAround, plainGame } from './helpers';

function foggyTown(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  clearAround(s, 40);
  s.land.open = 60;
  updateFog(s);
  assert.ok(s.explored, 'the fog has started');
  return s;
}

function seenAfter(s: GameState): number {
  const sim = new Sim(s);
  for (let i = 0; i < 6000 && s.raid?.veil; i++) sim.step();
  return s.tick;
}

test('a war host sets out unseen, and is announced when seen', () => {
  const s = foggyTown('fograids-host');
  s.era = 'medieval';
  s.battles = true;
  for (const f of realm(s)) f.known = true;
  const foe = realm(s)[0];
  foe.stance = 'war';
  foe.troops = 100;
  musterHost(s, foe);
  const r = launchHost(s, foe, new Rng(4))!;
  assert.ok(r.veil, 'veiled');
  assert.equal(r.prompt, null);
  assert.equal(snapshot(s).raid, null);
  assert.ok(r.veil!.news?.length, 'its "is here" line is kept back');
});

test('a sea raid sets out unseen, with a sign of sails', () => {
  const s = foggyTown('fograids-sea');
  const r = startRaid(s, RAID_KIND_BY_ID.sea_reavers, 30, new Rng(5), undefined, undefined, true);
  assert.ok(r.veil);
  assert.equal(r.prompt, null);
  assert.equal(snapshot(s).raid, null);
});

test('a source\'s own title and words wait for the sighting', () => {
  const s = foggyTown('fograids-words');
  s.people = [];
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  raidPromptWords(s, r, 'The Dark Rider', 'A saga comes.');
  raidNews(s, r, 'Kept back.');
  assert.equal(s.prompts.length, 0);
  // someone stands at the edge and sees it
  const p = plainGame('x').people[0];
  s.people = [{ ...p, x: s.land.camp.x * 32, y: s.land.camp.y * 32 }];
  seenAfter(s);
  assert.equal(s.prompts[0]?.title, 'The Dark Rider');
  assert.match(s.prompts[0].text, /^A saga comes\./);
});

test('once seen, even an unwatched town has the full lead time', () => {
  assert.equal(SPOTTED_LEAD_TICKS, 300, '30 seconds at 10 ticks a second');
  const s = foggyTown('fograids-lead');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  r.arrivesTick = s.tick + 5; // seen only when it is nearly at the gate
  assert.equal(leadAfterSeen(s, r), s.tick + SPOTTED_LEAD_TICKS);
  r.arrivesTick = s.tick + 5000; // seen far out: the sooner warning stands
  assert.equal(leadAfterSeen(s, r), s.tick + 5000);
});
