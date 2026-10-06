// Gods and faith: neglected gods grow wrathful and strike; a shrine and offerings keep them pleased, and pleased
// they bless the town.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faithHourly, faithOf, faithView } from '../src/shared/sim/faith';
import { FAITH_HOUR, WRATH_AT } from '../src/shared/data/gods';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row, camp } from './helpers';

/** Run the town's mornings: faithHourly at the hour of the offering, day after day. */
function mornings(s: ReturnType<typeof plainGame>, days: number): void {
  s.autopilot = true;
  for (let d = 0; d < days; d++) {
    do s.tick += TICKS_PER_HOUR;
    while (calendar(s.tick).hour !== FAITH_HOUR);
    faithHourly(s);
  }
}

test('gods with nowhere to be worshipped grow wrathful, and strike', () => {
  const s = plainGame('faith-neglect');
  mornings(s, 30);
  const f = faithOf(s);
  assert.ok(f.signs.some((g) => g.kind === 'wrath'), `a wrath came (${JSON.stringify(f.favour)})`);
  assert.ok(Object.values(f.favour).some((v) => v < 0), 'favour has fallen');
});

test('a temple keeps the gods pleased, and pleased they bless the town', () => {
  const s = plainGame('faith-temple');
  const c = camp(s);
  put(s, 'temple', c.x + 4, row(s));
  put(s, 'wayside_shrine', c.x - 6, row(s));
  mornings(s, 40);
  const f = faithOf(s);
  assert.ok(f.signs.some((g) => g.kind === 'bless'), 'a blessing came');
  assert.ok(!f.signs.some((g) => g.kind === 'wrath'), 'no wrath');
  assert.ok(Object.values(f.favour).every((v) => v > WRATH_AT));
  assert.ok((s.marks ?? []).length > 0 || f.signs.length > 0);
  const v = faithView(s);
  assert.equal(v.gods.length, 4);
  assert.ok(v.places.includes('Temple'));
});

test('each people keeps its own gods', () => {
  const a = plainGame('faith-a');
  const b = plainGame('faith-b');
  b.origin = 'dwarves';
  assert.notEqual(faithView(a).gods[0].name, faithView(b).gods[0].name);
});
