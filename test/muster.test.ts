import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardDestinations, dangerOf } from '../src/shared/sim/parties';
import { destinationUnlocked, updateExpeditions } from '../src/shared/sim/expeditions';
import { addMember, order, persuade, raiseParty, sendMuster, setMuster, willing } from '../src/shared/sim/muster';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { ENEMY } from '../src/shared/data/social';
import { relationsChanged } from '../src/shared/sim/social';
import { maxHp, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

// Sending a party yourself (sim/muster.ts): a leader steps up, people may say no and be talked round or ordered, the
// party asks on the road, and is debriefed at home.

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition: 'farmer', partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.people[1].ambition = 'adventurer';
  s.coins = 500;
  return s;
}
const dangerous = (s: GameState) => boardDestinations(s).find((d) => destinationUnlocked(s, d) && dangerOf(d) > 0 && d.type !== 'delve')!;

test('raising a party: an adventurer leads, with a party of the willing; the founder is never refused', () => {
  const s = town('muster1', 6);
  const d = dangerous(s);
  assert.ok(raiseParty(s, d.id).ok);
  const m = s.muster!;
  assert.equal(m.leader, s.people[1].id, 'the adventurer leads');
  assert.ok(m.members.length >= 1);
  for (const id of m.members) assert.equal(willing(s, m, s.people.find((p) => p.id === id)!), null, 'only the willing are picked');
  assert.equal(willing(s, m, s.people[0]), null, 'the founder answers to you');
});

test('someone who says no can be talked round with coins, or ordered along and resent it', () => {
  const s = town('muster2', 6);
  const d = dangerous(s);
  raiseParty(s, d.id);
  const m = s.muster!;
  m.members = [m.leader];
  // an enemy of the leader won't go
  const grudge = s.people.find((p) => p.id !== m.leader && p.id !== s.mainId)!;
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  s.relations[key(grudge.id, m.leader)] = ENEMY - 5;
  relationsChanged(s);
  assert.ok(!addMember(s, grudge.id).ok, 'they say no');
  const price = m.refused[grudge.id].price!;
  assert.ok(price > 0);
  const coins = s.coins!;
  const purse = grudge.coins ?? 0;
  assert.ok(persuade(s, grudge.id).ok);
  assert.ok(m.members.includes(grudge.id), 'talked round, they come');
  assert.equal(s.coins, coins - price);
  assert.equal(grudge.coins, purse + price, 'the coins went to them');
  // someone hurt can only be ordered
  const hurt = s.people.find((p) => p.id !== s.mainId && !m.members.includes(p.id))!;
  hurt.hp = maxHp(hurt) * 0.3;
  assert.ok(!addMember(s, hurt.id).ok);
  assert.equal(m.refused[hurt.id].price, null, 'no price for the hurt');
  assert.ok(order(s, hurt.id).ok);
  assert.ok(m.members.includes(hurt.id));
  assert.ok(hurt.sore && hurt.sore.value < 0, 'ordered along, they resent it');
});

test('a commanded party asks on the road, and is debriefed when it is home', () => {
  const s = town('muster3', 6);
  const d = dangerous(s);
  raiseParty(s, d.id);
  setMuster(s, { rations: 'plenty', stakes: 'safe' });
  assert.ok(sendMuster(s).ok);
  assert.equal(s.muster, undefined);
  const e = s.expeditions[0];
  assert.ok(e.ordered && e.start, 'marked as commanded, with how they set out');
  const rng = new Rng(3);
  let asked = 0;
  for (let t = 0; t < 400 * TICKS_PER_HOUR && s.expeditions.length; t++) {
    s.tick++;
    updateExpeditions(s, rng);
    for (const p of [...s.prompts]) {
      if (p.kind === 'road') asked++;
      if (p.kind !== 'debrief') answerPrompt(s, p.id, p.defaultOption, rng);
    }
    for (const p of s.people) p.needs = { food: 1, rest: 1 };
  }
  assert.ok(asked >= 1, 'asked at least once on the road');
  assert.ok(asked <= 2, 'at most twice');
  const debrief = s.prompts.find((p) => p.kind === 'debrief');
  assert.ok(debrief, 'a debrief waits at home');
  assert.match(debrief!.story!, /home from/);
});
