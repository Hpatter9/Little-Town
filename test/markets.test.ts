import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ARMS, HOUSE_TIERS, LOAN_DAYS, MARKET_HOUR } from '../src/shared/data/markets';
import { WORTH } from '../src/shared/data/trade';
import { storages, totalStock } from '../src/shared/sim/buildings';
import { realm } from '../src/shared/sim/factions';
import { goBust, loans, marketOf, marketsHourly, marketView, movePrices, sellPrice, sendWagons, swings, tierOf, wagonsOnTheRoad, wantsOf } from '../src/shared/sim/markets';
import { noteFlow, priceOf } from '../src/shared/sim/prices';
import { snapshot } from '../src/shared/sim/snapshot';
import type { GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { freeSpot, plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function market(seed: string): GameState {
  const s = plainGame(seed);
  const spot = freeSpot(s, 'market');
  put(s, 'market', spot.x, spot.y);
  s.tick = at(5, 6);
  const f = realm(s).find((q) => q.id !== 'brotherhood')!;
  f.known = true;
  f.stance = 'trade';
  return s;
}

test('prices move with supply, war and the season, and drift back', () => {
  const s = market('mk-prices');
  const mk = marketOf(s)!;
  assert.equal(priceOf(s, 'wood'), WORTH.wood, 'a quiet market: worth');
  noteFlow(s, 'wood', 400); // the town sold a great deal of wood
  for (let i = 0; i < 3; i++) movePrices(s, mk);
  assert.ok(priceOf(s, 'wood') < WORTH.wood * 0.9, `plenty of wood is cheap (${priceOf(s, 'wood')})`);
  for (const f of s.factions!) f.stance = 'war';
  for (let i = 0; i < 8; i++) movePrices(s, mk);
  assert.ok(priceOf(s, ARMS[0]) > WORTH[ARMS[0]] * 1.3, 'arms are dear in a war');
  for (const f of s.factions!) f.stance = 'neutral';
  for (let i = 0; i < 30; i++) movePrices(s, mk);
  assert.ok(Math.abs(priceOf(s, 'iron') / WORTH.iron - 1) < 0.2, 'and drift back at peace');
});

test('booms, shortages, gluts and crashes come with a reason, move the price, and end', () => {
  const s = market('mk-swing');
  const mk = marketOf(s)!;
  let w = null;
  for (let d = 0; d < 40 && !w; d++) {
    s.tick += TICKS_PER_DAY;
    w = swings(s, mk);
  }
  assert.ok(w, 'a swing came');
  assert.ok(w.why.length > 10 && !w.why.includes('{place}'));
  for (let i = 0; i < 6; i++) movePrices(s, mk);
  const k = priceOf(s, w.m) / WORTH[w.m];
  assert.ok(w.mult > 1 ? k > 1.2 : k < 0.85, `${w.kind} in ${w.m}: ×${k.toFixed(2)}`);
  s.tick = w.until + 1;
  swings(s, mk);
  assert.ok(!mk.swings.includes(w), 'it ends');
});

test('a wagon carries what the town can spare to a power that wants it, sells, and comes home with the takings', () => {
  const s = market('mk-wagon');
  const mk = marketOf(s)!;
  const f = s.factions!.find((q) => q.known)!;
  const want = wantsOf(s, f)[0];
  storages(s)[0].store[want] = 120;
  const before = s.coins ?? 0;
  const sent = sendWagons(s, mk);
  assert.equal(sent.length, 1, 'one route open, one wagon');
  const w = sent[0];
  assert.ok((w.out[want] ?? 0) > 0, `it carries ${want}`);
  assert.ok(sellPrice(s, f, want) > priceOf(s, want) * 1.3, 'dear there');
  assert.ok((totalStock(s)[want] ?? 0) < 120, 'taken from the stores');
  s.tick = w.arrive;
  wagonsOnTheRoad(s, mk);
  assert.ok(w.sold && w.purse > 0);
  s.tick = w.home;
  wagonsOnTheRoad(s, mk);
  assert.equal(mk.wagons.length, 0);
  assert.ok((s.coins ?? 0) > before, 'the takings came home');
  assert.equal(mk.runs, 1);
  assert.ok(mk.standing > 0 || mk.profit < 0, 'standing follows the profit');
  assert.ok(marketView(s)!.routes.some((r) => r.runs === 1));
});

test('a wagon on a road to a power gone to war is seized', () => {
  const s = market('mk-war');
  const mk = marketOf(s)!;
  const f = s.factions!.find((q) => q.known)!;
  storages(s)[0].store[wantsOf(s, f)[0]] = 120;
  const [w] = sendWagons(s, mk);
  f.stance = 'war';
  s.tick = w.arrive;
  wagonsOnTheRoad(s, mk);
  assert.equal(mk.wagons.length, 0);
  assert.ok(mk.profit < 0, 'a loss');
  assert.ok(mk.log[0].includes('seized'));
  assert.equal(sendWagons(s, mk).length, 0, 'the road is shut');
});

test('short of a stake the house borrows; unpaid when due it goes bust, and the debt is seized', () => {
  const s = market('mk-bust');
  const mk = marketOf(s)!;
  mk.standing = HOUSE_TIERS[1].at; // traders: the moneylenders will lend
  s.coins = 0;
  for (const st of storages(s)) st.store = {};
  const [w] = sendWagons(s, mk);
  assert.ok(w && mk.loan, 'borrowed to fill the wagon');
  assert.ok(w.stake > 0);
  storages(s)[0].store.iron = 40;
  s.tick = mk.loan!.due + 1;
  s.coins = 5;
  loans(s, mk);
  assert.equal(mk.loan, undefined);
  assert.equal(mk.standing, 0, 'back to peddlers');
  assert.ok(mk.bustUntil! > s.tick && mk.busts === 1);
  assert.equal(s.coins, 0, 'the treasury taken');
  assert.ok((totalStock(s).iron ?? 0) < 40, 'and the stores');
  assert.ok(s.prompts.some((p) => p.title === 'The trade house goes bust'));
  assert.equal(sendWagons(s, mk).length, 0, 'no merchant will deal with a bust house');
  assert.ok(snapshot(s).markets!.house.bustDays! > 0);
  void LOAN_DAYS;
  void goBust;
});

test('a loan paid back in time keeps the house; a fortune makes it a merchant power', () => {
  const s = market('mk-power');
  s.autopilot = true;
  const mk = marketOf(s)!;
  mk.loan = { owed: 50, due: s.tick + 3 * TICKS_PER_DAY, from: 'the Deep Hold' };
  s.coins = 500;
  mk.standing = HOUSE_TIERS[4].at + 10;
  s.tick = at(6, MARKET_HOUR);
  marketsHourly(s);
  assert.equal(mk.loan, undefined, 'repaid');
  assert.equal(s.coins, 450);
  assert.equal(tierOf(mk.standing).tier.name, 'Merchant Power');
  assert.ok(s.prompts.some((p) => p.title === 'A merchant power'));
});
