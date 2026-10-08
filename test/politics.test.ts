import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { COUNCIL_HOUR, LAW_BY_ID, OVERRULE_COST, REVOLT_OPTIONS, STRIKE_AT } from '../src/shared/data/politics';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { blocMood, blocOf, callVote, crime, lawOn, membersOf, politicsHourly, politicsOf, striking, targetOf, trial, unrest } from '../src/shared/sim/politics';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { mood } from '../src/shared/sim/townsfolk';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
const lucky = (seed: number, yes: boolean) => Object.assign(new Rng(seed), { chance: () => yes }) as Rng;

/** A self-running town of `n` grown-ups, one of each sort of bloc. */
function town(seed: string, n = 8): GameState {
  const s = plainGame(seed);
  const rng = new Rng(4);
  const c = s.people[0];
  const ambitions = ['crafter', 'farmer', 'guard', 'scholar', 'farmer', 'keeper', 'adventurer', 'homebody', 'farmer', 'farmer'] as const;
  while (s.people.length < n) {
    const p = makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name));
    p.ambition = ambitions[(s.people.length - 1) % ambitions.length];
    p.nature = 'cheerful';
    s.people.push(p);
  }
  s.autopilot = true;
  s.coins = 100;
  return s;
}

test('the grown-ups fall into blocs (never the founder), and each bloc has its own satisfaction', () => {
  const s = town('pol-blocs');
  assert.equal(blocOf(s, s.people[0]), null, 'the founder rules');
  const blocs = new Set(s.people.slice(1).map((p) => blocOf(s, p)));
  for (const b of ['guilds', 'devout', 'soldiers', 'commons'] as const) assert.ok(blocs.has(b), b);
  const pol = politicsOf(s);
  assert.equal(pol.laws.length, 0);
  // the tax and the laws pull on them
  s.tax = 'heavy';
  const heavy = targetOf(s, 'commons');
  s.tax = 'low';
  assert.ok(targetOf(s, 'commons') > heavy, 'the commons hate a heavy tax');
  pol.laws.push('poor_relief');
  assert.ok(targetOf(s, 'commons') > targetOf(s, 'guilds'), 'poor relief pleases the commons, not the guilds');
  // and it shows in their spirits
  pol.sat.commons = 10;
  const p = s.people.find((q) => blocOf(s, q) === 'commons')!;
  assert.ok(blocMood(s, p)!.value < 0);
  assert.ok(mood(s, p).reasons.some((r) => r.text === 'The commons are angry'));
});

test('the council votes on what the unhappiest bloc asks; the player may let it stand or overrule it', () => {
  const s = town('pol-council');
  const pol = politicsOf(s);
  pol.sat.commons = 10;
  s.tick = at(6, COUNCIL_HOUR);
  politicsHourly(s);
  const q = s.prompts.find((x) => x.kind === 'council');
  assert.ok(q && pol.vote, 'a vote is called');
  assert.equal(pol.vote!.by, 'commons');
  const law = pol.vote!.law!;
  assert.ok(LAW_BY_ID[law].stance.commons === 1, 'they ask for a law they want');
  const passes = pol.vote!.passes;
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(lawOn(s, law), passes, 'let stand, the vote decides');
  // overruled: it goes the other way, and the side that won pays
  const t = town('pol-overrule');
  callVote(t, 'devout', { law: 'temple_tithe' });
  const v = politicsOf(t).vote!;
  const before = { ...politicsOf(t).sat };
  answerPrompt(t, v.prompt, 1, new Rng(1));
  assert.equal(lawOn(t, 'temple_tithe'), !v.passes, 'overruled');
  if (v.passes) assert.equal(politicsOf(t).sat.devout, before.devout - OVERRULE_COST, 'the winners are sore');
});

test('crime comes by night; a culprit caught is tried, and the sentence is carried out', () => {
  const s = town('pol-crime');
  s.tick = at(6, 2);
  crime(s, lucky(2, true));
  const pol = politicsOf(s);
  assert.equal(pol.crimes, 1);
  assert.ok(pol.trial, 'caught, and a trial called');
  const q = s.prompts.find((x) => x.kind === 'trial')!;
  const culprit = s.people.find((p) => p.id === pol.trial!.who)!;
  const exile = pol.trial!.options.indexOf('exile');
  answerPrompt(s, q.id, exile, new Rng(1));
  assert.ok(!s.people.includes(culprit), 'exiled');
  // a murderer may hang
  const t = town('pol-murder');
  const victim = t.people[2];
  const killer: Person = t.people[3];
  trial(t, killer, 'murder', `murdered ${victim.name}`, victim);
  const tq = t.prompts.find((x) => x.kind === 'trial')!;
  assert.ok(politicsOf(t).trial!.options.includes('hang'));
  answerPrompt(t, tq.id, politicsOf(t).trial!.options.indexOf('hang'), new Rng(1));
  assert.ok(!t.people.includes(killer), 'hanged');
  // a fine goes to the treasury
  const u = town('pol-fine');
  const thief = u.people[4];
  thief.coins = 30;
  trial(u, thief, 'theft', 'stole 10 coins from the treasury');
  const coins = u.coins ?? 0;
  answerPrompt(u, u.prompts.find((x) => x.kind === 'trial')!.id, politicsOf(u).trial!.options.indexOf('fine'), new Rng(1));
  assert.ok((u.coins ?? 0) > coins && thief.coins! < 30);
});

test('a bloc pushed too far strikes: its members stop work and gather; a town ruled badly rises', () => {
  const s = town('pol-strike');
  const pol = politicsOf(s);
  pol.sat.commons = STRIKE_AT - 10;
  s.tick = at(6, 12);
  for (let i = 0; i < 6 && !pol.strike; i++) unrest(s, lucky(i, true));
  assert.ok(pol.strike, 'a strike');
  const striker = membersOf(s, pol.strike!.bloc)[0];
  assert.ok(striking(s, striker));
  assert.equal(snapshot(s).politics?.strike?.bloc, 'The commons');
  // ruled badly: a revolt, and stepping down hands the town to another
  const r = town('pol-revolt');
  const rp = politicsOf(r);
  for (const b of ['guilds', 'devout', 'soldiers', 'commons'] as const) rp.sat[b] = 5;
  r.tick = at(8, 12);
  unrest(r, lucky(1, true));
  const q = r.prompts.find((x) => x.kind === 'revolt');
  assert.ok(q && rp.revolt, 'the town rises');
  const old = r.mainId;
  answerPrompt(r, q.id, REVOLT_OPTIONS.indexOf('Step down'), new Rng(1));
  assert.notEqual(r.mainId, old, 'someone else leads');
  assert.ok(rp.sat.commons > 5);
  // giving way lowers the tax and repeals what they hated
  const g = town('pol-give');
  const gp = politicsOf(g);
  gp.laws.push('harsh_law');
  g.tax = 'heavy';
  for (const b of ['guilds', 'devout', 'soldiers', 'commons'] as const) gp.sat[b] = 5;
  g.tick = at(8, 12);
  unrest(g, lucky(1, true));
  answerPrompt(g, g.prompts.find((x) => x.kind === 'revolt')!.id, 0, new Rng(1));
  assert.equal(g.tax, 'low');
});

test('the laws do their work: a curfew keeps people from the tavern, poor relief feeds the poor', () => {
  const s = town('pol-laws');
  const pol = politicsOf(s);
  pol.laws.push('poor_relief');
  const poor = s.people[2];
  poor.coins = 0;
  s.tick = at(6, 6);
  politicsHourly(s);
  assert.ok((poor.coins ?? 0) > 0, 'poor relief');
  assert.ok(snapshot(s).politics!.laws.find((l) => l.id === 'poor_relief')!.on);
});
