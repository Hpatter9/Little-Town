// Natural disasters on the map: a flood spreads out of the water and spoils what it reaches; a wildfire burns the
// woods to ash and sets alight what it reaches; a tornado tears down what stands in its path; an earthquake shakes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disastersTick, disasterView, startDisaster, TORNADO_TICKS } from '../src/shared/sim/disasters';
import { buildingCentre } from '../src/shared/sim/buildings';
import { groundAt, idx, setGround } from '../src/shared/sim/land';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, clearAround, plainGame, put, row } from './helpers';

const run = (s: ReturnType<typeof plainGame>, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    disastersTick(s);
  }
};

test('a flood climbs out of the river a ring an hour and spoils the fields it reaches', () => {
  const s = plainGame('flood');
  s.autopilot = true;
  clearAround(s, 12);
  const c = camp(s);
  const y = row(s) + 3;
  for (let x = c.x - 8; x <= c.x + 8; x++) setGround(s.land, x, y + 3, 'water');
  const field = put(s, 'garden_plot', c.x - 1, y + 1, { crop: { stage: 'growing', growth: 0.8, work: 0 } as never });
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  startDisaster(s, 'flood');
  run(s, 5 * TICKS_PER_HOUR);
  const v = disasterView(s)!;
  assert.ok(v.flood.length > 10, `flooded cells ${v.flood.length}`);
  assert.equal(field.crop!.growth, 0, 'the crop is spoilt');
  run(s, 14 * TICKS_PER_HOUR);
  assert.equal(s.disaster, undefined, 'the water goes down');
});

test('a wildfire burns the woods to grass and sets alight a building beside them', () => {
  const s = plainGame('wildfire');
  s.autopilot = true;
  clearAround(s, 12);
  const c = camp(s);
  const y = row(s) + 4;
  for (let x = c.x - 9; x <= c.x + 1; x++) for (let dy = 0; dy < 3; dy++) setGround(s.land, x, y + dy, 'forest');
  const hut = put(s, 'lean_to', c.x + 2, y + 1);
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  const d = startDisaster(s, 'wildfire');
  d.burning = { [idx(s.land, c.x - 9, y + 1)]: s.tick, [idx(s.land, c.x + 1, y + 1)]: s.tick };
  d.crew = false; // (no firebreak: let it run)
  for (let h = 0; h < 16 && s.disaster; h++) run(s, TICKS_PER_HOUR);
  assert.equal(groundAt(s.land, c.x - 9, y + 1), 'grass', 'burnt out');
  assert.ok(s.land.regrow && Object.keys(s.land.regrow).length > 3, 'the woods will grow back');
  assert.ok(hut.fire !== undefined || !s.buildings.includes(hut) || d.hit.includes(hut.id), 'the fire reached the hut');
  assert.ok(disasterView(s)!.ash.length > 3, 'ash on the ground');
});

test('a tornado tears down what stands in its path', () => {
  const s = plainGame('tornado');
  s.autopilot = true;
  clearAround(s, 14);
  const c = camp(s);
  const y = row(s) + 2;
  const huts = [-8, -5, -2, 1, 4, 7].map((dx) => put(s, 'lean_to', c.x + dx, y));
  const d = startDisaster(s, 'tornado');
  const at = buildingCentre(huts[0]);
  d.path = { from: { x: at.x - 200, y: at.y }, to: { x: at.x + 600, y: at.y } };
  run(s, TORNADO_TICKS + 2);
  assert.ok(huts.filter((h) => !s.buildings.includes(h)).length >= 1, 'something came down');
  assert.equal(s.disaster, undefined);
});

test('an earthquake shakes the town', () => {
  const s = plainGame('quake');
  s.autopilot = true;
  startDisaster(s, 'quake');
  assert.equal(s.bossShake, s.tick);
  assert.ok(s.notices.some((n) => /earthquake/i.test(n.text)));
});

test('disasters come by themselves now and then', () => {
  const s = plainGame('disaster-due');
  s.autopilot = true;
  s.nextDisaster = 0;
  s.tick = TICKS_PER_HOUR * 100;
  disastersTick(s);
  assert.ok(s.disaster || s.nextDisaster! > s.tick);
});
