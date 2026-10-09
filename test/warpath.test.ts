import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BRAWL_AT, FURY_DAILY, GLORY_NAMES, RAID_HOURS, THRALL_WORK, WIN_WAAAGHS } from '../src/shared/data/warpath';
import { ORIGIN_DEFS } from '../src/shared/data/origins';
import { FOUNDERS } from '../src/shared/data/founders';
import { RIVALS } from '../src/shared/data/rivals';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { totalStock } from '../src/shared/sim/buildings';
import { realm } from '../src/shared/sim/factions';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makePerson, newGame, type GameState } from '../src/shared/sim/state';
import { keepKin } from '../src/shared/sim/townsfolk';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { addGlory, callRaid, checkWin, hordeHourly, hordeOf, hordeView, RAID_AWAY, sendRaid } from '../src/shared/sim/warpath';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function horde(seed: string, n = 6): GameState {
  const s = plainGame(seed);
  s.origin = 'orcs';
  s.autopilot = true;
  s.tick = at(5, 8);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  const rng = new Rng(7);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'hunter', { x: c.x, y: c.y }, s.people.map((q) => q.name)));
  for (const f of realm(s)) f.known = true;
  return s;
}

test('the orcs are a whole people: an origin, founders, a rival warband with its own lord and sprites', () => {
  assert.equal(ORIGIN_DEFS.orcs.name, 'Orc Warband');
  assert.equal(FOUNDERS.orcs.length, 3);
  for (const f of FOUNDERS.orcs) assert.equal(f.look.body, 'orc');
  assert.equal(RIVALS.orcs.leader, 'orc_warlord');
  const kind = RAID_KIND_BY_ID[RIVALS.orcs.raid];
  for (const id of [...Object.keys(kind.enemies), kind.leader!]) assert.ok(ENEMIES[id], id);
});

test('an orc town founds as greenskins, and its own are kept so', () => {
  const s = newGame('orc-found', { origin: 'orcs', founder: { name: 'Grakk', pick: 'grakk' } as never });
  assert.equal(s.origin, 'orcs');
  keepKin(s);
  for (const p of s.people) assert.equal(p.look.body, 'orc', p.name);
});

test('fury rises each morning, faster in long peace, and boils over into brawls', () => {
  const s = horde('orc-fury');
  const h = hordeOf(s)!;
  const f0 = h.fury;
  h.lastRaid = s.tick; // (no call to war yet)
  hordeHourly(s);
  assert.equal(h.fury, f0 + FURY_DAILY, 'a day of peace');
  h.lastFight = s.tick - 5 * TICKS_PER_DAY;
  h.fury = BRAWL_AT;
  s.tick += TICKS_PER_DAY;
  hordeHourly(s);
  assert.ok(h.fury > BRAWL_AT + FURY_DAILY, 'restless: faster');
  assert.ok(s.marks?.some((m) => m.text === 'The horde is restless'));
});

test('the war drums: a raid called and answered; the party goes out and comes home with plunder, captives and glory', () => {
  const s = horde('orc-raid', 8);
  const h = hordeOf(s)!;
  for (const p of s.people) p.skills.melee.level = 40; // (strong enough to win)
  h.fury = 60;
  const q = callRaid(s, h)!;
  assert.ok(q, 'asked');
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.ok(h.out, 'out raiding');
  const out = h.out!.ids.length;
  assert.ok(s.people.filter((p) => p.away === RAID_AWAY).length === out);
  const coins = s.coins ?? 0;
  s.tick += RAID_HOURS * TICKS_PER_HOUR;
  hordeHourly(s);
  assert.equal(h.out, undefined);
  assert.ok(s.people.every((p) => p.away !== RAID_AWAY), 'home');
  assert.equal(h.won, 1, 'a strong party wins');
  assert.ok((s.coins ?? 0) > coins, 'plunder to the hoard');
  assert.ok(s.prisoners.length >= 1, 'captives dragged home');
  assert.equal(h.sacked.length, 1);
  assert.ok(Object.values(h.glory).some((g) => g >= 10));
});

test('held back, the horde grumbles and its fury grows', () => {
  const s = horde('orc-hold');
  const h = hordeOf(s)!;
  h.fury = 50;
  const q = callRaid(s, h)!;
  answerPrompt(s, q.id, q.options.length - 1, new Rng(1));
  assert.equal(h.out, undefined);
  assert.equal(h.fury, 60);
});

test('thralls work: each prisoner hauls wood and stone into the stores each morning', () => {
  const s = horde('orc-thralls');
  const h = hordeOf(s)!;
  h.lastRaid = s.tick;
  h.fury = 0;
  s.prisoners.push({ id: s.nextId++, enemy: 'bandit', name: 'Thrall', conviction: 0, since: s.tick, hungry: false });
  const wood = totalStock(s).wood ?? 0;
  hordeHourly(s);
  assert.equal((totalStock(s).wood ?? 0) - wood, THRALL_WORK.wood);
});

test('glory brings names in blood', () => {
  const s = horde('orc-glory');
  const h = hordeOf(s)!;
  const p = s.people[1];
  addGlory(s, h, p, GLORY_NAMES[1][0]);
  assert.equal(p.titles?.length, 2, 'the first two names');
  assert.ok(hordeView(s)!.glory[0].title);
});

test('the Waaagh! at full fury: marks on the town, the whole horde marches; the Great Waaagh wins', () => {
  const s = horde('orc-waaagh', 8);
  const h = hordeOf(s)!;
  h.fury = 100;
  hordeHourly(s);
  assert.ok(h.waaagh, 'called');
  assert.equal(h.waaaghs, 1);
  assert.ok(h.out?.waaagh, 'marching');
  assert.ok(s.marks?.some((m) => m.lever === 'fight' && m.text === 'WAAAGH!'));
  // the win: every power sacked, and Waaaghs enough
  h.out = undefined;
  for (const p of s.people) p.away = null;
  h.sacked = realm(s).map((f) => f.id);
  assert.equal(checkWin(s, h), WIN_WAAAGHS <= 1);
  h.waaaghs = WIN_WAAAGHS;
  assert.ok(checkWin(s, h));
  assert.ok(s.gameOver?.won);
});

test('a road raid scares the travellers off; a town run by hand never raids', () => {
  const s = horde('orc-roads');
  const h = hordeOf(s)!;
  assert.ok(sendRaid(s, h, 'roads', false));
  s.tick += RAID_HOURS * TICKS_PER_HOUR;
  hordeHourly(s);
  const t = plainGame('orc-plain');
  t.origin = 'orcs';
  hordeHourly(t);
  assert.equal(t.horde, undefined);
});
