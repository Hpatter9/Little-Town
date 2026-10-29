import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLD_HP_PER_HOUR, FEVER_FROM, FEVER_FROM_DAY, FEVER_HOURS, FEVER_HP_PER_HOUR, FESTER_HP_PER_HOUR } from '../src/shared/data/hardship';
import { fevered, festering, hardshipHourly, squalor } from '../src/shared/sim/hardship';
import { heal } from '../src/shared/sim/health';
import { makePerson, maxHp, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { calendarOf, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { FOOD_PER_HOUR } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { CELL } from '../src/shared/sim/land';
import { campPx, plainGame, row } from './helpers';

// Hard times (docs/notes/deaths-common.md): fevers in a crowded, dirty town; open wounds that fester untended; the
// winter's cold for those sleeping rough. Each run hour by hour on its own here (`hardshipHourly`), the rest of the
// town held still.

/** A town of `n` at home, the autopilot on, nobody abed; the first summer day. */
function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = s.people.length; i < n; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', { x: campPx(s).x + (i % 4) * 40, y: campPx(s).y + Math.floor(i / 4) * 40 }, s.people.map((p) => p.name)));
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.bed = null;
  }
  s.tick = 12 * TICKS_PER_DAY;
  return s;
}

/** Run the hardship rules for so many hours. */
function hours(s: GameState, h: number, each?: () => void): void {
  for (let i = 0; i < h; i++) {
    s.tick += TICKS_PER_HOUR;
    hardshipHourly(s);
    each?.();
  }
}

const homes = (s: GameState, beds: number) => {
  for (let i = 0; i * 4 < beds; i++) s.buildings.push({ id: s.nextId++, def: 'cottage', tile: 60 + i * 4, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
};

test('nothing of the kind with the autopilot off', () => {
  const s = town('hard-off', 12);
  s.autopilot = false;
  s.people[1].sick = { until: s.tick + 10 * TICKS_PER_HOUR, fever: true };
  const hp = s.people[1].hp;
  hours(s, 5);
  assert.equal(s.people[1].hp, hp);
});

test('a crowded, dirty town is the more fever-ridden: beds and a well make it cleaner', () => {
  const s = town('squalor', 12);
  const dirty = squalor(s);
  homes(s, 12);
  for (const p of s.people) p.bed = s.buildings.find((b) => b.def === 'cottage')!.id;
  s.buildings.push({ id: s.nextId++, def: 'well', tile: 50, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  assert.ok(dirty > 2 * squalor(s) - 0.5, `${dirty.toFixed(2)} against ${squalor(s).toFixed(2)}`);
  assert.equal(squalor(s), 1);
});

test('fevers break out in a crowded town, and never in a band round one fire', () => {
  const outbreaks = (n: number) => {
    let seen = 0;
    for (let k = 0; k < 6; k++) {
      const s = town(`fever-${n}-${k}`, n);
      hours(s, 10 * 24, () => {
        if (s.people.some(fevered)) seen++;
      });
    }
    return seen;
  };
  assert.equal(outbreaks(FEVER_FROM - 1), 0);
  assert.ok(outbreaks(14) > 0, 'a fever came to some of the crowded towns');
});

test('a fever takes health and stops the mending; the strong get over it, the weak die of it', () => {
  const s = town('fever-course', 3);
  const [, strong, weak] = s.people;
  // (kept apart, so neither catches it from the other)
  strong.x = 0;
  weak.x = 100 * CELL;
  for (const p of [strong, weak]) p.sick = { until: s.tick + FEVER_HOURS[0] * TICKS_PER_HOUR, fever: true };
  weak.hp = FEVER_HP_PER_HOUR * 4;
  const hp = strong.hp - 1;
  strong.hp = hp;
  heal(s, strong);
  assert.equal(strong.hp, hp, 'no mending while it burns');
  hours(s, FEVER_HOURS[0] + 1);
  assert.ok(!s.people.includes(weak), 'the weak died');
  assert.ok(s.fallen?.some((f) => f.id === weak.id && f.cause === 'of a fever'));
  assert.ok(s.people.includes(strong) && !strong.sick, 'the strong got over it');
  assert.ok(strong.hp < hp - FEVER_HP_PER_HOUR * (FEVER_HOURS[0] - 1));
});

test('a fever spreads to those near the sick, not to those far off', () => {
  let near = 0;
  let far = 0;
  for (let k = 0; k < 8; k++) {
    const s = town(`spread-${k}`, 4);
    const [, sick, close, away] = s.people;
    sick.sick = { until: s.tick + 30 * TICKS_PER_HOUR, fever: true };
    close.x = sick.x + CELL;
    close.y = sick.y;
    away.x = sick.x + 40 * CELL;
    hours(s, 24);
    if (close.sick) near++;
    if (away.sick) far++;
  }
  assert.ok(near >= 3, `caught it near the sick in ${near} of 8`);
  assert.equal(far, 0);
});

test('an open wound left untended festers and takes health; a dressing in store cleans it instead', () => {
  const wounded = (seed: string) => {
    const s = town(seed, 2);
    const p = s.people[1];
    p.wounds = [{ part: 'torso', kind: 'cut', sev: 0.6, peak: 0.6 }];
    return { s, p };
  };
  const { s, p } = wounded('fester');
  let at = -1;
  hours(s, 400, () => {
    if (at < 0 && festering(p)) at = p.hp;
    p.wounds![0].sev = 0.6; // (kept open: the test is of its turning bad, not its healing)
  });
  assert.ok(at > 0 || !s.people.includes(p), 'it festered');
  const t = wounded('fester-clean');
  t.s.items.bandage = 1;
  hours(t.s, 400, () => (t.p.wounds![0].sev = 0.6));
  assert.equal(t.s.items.bandage ?? 0, 0, 'the dressing was used');
  assert.ok(t.s.notices.some((n) => n.text.includes('cleaned and dressed')));

  // festering, they lose health hour by hour and don't mend
  const u = wounded('fester-hp');
  u.p.wounds![0].fester = true;
  u.p.hp = maxHp(u.p) - 10;
  const hp = u.p.hp;
  heal(u.s, u.p);
  assert.equal(u.p.hp, hp);
  u.s.tick += TICKS_PER_HOUR;
  hardshipHourly(u.s);
  assert.ok(u.p.hp <= hp - FESTER_HP_PER_HOUR + 1e-9 || !festering(u.p));
});

test('winter: those asleep on the ground grow cold and lose health; a bed keeps them; everyone eats more', () => {
  const s = town('winter', 3);
  s.tick = 32 * TICKS_PER_DAY;
  assert.equal(calendarOf(s).season, 'winter');
  const [, rough, abed] = s.people;
  const sleep = (p: Person, building: number | null) => {
    p.task = { type: 'sleep', building };
    p.activity = 'sleep';
  };
  homes(s, 1);
  sleep(rough, null);
  sleep(abed, s.buildings.at(-1)!.id);
  for (const p of [rough, abed]) p.needs.food = 1;
  hours(s, 1);
  assert.ok(rough.hp <= maxHp(rough) - COLD_HP_PER_HOUR, 'cold on the ground');
  assert.ok(rough.cold);
  assert.equal(abed.hp, maxHp(abed), 'warm in bed');
  assert.ok(abed.needs.food < 1 - FOOD_PER_HOUR * 0.1, 'hungrier in winter');
  // (not in summer)
  const t = town('summer', 2);
  sleep(t.people[1], null);
  hours(t, 1);
  assert.equal(t.people[1].hp, maxHp(t.people[1]));
  assert.ok(!t.people[1].cold);
});

test('hard times lay the founder low but never kill them; and a new camp has no fevers in its first days', () => {
  const s = town('founder-low', 2);
  const founder = s.people.find((p) => p.id === s.mainId)!;
  founder.sick = { until: s.tick + 30 * TICKS_PER_HOUR, fever: true };
  founder.hp = 3;
  hours(s, 5);
  assert.ok(s.people.includes(founder) && !s.gameOver);
  assert.ok(founder.hp > 0 && founder.hp <= 1, `laid low (${founder.hp})`);

  let seen = 0;
  for (let k = 0; k < 6; k++) {
    const t = town(`fresh-camp-${k}`, 14);
    t.tick = 0;
    hours(t, FEVER_FROM_DAY * 24 - 2, () => (seen += t.people.filter(fevered).length));
  }
  assert.equal(seen, 0);
});

test('someone over a fever is spared another for a while, so it burns out', () => {
  const s = town('spared', 3);
  const [, sick, other] = s.people;
  sick.sick = { until: s.tick + 2 * TICKS_PER_HOUR, fever: true };
  other.x = 100 * CELL;
  hours(s, 3);
  assert.ok(!sick.sick && (sick.feverSpared ?? 0) > s.tick, 'got over it, and spared');
  // (beside a fevered neighbour for a day, they don't catch it again)
  other.sick = { until: s.tick + 30 * TICKS_PER_HOUR, fever: true };
  other.x = sick.x + CELL;
  other.y = sick.y;
  hours(s, 24);
  assert.ok(!sick.sick);
});
