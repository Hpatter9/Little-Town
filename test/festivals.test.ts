import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FESTIVALS, FESTIVAL_DAY, FESTIVAL_HOUR, FESTIVAL_HOURS, PREP_DAYS, festivalFor, foodId, wareId } from '../src/shared/data/festivals';
import { ORIGINS } from '../src/shared/data/origins';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { EVENTS } from '../src/shared/data/events';
import { EVENT_MORE } from '../src/shared/data/eventMore';
import { ceremoniesHourly } from '../src/shared/sim/ceremonies';
import { festivalSoon, festivalsHourly, festivalsView } from '../src/shared/sim/festivals';
import { faithOf } from '../src/shared/sim/faith';
import { Sim } from '../src/shared/sim/sim';
import { addStock, maxHp, newGame, type GameState, type Person } from '../src/shared/sim/state';
import { storages } from '../src/shared/sim/buildings';
import { calendar, SEASONS, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

function town(seed: string, n: number, origin?: string): GameState {
  const s = origin ? newGame(seed, { origin: origin as never }) : plainGame(seed);
  if (origin) {
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
    s.battles = false;
  }
  for (let i = 0; i < n; i++) {
    const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, partner: null };
    p.hp = maxHp(p);
    s.people.push(p);
  }
  s.autopilot = undefined;
  return s;
}

/** On, hour by hour, to a day of the season and an hour (the festivals' and ceremonies' hourly turns only). */
function to(s: GameState, day: number, hour: number) {
  let guard = 0;
  do {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
    festivalsHourly(s);
    if (++guard > 24 * 50) throw new Error('never got there');
  } while (!(calendar(s.tick).dayOfSeason === day && calendar(s.tick).hour === hour));
}
const feed = (s: GameState, n = 200) => addStock(storages(s)[0].store, 'berries', n);

test('every people has a festival in each season, each with its own food, ware and song', () => {
  for (const o of ORIGINS) for (const season of SEASONS) assert.ok(festivalFor(o, season), `${o} ${season}`);
  assert.equal(FESTIVALS.length, ORIGINS.length * SEASONS.length);
  assert.equal(new Set(FESTIVALS.map((f) => f.id)).size, FESTIVALS.length, 'ids unique');
  assert.equal(new Set(FESTIVALS.map((f) => f.name)).size, FESTIVALS.length, 'names unique');
  assert.equal(new Set(FESTIVALS.map((f) => f.song.name)).size, FESTIVALS.length, 'songs unique');
  for (const f of FESTIVALS) {
    assert.ok(ITEM_BY_ID[foodId(f)] && ITEM_BY_ID[wareId(f)], f.id);
    assert.equal(ITEM_BY_ID[foodId(f)].station, 'campfire');
    assert.ok(f.lore.length > 40, `${f.id} has its lore`);
  }
});

test('the town makes ready: the food and ware are ordered at the fire before the day', () => {
  const s = town('fest1', 5);
  feed(s);
  to(s, FESTIVAL_DAY - PREP_DAYS, 7);
  const f = festivalFor(s.origin, calendar(s.tick).season);
  assert.equal(s.festival?.id, f.id);
  assert.equal(s.festival?.phase, 'prep');
  assert.ok(festivalSoon(s));
  assert.ok(s.crafting.some((o) => o.item === foodId(f)), 'its food ordered');
  assert.ok(s.crafting.some((o) => o.item === wareId(f)), 'its ware ordered');
  const v = festivalsView(s);
  assert.equal(v.next.id, f.id);
  assert.equal(v.next.days, PREP_DAYS);
  assert.equal(v.calendar.length, 4);
});

test('on its day travellers come, the town gathers and dances, and it leaves a boon and a god pleased', () => {
  const s = town('fest2', 5);
  feed(s);
  to(s, FESTIVAL_DAY - PREP_DAYS, 7);
  const f = festivalFor(s.origin, calendar(s.tick).season);
  // (as if the crafters had made them)
  s.items[foodId(f)] = 5;
  s.items[wareId(f)] = 5;
  const before = faithOf(s).favour[f.god];
  const coins = s.coins ?? 0;
  to(s, FESTIVAL_DAY, 10);
  assert.ok((s.travellers ?? []).some((t) => t.band !== undefined), 'visitors come in for it');
  assert.ok(s.marks?.some((m) => m.lever === 'travellers' && m.until > s.tick));
  to(s, FESTIVAL_DAY, FESTIVAL_HOUR);
  assert.equal(s.gathering?.kind, 'festival');
  assert.equal(s.gathering?.festival, f.id);
  assert.equal(s.gathering?.ids.length, s.people.length, 'everyone comes');
  assert.ok((s.coins ?? 0) > coins, 'the visitors buy the wares');
  assert.ok((s.items[foodId(f)] ?? 0) < 5, 'the food is shared');
  for (let h = 0; h < FESTIVAL_HOURS; h++) {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
    festivalsHourly(s);
  }
  assert.equal(s.gathering, undefined, 'over');
  assert.ok(s.marks?.some((m) => m.text === f.name && m.value > 0), 'the spirits lifted');
  assert.ok(s.marks?.some((m) => m.lever === f.boon.lever && m.value > 1), 'its boon');
  assert.ok(faithOf(s).favour[f.god] > before, 'its god pleased');
  assert.equal(s.festivalLog?.at(-1)?.outcome, 'held');
  assert.equal(festivalsView(s).calendar.find((r) => r.id === f.id)?.last?.outcome, 'held');
});

test('skipped for want of food: the town is sore and the god offended', () => {
  const s = town('fest3', 5);
  for (const st of storages(s)) st.store = {};
  to(s, FESTIVAL_DAY - PREP_DAYS, 7);
  const f = festivalFor(s.origin, calendar(s.tick).season);
  const before = faithOf(s).favour[f.god];
  to(s, FESTIVAL_DAY, FESTIVAL_HOUR + 1);
  assert.notEqual(s.gathering?.kind, 'festival');
  assert.equal(s.festivalLog?.at(-1)?.outcome, 'skipped');
  assert.ok(s.marks?.some((m) => m.lever === 'morale' && m.value < 0 && m.text.includes(f.name)));
  assert.ok(faithOf(s).favour[f.god] < before);
  assert.ok(!s.crafting.some((o) => o.item === foodId(f)), 'its orders dropped');
});

test('a town of the dead keeps its festivals: nobody eats, so it is never skipped for food', () => {
  const s = town('fest4', 3, 'lich');
  for (const st of storages(s)) st.store = {};
  to(s, FESTIVAL_DAY, FESTIVAL_HOUR);
  assert.equal(s.gathering?.kind, 'festival');
  assert.equal(festivalFor('lich', calendar(s.tick).season).origin, 'lich');
});

test('nothing with the autopilot off (the tests\' plain towns)', () => {
  const s = plainGame('fest5');
  feed(s);
  for (let t = 0; t < TICKS_PER_DAY * 8; t += TICKS_PER_HOUR) {
    s.tick += TICKS_PER_HOUR;
    festivalsHourly(s);
  }
  assert.equal(s.festival, undefined);
});

test('festival-only events: each has its passage, and comes only while one is near', () => {
  const ids = EVENTS.filter((e) => e.id.startsWith('fest_')).map((e) => e.id);
  assert.ok(ids.length >= 13, `${ids.length} festival events`);
  for (const id of ids) assert.ok(EVENT_MORE[id], `${id} has its passage`);
  const s = town('fest6', 6);
  feed(s);
  for (const e of EVENTS.filter((x) => x.id.startsWith('fest_'))) assert.equal(e.when?.(s) ?? true, false, `${e.id} without a festival`);
  to(s, FESTIVAL_DAY - 1, 9);
  assert.ok(EVENTS.filter((e) => e.id.startsWith('fest_')).some((e) => e.when!(s)), 'some come while making ready');
});

test('a whole town keeps its season\'s festival by itself, deterministically', () => {
  const run = () => {
    const s = newGame('fest-run', { origin: 'settlers' });
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
    const sim = new Sim(s);
    const until = (FESTIVAL_DAY - 1) * TICKS_PER_DAY + 12 * TICKS_PER_HOUR;
    while (s.tick < until) sim.step();
    return s;
  };
  const a = run();
  const b = run();
  assert.equal(JSON.stringify(a.festivalLog ?? []), JSON.stringify(b.festivalLog ?? []));
  assert.ok((a.festivalLog ?? []).length >= 1, 'a festival came and went');
});

test('every festival has a song of its own that composes', async () => {
  const { compose, festivalPiece } = await import('../src/renderer/musicScore');
  const { moodOf } = await import('../src/renderer/musicMood');
  const keys = new Set<string>();
  for (const f of FESTIVALS) {
    const p = festivalPiece(`fest:${f.id}`);
    assert.ok(p, f.id);
    assert.equal(p!.name, f.song.name);
    assert.ok(compose(p!, 1).length > 20, `${f.id} has notes`);
    keys.add(`${p!.root}|${p!.a.join()}|${p!.bpm}|${p!.lead}`);
  }
  assert.ok(keys.size >= FESTIVALS.length - 2, 'no two alike (near enough)');
  assert.equal(moodOf({ raid: false, boss: false, fight: false, daylight: 1, season: 'spring', theme: 'town', gathering: 'festival', biome: 'forest' }), 'festival');
});
