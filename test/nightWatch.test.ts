import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { oddsHourly } from '../src/shared/sim/raidOdds';
import { prowlers } from '../src/shared/sim/prowlers';
import { Rng } from '../src/shared/rng';
import { danger, moonLight, nightIndex, WATCH_BRIGHT, WATCH_DARK, nightWatchHourly, onNightWatch, spotAt, spotChance, watchMeetsProbe, watchNear, watchWanted } from '../src/shared/sim/nightWatch';
import { raidRecap } from '../src/shared/sim/raidRecap';
import { wantsToWake } from '../src/shared/sim/townsfolk';
import { townEdgeX } from '../src/shared/sim/raids';
import { campXY, newGame, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { CELL } from '../src/shared/sim/land';
import { clearAround } from './helpers';

/** The tick of an hour on a day (the clock starts at 7). */
const at = (day: number, hour: number) => day * TICKS_PER_DAY + ((hour - 7 + 24) % 24) * TICKS_PER_HOUR;
const lucky = (seed: number) => Object.assign(new Rng(seed), { chance: () => true }) as Rng;

/** A town of `grown` grown-ups with the autopilot on, and the land about it clear. */
function town(seed: string, grown = 12): GameState {
  const s = newGame(seed);
  clearAround(s, 24);
  s.autopilot = true;
  s.research.done.push('palisades');
  while (s.people.length < grown) s.people.push({ ...s.people[0], id: s.nextId++, name: `Hand ${s.people.length}`, task: null, away: null, priorities: { ...s.people[0].priorities, defend: 2 } });
  return s;
}
/** A watchman on patrol at a point. */
function post(s: GameState, x: number, y: number, melee = 5): Person {
  const p: Person = { ...s.people[0], id: s.nextId++, name: `Watch ${s.nextId}`, x, y, task: { type: 'patrol', targetX: x, targetY: y }, away: null, downed: null, skills: { ...s.people[0].skills, melee: { ...s.people[0].skills.melee, level: melee } } };
  s.people.push(p);
  return p;
}
/** Watchmen standing at both edges of the town (the sneaks come in at either). */
function edges(s: GameState, each = 4): void {
  const y = campXY(s).y;
  for (const side of [-1, 1] as const) for (let i = 0; i < each; i++) post(s, townEdgeX(s, side) + side * i * 4, y);
}

test('the watch is set at noon: none in a town too small, one when no guard is hired, more on Defence', () => {
  const tiny = town('watch-tiny', 3);
  tiny.tick = at(3, 12);
  nightWatchHourly(tiny);
  assert.deepEqual(tiny.watch?.ids, []);

  const s = town('watch-roster');
  s.tick = at(3, 12);
  assert.equal(danger(s), 1, 'a town with no wall has gaps to watch');
  s.ring = { gen: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, line: [], wall: 'palisade_wall', gate: 'palisade_gate', gates: [], done: true };
  assert.equal(danger(s), 0);
  assert.equal(watchWanted(s), 1);
  nightWatchHourly(s);
  assert.equal(s.watch!.ids.length, 1);
  assert.ok(!s.watch!.ids.includes(s.mainId), 'never the founder');
  assert.equal(s.watch!.night, nightIndex(s.tick));

  const d = town('watch-defence');
  d.ring = s.ring;
  d.direction = 'defense';
  d.tick = at(3, 12);
  assert.equal(danger(d), 2);
  nightWatchHourly(d);
  assert.equal(d.watch!.ids.length, 3);
  assert.equal(new Set(d.watch!.ids).size, 3);
});

test('the danger raises the watch: a prowl, a probe, a wall with gaps', () => {
  const s = town('watch-danger');
  s.tick = at(5, 12);
  s.ring = { gen: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, line: [], wall: 'palisade_wall', gate: 'palisade_gate', gates: [], done: true };
  const calm = watchWanted(s);
  s.lastProwl = s.tick - TICKS_PER_HOUR;
  assert.ok(watchWanted(s) > calm, 'a prowl lately');
  s.lastProwl = undefined;
  s.raidOdds = { probe: { kind: 'prowl_thieves', at: s.tick, goal: 'steal', n: 2 } };
  assert.ok(watchWanted(s) > calm, 'a probe waiting');
});

test('the townsfolk on the roster walk the beat at night, and are off it by day; others do not', () => {
  const s = town('watch-beat');
  s.tick = at(3, 12);
  nightWatchHourly(s);
  const id = s.watch!.ids[0];
  const p = s.people.find((q) => q.id === id)!;
  const other = s.people.find((q) => q.id !== id && q.id !== s.mainId)!;
  s.tick = at(3, 10);
  assert.ok(!onNightWatch(s, p), 'not by day');
  const sim = new Sim(s);
  s.tick = at(3, 21);
  for (let i = 0; i < 30; i++) sim.step();
  assert.ok(onNightWatch(s, p));
  assert.equal(p.task?.type, 'patrol', `on the beat: ${JSON.stringify(p.task)}`);
  assert.ok(other.task?.type !== 'patrol' || s.watch!.ids.includes(other.id));
});

test('the watch sleeps by day', () => {
  const s = town('watch-sleep');
  s.tick = at(3, 12);
  nightWatchHourly(s);
  const p = s.people.find((q) => q.id === s.watch!.ids[0])!;
  const other = s.people.find((q) => !s.watch!.ids.includes(q.id) && q.id !== s.mainId)!;
  s.tick = at(4, 10);
  p.needs.rest = 0.7;
  other.needs.rest = 0.7;
  assert.equal(wantsToWake(s, p), false, 'the watchman sleeps on at ten');
  assert.equal(wantsToWake(s, other), true, 'the rest are up');
});

test('only a watchman near a way in sees it, and only at night', () => {
  const s = town('watch-near');
  const y = campXY(s).y;
  const w = post(s, townEdgeX(s, 1), y);
  s.tick = at(3, 23);
  assert.deepEqual(watchNear(s, { x: townEdgeX(s, 1), y }), [w]);
  assert.deepEqual(watchNear(s, { x: townEdgeX(s, 1) + 40 * CELL, y }), [], 'out of sight');
  s.tick = at(3, 12);
  assert.deepEqual(watchNear(s, { x: townEdgeX(s, 1), y }), [], 'by day there is no watch');
});

test('a probe at a watched way in is met by the watch; an unwatched one gets through', () => {
  let met = 0;
  let missed = 0;
  for (let i = 0; i < 40; i++) {
    const s = town(`probe-${i}`);
    edges(s);
    s.tick = at(4, 2);
    s.raidOdds = { probe: { kind: 'prowl_thieves', at: s.tick, goal: 'steal', n: 2 } };
    if (watchMeetsProbe(s, 'prowl_thieves', 2)) {
      met++;
      assert.ok(s.raid?.watched, 'the raid is the watch\'s');
      assert.equal(s.raid!.phase, 'active');
      assert.ok(s.raid!.watchers!.length > 0);
      assert.ok(s.journal.some((j) => /of the night watch spotted 2 of the .* creeping in at the (east|west) edge of the town/.test(j.text)), s.journal.map((j) => j.text).join('|'));
    } else missed++;
  }
  assert.ok(met >= 25, `watched: ${met} of 40 met`);
  assert.ok(missed >= 1, 'blind spots and dark nights let some through');
  // nobody on the watch: nothing is met, and the probe goes on as before (steals or burns)
  for (let i = 0; i < 10; i++) {
    const s = town(`probe-bare-${i}`);
    s.tick = at(4, 2);
    assert.equal(watchMeetsProbe(s, 'prowl_thieves', 2), false);
    assert.equal(s.raid, null);
    assert.ok(s.watch!.missed! >= 1);
  }
});

test('the odds probe goes through the watch first', () => {
  for (let i = 0; i < 40; i++) {
    const s = town(`odds-${i}`);
    edges(s, 6);
    s.tick = at(4, 2);
    s.raidOdds = { probe: { kind: 'prowl_thieves', at: s.tick, goal: 'steal', n: 2 } };
    oddsHourly(s);
    if (s.raid?.watched) {
      assert.equal(s.raidOdds.probe, undefined);
      return;
    }
  }
  assert.fail('never met');
});

test('prowlers spotted by the watch are fewer, and the news says so', () => {
  let watched = 0;
  for (let i = 0; i < 30; i++) {
    const s = town(`prowl-${i}`, 6);
    s.tick = at(5, 23);
    const bare = town(`prowl-${i}`, 6);
    bare.tick = s.tick;
    edges(s, 5);
    prowlers(bare, lucky(1));
    prowlers(s, lucky(1));
    if (!s.raid?.watched) continue;
    watched++;
    assert.ok(s.raid.raiders.length <= bare.raid!.raiders.length);
    assert.ok(s.journal.some((j) => /of the night watch spotted .* slipping in at the (east|west) edge of the town: the alarm is raised!/.test(j.text)));
  }
  assert.ok(watched >= 10, `${watched} of 30`);
});

test('the dark of a moonless night hides them, a full moon and a lamp at the gate help the watch', () => {
  const s = town('watch-moon');
  const y = campXY(s).y;
  const w = post(s, townEdgeX(s, 1), y);
  const where = { x: townEdgeX(s, 1), y };
  const night = (light: number) => {
    for (let d = 1; d < 14; d++) {
      s.tick = at(d, 23);
      if (moonLight(s) === light) return;
    }
    assert.fail('no such night');
  };
  night(WATCH_DARK); // (the new moon)
  const dark = spotChance(s, [w], where);
  night(WATCH_BRIGHT); // (the full moon)
  const bright = spotChance(s, [w], where);
  assert.ok(dark < bright, `${dark} < ${bright}`);
  night(1);
  const plain = spotChance(s, [w], where);
  assert.ok(dark < plain && plain < bright);
  s.torches = [{ id: 1, x: Math.floor(where.x / CELL), y: Math.floor(where.y / CELL), fuel: 5, gate: true }];
  assert.ok(spotChance(s, [w], where) > plain, 'a lit lamp at the way in');
});

test('a watchman who is there when sneaks are caught earns a deed and experience', () => {
  const s = town('watch-deed');
  const w = post(s, 0, 0);
  s.tick = at(5, 23);
  const raid = { id: 1, kind: 'prowl_thieves', side: 1 as const, phase: 'active' as const, arrivesTick: 0, leavesTick: 0, raiders: [], prompt: null, watched: 'at the east gate', watchers: [w.id], roll: [{ id: w.id, name: w.name, level: 1, xp: 0 }], tally: { [w.id]: { dealt: 12, kills: 1, taken: 0 } } };
  const before = w.skills.melee.xp;
  raidRecap(s, raid, 'Night thieves', { outcome: 'victory', boss: null, killed: 2, came: 2, prisoners: 0, stolen: {}, spoils: {} }); // (the recap tells the watch's part)
  assert.equal(w.deeds?.watched, 1);
  assert.ok(w.skills.melee.xp > before);
  assert.equal(s.watch!.caught, 1);
  assert.equal(s.yearRaids!.watched, 1);
  assert.ok(s.journal.some((j) => /The night watch caught the night thieves at the east gate/.test(j.text)), s.journal.map((j) => j.text).join('|'));
});

test('spotAt records what the watch saw and missed', () => {
  const s = town('watch-tally');
  s.tick = at(5, 23);
  assert.deepEqual(spotAt(s, { x: 0, y: 0 }, new Rng(1)), []);
  assert.equal(s.watch!.missed, 1);
  assert.ok(s.watch!.alert !== undefined);
});
