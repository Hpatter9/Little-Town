import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/shared/sim/state';
import { Sim } from '../src/shared/sim/sim';
import { feedLight, inDark, isLit, darkPace, lightingHourly, lightToFeed, placeLights, streetCells } from '../src/shared/sim/lighting';
import { DARK_PACE, FUEL_MOST, LIGHT_EVERY } from '../src/shared/data/lighting';
import { depositNear, totalStock } from '../src/shared/sim/buildings';
import { CELL, isRoad, setRoad } from '../src/shared/sim/land';
import { campXY } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => day * TICKS_PER_DAY + (hour - 7) * TICKS_PER_HOUR;

/** A town with lighting at work and a street of road east of the camp. */
function lit(seed: string) {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  for (let x = s.land.camp.x; x < s.land.camp.x + 30; x++) setRoad(s.land, x, s.land.camp.y + 1);
  return s;
}

test('street lights stand along the roads, more as the town grows', () => {
  const s = lit('lights-place');
  placeLights(s);
  const n = s.torches!.length;
  assert.ok(n > 0, 'some lights');
  for (const t of s.torches!) assert.ok(isRoad(s.land, t.x, t.y), "a street light by a road");
  assert.ok(streetCells(s.land).length >= n);
  assert.ok(s.torches!.every((t) => t.fuel === 0), 'new lights start empty');
  // more people, more lights (up to the road's room)
  for (let i = 0; i < 6; i++) s.people.push({ ...s.people[0], id: 900 + i });
  placeLights(s);
  assert.ok(s.torches!.length >= n);
  assert.ok(LIGHT_EVERY > 1);
});

test('lights burn their fuel by night only, and are fed from the stores', () => {
  const s = lit('lights-burn');
  placeLights(s);
  const t = s.torches![0];
  t.fuel = 5;
  s.tick = at(2, 12);
  lightingHourly(s);
  assert.equal(t.fuel, 5, 'no burning by day');
  s.tick = at(2, 23);
  lightingHourly(s);
  assert.equal(t.fuel, 4, 'an hour burned by night');
  t.fuel = 0;
  assert.equal(isLit(s, t), false);
  depositNear(s, campXY(s), { wood: 5 });
  const before = totalStock(s).wood ?? 0;
  assert.ok(feedLight(s, t));
  assert.equal(t.fuel, FUEL_MOST);
  assert.equal(totalStock(s).wood ?? 0, before - 1);
});

test('the lamplighters go round in the afternoon, and feed the lights', () => {
  const s = lit('lights-feed');
  placeLights(s);
  depositNear(s, campXY(s), { wood: 20 });
  const p = s.people[0];
  s.tick = at(2, 10);
  assert.equal(lightToFeed(s, p), null, 'not in the morning');
  s.tick = at(2, 16);
  assert.ok(lightToFeed(s, p), 'in the afternoon');
  const sim = new Sim(s);
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) sim.step();
  assert.ok(s.torches!.some((t) => t.fuel > 0), 'someone fed a light');
});

test('in the dark beyond the lights, work goes slower', () => {
  const s = lit('lights-dark');
  placeLights(s);
  const p = s.people[0];
  const t = s.torches![0];
  s.tick = at(2, 23);
  // far out in the night
  p.x = (s.land.camp.x + 25) * CELL;
  p.y = (s.land.camp.y - 12) * CELL;
  assert.equal(inDark(s, p.x, p.y), true);
  assert.equal(darkPace(s, p), DARK_PACE);
  // by a burning light
  t.fuel = 6;
  p.x = (t.x + 0.5) * CELL;
  p.y = (t.y + 0.5) * CELL;
  lightingHourly(s);
  assert.equal(inDark(s, p.x, p.y), false);
  // by the camp's fire
  p.x = campXY(s).x;
  p.y = campXY(s).y;
  assert.equal(inDark(s, p.x, p.y), false);
  // by day, never
  s.tick = at(3, 12);
  p.x = (s.land.camp.x + 25) * CELL;
  assert.equal(darkPace(s, p), 1);
  // and with lighting off (the tests' towns), never
  s.autopilot = false;
  s.tick = at(3, 23);
  assert.equal(darkPace(s, p), 1);
});

test('under the mountain the halls are dark at every hour without their sconces', () => {
  const s = newGame('lights-hold', { origin: 'dwarves' });
  s.autopilot = true;
  placeLights(s);
  const sconces = s.torches!.filter((t) => t.room !== undefined);
  assert.ok(sconces.length >= 1, 'a sconce in the hall');
  // (the hold's seat is built over its hall, so the hall's sconce is the seat's room's)
  const hall = sconces[0];
  const x = (hall.x + 0.5) * CELL;
  const y = (hall.y + 1.5) * CELL;
  s.tick = at(2, 12);
  hall.fuel = 0;
  assert.equal(inDark(s, x, y), true, 'dark at noon, unlit');
  hall.fuel = 8;
  assert.equal(inDark(s, x, y), false, 'lit by its sconce');
  // and the sconce burns by day too, while someone is in the room (and not while it stands empty)
  const p = s.people[0];
  p.x = 0;
  p.y = 0;
  for (const q of s.people) q.x = q.y = 0;
  lightingHourly(s);
  assert.equal(hall.fuel, 8, 'nobody there: not burning');
  p.x = x;
  p.y = y;
  lightingHourly(s);
  assert.equal(hall.fuel, 7, 'someone there: burning');
});

/* ------------------------------------------------------------ what light reaches */

import { clearLine, flat, lightSources, occluders, OPEN, ROUND, SOLID } from '../src/shared/sim/lightField';
import { FIRE_LIGHTS, LIGHT_KIND } from '../src/shared/data/lighting';
import { setGround } from '../src/shared/sim/land';
import { put } from './helpers';

/** A clear stretch of grass east of the camp, a lit street light on it, at night. */
function nightField(seed: string) {
  const s = lit(seed);
  const cx = s.land.camp.x + 10;
  const cy = s.land.camp.y + 6;
  for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) setGround(s.land, x, y, 'grass');
  s.buildings = s.buildings.filter((b) => b.def === 'campfire');
  s.torches = [{ id: 1, x: cx, y: cy, fuel: FUEL_MOST }];
  s.land.version++;
  s.tick = at(2, 23);
  return { s, cx, cy };
}
const px = (c: number) => (c + 0.5) * CELL;

test('each light reaches as far as its kind: the age\'s street light, the camp\'s fire, a forge', () => {
  const kinds = lightSources('neolithic', [{ x: 5, y: 5 }], [], { x: 40, y: 40 });
  assert.equal(kinds[0].r, LIGHT_KIND.neolithic.radius, 'a torch');
  assert.equal(kinds[1].r, FIRE_LIGHTS.campfire.radius, 'the camp\'s fire, with no fire standing');
  assert.equal(lightSources('modern', [{ x: 5, y: 5 }], [], { x: 40, y: 40 })[0].r, LIGHT_KIND.modern.radius, 'an electric lamp');
  assert.ok(LIGHT_KIND.modern.radius > LIGHT_KIND.neolithic.radius, 'an electric lamp lights further than a torch');
  assert.ok(FIRE_LIGHTS.campfire.radius > FIRE_LIGHTS.kiln.radius, 'the camp\'s fire further than a kiln');
  // in the sim: lit just inside the torch's reach, dark just past it
  const { s, cx, cy } = nightField('lights-reach');
  const r = LIGHT_KIND.neolithic.radius;
  assert.equal(inDark(s, px(cx + Math.floor(r) - 1), px(cy)), false, 'inside the reach');
  assert.equal(inDark(s, px(cx + Math.ceil(r) + 1), px(cy)), true, 'past the reach');
});

test('buildings, walls, trees and rocks stop the light and throw a shadow behind them', () => {
  const { s, cx, cy } = nightField('lights-shadow');
  // open ground both sides: lit two cells off
  assert.equal(inDark(s, px(cx + 2), px(cy)), false);
  assert.equal(inDark(s, px(cx - 2), px(cy)), false);
  // a wall east of the light: lit on its face, dark behind it
  put(s, 'palisade_wall', cx + 1, cy);
  s.land.version++;
  assert.equal(inDark(s, px(cx + 1), px(cy)), false, 'the wall itself is lit on its face');
  assert.equal(inDark(s, px(cx + 2), px(cy)), true, 'behind the wall is dark');
  assert.equal(inDark(s, px(cx - 2), px(cy)), false, 'the other side is still lit');
  // a tree west, a rock north: shadows behind both
  setGround(s.land, cx - 1, cy, 'forest');
  setGround(s.land, cx, cy - 1, 'rock');
  s.land.version++;
  assert.equal(inDark(s, px(cx - 2), px(cy)), true, 'behind the tree');
  assert.equal(inDark(s, px(cx), px(cy - 2)), true, 'behind the rock');
  assert.equal(inDark(s, px(cx), px(cy + 2)), false, 'open ground south still lit');
  // the shared rule: what stands in the way
  const occ = occluders(s.land, s.buildings);
  const w = s.land.w;
  assert.equal(occ[cy * w + cx + 1], SOLID);
  assert.equal(occ[cy * w + cx - 1], ROUND);
  assert.equal(occ[(cy + 2) * w + cx], OPEN);
  // a tree's shadow is round: a ray grazing the cell's corner passes
  assert.equal(clearLine(occ, w, s.land.h, cx + 0.5, cy + 0.5, cx - 1.5, cy + 0.5), false, 'straight through the trunk');
  assert.equal(clearLine(occ, w, s.land.h, cx + 0.5, cy + 0.98, cx - 1.5, cy + 1.02), true, 'past its edge');
});

test('light passes over fields, pens and traps lying flat', () => {
  assert.equal(flat({ def: 'garden_plot' }), true);
  assert.equal(flat({ def: 'chicken_coop' }), true);
  assert.equal(flat({ def: 'pit_trap' }), true);
  assert.equal(flat({ def: 'campfire' }), true);
  assert.equal(flat({ def: 'palisade_wall' }), false);
  assert.equal(flat({ def: 'lean_to' }), false);
  const { s, cx, cy } = nightField('lights-flat');
  put(s, 'garden_plot', cx + 1, cy - 1);
  s.land.version++;
  assert.equal(inDark(s, px(cx + 3), px(cy)), false, 'lit past the field');
});
