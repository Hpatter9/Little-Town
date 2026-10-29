import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { ally } from '../src/shared/sim/classes';
import { adoptCreature, creatureAllies, creatureMaxHp, creatureRaidOver } from '../src/shared/sim/creature';
import { before, credit, creditAlly, felledWords, noteRoll, raidRecap } from '../src/shared/sim/raidRecap';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { campXY, makePerson, type GameState, type Raid, type Raider } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.tick = 30 * TICKS_PER_DAY;
  for (let i = 1; i < 4; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'hunter', campXY(s), s.people.map((q) => q.name)));
  return s;
}

const fakeRaid = (s: GameState): Raid => ({ id: s.nextId++, kind: 'bandits', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 0, raiders: [], prompt: null }) as unknown as Raid;

/** One blow: `rd` struck down (or hurt by `dmg`), credited to whoever `by` is. */
function blow(s: GameState, rd: Raider, by: (was: [Raider, number, boolean][]) => void, dmg?: number): void {
  const was = before(s.raid!.raiders);
  rd.hp = dmg === undefined ? 0 : Math.max(0, rd.hp - dmg);
  if (rd.hp === 0) rd.down = true;
  by(was);
}

test('the raid recap has a row for the God creature: what it felled, the harm it did, its wounds; it can fight best', () => {
  const s = town('beast-recap');
  s.autopilot = true;
  const c = adoptCreature(s, 'wolf');
  c.size = 1;
  c.hp = creatureMaxHp(c);
  const r = fakeRaid(s);
  s.raid = r;
  noteRoll(s, r);
  assert.ok(creatureAllies(s, r, (k) => ally(s, k, 0, 1)));
  const a = r.raiders.find((rd) => rd.creature)!;
  const foes = ['bandit', 'bandit', 'bandit_archer', 'bandit'].map((k) => {
    const rd = ally(s, k, 10, -1);
    rd.ally = false;
    r.raiders.push(rd);
    return rd;
  });
  // (the wolf fells three; a townsperson one, and only a little harm)
  for (const rd of foes.slice(0, 3)) blow(s, rd, (was) => creditAlly(s, a, was));
  const p = s.people[1];
  blow(s, foes[3], (was) => credit(s, p.id, was, false));
  // (a blow by some other ally is not the creature's)
  const other = ally(s, 'bandit', 0, 1);
  blow(s, foes[0], (was) => creditAlly(s, other, was), 1);
  a.hp -= 30;
  creatureRaidOver(s, r);
  s.raid = null;
  const recap = raidRecap(s, r, 'Bandits', { outcome: 'victory', boss: null, killed: 4, came: 4, prisoners: 0, stolen: {}, spoils: {} });
  const b = recap.beast;
  assert.ok(b, 'the creature has its row');
  assert.equal(b.name, `${c.name} the Wolf`);
  assert.equal(b.kills, 3);
  assert.ok(b.dealt > 100, `harm dealt (${b.dealt})`);
  assert.equal(b.taken, 30, 'its wounds');
  assert.equal(b.felled, 'two bandits and a bandit archer');
  assert.ok(!b.fell && !b.died);
  assert.ok(recap.beastBest, 'it fought best');
  assert.equal(recap.best, p.id, 'the best townsperson is still noted');
  assert.ok(recap.story.includes(`${b.name} fought best. It killed two bandits and a bandit archer and did ${b.dealt} damage.`), recap.story.join(' | '));
  assert.ok(recap.story.some((l) => l.startsWith(`Of the townsfolk, ${p.name} fought best`)), recap.story.join(' | '));
  assert.ok(recap.story.some((l) => l === `${b.name} took 30 damage and stayed on its feet.`), recap.story.join(' | '));
  assert.ok(recap.rows.every((x) => x.id >= 0), 'the rows stay the townsfolk');
});

test('the God creature beaten down, or fighting less than a townsperson, is told so', () => {
  const s = town('beast-recap-2');
  s.autopilot = true;
  const c = adoptCreature(s, 'bear');
  c.size = 1;
  c.hp = creatureMaxHp(c);
  const r = fakeRaid(s);
  s.raid = r;
  noteRoll(s, r);
  creatureAllies(s, r, (k) => ally(s, k, 0, 1));
  const a = r.raiders.find((rd) => rd.creature)!;
  const foes = [0, 1, 2].map(() => {
    const rd = ally(s, 'bandit', 10, -1);
    rd.ally = false;
    r.raiders.push(rd);
    return rd;
  });
  const p = s.people[1];
  blow(s, foes[0], (was) => credit(s, p.id, was, false));
  blow(s, foes[1], (was) => credit(s, p.id, was, false));
  blow(s, foes[2], (was) => creditAlly(s, a, was), 20);
  a.hp = 0;
  a.down = true;
  creatureRaidOver(s, r);
  const recap = raidRecap(s, r, 'Bandits', { outcome: 'driven', boss: null, killed: 2, came: 3, prisoners: 0, stolen: {}, spoils: {} });
  const b = recap.beast!;
  assert.ok(b.fell && !recap.beastBest);
  assert.equal(b.taken, creatureMaxHp(c));
  assert.ok(recap.story.some((l) => l.startsWith(`${p.name} fought best`)));
  assert.ok(recap.story.some((l) => l === `${b.name} fought beside them, and did 20 damage.`), recap.story.join(' | '));
  assert.ok(recap.story.some((l) => (b.died ? l === `${b.name} was killed in the fight.` : l.startsWith(`${b.name} was beaten down`))), recap.story.join(' | '));
});

test('felled raiders told in words', () => {
  assert.equal(felledWords({}), '');
  assert.equal(felledWords({ wolf: 1 }), 'a wolf');
  assert.equal(felledWords({ wolf: 3, orc_grunt: 1 }).split(' and ')[0], 'three wolves');
});

test('in a real raid the God creature that went out has a row in the recap', () => {
  const s = town('beast-recap-raid');
  s.battles = true;
  s.autoBattle = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  const c = adoptCreature(s, 'bear');
  c.size = 1;
  c.hp = creatureMaxHp(c);
  s.autopilot = true;
  for (const p of s.people) p.priorities.defend = 1;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 200, new Rng(1));
  assert.ok(r.raiders.some((rd) => rd.creature), 'it went out');
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 12 * TICKS_PER_HOUR && !s.raidRecap; i++) sim.step();
  const b = s.raidRecap?.beast;
  assert.ok(b, 'its row');
  assert.ok(b.name.startsWith(c.name));
  assert.ok(b.dealt > 0, 'its blows on the board counted');
  const kills = (s.raidRecap!.rows.reduce((t, x) => t + x.kills, 0) ?? 0) + (s.raidRecap!.towers?.kills ?? 0) + b.kills;
  assert.ok(kills <= s.raidRecap!.killed + 1, `no more felled than fell (${kills} of ${s.raidRecap!.killed})`);
  if (b.kills) assert.ok(s.raidRecap!.story.some((l) => l.startsWith(b.name)), s.raidRecap!.story.join(' | '));
});
