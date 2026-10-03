// A blow that lands on a townsperson is remembered (the tick, and which side it came from), for the blood.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { attackPerson, startRaid } from '../src/shared/sim/raids';
import { plainGame } from './helpers';

test('a landed blow records when it fell and the side it came from; a miss records nothing', () => {
  const s = plainGame('blood');
  const p = s.people[0];
  p.hp = 1000;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(1));
  const rd = r.raiders[0];
  rd.x = p.x - 30;
  rd.y = p.y;
  assert.equal(p.lastHit, undefined);
  const rng = new Rng(7);
  let landed = 0;
  for (let i = 0; i < 40; i++) {
    s.tick++;
    const before = p.hp;
    attackPerson(s, rd, p, rng);
    if (p.hp < before) {
      landed++;
      assert.equal(p.lastHit, s.tick, 'the blow is remembered the tick it lands');
      assert.equal(p.hitFrom, -1, 'from the left, where the raider stands');
    } else assert.notEqual(p.lastHit, s.tick, 'a miss is not');
  }
  assert.ok(landed > 0, 'some blows landed');
  rd.x = p.x + 30;
  for (let i = 0; i < 40 && p.hitFrom !== 1; i++) {
    s.tick++;
    attackPerson(s, rd, p, rng);
  }
  assert.equal(p.hitFrom, 1, 'and from the right once it has come round');
});

test('whoever is struck down leaves blood on the ground, kept a while and never more than a few dozen marks', async () => {
  const { markBlood, BLOOD_LASTS, BLOOD_MOST } = await import('../src/shared/sim/state');
  const { knockDown } = await import('../src/shared/sim/health');
  const { updateRaid } = await import('../src/shared/sim/raids');
  const s = plainGame('blood-marks');
  const p = s.people[0];
  // a blow just landed, then they fall: a mark where they lie, from the side the blow came
  p.lastHit = s.tick;
  p.hitFrom = -1;
  p.hp = 0;
  knockDown(s, p);
  assert.equal(s.blood?.length, 1);
  assert.deepEqual([s.blood![0].x, s.blood![0].y, s.blood![0].from], [Math.round(p.x), Math.round(p.y), -1]);
  // a raider cut down in the town bleeds too (a wolf does; the marks are made once)
  const r = startRaid(s, RAID_KIND_BY_ID.wolves, 20, new Rng(2));
  r.phase = 'active';
  const rd = r.raiders[0];
  rd.x = p.x + 64;
  rd.y = p.y;
  rd.down = true;
  updateRaid(s, new Rng(3));
  updateRaid(s, new Rng(4));
  assert.equal(s.blood!.length, 2, 'one mark for the wolf');
  // old marks go, and the list is capped
  for (let i = 0; i < BLOOD_MOST + 5; i++) markBlood(s, i, i, 1);
  assert.equal(s.blood!.length, BLOOD_MOST);
  s.tick += BLOOD_LASTS;
  markBlood(s, 0, 0, 1);
  assert.equal(s.blood!.length, 1, 'the old ones are gone');
});
