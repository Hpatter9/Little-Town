import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { RECAP_HOURS } from '../src/shared/sim/raidRecap';
import { plainGame } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.autoBattle = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < 4; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    s.people.push(p);
  }
  s.people[0].priorities.defend = 1;
  return s;
}

test('a raid ends with a recap: who fought, the harm they dealt and took, the raiders felled, what was won or lost', () => {
  const s = town('recap-1');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 12 * TICKS_PER_HOUR && !s.raidRecap; i++) sim.step();
  const c = s.raidRecap;
  assert.ok(c, 'a recap');
  assert.equal(c.came, r.raiders.filter((rd) => !rd.ally).length);
  assert.ok(c.killed + c.fled + c.through >= c.came - 1, `everyone accounted for (${c.killed}/${c.fled}/${c.through} of ${c.came})`);
  assert.ok(c.rows.length > 0, 'the defenders are listed');
  const dealt = c.rows.reduce((t, x) => t + x.dealt, 0) + (c.towers?.dealt ?? 0);
  assert.ok(dealt > 0, 'harm was dealt');
  const kills = c.rows.reduce((t, x) => t + x.kills, 0) + (c.towers?.kills ?? 0);
  assert.ok(kills <= c.killed + 1 && kills >= Math.min(1, c.killed), `felled ${kills} of ${c.killed}`);
  if (c.best !== null) assert.equal(c.rows[0].id, c.best, 'the best first');
  assert.ok(['victory', 'driven', 'pillaged'].includes(c.outcome));
  // and told: where they came from, how it ended, the one who fought hardest by name
  assert.ok(c.story.length >= 2, c.story.join(' '));
  assert.match(c.story[0], /came (out of the (west|east)|up out of the sea)/);
  const best = c.rows.find((x) => x.id === c.best);
  if (best) assert.ok(c.story.some((l) => l.startsWith(`${best.name} fought hardest`)), c.story.join(' '));
  // carried by the snapshot a while, then dropped
  assert.ok(snapshot(s).raidRecap, 'in the snapshot');
  s.tick += RECAP_HOURS * TICKS_PER_HOUR;
  assert.equal(snapshot(s).raidRecap, null);
});
