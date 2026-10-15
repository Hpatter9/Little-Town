// Fixes batch 6: the fallen keep their guild's badge, a town of the light or dark has its own sayings, the town talks of
// the intrigue's whispers, and a secret kept shows in its keeper's diary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { ALIGN_SAYINGS } from '../src/shared/data/alignment';
import { cultureView } from '../src/shared/sim/culture';
import { diaryFacts, writeDiary } from '../src/shared/sim/diary';
import { townGossip, whisperGossip, gossipLine, gossipReply, sayingOf } from '../src/shared/sim/gossip';
import { killPerson } from '../src/shared/sim/health';
import { foundGuild } from '../src/shared/sim/guilds';
import { intrigueOf } from '../src/shared/sim/intrigue';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('the fallen keep the guild they belonged to, for their badge', () => {
  const s = plainGame('fallen-guild');
  for (const p of s.people) p.level = 8;
  for (let i = 0; i < 4; i++) {
    const q = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((x) => x.name));
    s.people.push(q);
  }
  const g = foundGuild(s, 'wardens', new Rng(3), 'person')!;
  assert.ok(g, 'a guild stands');
  const member = s.people.find((p) => p.id === g.members[0])!;
  const outsider = makePerson(new Rng(99), s.nextId++, 'hunter', s.people[0], s.people.map((x) => x.name));
  s.people.push(outsider);
  killPerson(s, outsider, 'of the fever');
  assert.equal(s.fallen!.at(-1)!.guild, undefined, 'no guild, none kept');
  assert.notEqual(member.id, s.mainId, 'the founder is not the guild member picked');
  killPerson(s, member, 'at the hands of the bandits');
  const f = s.fallen!.at(-1)!;
  assert.equal(f.guild?.role, 'wardens');
  assert.equal(f.guild?.name, g.name);
  assert.equal(snapshot(s).annals.fallen[0].guild?.role, 'wardens', 'the hall shows it');
});

test('a good or an evil town says so now and then; between, it does not', () => {
  const s = plainGame('align-sayings');
  s.align = { score: 0, order: 0, log: [] } as unknown as typeof s.align;
  assert.equal(cultureView(s).sayings.greet, undefined);
  s.align!.score = 50;
  for (const line of ALIGN_SAYINGS.good.greet!) assert.ok(cultureView(s).sayings.greet!.includes(line));
  s.align!.score = -50;
  for (const line of ALIGN_SAYINGS.evil.greet!) assert.ok(cultureView(s).sayings.greet!.includes(line));
  assert.ok(!cultureView(s).sayings.greet!.includes(ALIGN_SAYINGS.good.greet![0]));
});

test('the town talks of the whispers going round, and they stay out of the journal', () => {
  const s = plainGame('whisper-talk');
  const st = intrigueOf(s);
  st.whispers.push({ tick: s.tick, text: 'Folk say the shopkeepers pay somebody for "peace".', house: 1 });
  const news = whisperGossip(st.whispers, s.tick);
  assert.equal(news.length, 1);
  assert.equal(news[0].kind, 'whisper');
  const said = sayingOf(news[0], 0.1)!;
  assert.ok(said.includes('shopkeepers'));
  assert.ok(gossipLine(news[0], 'shy', 0.3).includes('shopkeepers'));
  assert.ok(gossipReply(news[0], 'bold', 0.2).length > 0);
  assert.equal(townGossip(s.journal, s.tick).some((g) => g.kind === 'whisper'), false);
  assert.ok(snapshot(s).gossip.length === 0 || snapshot(s).gossip.some((g) => g.kind === 'whisper'));
  assert.equal(whisperGossip(st.whispers, s.tick + 10 * TICKS_PER_DAY).length, 0, 'old whispers are not talked of');
});

test('someone with a secret writes of it in their diary, in their own words', () => {
  const s = plainGame('secret-diary');
  const p = s.people[0];
  p.debt = 100;
  const facts = diaryFacts(s, p);
  assert.match(facts.secret ?? '', /I owe far more than anyone knows/);
  // (it appears on about half the days: some day carries it)
  let shown = 0;
  for (let day = 0; day < 20; day++) if (writeDiary({ ...facts, day }).join(' ').includes('owe far more than anyone knows')) shown++;
  assert.ok(shown > 3 && shown < 20, `${shown} of 20 days`);
  p.debt = 0;
  assert.equal(diaryFacts(s, p).secret, null);
  intrigueOf(s).secrets.push({ about: p.id, what: 'stole a loaf from the granary, and nobody knows', day: 3 });
  assert.match(diaryFacts(s, p).secret ?? '', /^I stole a loaf from the granary, and nobody saw me/);
});

test("the empire's ships are drawn as the fleet's boats: the best of the fleet, else what the town can build", async () => {
  const { tradeShips, shipKind } = await import('../src/shared/sim/boats');
  const { empireOnMap } = await import('../src/shared/sim/tradeEmpire');
  const s = plainGame('empire-ship');
  assert.equal(tradeShips(s).length, 0, 'no empire, no ships');
  s.empire = { posts: [], caravans: [{ id: 901, kind: 'ship', start: s.tick, path: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }], times: [s.tick, s.tick + 100, s.tick + 200], stops: [], out: {}, back: {}, purse: 0, worth: 0, drivers: [] }, { id: 902, kind: 'caravan', start: s.tick, path: [], times: [], stops: [], out: {}, back: {}, purse: 0, worth: 0, drivers: [] }] } as unknown as typeof s.empire;
  assert.equal(shipKind(s), 'dugout', 'the first age: a dugout');
  s.boats = [{ id: 5, kind: 'longboat', name: 'Gull', hull: 10, away: null }] as unknown as typeof s.boats;
  const ships = tradeShips(s);
  assert.equal(ships.length, 1, 'only the ship, not the caravan');
  assert.equal(ships[0].kind, 'longboat');
  assert.equal(ships[0].id, 901);
  assert.ok(ships[0].away, 'it is away, so the boats layer sails it on the lane');
  assert.equal(empireOnMap(s)!.moves.find((m) => m.kind === 'ship')!.boat, 'longboat', 'the world map draws the same boat');
});
