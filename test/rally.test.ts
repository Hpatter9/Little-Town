import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { canRally, rally, rallyState, RALLY_COOLDOWN, RALLY_TICKS } from '../src/shared/sim/rally';
import { defenderAttack, startRaid } from '../src/shared/sim/raids';
import { snapshot } from '../src/shared/sim/snapshot';
import { maxHp } from '../src/shared/sim/state';
import { plainGame } from './helpers';

function fight(seed: string) {
  const s = plainGame(seed);
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  raid.phase = 'active';
  s.raid = raid;
  const p = s.people[0];
  p.task = { type: 'defend', cooldown: 0 } as never;
  return { s, p, rd: raid.raiders[0] };
}

test('a defender can be rallied in a raid, once in a while: a second wind, and harder blows', () => {
  const { s, p, rd } = fight('rally');
  p.hp = 10;
  assert.equal(rallyState(s, p), 'ready');
  assert.ok(rally(s, p.id));
  assert.ok(p.hp > 10, 'a second wind');
  assert.equal(snapshot(s).people.find((q) => q.id === p.id)!.rally, 'on');
  // (the rest of the town waits for the next rally)
  assert.equal(rally(s, p.id), false);
  // harder blows: the same swings do more rallied than not
  const skills = JSON.stringify(p.skills);
  const hits = (rallied: boolean) => {
    p.skills = JSON.parse(skills); // (each swing trains them: both runs start alike)
    p.rallied = rallied ? s.tick + RALLY_TICKS : undefined;
    rd.hp = rd.maxHp = 100_000;
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) defenderAttack(s, p, rd, rng);
    return 100_000 - rd.hp;
  };
  const plain = hits(false);
  assert.ok(plain > 0);
  assert.ok(hits(true) > plain * 1.3, 'harder blows');
  s.tick += RALLY_COOLDOWN;
  p.rallied = undefined;
  assert.ok(canRally(s, p), 'ready again after the cooldown');
});

test('no rallying outside a fight, or someone who is not defending', () => {
  const s = plainGame('calm');
  const p = s.people[0];
  assert.equal(rallyState(s, p), null);
  assert.equal(rally(s, p.id), false);
  const f = fight('bystander');
  f.p.task = null;
  assert.equal(rally(f.s, f.p.id), false);
  assert.ok(f.p.hp <= maxHp(f.p));
});
