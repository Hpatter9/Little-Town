import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ELITE_FIGHT, GUILD_HOUR, MENDER_CARE, ORIGIN_WORDS, WARDEN_FIGHT } from '../src/shared/data/guilds';
import { Rng } from '../src/shared/rng';
import { guildCare, guildFight, guildOf, guildWork } from '../src/shared/sim/guildPerks';
import { foundGuild, guildName, guildsHourly, lacking, needOf } from '../src/shared/sim/guilds';
import { politicsOf } from '../src/shared/sim/politics';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { totalStock } from '../src/shared/sim/buildings';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** A self-running town of `n` grown-ups, a few of them good healers. */
function town(seed: string, n = 8): GameState {
  const s = plainGame(seed);
  const rng = new Rng(7);
  const c = s.people[0];
  while (s.people.length < n) {
    const p = makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name));
    s.people.push(p);
  }
  for (const p of s.people.slice(1, 4)) p.skills.medicine.level = 5;
  s.autopilot = true;
  return s;
}

test('the town notices the role it lacks: the hurt and the sick ask for healers', () => {
  const s = town('guild-need');
  for (const p of s.people.slice(4)) p.sick = { until: s.tick + TICKS_PER_DAY * 3 };
  assert.ok(needOf(s, 'menders') >= 6);
  assert.equal(lacking(s), 'menders');
});

test('a townsperson founds a guild: named by the town, led by the fittest, told in the event box', () => {
  const s = town('guild-found');
  for (const p of s.people.slice(4)) p.sick = { until: s.tick + TICKS_PER_DAY * 3 };
  s.tick = at(6, GUILD_HOUR);
  const before = s.prompts.length;
  guildsHourly(s);
  const g = s.guilds?.[0];
  assert.ok(g, 'a guild was founded');
  assert.equal(g.role, 'menders');
  assert.ok(g.members.length >= 3);
  assert.ok(s.people.slice(1, 4).some((p) => p.id === g.leader), 'a healer leads it');
  assert.ok(g.name.length > 4 && g.name.startsWith('The '));
  assert.ok(s.prompts.length > before, 'its founding is told');
  assert.equal(guildCare(s), MENDER_CARE);
  // (no second guild the same evening, nor a second menders' guild)
  s.tick += TICKS_PER_DAY;
  guildsHourly(s);
  assert.equal(s.guilds!.filter((x) => x.role === 'menders').length, 1);
  assert.equal(snapshot(s).guilds[0].name, g.name);
});

test('the council may vote a guild in, by its blocs', () => {
  const s = town('guild-council', 9);
  politicsOf(s);
  for (const p of s.people.slice(4)) p.sick = { until: s.tick + TICKS_PER_DAY * 3 };
  const g = foundGuild(s, 'menders', new Rng(3), 'council');
  if (g) {
    assert.equal(g.by, 'council');
    assert.ok(g.votes && g.votes.for > g.votes.against);
  } else assert.ok(s.prompts.some((q) => q.title.includes('votes down')));
});

test('an elite squad: the seasoned fighters after a raid, a dark name, harder blows', () => {
  const s = town('guild-elite', 11);
  for (const p of s.people.slice(1, 5)) {
    p.level = 12;
    p.skills.melee.level = 9;
  }
  s.raidRecap = { tick: s.tick } as GameState['raidRecap'];
  assert.ok(needOf(s, 'elite') >= 4);
  const g = foundGuild(s, 'elite', new Rng(1), 'person')!;
  assert.ok(g.members.length >= 2 && g.members.length <= 4);
  const member = s.people.find((p) => p.id === g.members[0])!;
  assert.equal(guildFight(s, member), ELITE_FIGHT);
  const words = ORIGIN_WORDS[s.origin ?? 'settlers'].elite;
  assert.ok(words.some((w) => g.name.includes(w)) || g.name.includes(' of '), g.name);
  const outsider = s.people.find((p) => !guildOf(s, p))!;
  assert.equal(guildFight(s, outsider), 1);
  assert.ok(WARDEN_FIGHT < ELITE_FIGHT);
});

test('guild perks at work: crafters craft faster, rangers bring home meat', () => {
  const s = town('guild-perks');
  for (const p of s.people.slice(4, 7)) {
    p.skills.crafting.level = 6;
    p.skills.ranged.level = 6;
  }
  const crafters = foundGuild(s, 'crafters', new Rng(2), 'person')!;
  const c = s.people.find((p) => p.id === crafters.leader)!;
  c.task = { type: 'craft', order: 1, phase: 'work', from: null };
  assert.ok(guildWork(s, c) > 1);
  c.task = null;
  assert.equal(guildWork(s, c), 1);
  // (the rangers are those left over)
  for (const p of s.people.slice(1, 4)) p.skills.gathering.level = 5;
  const rangers = foundGuild(s, 'rangers', new Rng(2), 'person')!;
  assert.ok(rangers.members.length >= 2);
  const meat = totalStock(s).meat ?? 0;
  s.tick = at(3, GUILD_HOUR);
  s.lastGuild = s.tick;
  guildsHourly(s);
  assert.ok((totalStock(s).meat ?? 0) > meat, 'the rangers brought meat home');
});

test('a guild whose members are all gone is disbanded; a lost leader is replaced', () => {
  const s = town('guild-gone');
  const g = foundGuild(s, 'menders', new Rng(5), 'person')!;
  const lead = g.leader;
  s.people = s.people.filter((p) => p.id !== lead);
  s.tick = at(3, GUILD_HOUR);
  s.lastGuild = s.tick;
  guildsHourly(s);
  assert.notEqual(s.guilds![0].leader, lead);
  s.people = s.people.filter((p) => !s.guilds![0].members.includes(p.id) && p.skills.medicine.level < 3);
  s.tick += TICKS_PER_DAY;
  guildsHourly(s);
  assert.equal(s.guilds!.length, 0);
});

test('names are the town\'s own and never repeat; the hour is quiet without the autopilot', () => {
  const s = town('guild-names');
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) {
    const n = guildName(s, 'wardens', new Rng(i));
    (s.guilds ??= []).push({ id: i + 1, role: 'wardens', name: n, leader: 0, members: [], founded: 0, by: 'person', log: [] });
    assert.ok(!seen.has(n), n);
    seen.add(n);
  }
  const q = town('guild-off');
  q.autopilot = false;
  for (const p of q.people.slice(4)) p.sick = { until: q.tick + TICKS_PER_DAY * 3 };
  q.tick = at(6, GUILD_HOUR);
  guildsHourly(q);
  assert.equal(q.guilds, undefined);
});
