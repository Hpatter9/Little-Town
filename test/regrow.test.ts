// The wild grows back: a wood gathered bare comes back as a wood in a few days, unless it's kept clear.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearCell } from '../src/shared/sim/people';
import { REGROW_DAYS, regrowHourly } from '../src/shared/sim/regrow';
import { addWear, cellAt, groundAt, WEAR_SHOW } from '../src/shared/sim/land';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { makeWild, plainGame, put, camp } from './helpers';

const passDays = (s: ReturnType<typeof plainGame>, days: number) => {
  for (let h = 0; h < days * 24; h++) {
    s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    regrowHourly(s);
  }
};

test('a wood chopped bare grows back in a few days, its wood and berries again', () => {
  const s = plainGame('regrow');
  const c = camp(s);
  const i = makeWild(s, c.x + 9, c.y + 8, 'forest', { wood: 1 });
  clearCell(s, i);
  const at = cellAt(s.land, i);
  assert.equal(groundAt(s.land, at.x, at.y), 'grass', 'bare');
  passDays(s, 1);
  assert.equal(groundAt(s.land, at.x, at.y), 'grass', 'not yet');
  passDays(s, REGROW_DAYS.forest! * 1.5);
  assert.equal(groundAt(s.land, at.x, at.y), 'forest', 'grown back');
  assert.ok((s.land.pools[i]?.wood ?? 0) > 0, 'wood to gather again');
  assert.equal(s.land.regrow, undefined);
});

test('a cell kept clear does not grow back: walked, or beside a building; rock never does', () => {
  const s = plainGame('regrow-kept');
  const c = camp(s);
  const walked = makeWild(s, c.x + 9, c.y + 8, 'forest', { wood: 1 });
  const yard = makeWild(s, c.x - 9, c.y + 8, 'marsh', { fiber: 1 });
  const rock = makeWild(s, c.x + 9, c.y + 11, 'rock', { stone: 1 });
  put(s, 'workbench', c.x - 11, c.y + 8);
  for (const i of [walked, yard, rock]) clearCell(s, i);
  for (let d = 0; d < 10; d++) {
    for (let k = 0; k < WEAR_SHOW + 2; k++) addWear(s.land, walked); // (people keep walking it)
    passDays(s, 1);
  }
  for (const i of [walked, yard, rock]) {
    const at = cellAt(s.land, i);
    assert.notEqual(groundAt(s.land, at.x, at.y), i === yard ? 'marsh' : i === rock ? 'rock' : 'forest');
  }
});
