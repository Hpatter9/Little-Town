// Phase 4 farming: tired soil, muck from the pens, blight, orchards, autumn sowing and the harvest home.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROPS, SOIL } from '../src/shared/data/crops';
import { totalStock } from '../src/shared/sim/buildings';
import { fieldToWork, ripensInTime, tendFields, workField } from '../src/shared/sim/farming';
import type { Rng } from '../src/shared/rng';
import { type Building, type GameState } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function field(s: GameState, def: string, at = 2): Building {
  const b: Building = { id: s.nextId++, def, tile: camp(s) + at, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
/** The first tick on the hour in that season, on that day of it, at that hour. */
function tickAt(season: string, day: number, hour: number): number {
  for (let t = 0; ; t += TICKS_PER_HOUR) {
    const c = calendar(t);
    if (c.season === season && c.dayOfSeason === day && c.hour === hour) return t;
  }
}
const always = { chance: () => true, next: () => 0, int: (a: number) => a, pick: <T>(xs: T[]) => xs[0] } as unknown as Rng;
const never = { chance: () => false } as unknown as Rng;
/** Harvest it: what was gathered (in hand, and what spilled into the stores). */
const harvest = (s: GameState, b: Building) => {
  const p = s.people[0];
  const m = CROPS[b.def].material;
  p.carrying = {};
  const before = totalStock(s)[m] ?? 0;
  while (!workField(s, p, b));
  return (p.carrying[m] ?? 0) + (totalStock(s)[m] ?? 0) - before;
};

test('each harvest tires the soil, and a tired field gives less', () => {
  const s = plainGame('soil');
  const plot = field(s, 'garden_plot');
  plot.crop = { stage: 'ripe', growth: 1, work: 0 };
  const good = harvest(s, plot);
  assert.equal(plot.crop.soil, SOIL.start - SOIL.drain);
  plot.crop = { stage: 'ripe', growth: 1, work: 0, soil: 0.5 };
  const tired = harvest(s, plot);
  assert.ok(tired < good * 0.6, `${tired} of ${good}`);
  // (crop rotation halves the wear)
  s.research.done.push('crop_rotation');
  plot.crop = { stage: 'ripe', growth: 1, work: 0, soil: 1 };
  harvest(s, plot);
  assert.equal(plot.crop.soil, SOIL.start - SOIL.drain / 2);
});

test('a worn-out field is left to rest while there is food, and sown anyway when the town is hungry', () => {
  const s = plainGame('rest');
  s.tick = tickAt('spring', 1, 8);
  const plot = field(s, 'garden_plot');
  plot.crop = { stage: 'fallow', growth: 0, work: 0, soil: 0.4 };
  s.buildings.find((b) => b.def === 'campfire')!.store = { grain: 100 };
  assert.equal(fieldToWork(s, s.people[0]), null);
  s.buildings.find((b) => b.def === 'campfire')!.store = {};
  assert.equal(fieldToWork(s, s.people[0]), plot);
});

test('fallow ground rests, and muck from the pens mends it', () => {
  const s = plainGame('muck');
  s.tick = tickAt('summer', 1, 6);
  const plot = field(s, 'garden_plot');
  plot.crop = { stage: 'growing', growth: 0.5, work: 0, soil: 0.5 };
  const fallow = field(s, 'garden_plot', 6);
  fallow.crop = { stage: 'fallow', growth: 0, work: 0, soil: 0.5 };
  tendFields(s, never);
  assert.equal(plot.crop.soil, 0.5, 'no rest while it grows, and no pens');
  assert.ok(Math.abs(fallow.crop.soil! - (0.5 + SOIL.restPerDay)) < 1e-9);
  const pen = field(s, 'goat_pen', -6);
  pen.herd = { head: 3, tended: 0, breed: 0, hungry: 0, work: 0 };
  tendFields(s, never);
  assert.ok(Math.abs(plot.crop.soil! - (0.5 + SOIL.manurePerPen)) < 1e-9, `${plot.crop.soil}`);
});

test('blight takes the crop, and spreads through fields of the same kind (but not others)', () => {
  const s = plainGame('blight');
  s.tick = tickAt('summer', 1, 6);
  const a = field(s, 'garden_plot');
  const b = field(s, 'garden_plot', 6);
  const herbs = field(s, 'herb_garden', 10);
  for (const f of [a, b, herbs]) f.crop = { stage: 'growing', growth: 0.6, work: 0 };
  tendFields(s, always);
  assert.equal(a.crop!.stage, 'fallow');
  assert.equal(b.crop!.stage, 'fallow');
  assert.equal(herbs.crop!.stage, 'growing', 'one outbreak a day, and not across crops');
  assert.ok(s.journal.some((j) => j.text.includes('Blight')));
});

test('an orchard is planted once: it takes a while to bear, then fruits again without sowing, and never tires the soil', () => {
  const s = plainGame('orchard');
  const o = field(s, 'orchard');
  o.crop = { stage: 'ripe', growth: 1, work: 0 };
  const fruit = harvest(s, o);
  assert.ok(fruit >= CROPS.orchard.yield - 1, `${fruit}`);
  assert.equal(o.crop.stage, 'growing');
  assert.equal(o.crop.bearing, true);
  assert.equal(o.crop.soil ?? SOIL.start, SOIL.start);
});

test('nobody sows in late autumn what cannot ripen before winter; hardy vegetables still go in', () => {
  const s = plainGame('autumn');
  s.tick = tickAt('autumn', 3, 0);
  assert.equal(ripensInTime(s, field(s, 'garden_plot')), false);
  assert.equal(ripensInTime(s, field(s, 'vegetable_patch', 6)), true);
  s.tick = tickAt('autumn', 1, 8);
  assert.equal(ripensInTime(s, field(s, 'garden_plot', 10)), true);
});

test('at the turn of winter a well-stocked town holds a harvest home; a hungry one grumbles', () => {
  const s = plainGame('harvest');
  field(s, 'garden_plot');
  s.tick = tickAt('winter', 1, 6);
  s.buildings.find((b) => b.def === 'campfire')!.store = { grain: 200 };
  tendFields(s, never);
  assert.ok(s.marks?.some((m) => m.text === 'The harvest home' && m.value > 0));
  const t = plainGame('harvest2');
  field(t, 'garden_plot');
  t.tick = tickAt('winter', 1, 6);
  tendFields(t, never);
  assert.ok(t.marks?.some((m) => m.text === 'A thin harvest' && m.value < 0));
});
