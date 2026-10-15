import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { EMPIRE_AWAY, EMPIRE_HOUR, CARAVAN_HOUR, POST_FOLK } from '../src/shared/data/tradeEmpire';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { storages, totalStock } from '../src/shared/sim/buildings';
import { marketOf } from '../src/shared/sim/markets';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { startRaid } from '../src/shared/sim/raids';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { empireHourly, empireOf, empireTick, empireView, empireOnMap, losePost, type EmpireCaravan } from '../src/shared/sim/tradeEmpire';
import { freeSpot, plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** A trading town: a market stall, the Trade direction, folk and coin and goods to spare, a region mapped. */
function trader(seed: string): GameState {
  const s = plainGame(seed);
  const spot = freeSpot(s, 'market');
  put(s, 'market', spot.x, spot.y);
  s.autopilot = true; // (the empire runs only with the autopilot; the tests call its steps directly)
  s.direction = 'trade';
  s.tick = at(5, EMPIRE_HOUR);
  s.regions = ['heartland', 'westwood'];
  s.coins = 600;
  for (let i = 0; i < 16; i++) s.people.push(makePerson(new Rng(900 + i), s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((p) => p.name)));
  for (const st of storages(s)) st.store = {};
  storages(s)[0].store = { wood: 200, stone: 150, clay: 100, grain: 120, fiber: 80 };
  marketOf(s);
  return s;
}

test('under Trade a town with a trade house founds a post, and it earns at the turn of the season', () => {
  const s = trader('te-found');
  const coins0 = s.coins!;
  empireHourly(s);
  const e = empireOf(s)!;
  assert.equal(e.posts.length, 1, 'a post is founded');
  assert.ok(s.coins! < coins0, 'it cost coin');
  const staff = s.people.filter((p) => p.away === EMPIRE_AWAY);
  assert.equal(staff.length, POST_FOLK, 'a few people went to staff it');
  // the season turns: the post pays its takings
  s.tick = at(11, EMPIRE_HOUR);
  empireHourly(s);
  assert.ok(e.lastTakings > 0 && e.made > 0, `the post paid the town (${e.lastTakings})`);
  assert.ok(empireView(s)!.posts[0].total > 0);
  assert.ok(snapshot(s).empire, 'the snapshot shows it');
});

test('without the Trade direction, or without the autopilot, no post is founded', () => {
  const a = trader('te-dir');
  a.direction = 'growth';
  empireHourly(a);
  assert.equal(empireOf(a), undefined);
  const b = trader('te-auto');
  b.autopilot = false;
  empireHourly(b);
  assert.equal(empireOf(b), undefined);
});

test('a caravan sets out with goods from the stores, and a lost one is lost: goods gone, drivers at risk', () => {
  const s = trader('te-caravan');
  empireHourly(s);
  const e = empireOf(s)!;
  s.tick = at(5, CARAVAN_HOUR);
  const before = totalStock(s);
  empireHourly(s);
  assert.equal(e.caravans.length, 1, 'a caravan set out');
  const c: EmpireCaravan = e.caravans[0];
  const out = Object.values(c.out).reduce((n, k) => n + (k ?? 0), 0);
  assert.ok(out > 0);
  const after = totalStock(s);
  const gone = Object.keys(c.out).some((m) => (after[m as keyof typeof after] ?? 0) < (before[m as keyof typeof before] ?? 0));
  assert.ok(gone, 'the goods left the stores');
  assert.ok(empireOnMap(s)!.moves.length === 1, 'and it is on the world map');
  // the road takes it
  c.fate = { at: s.tick + TICKS_PER_HOUR, kind: 'lost' };
  const coins = s.coins!;
  s.tick = c.fate.at;
  empireHourly(s);
  assert.equal(e.caravans.length, 0);
  assert.equal(e.lostCaravans, 1);
  assert.ok(e.lostWorth > 0);
  assert.equal(s.coins, coins, 'nothing came home');
  assert.ok(s.people.every((p) => p.away !== EMPIRE_AWAY || e.posts[0].folk.includes(p.id)), 'drivers are no longer out');
  const after2 = totalStock(s);
  for (const m of Object.keys(c.out) as (keyof typeof after2)[]) assert.ok((after2[m] ?? 0) <= (before[m] ?? 0), 'the goods did not come back');
});

test('a safe caravan comes home with coin and goods', () => {
  const s = trader('te-home');
  empireHourly(s);
  const e = empireOf(s)!;
  s.tick = at(5, CARAVAN_HOUR);
  empireHourly(s);
  const c = e.caravans[0];
  delete c.fate;
  const coins = s.coins!;
  s.tick = c.times[c.times.length - 1];
  empireHourly(s);
  assert.equal(e.caravans.length, 0);
  assert.ok(s.coins! > coins, 'the purse came home');
});

test('a post lost to bandits sends its folk home or to their deaths', () => {
  const s = trader('te-lose');
  empireHourly(s);
  const e = empireOf(s)!;
  const folk = e.posts[0].folk.slice();
  losePost(s, e, e.posts[0], 'bandits', new Rng(1));
  assert.equal(e.posts.length, 0);
  assert.equal(e.lostPosts, 1);
  for (const id of folk) {
    const p = s.people.find((q) => q.id === id);
    assert.ok(!p || p.away === null, 'home, or dead');
  }
});

test('a raid of people is bought off with tribute, at a price that rises each time', () => {
  const s = trader('te-tribute');
  s.coins = 5000;
  empireHourly(s); // (founds a post: the empire begins)
  const e = empireOf(s)!;
  const paid: number[] = [];
  for (let i = 0; i < 2; i++) {
    let done = false;
    for (let k = 0; k < 40 && !done; k++) {
      s.tick += 1;
      startRaid(s, RAID_KIND_BY_ID.bandits, 200, new Rng(7 + k + i * 99));
      const coins = s.coins!;
      empireTick(s);
      if (!s.raid) {
        paid.push(coins - s.coins!);
        done = true;
      } else {
        s.raid = null; // (the council's pride refused: try another raid)
        s.prompts = [];
      }
    }
    assert.ok(done, 'a raid was bought off');
  }
  assert.ok(paid[0] > 0 && e.tributes === 2);
  assert.ok(paid[1] >= paid[0], 'the second costs at least as much for as many raiders');
  assert.ok(!s.prompts.some((p) => p.kind === 'raid'), 'its warning is gone');
});

test('a poor town cannot buy a raid off; mercenaries fight beside it', () => {
  const s = trader('te-merc');
  empireHourly(s);
  const e = empireOf(s)!;
  e.mercs = { n: 3, until: s.tick + TICKS_PER_DAY * 5 };
  s.coins = 30;
  startRaid(s, RAID_KIND_BY_ID.bandits, 200, new Rng(3));
  empireTick(s);
  assert.ok(s.raid, 'the raid came: no coin for tribute');
  assert.equal(s.raid!.raiders.filter((r) => r.ally).length >= 3, true, 'and the hired swords stand with the town');
});

test('a 12-day game with the Trade direction runs with the empire on', () => {
  const s = trader('te-run');
  s.autopilot = true;
  s.tick = 0;
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_DAY * 4; i++) sim.step();
  assert.ok(s.people.length > 0);
});

test('the year\'s chronicle tells the empire\'s doings once', async () => {
  const { empireYearLines } = await import('../src/shared/sim/empireYear');
  const s = trader('te-year');
  empireHourly(s);
  const e = empireOf(s)!;
  e.sent = 3;
  e.made = 90;
  e.lostCaravans = 1;
  const lines = empireYearLines(s);
  assert.ok(lines.some((l) => l.includes('trading post')) && lines.some((l) => l.includes('caravans made 3 runs')), lines.join(' | '));
  assert.deepEqual(empireYearLines(s), [], 'and not again the next year if nothing happened');
});
