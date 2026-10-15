// Work you can see: felled trees leave stumps and broken rock its rubble, the stockpile's heaps follow the store,
// gains float up between snapshots, a reaped field keeps its hay a while, water is drawn at the well and carried home.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearCell, newTickContext, updatePerson } from '../src/shared/sim/people';
import { RUBBLE_DAYS, regrowHourly } from '../src/shared/sim/regrow';
import { workField } from '../src/shared/sim/farming';
import { pastimeFor } from '../src/shared/sim/pastimes';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import type { Snapshot } from '../src/shared/sim/snapshot';
import type { Building } from '../src/shared/sim/state';
import { coveredCells, finishedBetween, gainsBetween, GAINS_GAP, hasLaundry, HAY_DAYS, hayStacks, laundryOut, layPiles, pileOf, rubbleBits, rubbleCells, slotGrid, sowThrow, stockPiles, stumpCells } from '../src/renderer/map/workSeen';
import { camp, makeWild, plainGame, put } from './helpers';

const hours = (s: ReturnType<typeof plainGame>, n: number) => {
  for (let h = 0; h < n; h++) {
    s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    regrowHourly(s);
  }
};

test('a felled wood leaves a stump until it grows back; broken rock leaves rubble a while', () => {
  const s = plainGame('felled');
  const c = camp(s);
  const wood = makeWild(s, c.x + 9, c.y + 8, 'forest', { wood: 1 });
  const rock = makeWild(s, c.x + 9, c.y + 11, 'rock', { stone: 1 });
  clearCell(s, wood);
  clearCell(s, rock);
  const none = new Set<number>();
  assert.deepEqual(stumpCells(s.land, none), [wood]);
  assert.deepEqual(rubbleCells(s.land, none), [rock]);
  // (built over, neither shows)
  assert.deepEqual(stumpCells(s.land, new Set([wood])), []);
  hours(s, RUBBLE_DAYS * 24 + 1);
  assert.deepEqual(rubbleCells(s.land, none), [], 'the rubble cleared away');
  assert.deepEqual(stumpCells(s.land, none), [wood], 'the stump still there');
  const bits = rubbleBits(rock);
  assert.ok(bits.length >= 3 && bits.every((b) => b.k >= 0 && b.k < 4));
  assert.deepEqual(rubbleBits(rock), bits, 'the same stones every time');
});

test('the stockpile heaps grow and shrink with the store', () => {
  assert.equal(pileOf('wood'), 'logs');
  assert.equal(pileOf('iron_ore'), 'stone');
  assert.equal(pileOf('grain'), 'sacks');
  assert.equal(pileOf('milk'), 'barrels');
  assert.equal(pileOf('leather'), 'crates');
  const grid = slotGrid(3, 1);
  assert.ok(grid.length >= 8);
  const empty = stockPiles({}, 100, grid.length);
  assert.equal(Object.values(empty).reduce((a, b) => a + b, 0), 0);
  const few = stockPiles({ wood: 5, grain: 2 }, 100, grid.length);
  assert.equal(few.logs, 1);
  assert.equal(few.sacks, 1);
  const full = stockPiles({ wood: 60, stone: 40 }, 100, grid.length);
  assert.ok(full.logs > few.logs && full.stone > 0);
  assert.ok(full.logs + full.stone <= grid.length);
  const laid = layPiles(full, grid);
  assert.equal(laid.length, full.logs + full.stone);
  assert.ok(laid.every((p) => grid.some((g) => g.x === p.x && g.y === p.y)));
});

const snap = (o: Partial<Snapshot>): Snapshot => ({ tick: 100, people: [], buildings: [], crafting: [], ...o }) as unknown as Snapshot;
const person = (o: Record<string, unknown>) => ({ id: 1, x: 50, y: 60, away: null, indoors: false, carrying: {}, activity: 'idle', ...o });

test('a load stored, a sale and a piece made rise between snapshots', () => {
  const pile = (store: Record<string, number>): Building => ({ id: 7, def: 'stockpile', tile: 2, row: 2, status: 'done', delivered: {}, progress: 1, store });
  const shop = (today: number): Building => ({ id: 8, def: 'trading_post', tile: 8, row: 2, status: 'done', delivered: {}, progress: 1, store: {}, shop: { takings: { day: 1, today, yesterday: 0 } } as unknown as Building['shop'] });
  const before = snap({ tick: 100, people: [person({ carrying: { wood: 3 } })] as never, buildings: [pile({ wood: 2 }), shop(10)], crafting: [{ id: 3, item: 'spear', count: 2, made: 0, progress: 0.9, station: 8, crafter: 'Ana' }] as never });
  const after = snap({ tick: 101, people: [person({ carrying: {} })] as never, buildings: [pile({ wood: 5 }), shop(16)], crafting: [{ id: 3, item: 'spear', count: 2, made: 1, progress: 0, station: 8, crafter: 'Ana' }] as never });
  const g = gainsBetween(before, after);
  assert.deepEqual(
    g.map((x) => [x.kind, x.what, x.n]),
    [
      ['stored', 'wood', 3],
      ['coins', 'coins', 6],
      ['made', 'spear', 1],
    ],
  );
  // (a catch-up after time away lifts nothing)
  assert.deepEqual(gainsBetween(before, { ...after, tick: 100 + GAINS_GAP + 1 }), []);
  assert.deepEqual(gainsBetween(null, after), []);
  // (eaten, not stored: nothing rises)
  assert.deepEqual(gainsBetween(before, { ...after, buildings: [pile({ wood: 2 }), shop(10)], crafting: before.crafting }), []);
});

test('a building finished is cheered by those who built it', () => {
  const site = (status: 'blueprint' | 'done'): Building => ({ id: 9, def: 'cottage', tile: 10, row: 10, status, delivered: {}, progress: status === 'done' ? 1 : 0.98, store: {} });
  const builder = person({ id: 4, x: 11.5 * 32, y: 11.2 * 32, activity: 'build' });
  const far = person({ id: 5, x: 40 * 32, y: 40 * 32, activity: 'build' });
  const f = finishedBetween(snap({ tick: 10, buildings: [site('blueprint')], people: [builder, far] as never }), snap({ tick: 11, buildings: [site('done')], people: [builder, far] as never }));
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].builders, [4]);
  assert.deepEqual(finishedBetween(snap({ tick: 10, buildings: [site('done')] }), snap({ tick: 11, buildings: [site('done')] })), []);
});

test('a reaped field keeps its hay for a few days, taken in as it is sown again', () => {
  const s = plainGame('hay');
  const c = camp(s);
  const b = put(s, 'garden_plot', c.x + 4, c.y + 4, { crop: { stage: 'ripe', growth: 1, work: 0.999 } });
  const p = s.people[0];
  p.x = (c.x + 4.5) * 32;
  p.y = (c.y + 4.5) * 32;
  assert.ok(workField(s, p, b), 'reaped');
  assert.equal(b.crop!.stage, 'fallow');
  assert.equal(b.crop!.reaped, s.tick);
  const stacks = hayStacks(b, s.tick + 1, 0);
  assert.ok(stacks.length > 0, 'haystacks on the stubble');
  assert.ok(hayStacks(b, s.tick + 1, 1).length === 0, 'none once sown again');
  assert.equal(hayStacks(b, s.tick + HAY_DAYS * TICKS_PER_DAY + 1, 0).length, 0, 'taken in after a few days');
});

test('water is drawn at the well by day and carried home', () => {
  const s = plainGame('well');
  const c = camp(s);
  const p = s.people[0];
  const home = put(s, 'lean_to', c.x - 6, c.y + 4);
  p.bed = home.id;
  put(s, 'well', c.x + 5, c.y + 4);
  s.tick = 10 * TICKS_PER_HOUR; // (mid-morning)
  const slot = [0, 1, 2, 3].find((k) => pastimeFor(s, p, k)?.pastime === 'well');
  assert.ok(slot !== undefined, 'a slot at the well');
  // waiting at the well: winding the bucket; then off home with it
  p.task = { type: 'idle', untilTick: s.tick + 5, pastime: 'well' };
  updatePerson(s, p, new Rng(1), newTickContext());
  assert.equal(p.activity, 'draw');
  s.tick += 10;
  p.task = { type: 'idle', untilTick: s.tick, pastime: 'well' };
  updatePerson(s, p, new Rng(1), newTickContext());
  const t = p.task as { type: string; pastime?: string } | null;
  assert.equal(t?.type === 'wander' && t.pastime, 'carry');
  // (no well, or night: no trip to it)
  s.tick = 22 * TICKS_PER_HOUR;
  assert.ok([0, 1, 2, 3].every((k) => pastimeFor(s, p, k)?.pastime !== 'well'));
});

test('the sower, the washing and what covers the ground', () => {
  const throws = Array.from({ length: 100 }, (_, i) => sowThrow(i * 37, 3)).filter(Boolean).length;
  assert.ok(throws > 10 && throws < 60, 'a handful now and then');
  assert.ok(laundryOut('clear', 'summer', 1));
  assert.ok(!laundryOut('rain', 'summer', 1) && !laundryOut('clear', 'winter', 1) && !laundryOut('clear', 'summer', 0.1));
  const homes = Array.from({ length: 60 }, (_, i): Building => ({ id: i + 1, def: 'cottage', tile: 0, row: 0, status: 'done', delivered: {}, progress: 1, store: {} }));
  const lines = homes.filter(hasLaundry).length;
  assert.ok(lines > 5 && lines < 40, 'a few homes, not all');
  assert.ok(!hasLaundry({ id: 1, def: 'well', status: 'done' }));
  const cov = coveredCells({ w: 100 }, [homes[0]]);
  assert.ok(cov.has(0) && cov.size >= 3, "a cottage covers its footprint");
});
