import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BROWSE_HOURS, TALK_HOURS } from '../src/shared/data/shop';
import { finishPiece } from '../src/shared/sim/crafting';
import { Sim } from '../src/shared/sim/sim';
import type { Stock } from '../src/shared/data/materials';
import { type Building, type GameState, type Traveller } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, plainGame, row } from './helpers';

function addBuilding(s: GameState, def: string, tile: number, store: Stock = {}): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store };
  s.buildings.push(b);
  return b;
}
const shopLog = (s: GameState) => s.buildings.find((b) => b.def === 'trading_post')?.shop?.log ?? [];

/** A town with a trading post and a stockpile; the next customer to walk in comes for a wooden club with a full
 *  purse. Runs until they've walked in, and returns them. */
function customer(seed: string, store: Stock): { sim: Sim; s: GameState; t: Traveller } {
  const sim = new Sim(plainGame(seed));
  const s = sim.state;
  addBuilding(s, 'trading_post', camp(s).x + 3);
  addBuilding(s, 'stockpile', camp(s).x - 6, store);
  let t: Traveller | undefined;
  for (let k = 0; k < 2 * TICKS_PER_DAY && !t; k++) {
    for (const q of s.travellers ?? [])
      if (q.phase === 'arriving' && (q.venue ?? 'shop') === 'shop' && !q.line) {
        q.want = { kind: 'item', item: 'wooden_club' };
        q.purse = 500;
      }
    sim.step();
    t = (s.travellers ?? []).find((q) => q.phase === 'shopping' && (q.venue ?? 'shop') === 'shop' && q.want?.kind === 'item');
  }
  assert.ok(t, 'a customer walked in');
  return { sim, s, t: t! };
}
const toCounter = (sim: Sim, t: Traveller) => {
  for (let k = 0; k < 2 * TICKS_PER_HOUR && !t.talk; k++) sim.step();
};

test('a customer looks round the shop first, then goes up to the counter and is served there, then is done', () => {
  const { sim, s, t } = customer('shop-browse', { stone: 30 });
  assert.equal(t.stage, 'browse', 'they look round first');
  assert.equal(t.talk, undefined, 'nothing said yet');
  const arrived = s.tick;
  toCounter(sim, t);
  assert.equal(t.stage, 'counter');
  assert.ok(s.tick - arrived >= BROWSE_HOURS * TICKS_PER_HOUR - 2, 'served only after looking round');
  assert.ok(t.talk!.ask.length > 0 && t.talk!.answer.length > 0, 'a question and an answer for the bubbles');
  for (let k = 0; k < TALK_HOURS * TICKS_PER_HOUR + 2; k++) sim.step();
  assert.equal(t.stage, 'done', 'then they make for the door');
});

test('none in stock but the town can make one: the keeper takes their coin and orders it; finished, it goes to them', () => {
  const { sim, s, t } = customer('shop-order', { wood: 20 });
  s.items.wooden_club = 0;
  toCounter(sim, t);
  assert.equal(t.talk?.outcome, 'order', String(t.talk?.answer));
  assert.match(t.talk!.answer, /can make you one/);
  const o = s.crafting.find((q) => q.commission?.name === t.name);
  assert.ok(o, 'an order was put in for them');
  assert.equal(o!.item, 'wooden_club');
  assert.ok(o!.commission!.paid > 0, 'paid up front');
  // finished, the club is theirs: it doesn't go into the stores
  finishPiece(s, o!, s.people[0]);
  assert.ok(!(s.items.wooden_club ?? 0), 'not put in the stores');
  assert.ok(shopLog(s).some((l) => /sent on to them/.test(l.text)), 'the shop notes it was sent on');
});

test('none in stock and nothing to make one with: the keeper turns them down', () => {
  const { sim, s, t } = customer('shop-turned', { stone: 30 });
  s.items.wooden_club = 0;
  toCounter(sim, t);
  assert.equal(t.talk?.outcome, 'no', String(t.talk?.answer));
  assert.ok(!s.crafting.some((q) => q.commission), 'no order put in');
});
