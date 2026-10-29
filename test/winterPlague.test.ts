import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLD_AWAKE, COLD_HP_PER_HOUR, COLD_IN_BED, WINTER_SNOW, FIREWOOD_PER_HEAD, SPOIL_DAILY, WINTER_FORAGE, WINTER_YIELD, WOODPILE_WARN_FROM } from '../src/shared/data/hardship';
import { PLAGUE_HP_PER_HOUR, PLAGUE_SHARE } from '../src/shared/data/doom';
import { LIFESPANS } from '../src/shared/data/lifespans';
import { firewoodWanted, hardshipHourly, noMending, winterForage, winterYield, woodpileForecast } from '../src/shared/sim/hardship';
import { plagueToll, updateDoom } from '../src/shared/sim/doom';
import { heal } from '../src/shared/sim/health';
import { mended, needsSickbed } from '../src/shared/sim/sickbeds';
import { makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { calendarOf, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng, hashSeed } from '../src/shared/rng';
import { weatherAt } from '../src/shared/sim/weather';
import { campPx, plainGame, put } from './helpers';

// Winter made a season to prepare for, and the plague made deadly (docs/notes/winter-plague-delves.md): the hearths
// burn firewood, the bare land forages slowly, food left in the open spoils, and the plague stops the mending and
// takes the weak first, eased by a sickbed, a healer and herbs, and burns out.

/** A town of `n` at home, the autopilot on, its stores empty; on day `day`. */
function town(seed: string, n: number, day = 12): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = s.people.length; i < n; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', { x: campPx(s).x + (i % 4) * 40, y: campPx(s).y + Math.floor(i / 4) * 40 }, s.people.map((p) => p.name)));
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs.food = 1;
  }
  s.tick = day * TICKS_PER_DAY;
  return s;
}

const hours = (s: GameState, h: number, each?: () => void) => {
  for (let i = 0; i < h; i++) {
    s.tick += TICKS_PER_HOUR;
    hardshipHourly(s);
    each?.();
  }
};
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
const sleepIn = (p: Person, building: number | null) => {
  p.task = { type: 'sleep', building };
  p.activity = 'sleep';
};

test('winter hearths burn firewood; with none, even those in bed grow cold', () => {
  // (four: too few for a fever to break out)
  const s = town('hearths', 4, 32);
  assert.equal(calendarOf(s).season, 'winter');
  const home = put(s, 'cottage', 60);
  for (const p of s.people) sleepIn(p, home.id);
  campfire(s).store = { wood: 10 };
  hours(s, 24);
  // (stacked on the woodpile, and a day's burning for four burned: 0.6 a head)
  assert.equal((campfire(s).store.wood ?? 0) + (s.woodpile ?? 0), 10 - Math.floor(4 * FIREWOOD_PER_HEAD), 'a day of firewood burned');
  assert.ok((s.woodpile ?? 0) > 0, 'the wood stacked on the woodpile');
  assert.ok(!s.hearthsCold);
  assert.ok(s.people.every((p) => p.hp === maxHp(p) && !p.cold), 'warm in bed by a lit hearth');
  // the woodpile bare: the hearths go cold and the sleepers in bed with them, at half the ground's rate
  campfire(s).store = {};
  s.woodpile = undefined;
  s.hearthOwed = 0.99;
  hours(s, 1);
  assert.ok(s.hearthsCold);
  const p = s.people[1];
  assert.ok(p.cold);
  const snow = weatherAt(s.seed, s.tick, null).kind === 'snow' ? WINTER_SNOW : 1;
  assert.equal(p.hp, maxHp(p) - COLD_HP_PER_HOUR * COLD_IN_BED * snow);
  assert.ok(noMending(p));
  // (and one up and about is chilled too, at a lower rate)
  const up = s.people[2];
  up.task = null;
  up.activity = 'idle';
  up.hp = maxHp(up);
  campfire(s).store = {};
  s.woodpile = undefined;
  hours(s, 1);
  assert.ok(up.cold && up.hp === maxHp(up) - COLD_HP_PER_HOUR * COLD_AWAKE * (weatherAt(s.seed, s.tick, null).kind === 'snow' ? WINTER_SNOW : 1));
  // (no firewood burned in summer)
  const t = town('summer-hearths', 6, 12);
  campfire(t).store = { wood: 10 };
  hours(t, 24);
  assert.equal(campfire(t).store.wood, 10);
  // (and nothing with the autopilot off)
  // (the woodpile is the hearths' alone, and wanted no more once it holds the winter's need)
  const w = town('woodpile', 4, 22);
  campfire(w).store = { wood: 100 };
  hours(w, 1);
  assert.equal(w.woodpile, Math.ceil(4 * FIREWOOD_PER_HEAD * 10));
  assert.equal(firewoodWanted(w), 0);
  const u = town('off-hearths', 6, 32);
  u.autopilot = false;
  campfire(u).store = { wood: 10 };
  hours(u, 24);
  assert.equal(campfire(u).store.wood, 10);
});

test('the town wants a winter of firewood put by from autumn on', () => {
  const s = town('firewood', 5, 12);
  assert.equal(firewoodWanted(s), 0, 'not in summer');
  s.tick = 22 * TICKS_PER_DAY;
  assert.equal(calendarOf(s).season, 'autumn');
  assert.equal(firewoodWanted(s), Math.ceil(5 * FIREWOOD_PER_HEAD * 10));
  s.tick = 38 * TICKS_PER_DAY;
  assert.ok(firewoodWanted(s) < Math.ceil(5 * FIREWOOD_PER_HEAD * 10) && firewoodWanted(s) > 0, 'less as the winter passes');
  s.autopilot = false;
  assert.equal(firewoodWanted(s), 0);
});

test('the winter land forages slowly, and the herds and the hunt give less', () => {
  const s = town('forage', 2, 32);
  assert.equal(winterForage(s), WINTER_FORAGE);
  assert.equal(winterYield(s), WINTER_YIELD);
  s.tick = 12 * TICKS_PER_DAY;
  assert.equal(winterForage(s), 1);
  assert.equal(winterYield(s), 1);
  s.tick = 32 * TICKS_PER_DAY;
  s.autopilot = false;
  assert.equal(winterForage(s), 1);
  assert.equal(winterYield(s), 1);
});

test('food left in the open spoils; a granary keeps it better, dried food keeps, and the winter slows it', () => {
  const rot = (day: number, def: string) => {
    const s = town(`spoil-${day}-${def}`, 2, day);
    const st = def === 'campfire' ? campfire(s) : put(s, def, 60);
    st.store = { berries: 40, grain: 40, dried_meat: 40 };
    hours(s, 10 * 24);
    return { berries: 40 - (st.store.berries ?? 0), grain: 40 - (st.store.grain ?? 0), dried: 40 - (st.store.dried_meat ?? 0) };
  };
  const open = rot(2, 'stockpile');
  const granary = rot(2, 'granary');
  const cold = rot(31, 'stockpile');
  assert.ok(open.berries >= 40 * (1 - (1 - SPOIL_DAILY.berries!) ** 10) - 4, `berries rot in the open: ${open.berries}`);
  assert.ok(open.grain > 0 && open.grain < open.berries, 'grain keeps longer');
  assert.equal(open.dried, 0, 'dried meat keeps');
  assert.ok(granary.berries < open.berries / 2, `a granary keeps them: ${granary.berries} against ${open.berries}`);
  assert.ok(cold.berries < open.berries, `the cold slows it: ${cold.berries} against ${open.berries}`);
  // (nothing with the autopilot off)
  const s = town('spoil-off', 2, 2);
  s.autopilot = false;
  campfire(s).store = { berries: 20 };
  hours(s, 5 * 24);
  assert.equal(campfire(s).store.berries, 20);
});

test('the cold and the hungry catch a fever more readily', () => {
  const caught = (weak: boolean) => {
    let n = 0;
    for (let k = 0; k < 20; k++) {
      const s = town(`weak-${weak}-${k}`, 3, 32);
      const [, sick, other] = s.people;
      sick.sick = { until: s.tick + 100 * TICKS_PER_HOUR, fever: true };
      other.x = sick.x + 10;
      other.y = sick.y;
      sick.hp = other.hp = 1000;
      if (weak) other.needs.food = 0;
      hours(s, 12, () => {
        if (weak) other.starving = true;
        other.needs.food = weak ? 0 : 1;
      });
      if (other.sick?.fever) n++;
    }
    return n;
  };
  const strong = caught(false);
  const weak = caught(true);
  assert.ok(weak > strong, `${weak} weak against ${strong} strong`);
});

/** A town in the grip of the plague: `n` close together, the plague struck. */
function plagueTown(seed: string, n: number): GameState {
  const s = town(seed, n);
  s.doom = { kind: 'plague', phase: 'active', untilTick: s.tick };
  return s;
}

test('the plague stops the mending and lays the sick abed till it lets go', () => {
  const s = plagueTown('plague-mend', 2);
  const p = s.people[1];
  p.sick = { until: s.tick + 10 * TICKS_PER_HOUR, wasting: true };
  p.hp = maxHp(p) / 2;
  for (let i = 0; i < TICKS_PER_HOUR; i++) heal(s, p);
  assert.equal(p.hp, maxHp(p) / 2, 'no mending while it wastes them');
  assert.ok(noMending(p));
  assert.ok(needsSickbed(p), 'they lie abed');
  p.hp = maxHp(p);
  assert.ok(!mended(p), 'not up while still sick');
  // (an old-style sickness, as with the autopilot off, mends as before)
  p.sick = { until: s.tick + 10 * TICKS_PER_HOUR };
  p.hp = maxHp(p) / 2;
  for (let i = 0; i < TICKS_PER_HOUR; i++) heal(s, p);
  assert.ok(p.hp > maxHp(p) / 2);
});

test('the plague takes the old, the hungry and children worst; a sickbed, a healer and herbs ease it', () => {
  const s = plagueTown('plague-toll', 3);
  const p = s.people[1];
  p.grownAt = s.tick - 2 * TICKS_PER_DAY;
  p.sick = { until: s.tick + 10 * TICKS_PER_HOUR, wasting: true };
  const plain = plagueToll(s, p);
  assert.equal(plain, maxHp(p) * PLAGUE_SHARE, 'a share of their health');
  p.grownAt = s.tick - (LIFESPANS.settlers.oldDays + 1) * TICKS_PER_DAY;
  const old = plagueToll(s, p);
  assert.ok(old > plain * 1.5, `the old: ${old}`);
  p.grownAt = s.tick - 2 * TICKS_PER_DAY;
  p.needs.food = 0.1;
  assert.ok(plagueToll(s, p) > plain * 1.4, 'the hungry');
  p.needs.food = 1;
  // a sickbed in a healer's hut
  const hut = put(s, 'healers_hut', 60);
  p.task = { type: 'sleep', building: hut.id, sick: true };
  p.activity = 'sleep';
  const tended = plagueToll(s, p);
  assert.ok(tended < plain * 0.61, `in a sickbed: ${tended}`);
  // herbs from the stores, one bundle a sickness
  campfire(s).store = { herbs: 2 };
  const eased = plagueToll(s, p);
  assert.ok(eased < tended, 'herbs ease it');
  assert.equal(campfire(s).store.herbs, 1);
  plagueToll(s, p);
  assert.equal(campfire(s).store.herbs, 1, 'one bundle a sickness');
  // (with the autopilot off the plain toll)
  const q = s.people[2];
  q.sick = { until: s.tick + 10 * TICKS_PER_HOUR };
  q.needs.food = 0;
  assert.equal(plagueToll(s, q), PLAGUE_HP_PER_HOUR);
});

test('a plague spreads through a crowded town, kills the weak, and burns out', () => {
  let ended = 0;
  let caught = 0;
  let dead = 0;
  for (let k = 0; k < 4; k++) {
    const s = plagueTown(`plague-run-${k}`, 10);
    for (const p of s.people) {
      p.x = campPx(s).x + (p.id % 3) * 20;
      p.y = campPx(s).y;
    }
    s.people[1].sick = { until: s.tick + 36 * TICKS_PER_HOUR, wasting: true };
    // (the frail: three going hungry)
    for (const p of s.people.slice(7)) p.needs.food = 0.1;
    const had = new Set<number>();
    for (let h = 0; h < 30 * 24 && s.doom; h++) {
      s.tick += TICKS_PER_HOUR;
      for (const p of s.people.slice(7)) p.needs.food = 0.1;
      updateDoom(s, new Rng(hashSeed(`plague-run:${k}:${h}`)));
      for (const p of s.people) if (p.sick) had.add(p.id);
    }
    if (!s.doom) ended++;
    caught += had.size;
    dead += 10 - s.people.length;
  }
  assert.equal(ended, 4, 'every plague burned out within the month');
  assert.ok(caught >= 4 * 4, `it spread: ${caught} sick in four towns`);
  assert.ok(dead > 0, `it killed: ${dead}`);
});

test('the plague lays the founder low but never kills them', () => {
  const s = plagueTown('plague-founder', 2);
  const main = s.people.find((p) => p.id === s.mainId)!;
  main.sick = { until: s.tick + 200 * TICKS_PER_HOUR, wasting: true };
  main.hp = 3;
  main.needs.food = 0;
  for (let h = 0; h < 48; h++) {
    s.tick += TICKS_PER_HOUR;
    updateDoom(s, new Rng(h + 1));
  }
  assert.ok(s.people.includes(main) && !s.gameOver);
  assert.ok(main.hp > 0 && main.hp <= 1);
});

test("the woodpile's forecast: shown in autumn and winter, warned of when it won't last, and when the hearths go cold", () => {
  // (four at home: 2.4 logs a day)
  const s = town('woodpile', 4, 12);
  assert.equal(calendarOf(s).season, 'summer');
  assert.equal(woodpileForecast(s), null, 'nothing to show in summer');
  // autumn's first days: gathering, no warning yet
  s.tick = 20 * TICKS_PER_DAY + 2 * TICKS_PER_HOUR;
  assert.equal(calendarOf(s).season, 'autumn');
  campfire(s).store = {};
  let f = woodpileForecast(s)!;
  assert.equal(f.need, Math.ceil(4 * FIREWOOD_PER_HEAD * 10), "a whole winter's burning wanted");
  assert.equal(f.warn, null, 'too early in autumn to warn');
  // later in autumn with nothing put by: it won't last
  s.tick = (20 + WOODPILE_WARN_FROM - 1) * TICKS_PER_DAY;
  assert.equal(calendarOf(s).dayOfSeason, WOODPILE_WARN_FROM);
  f = woodpileForecast(s)!;
  assert.equal(f.warn, 'short');
  assert.equal(f.lastsDays, 0);
  const told = () => s.journal.filter((j) => /firewood won't last the winter/.test(j.text)).length;
  hours(s, 3);
  assert.equal(told(), 1, 'warned once');
  hours(s, 3);
  assert.equal(told(), 1, 'and not again this season');
  // enough on the woodpile and in the stores: no warning, and it lasts the days it should
  s.woodpile = 12;
  campfire(s).store = { wood: 10, coal: 2 };
  f = woodpileForecast(s)!;
  assert.equal(f.warn, null);
  assert.equal(f.spare, 10 + 2 * 3, 'the stores count at their heat');
  assert.equal(f.lastsDays, Math.round(((12 + 16) / (4 * FIREWOOD_PER_HEAD)) * 10) / 10);
  // winter with the hearths cold
  s.tick = 32 * TICKS_PER_DAY;
  s.woodpile = undefined;
  campfire(s).store = {};
  hours(s, 12);
  assert.ok(s.hearthsCold);
  assert.equal(woodpileForecast(s)!.warn, 'cold');
  // (the autopilot off: none of it)
  s.autopilot = false;
  assert.equal(woodpileForecast(s), null);
});
