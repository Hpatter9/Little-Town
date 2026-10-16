import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FESTIVAL_DAY, festivalFor } from '../src/shared/data/festivals';
import { awayBefore, awaySummary } from '../src/shared/sim/awaySummary';
import { addCalendarSource, omensFor, upcoming, CALENDAR_DAYS } from '../src/shared/sim/calendar';
import { foreshadow, hintCandidates, openThreads, RAID_SEEN_HOURS, whenWords } from '../src/shared/sim/foreshadow';
import type { RaidRecap } from '../src/shared/sim/raidRecap';
import { serialize } from '../src/shared/sim/save';
import { maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { calendar, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

function town(seed: string, n = 3): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `Folk${"ABCDEFGHIJ"[i]}`, partner: null };
    p.hp = maxHp(p);
    s.people.push(p);
  }
  s.autopilot = true;
  s.nextRaidTick = s.tick + 30 * TICKS_PER_DAY;
  return s;
}
/** On to a day of the season at an hour (the clock only). */
function at(s: GameState, dayOfSeason: number, hour: number) {
  while (!(calendar(s.tick).dayOfSeason === dayOfSeason && calendar(s.tick).hour === hour)) s.tick += TICKS_PER_HOUR;
}
const party = (s: GameState, phase: 'out' | 'back', hoursLeft: number) =>
  s.expeditions.push({ id: s.nextId++, dest: 'nowhere', members: [s.people[1].id], leader: s.people[1].id, phase, elapsed: 0, outTicks: 1, workTicks: 1, backTicks: hoursLeft * TICKS_PER_HOUR, battle: null } as never);

test('no hints, threads or omens with the autopilot off', () => {
  const s = town('ant-off');
  s.nextRaidTick = s.tick + 2 * TICKS_PER_HOUR;
  s.autopilot = false;
  assert.deepEqual(hintCandidates(s), []);
  assert.deepEqual(openThreads(s), []);
  assert.deepEqual(omensFor(s, 0), []);
});

test('a raid near is foreshadowed by campfires; the text has no numbers; reading changes nothing', () => {
  const s = town('ant-raid');
  s.nextRaidTick = s.tick + (RAID_SEEN_HOURS - 2) * TICKS_PER_HOUR;
  const before = serialize(s, 0);
  const raid = hintCandidates(s).find((h) => h.kind === 'raid');
  assert.ok(raid && !raid.false, 'a true raid hint');
  assert.ok(!/\d/.test(raid.text), raid.text);
  assert.deepEqual(foreshadow(s), foreshadow(s), 'the same hints for the same town');
  assert.equal(serialize(s, 0), before, 'foreshadowing only reads');
  // too far off: no true hint
  s.nextRaidTick = s.tick + (RAID_SEEN_HOURS + 30) * TICKS_PER_HOUR;
  assert.ok(!hintCandidates(s).some((h) => h.kind === 'raid' && !h.false));
});

test('some true hints go unsaid and some campfires are false alarms', () => {
  const s = town('ant-false');
  let falses = 0;
  let quietDays = 0;
  let unsaid = 0;
  for (let d = 0; d < 120; d++) {
    s.nextRaidTick = s.tick + 30 * TICKS_PER_DAY;
    const far = hintCandidates(s).filter((h) => h.kind === 'raid');
    if (far.some((h) => h.false)) falses++;
    else quietDays++;
    s.nextRaidTick = s.tick + 4 * TICKS_PER_HOUR;
    if (!hintCandidates(s).find((h) => h.kind === 'raid')?.voiced) unsaid++;
    s.tick += TICKS_PER_DAY;
  }
  assert.ok(falses > 0 && quietDays > falses, `false alarms on ${falses} days`);
  assert.ok(unsaid > 0 && unsaid < 60, `left unsaid on ${unsaid} days`);
});

test('a party on its way home, the festival, the season turning and thin stores', () => {
  const s = town('ant-many');
  party(s, 'back', 5);
  at(s, FESTIVAL_DAY - 1, 9);
  const kinds = hintCandidates(s);
  const p = kinds.find((h) => h.kind === 'party');
  assert.ok(p?.text.startsWith(`${s.people[1].name}'s party should be home`), String(p?.text));
  assert.equal(kinds.find((h) => h.kind === 'festival')?.text, `${festivalFor(s.origin, calendar(s.tick).season).name} is tomorrow.`);
  assert.ok(kinds.some((h) => h.kind === 'stores'), 'nothing in store');
  assert.ok(!kinds.some((h) => h.kind === 'season'));
  at(s, DAYS_PER_SEASON, 9);
  assert.ok(hintCandidates(s).some((h) => h.kind === 'season'));
  for (const h of hintCandidates(s)) assert.ok(!/\d/.test(h.text), h.text);
  assert.equal(whenWords(1), 'any moment now');
});

test('the away card ends on the open threads, only after something worth a card', () => {
  const s = town('ant-away');
  party(s, 'out', 40);
  let b = awayBefore(s);
  s.tick += 600;
  assert.deepEqual(awaySummary(s, b), [], 'a quiet absence still has no card');
  b = awayBefore(s);
  s.tick += 600;
  s.raidRecap = { tick: s.tick, name: 'Wolves', outcome: 'victory', killed: 2 } as RaidRecap;
  const lines = awaySummary(s, b);
  const next = lines.filter((l) => l.tone === 'next');
  assert.ok(next.length >= 1 && next.length <= 3, JSON.stringify(lines));
  assert.equal(lines.at(-1)!.tone, 'next', 'the threads come last');
  assert.ok(next[0].text.startsWith(`${s.people[1].name}'s party is still out`), next[0].text);
});

test('the calendar: the festival, the next season, the rite, a caravan, other systems\' dates', () => {
  const s = town('ant-cal');
  at(s, 2, 9);
  s.buildings.push({ ...s.buildings[0], id: s.nextId++, def: 'market', status: 'done' }, { ...s.buildings[0], id: s.nextId++, def: 'wayside_shrine', status: 'done' });
  s.nextCaravanTick = s.tick + 2 * TICKS_PER_DAY;
  addCalendarSource('test', (_s, from) => [{ day: from + 1, kind: 'name-day', text: 'Wren\'s name-day' }]);
  const days = upcoming(s);
  addCalendarSource('test', () => []);
  assert.equal(days.length, CALENDAR_DAYS);
  assert.ok(days[0].today && days[0].dayOfSeason === 2);
  const all = days.flatMap((d) => d.entries.map((e) => ({ ...e, of: d.dayOfSeason })));
  assert.ok(all.some((e) => e.kind === 'festival' && e.of === FESTIVAL_DAY), JSON.stringify(all));
  assert.ok(all.some((e) => e.kind === 'season' && e.of === 1));
  assert.ok(all.some((e) => e.kind === 'rite'));
  assert.equal(all.find((e) => e.kind === 'caravan')?.day, calendar(s.nextCaravanTick).day);
  assert.equal(all.find((e) => e.kind === 'name-day')?.day, days[1].day);
  assert.ok(!all.some((e) => e.kind === 'omen'), 'no seer, no omens');
});

test('a seer marks days with omens, the Fate-touched more surely; the same all season', () => {
  const s = town('ant-omen', 6);
  for (const p of s.people.slice(1)) p.cls = 'shaman';
  const seasons = Array.from({ length: 12 }, (_, i) => omensFor(s, i));
  assert.ok(seasons.some((o) => o.length), 'some season has an omen');
  assert.ok(seasons.every((o) => o.length <= 2));
  for (const [i, o] of seasons.entries()) for (const e of o) {
    assert.ok(e.guess && e.kind === 'omen');
    assert.equal(Math.floor((e.day - 1) / DAYS_PER_SEASON), i, 'within its season');
  }
  assert.deepEqual(omensFor(s, 3), seasons[3], 'the same omens on another look');
  s.tick += 3 * TICKS_PER_DAY;
  assert.deepEqual(omensFor(s, 3), seasons[3], 'and later in the season');
});

test('the news bubble shows the hints, marked ⏳, keyed by the hint', async () => {
  const { hintNotices } = await import('../src/renderer/mobile/notices');
  const s = town('ant-bubble');
  s.nextRaidTick = s.tick + 3 * TICKS_PER_HOUR;
  const hints = foreshadow(s);
  const ns = hintNotices({ foreshadow: hints } as never);
  assert.equal(ns.length, hints.length);
  for (const [i, n] of ns.entries()) assert.ok(n.mark === '⏳' && n.key === `hint:${hints[i].key}` && n.title === hints[i].text);
  assert.deepEqual(hintNotices({} as never), [], 'an older snapshot has none');
});

test('a favourite\'s name-day is on the calendar', () => {
  const s = town('ant-name');
  const p = s.people[1];
  s.favourites = [p.id];
  const days = upcoming(s, 4 * DAYS_PER_SEASON);
  const hit = days.flatMap((d) => d.entries).filter((e) => e.kind === 'name-day');
  assert.equal(hit.length, 1, JSON.stringify(hit));
  assert.equal(hit[0].text, `${p.name}'s name-day`);
});
