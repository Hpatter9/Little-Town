// House intrigue (sim/intrigue.ts): rent and takings reach the owning house, a bought councillor swings a vote, an
// uncovered murder brings a trial, the founder is never a scheme's victim, and nothing runs without the autopilot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { SEAT_VOTES } from '../src/shared/data/intrigue';
import { LAW_BY_ID } from '../src/shared/data/politics';
import { Rng } from '../src/shared/rng';
import { dynastyOf, housesOf, rootOf } from '../src/shared/sim/dynasty';
import { houseCut, houseMurder, holdingsOf, intrigueHourly, intrigueOf, intrigueView, secretsAbout, uncoverPlot, wealthOf } from '../src/shared/sim/intrigue';
import { recordBirth } from '../src/shared/sim/lineage';
import { blocOf, callVote, politicsOf, stanceOn } from '../src/shared/sim/politics';
import { collectRent } from '../src/shared/sim/property';
import { makePerson, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
/** The intrigue's hour (3am) of a day. */
const night = (s: GameState, day: number) => {
  s.tick = at(day, 3);
  intrigueHourly(s);
};

function adult(s: GameState, rng: Rng): Person {
  const p = makePerson(rng, s.nextId++, 'gatherer', { x: s.people[0].x + 10, y: s.people[0].y }, s.people.map((q) => q.name));
  p.coins = 0;
  s.people.push(p);
  return p;
}
/** A couple and a child: a house in the family record. */
function house(s: GameState, rng: Rng): { a: Person; b: Person; kid: Person; root: number } {
  const a = adult(s, rng);
  const b = adult(s, rng);
  a.partner = b.id;
  b.partner = a.id;
  const kid = adult(s, rng);
  kid.bornTick = s.tick;
  kid.parents = [a.id, b.id];
  recordBirth(s, kid, a, b);
  return { a, b, kid, root: rootOf(housesOf(s), a.id) };
}
const townReady = (s: GameState, rng: Rng, extra = 4) => {
  s.autopilot = true;
  for (let i = 0; i < extra; i++) adult(s, rng);
};
/** A finished lean-to in the town's hands. */
const lean = (s: GameState): Building => {
  const b: Building = { id: s.nextId++, def: 'lean_to', tile: 3, row: 3, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
};

test('without the autopilot nothing is made', () => {
  const s = plainGame('intr-off');
  const rng = new Rng(2);
  house(s, rng);
  for (let i = 0; i < 4; i++) adult(s, rng);
  for (let d = 9; d < 14; d++) night(s, d);
  assert.equal(s.intrigue, undefined);
  assert.equal(intrigueView(s), null);
});

test('rent and a till\'s takings flow to the owning house', () => {
  const s = plainGame('intr-rent');
  const rng = new Rng(5);
  townReady(s, rng);
  const { a, root } = house(s, rng);
  night(s, 9); // (the books are opened, and who is of which house)
  assert.ok(intrigueOf(s).books[root], 'the house has a book');
  const b = lean(s);
  b.owner = a.id;
  for (let i = 0; i < 4; i++) {
    const tenant = adult(s, rng);
    tenant.coins = 50;
    tenant.bed = b.id;
  }
  const before = intrigueOf(s).books[root].purse;
  const aBefore = a.coins ?? 0;
  collectRent(s);
  const st = intrigueOf(s);
  assert.ok(st.books[root].purse > before, 'rent reached the family chest');
  assert.ok((a.coins ?? 0) > aBefore, 'the landlord kept the rest');
  assert.equal(houseCut(s, s.people.find((p) => p.id === s.mainId)!, 100), 0, 'the founder\'s own takings are their own');
  assert.ok(wealthOf(s, root) >= st.books[root].purse);
});

test('a house with coin to spare buys what the town sells, and a debtor\'s', () => {
  const s = plainGame('intr-buy');
  const rng = new Rng(6);
  townReady(s, rng);
  const { a, root } = house(s, rng);
  night(s, 9);
  const b = lean(s);
  assert.equal(holdingsOf(s, root).homes, 0);
  intrigueOf(s).books[root].purse = 5000;
  night(s, 10);
  assert.equal(b.owner !== undefined && intrigueOf(s).of[b.owner] === root, true, 'the house owns the town\'s home now');
  assert.equal(holdingsOf(s, root).homes, 1);
  // a neighbour in debt sells to a rich house
  const debtor = adult(s, rng);
  debtor.debt = 80;
  const c = lean(s);
  c.owner = debtor.id;
  intrigueOf(s).books[root].purse = 5000;
  night(s, 11);
  assert.ok(c.owner !== debtor.id && intrigueOf(s).of[c.owner!] === root, 'the debtor sold up');
  assert.ok((debtor.debt ?? 0) < 80);
  assert.ok(a);
});

test('a bought councillor swings the vote', () => {
  const s = plainGame('intr-bribe');
  const rng = new Rng(7);
  townReady(s, rng, 6);
  const { root } = house(s, rng);
  night(s, 9);
  // a soldier on the council, for harsh law (so against repealing it)
  const soldier = adult(s, rng);
  soldier.guard = true;
  assert.equal(blocOf(s, soldier), 'soldiers');
  soldier.skills.social.level = 40; // (the best-spoken of the soldiers: their speaker)
  const book = intrigueOf(s).books[root];
  book.mafia = { since: 1, boss: -1, muscle: [], heat: 0, victims: [] }; // (a ring wants harsh law gone)
  const prop = { law: 'harsh_law' as const, repeal: true };
  const tally = () => {
    const pol = politicsOf(s);
    s.prompts = [];
    pol.vote = undefined;
    callVote(s, null, prop);
    return { yes: pol.vote!.for, no: pol.vote!.against };
  };
  const plain = tally();
  intrigueOf(s).holds.push({ who: soldier.id, house: root, how: 'bribe', since: s.tick, until: s.tick + 10 * TICKS_PER_DAY, by: 0 });
  const bought = tally();
  const own = stanceOn('soldiers', prop);
  assert.equal(bought.yes, plain.yes - (own > 0 ? 1 : 0) + SEAT_VOTES);
  assert.equal(bought.no, plain.no - (own < 0 ? 1 : 0));
  assert.ok(bought.yes - bought.no > plain.yes - plain.no, 'the margin moved toward the house');
  assert.ok(LAW_BY_ID.harsh_law);
});

test('an uncovered murder brings a trial and a feud', () => {
  const s = plainGame('intr-trial');
  const rng = new Rng(8);
  townReady(s, rng);
  const mine = house(s, rng);
  const theirs = house(s, rng);
  night(s, 9);
  const st = intrigueOf(s);
  const h = housesOf(s);
  // (a knife that works: seeds are tried until the killing comes off)
  let seed = 1;
  while (s.people.includes(theirs.b) && seed < 200) houseMurder(s, h, new Rng(seed++), mine.root, st.books[mine.root], mine.a, theirs.b, 'plot');
  assert.ok(!s.people.includes(theirs.b), 'the victim is dead');
  const plot = st.plots.find((p) => p.victim === theirs.b.id)!;
  assert.ok(plot, 'the killing is a plot of the house');
  uncoverPlot(s, new Rng(3), plot);
  assert.ok(plot.uncovered);
  assert.ok(st.books[mine.root].crimes.some((c) => c.known), 'a known crime in the house\'s book');
  assert.ok(dynastyOf(s).feuds.some((f) => !f.ended && ((f.a === theirs.root && f.b === mine.root) || (f.b === theirs.root && f.a === mine.root))), 'a feud between the houses');
  night(s, 10); // (the court is free: the trial is called)
  const pol = politicsOf(s);
  assert.ok(pol.trial || st.trials.length || s.prompts.some((q) => q.politics === 'trial'), 'a trial for the one who ordered it');
  if (pol.trial) assert.equal(pol.trial.crime, 'murder');
});

test('the founder is never a scheme\'s victim, and never changes', () => {
  const s = plainGame('intr-leader');
  const rng = new Rng(9);
  townReady(s, rng, 6);
  const mine = house(s, rng);
  house(s, rng);
  night(s, 9);
  const st = intrigueOf(s);
  const h = housesOf(s);
  const main = s.people.find((p) => p.id === s.mainId)!;
  // a knife that works is turned on the founder, many times over
  for (let seed = 1; seed < 80; seed++) houseMurder(s, h, new Rng(seed), mine.root, st.books[mine.root], mine.a, main, 'plot');
  assert.ok(s.people.includes(main), 'the founder lives');
  assert.equal(s.mainId, main.id);
  // and an angry, rich, ringed town runs on for two months
  for (const book of Object.values(st.books)) {
    book.purse = 400;
    book.mafia = { since: 1, boss: mine.a.id, muscle: [], heat: 0, victims: [] };
  }
  for (let d = 10; d < 70; d++) {
    for (const book of Object.values(st.books)) book.purse = Math.max(book.purse, 400);
    night(s, d);
    assert.equal(s.mainId, main.id, `still the founder's town on day ${d}`);
    assert.ok(s.people.includes(main), `the founder lives on day ${d}`);
  }
});

test('a ring leans on shopkeepers and the money reaches the house', () => {
  const s = plainGame('intr-ring');
  const rng = new Rng(10);
  townReady(s, rng, 6);
  const mine = house(s, rng);
  night(s, 9);
  const st = intrigueOf(s);
  const shop = lean(s);
  shop.def = 'trading_post';
  const keeper = adult(s, rng);
  keeper.coins = 500;
  shop.owner = keeper.id;
  shop.shop = { pieces: [], takings: { day: Math.floor(at(10, 3) / TICKS_PER_DAY), today: 0, yesterday: 100 } };
  st.books[mine.root].mafia = { since: 1, boss: mine.a.id, muscle: [], heat: 0, victims: [] };
  st.books[mine.root].purse = 100;
  let paid = false;
  for (let d = 10; d < 40 && !paid; d++) {
    shop.shop!.takings!.yesterday = 100;
    shop.shop!.takings!.day = Math.floor(at(d, 3) / TICKS_PER_DAY);
    night(s, d);
    paid = (keeper.coins ?? 0) < 500 && s.people.includes(keeper);
    if (!s.people.includes(keeper)) break;
  }
  assert.ok(paid || !s.people.includes(keeper), 'the keeper paid, or came to grief');
  assert.ok(st.books[mine.root].drawn > 0 || !s.people.includes(keeper), 'and the house drew it');
});

test('secrets: debts and hidden crimes can be held over someone', () => {
  const s = plainGame('intr-secret');
  const rng = new Rng(11);
  const p = adult(s, rng);
  assert.deepEqual(secretsAbout(s, p), []);
  p.debt = 90;
  assert.equal(secretsAbout(s, p).length, 1);
});
