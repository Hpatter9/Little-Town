import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HORSE_CARRY, HORSE_HP } from '../src/shared/data/trade';
import { totalStock } from '../src/shared/sim/buildings';
import { partyCarry } from '../src/shared/sim/expeditions';
import { Sim } from '../src/shared/sim/sim';
import { canTrade, newHorse } from '../src/shared/sim/trade';
import { type Building, type GameState, campCell } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, row } from './helpers';

const camp = (s: GameState) => campCell(s).x;
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

test('with a market, a caravan comes, offers deals, trades, and moves on', () => {
  const sim = new Sim(plainGame('caravan'));
  const s = sim.state;
  s.era = 'medieval';
  addBuilding(s, 'market', camp(s) + 3);
  addBuilding(s, 'stockpile', camp(s) + 7);
  addBuilding(s, 'stable', camp(s) - 8);
  s.buildings.find((b) => b.def === 'stockpile')!.store = { wood: 80, stone: 20 };
  let t = 0;
  while (!s.caravan && t++ < 8 * TICKS_PER_DAY) sim.step();
  assert.ok(s.caravan, 'a caravan arrived');
  const offers = s.caravan!.offers;
  assert.ok(offers.some((o) => o.horse), 'a horse for sale (there is a stable)');
  const deal = offers.find((o) => !o.horse && canTrade(s, o.id).ok);
  assert.ok(deal, 'something the town can afford');
  const before = totalStock(s);
  sim.command({ type: 'trade', offer: deal!.id });
  sim.step();
  assert.ok(deal!.done);
  const after = totalStock(s);
  for (const [m, n] of Object.entries(deal!.wants)) assert.equal((after as Record<string, number>)[m] ?? 0, ((before as Record<string, number>)[m] ?? 0) - n);
  assert.equal(canTrade(s, deal!.id).ok, false, 'once only');
  for (let i = 0; i < 31 * TICKS_PER_HOUR && s.caravan; i++) sim.step(); // (12 hours on the Medieval clock)
  assert.equal(s.caravan, null, 'moved on');
});

test('horses carry for an expedition, speed it up, and come home', () => {
  const sim = new Sim(plainGame('ride'));
  const s = sim.state;
  addBuilding(s, 'stable', camp(s) - 8);
  const rng = new Rng(1);
  s.horses.push(newHorse(s, rng), newHorse(s, rng));
  s.buildings[0].store = { berries: 20 };
  const walk = (horses: number) => {
    const t = new Sim(JSON.parse(JSON.stringify(s)));
    t.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [t.state.mainId], horses });
    t.step();
    return t.state.expeditions[0];
  };
  const onFoot = walk(0);
  const riding = walk(1);
  assert.ok(riding.outTicks < onFoot.outTicks, 'faster');
  assert.equal(riding.horses?.length, 1);
  assert.equal(partyCarry(s, riding), partyCarry(s, onFoot) + HORSE_CARRY);

  sim.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [s.mainId], horses: 2 });
  sim.step();
  assert.equal(s.horses.length, 0, 'both went');
  for (let i = 0; i < TICKS_PER_DAY && s.expeditions.length; i++) sim.step();
  assert.equal(s.horses.length, 2, 'home again');
  assert.ok(s.horses.every((h) => h.hp <= HORSE_HP));
});

test('a horse can be bought even when storage is overfull (it lives in the stable)', () => {
  const s = plainGame('horse-full');
  addBuilding(s, 'stable', camp(s) + 3);
  const st = addBuilding(s, 'stockpile', camp(s) + 7);
  st.store = { stone: 5000, iron: 10 };
  s.caravan = { x: 100, leavesTick: s.tick + 1000, offers: [{ id: 1, gives: {}, wants: { iron: 2 }, horse: true }] } as never;
  assert.deepEqual(canTrade(s, 1), { ok: true });
});
