import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID, UPGRADES } from '../src/shared/data/buildings';
import { ORIGINS } from '../src/shared/data/origins';
import { HOLD_SEAT_D, HOLD_SEAT_W, SEAT_D, SEAT_DEFS, SEAT_ERAS, SEAT_STAGE, SEAT_W, SEATS, seatId, seatOf } from '../src/shared/data/seats';
import { canUpgrade, footprint, isUnlocked, placeBlueprint, unlockInfo, upgrade } from '../src/shared/sim/buildings';
import { coreRect } from '../src/shared/sim/castle';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

test('every origin has a seat of five stages, one an era, chained by upgrades', () => {
  assert.equal(SEAT_DEFS.length, ORIGINS.length * 5);
  const names = new Set(SEAT_DEFS.map((d) => d.name));
  assert.equal(names.size, SEAT_DEFS.length, 'every stage has a name of its own');
  for (const o of ORIGINS) {
    for (let i = 1; i <= 5; i++) {
      const d = BUILDING_BY_ID[seatId(o, i)];
      assert.ok(d, `${o} stage ${i}`);
      assert.equal(d.era, SEAT_ERAS[i - 1]);
      assert.equal(d.origin, o);
      assert.equal(d.seat, i);
      assert.ok(d.never, 'never built new');
      assert.equal(d.morale![0], [3, 5, 7, 9, 12][i - 1]);
      if (i < 5) assert.equal(UPGRADES[d.id], seatId(o, i + 1));
    }
    assert.equal(SEATS[o].names.length, 5);
  }
  // (the dead build with bone, not hide)
  assert.ok(BUILDING_BY_ID[seatId('lich', 2)].cost.bone && !BUILDING_BY_ID[seatId('lich', 2)].cost.hide);
});

test('a town is founded with its own first seat standing by the camp; a hold\'s on its hall', () => {
  for (const o of ORIGINS) {
    const s = newGame(`seat-${o}`, { origin: o });
    const seat = seatOf(s.buildings);
    assert.ok(seat, `${o} has a seat`);
    assert.equal(seat.def, seatId(o, 1));
    assert.equal(seat.status, 'done');
    const f = footprint(seat);
    if (o === 'vampire' || o === 'dwarves') {
      assert.ok(seat.room, `${o}: a room of the hold`);
      assert.deepEqual(f, coreRect(s), `${o}: on the hall`);
      assert.equal(f.w, HOLD_SEAT_W);
      assert.equal(f.h, HOLD_SEAT_D);
    } else {
      assert.equal(f.w, SEAT_W);
      assert.equal(f.h, SEAT_D);
      assert.ok(Math.abs(f.x + f.w / 2 - s.land.camp.x) <= 1, `${o}: centred on the camp`);
      assert.ok(f.y + f.h <= s.land.camp.y, `${o}: just beyond the fire`);
    }
    assert.equal(s.buildings.filter((b) => SEAT_STAGE[b.def]).length, 1, 'one seat');
  }
});

test('the next stage opens with its era, never another people\'s; it is rebuilt where it stands', () => {
  const s = newGame('seat-stages', { origin: 'knights' });
  const seat = seatOf(s.buildings)!;
  const next = BUILDING_BY_ID[UPGRADES[seat.def]];
  assert.ok(!isUnlocked(unlockInfo(s), next), 'the keep waits for the Medieval era');
  assert.match(canUpgrade(s, seat.id).reason ?? '', /Medieval/);
  s.era = 'medieval';
  assert.ok(isUnlocked(unlockInfo(s), next));
  assert.ok(!isUnlocked(unlockInfo(s), BUILDING_BY_ID[seatId('settlers', 2)]), 'another people\'s seat is never theirs');
  assert.ok(!placeBlueprint(s, seatId('knights', 2), 10, 10).ok, 'never placed new');
  const was = { tile: seat.tile, row: seat.row };
  // (a building beside it, so there'd be no room to grow: it is rebuilt in place all the same)
  assert.ok(upgrade(s, seat.id).ok);
  assert.equal(seat.def, seatId('knights', 2));
  assert.equal(seat.status, 'blueprint');
  assert.deepEqual({ tile: seat.tile, row: seat.row }, was);
});

test('a hold\'s seat is rebuilt on its hall, campfire and all', () => {
  const s = newGame('seat-hold', { origin: 'vampire' });
  const seat = seatOf(s.buildings)!;
  s.era = 'medieval';
  assert.ok(upgrade(s, seat.id).ok, 'the court of night rises in the hall');
  assert.deepEqual(footprint(seat), coreRect(s));
  assert.ok(seat.room);
});

test('the town rebuilds its seat grander as the ages come', () => {
  const s = newGame('seat-planner', { origin: 'settlers' });
  const sim = new Sim(s);
  // (the Medieval era, and the makings in store)
  s.era = 'medieval';
  const fire = s.buildings.find((b) => b.def === 'campfire')!;
  fire.store = { ...fire.store, wood: 30, stone: 24, hide: 6 };
  for (let t = 0; t < TICKS_PER_DAY * 2 && seatOf(s.buildings)!.def !== seatId('settlers', 2); t++) sim.step();
  const seat = seatOf(s.buildings)!;
  assert.equal(seat.def, seatId('settlers', 2), 'the moot hall is begun');
  assert.equal(s.buildings.filter((b) => SEAT_STAGE[b.def]).length, 1, 'still one seat');
});
