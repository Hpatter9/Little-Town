import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { CHASE_FIGHTERS, CHASE_GAP, CHASE_WOUNDED, canChase, giveChase, noteFugitives } from '../src/shared/sim/chase';
import { stepTactics } from '../src/shared/sim/tactics';
import { makePerson, type GameState, type Raid } from '../src/shared/sim/state';
import { plainGame } from './helpers';

function town(seed: string, n = 8): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.battles = true;
  s.battleStyle = 'tactics';
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    p.skills.melee.level = 8;
    s.people.push(p);
  }
  return s;
}

/** A raid that has ended with its raiders gone, three of them with loot in their packs. */
function escaped(s: GameState): Raid {
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 40, new Rng(3));
  r.raiders = r.raiders.slice(0, 3);
  r.raiders.forEach((rd) => {
    rd.gone = true;
    rd.carrying = { wood: 5 };
  });
  return r;
}

test('raiders who got away are offered for a chase, wounded, with their loot', () => {
  const s = town('chase-offer');
  const r = escaped(s);
  s.raid = null;
  noteFugitives(s, r, 'Bandits');
  assert.ok(canChase(s));
  assert.equal(s.chaseOffer!.runners.length, 3);
  // (a chase for a town with the autopilot off, or a raid whose survivors were spared, is not offered)
  s.chaseOffer = undefined;
  r.mercy = 'spared';
  noteFugitives(s, r, 'Bandits');
  assert.ok(!s.chaseOffer);
});

test('the chase starts close and the town goes first', () => {
  const s = town('chase-start');
  const r = escaped(s);
  s.raid = null;
  noteFugitives(s, r, 'Bandits');
  assert.ok(giveChase(s));
  const c = s.raid!;
  assert.ok(c.chase);
  const t = c.tactics!;
  const foes = t.units.filter((u) => u.foe);
  const folk = t.units.filter((u) => !u.foe);
  assert.equal(foes.length, 3);
  assert.ok(folk.length <= CHASE_FIGHTERS && folk.length > 0);
  // close: the nearest of the town is only a few tiles from the nearest fugitive
  const gap = Math.min(...folk.map((f) => Math.min(...foes.map((e) => Math.abs(f.u - e.u) + Math.abs(f.v - e.v)))));
  assert.ok(gap <= CHASE_GAP + 2, `gap ${gap}`);
  assert.ok(t.broken, 'the fugitives are already running');
  // wounded, and still carrying
  for (const rd of c.raiders) {
    assert.ok(rd.hp <= Math.ceil(rd.maxHp * CHASE_WOUNDED));
    assert.equal(rd.carrying.wood, 5);
  }
  // the town goes first: every town unit's charge is full and every raider's is not
  assert.ok(folk.every((u) => u.ct >= 100));
  assert.ok(foes.every((u) => u.ct < 100));
  s.tacticsAuto = true;
  t.auto = true;
  stepTactics(s, c, new Rng(1));
  const first = t.act ?? t.await;
  assert.ok(first && first.key[0] === 'p', 'a townsperson takes the first turn');
});

test('a chase plays out: those caught give their loot back, and the raid is over', () => {
  const s = town('chase-loot');
  const r = escaped(s);
  s.raid = null;
  noteFugitives(s, r, 'Bandits');
  const before = s.buildings.reduce((n, b) => n + (b.store.wood ?? 0), 0);
  giveChase(s);
  for (let i = 0; i < 20000 && s.raid; i++) {
    s.tick++;
    updateRaid(s, new Rng(i));
  }
  assert.equal(s.raid, null, 'the chase ends');
  const caught = r.raiders.length; // (the originals are untouched)
  assert.equal(caught, 3);
  const after = s.buildings.reduce((n, b) => n + (b.store.wood ?? 0), 0);
  const down = s.tacticsEnded!.raid.raiders.filter((rd) => rd.down).length;
  assert.ok(down > 0, 'a quick party catches some');
  assert.ok(after >= before + down * 5, 'what they carried is back in the stores');
  assert.ok(!canChase(s), 'the offer is spent');
});
