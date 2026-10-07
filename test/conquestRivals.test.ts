import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RIVAL_MOVE_DAYS } from '../src/shared/data/troops';
import { worldOf, holdings } from '../src/shared/sim/conquest/conquest';
import { checkConquestWin, defenceOf, rivalArmiesOf, rivalsDaily, rivalsTick } from '../src/shared/sim/conquest/rivals';
import { realm } from '../src/shared/sim/factions';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('rival realms spread over free land, and at war come for the town\'s bare provinces', () => {
  const s = plainGame('rivals');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const fs = realm(s);
  for (const f of fs) {
    f.known = true;
    f.troops = 40;
  }
  const before = c.realmIds.slice(1).map((id) => holdings(c, id).length);
  // a month of days: the powers march and take ground
  for (let d = 1; d <= 30; d++) {
    s.tick = d * TICKS_PER_DAY;
    rivalsDaily(s, c, w);
    for (let t = 0; t < TICKS_PER_DAY; t += 600) {
      s.tick = d * TICKS_PER_DAY + t;
      rivalsTick(s, c);
    }
  }
  const after = c.realmIds.slice(1).map((id) => holdings(c, id).length);
  assert.ok(after.some((n, i) => n > before[i]), `the powers grew: ${before} -> ${after}`);
  assert.ok(after.every((n, i) => n >= before[i]));
  for (const id of c.realmIds.slice(1)) for (const i of holdings(c, id)) assert.ok(w.provinces[i].landmark !== 'lair' || c.cleared?.includes(i), 'a lair held is a lair cleared');
  // at war, a bare province of the town's beside a strong power falls
  const home = w.realms[0].capital;
  const bare = holdings(c, 'town').find((i) => i !== home);
  assert.ok(bare !== undefined);
  const f = fs[0];
  f.stance = 'war';
  f.troops = 200;
  // give the power a province beside it
  const beside = w.provinces[bare!].neighbours.find((n) => c.holder[n] !== 'town');
  assert.ok(beside !== undefined);
  c.holder[beside!] = f.id;
  c.rivalMoved![f.id] = -RIVAL_MOVE_DAYS;
  let fell = false;
  for (let d = 31; d <= 60 && !fell; d++) {
    s.tick = d * TICKS_PER_DAY;
    rivalsDaily(s, c, w);
    for (let t = 0; t < TICKS_PER_DAY; t += 600) {
      s.tick = d * TICKS_PER_DAY + t;
      rivalsTick(s, c);
    }
    fell = c.holder[bare!] === f.id;
  }
  assert.ok(fell, 'the bare province fell');
  assert.ok(defenceOf(s, c, w, home) >= 0);
  assert.equal(rivalArmiesOf(c).length, 0);
});

test('the win: every province the town\'s, or an ally\'s or vassal\'s', () => {
  const s = plainGame('win');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const fs = realm(s);
  assert.equal(checkConquestWin(s, c, w), false);
  for (let i = 0; i < c.holder.length; i++) if (c.holder[i] === null) c.holder[i] = 'town';
  assert.equal(checkConquestWin(s, c, w), false, 'the rivals still hold theirs');
  for (const f of fs) f.stance = 'alliance';
  fs[0].stance = 'vassal';
  assert.equal(checkConquestWin(s, c, w), true);
  assert.ok(s.gameOver?.won);
});
