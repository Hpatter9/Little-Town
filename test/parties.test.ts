import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { ENEMY } from '../src/shared/data/social';
import { boardDestinations, bountyOn, bountyStep, dangerOf, fitToGo, partiesHourly, payBounty, postBounty, proposeParty, setVeto, withdrawBounty } from '../src/shared/sim/parties';
import { opinion, relationsChanged, updateSocial } from '../src/shared/sim/social';
import { maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
function setOpinion(s: GameState, a: Person, b: Person, v: number) {
  s.relations[key(a.id, b.id)] = v;
  relationsChanged(s);
}
/** A town of `n` grown-ups beside the founder, all healthy, rested and fed, with the given ambition. */
function town(seed: string, n: number, ambition: Person['ambition'] = 'farmer'): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition, partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.tick = TICKS_PER_HOUR; // 8 in the morning
  return s;
}
/** Leave only one destination open to the parties (the Berry Thicket: near, and gentle). */
function onlyThicket(s: GameState) {
  for (const d of boardDestinations(s)) if (d.id !== 'berry_thicket') setVeto(s, d.id, true);
}

test('an adventurer gathers a party and sets out on their own; the founder and guards stay home', () => {
  const s = town('party1', 6);
  s.people[1].ambition = 'adventurer';
  s.people[2].guard = true;
  onlyThicket(s);
  s.autopilot = undefined;
  partiesHourly(s);
  assert.equal(s.expeditions.length, 1, 'a party went');
  const e = s.expeditions[0];
  assert.equal(e.dest, 'berry_thicket');
  assert.equal(e.leader, s.people[1].id);
  assert.ok(!e.members.includes(s.mainId), 'the founder stays home');
  assert.ok(!e.members.includes(s.people[2].id), 'the guard stays home');
});

test('no adventurer and no bounty: no party forms; the autopilot off: none either', () => {
  const s = town('party2', 6);
  onlyThicket(s);
  assert.equal(proposeParty(s), null);
  s.people[1].ambition = 'adventurer';
  s.autopilot = false;
  partiesHourly(s);
  assert.equal(s.expeditions.length, 0);
});

test('a forbidden place is never chosen', () => {
  const s = town('party3', 6);
  s.people[1].ambition = 'adventurer';
  for (const d of boardDestinations(s)) setVeto(s, d.id, true);
  assert.equal(proposeParty(s), null);
  setVeto(s, 'berry_thicket', false);
  assert.equal(proposeParty(s)?.dest, 'berry_thicket');
});

test('the hurt, the tired and those just home rest first', () => {
  const s = town('party4', 6);
  const a = s.people[1];
  a.ambition = 'adventurer';
  a.hp = maxHp(a) * 0.5;
  assert.equal(fitToGo(s, a), false, 'hurt');
  a.hp = maxHp(a);
  a.needs.rest = 0.2;
  assert.equal(fitToGo(s, a), false, 'tired');
  a.needs.rest = 1;
  a.homeAt = s.tick - TICKS_PER_HOUR;
  assert.equal(fitToGo(s, a), false, 'just home');
  a.homeAt = s.tick - 30 * TICKS_PER_HOUR;
  assert.equal(fitToGo(s, a), true);
});

test('enemies never go together; the devoted go along', () => {
  const s = town('party5', 8);
  const lead = s.people[1];
  lead.ambition = 'adventurer';
  const foe = s.people[2];
  const dear = s.people[3];
  for (const p of s.people.slice(2)) p.level = 30; // (all strong: the choice is by liking, not strength)
  dear.level = 1;
  setOpinion(s, lead, foe, ENEMY - 5);
  setOpinion(s, lead, dear, 95);
  // (a place that wants a party of three or more)
  const fight = DESTINATIONS.find((d) => d.id !== 'berry_thicket' && dangerOf(d) > 0 && !d.research && !d.era && !d.coins)!;
  for (const d of boardDestinations(s)) if (d.id !== fight.id) setVeto(s, d.id, true);
  const plan = proposeParty(s);
  assert.ok(plan, 'a party forms');
  assert.ok(!plan!.members.includes(foe.id), 'not the enemy');
  assert.ok(plan!.members.includes(dear.id), 'the devoted friend comes, weak as they are');
});

test('a bounty: set aside from the treasury, draws the adventurers, and is paid to the party that does the job', () => {
  const s = town('party6', 6);
  onlyThicket(s);
  // (no adventurer: a bounty alone sends nobody)
  s.coins = 999;
  postBounty(s, 'berry_thicket');
  assert.equal(proposeParty(s), null, 'nobody leads without an adventurer');
  withdrawBounty(s, 'berry_thicket');
  s.people[1].ambition = 'adventurer';
  const step = bountyStep(s);
  s.coins = step * 3;
  assert.ok(postBounty(s, 'berry_thicket').ok);
  assert.equal(s.coins, step * 2);
  assert.equal(bountyOn(s, 'berry_thicket'), step);
  s.autopilot = undefined;
  partiesHourly(s);
  assert.equal(s.expeditions.length, 1, 'the adventurer goes for the bounty');
  const e = s.expeditions[0];
  const members = e.members.map((id) => s.people.find((p) => p.id === id)!);
  const before = members.reduce((n, p) => n + (p.coins ?? 0), 0);
  payBounty(s, e, members);
  assert.equal(members.reduce((n, p) => n + (p.coins ?? 0), 0) - before, step, 'paid to the party');
  assert.equal(bountyOn(s, 'berry_thicket'), 0);
  // withdrawn: back to the treasury; forbidding a place takes its bounty back too
  postBounty(s, 'berry_thicket');
  withdrawBounty(s, 'berry_thicket');
  assert.equal(s.coins, step * 2);
  postBounty(s, 'berry_thicket');
  setVeto(s, 'berry_thicket', true);
  assert.equal(s.coins, step * 2);
  assert.equal(postBounty(s, 'berry_thicket').ok, false, 'no bounty on a forbidden place');
});

test('a recalled party earns no bounty', () => {
  const s = town('party7', 4);
  s.people[1].ambition = 'adventurer';
  onlyThicket(s);
  s.coins = 500;
  postBounty(s, 'berry_thicket');
  s.autopilot = undefined;
  partiesHourly(s);
  const e = s.expeditions[0];
  e.recalled = true;
  const members = e.members.map((id) => s.people.find((p) => p.id === id)!);
  payBounty(s, e, members);
  assert.ok(bountyOn(s, 'berry_thicket') > 0, 'still posted');
});

test('enemies side by side may come to blows', () => {
  const s = town('party8', 2);
  const [a, b] = [s.people[1], s.people[2]];
  b.x = a.x;
  b.y = a.y;
  s.people[0].x += 2000; // (the founder well away)
  let fought = false;
  const rng = new Rng(7);
  for (let h = 0; h < 200 && !fought; h++) {
    setOpinion(s, a, b, -100);
    a.hp = maxHp(a);
    s.tick = (h + 1) * TICKS_PER_HOUR;
    updateSocial(s, rng);
    fought = !!a.sore;
  }
  assert.ok(fought, 'a brawl in 200 hours');
  assert.ok(a.hp < maxHp(a) && a.hp >= 1, 'hurt, never felled');
  assert.ok(opinion(s, a.id, b.id) <= ENEMY);
});

test('a founder and one companion stay home', () => {
  const s = town('party9', 1);
  s.people[1].ambition = 'adventurer';
  onlyThicket(s);
  assert.equal(proposeParty(s), null);
  const t = town('party10', 2);
  t.people[1].ambition = 'adventurer';
  onlyThicket(t);
  assert.ok(proposeParty(t), 'three grown-ups: one may go');
});

test('every town has an adventurer early: the first grown-up settled after the founder, while there is none', async () => {
  const { settleAmbitions } = await import('../src/shared/sim/ambition');
  const s = town('party11', 4);
  for (const p of s.people) p.ambition = undefined;
  settleAmbitions(s);
  assert.notEqual(s.people[0].ambition, 'adventurer', 'never the founder by this rule');
  assert.equal(s.people[1].ambition, 'adventurer', 'the first companion takes to the road');
  assert.equal(s.people.filter((p) => p.ambition === 'adventurer' && p.id !== s.mainId).length >= 1, true);
});
