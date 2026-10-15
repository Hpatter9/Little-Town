import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ARENA_AWAY, BOUT_HOUR, CARD_HOUR, SEASON_DAYS } from '../src/shared/data/arena';
import { Rng } from '../src/shared/rng';
import { arenaBet, arenaHourly, arenaOf, arenaTick, crown, noteJousts, postCard, seasonDay } from '../src/shared/sim/arena';
import { parseCommand } from '../src/shared/sim/commands';
import { addBeast } from '../src/shared/sim/ranch';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { DAYS_PER_SEASON, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** A self-running town of `n` grown-ups with purses, and an arena standing. */
function town(seed: string, n = 8): GameState {
  const s = plainGame(seed);
  const rng = new Rng(9);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name)));
  for (const p of s.people) {
    p.coins = 80;
    p.skills.melee.level = 6;
  }
  put(s, 'arena', (c.x / 32 + 6) | 0);
  s.coins = 200;
  s.autopilot = true;
  return s;
}

/** Fight the posted bout out, tick by tick. */
function fightItOut(s: GameState): void {
  s.tick = at(Math.floor(s.tick / TICKS_PER_DAY) + 1, BOUT_HOUR);
  arenaHourly(s);
  for (let i = 0; i < 20000 && s.arena!.bout && s.arena!.bout.ended === undefined; i++) {
    s.tick++;
    arenaTick(s);
  }
  // (the result lingers a moment for the fight screen, then the ring is clear)
  for (let i = 0; i < 100; i++) {
    s.tick++;
    arenaTick(s);
  }
}

test('the season runs on the first days of spring, summer and autumn, never in winter', () => {
  assert.ok(seasonDay(at(1, 12)));
  assert.ok(seasonDay(at(SEASON_DAYS, 12)));
  assert.ok(!seasonDay(at(SEASON_DAYS + 1, 12)));
  assert.ok(seasonDay(at(DAYS_PER_SEASON + 1, 12)), 'summer');
  assert.ok(!seasonDay(at(3 * DAYS_PER_SEASON + 1, 12)), 'winter');
});

test('a bout is posted at noon, the townsfolk bet from their purses, and the treasury may bet too', () => {
  const s = town('arena-card');
  s.tick = at(2, CARD_HOUR);
  arenaHourly(s);
  const card = s.arena!.card!;
  assert.ok(card, 'a card is posted');
  assert.equal(card.kind, 'champion');
  assert.notEqual(card.town.id, s.mainId, 'never the founder');
  assert.ok(card.pays.town > 1 && card.pays.visitor > 1);
  assert.ok(card.bets.length > 0, 'the townsfolk bet');
  const bettor = s.people.find((p) => p.id === card.bets[0].who)!;
  assert.ok((bettor.coins ?? 0) < 80, 'from their own purse');
  assert.ok(parseCommand({ type: 'arenaBet', on: 'town', amount: 25 }));
  assert.equal(parseCommand({ type: 'arenaBet', on: 'nobody', amount: 25 }), null);
  assert.ok(arenaBet(s, 'town', 50));
  assert.equal(s.coins, 150);
  assert.ok(arenaBet(s, 'visitor', 25), 'a bet replaced');
  assert.equal(s.coins, 175);
  assert.equal(card.bets.filter((b) => b.who === -1).length, 1);
  assert.ok(!arenaBet(s, 'town', 10000), 'not more than the treasury holds');
  assert.equal(snapshot(s).arena!.card!.treasury!.amount, 25);
});

test('the bout is fought out to a result: the fighter is in the ring, then home; purses, the book, the gate and the ladder', () => {
  const s = town('arena-bout');
  s.tick = at(2, CARD_HOUR);
  arenaHourly(s);
  const card = s.arena!.card!;
  arenaBet(s, 'town', 40);
  const fighter = s.people.find((p) => p.id === card.town.id)!;
  s.tick = at(2, BOUT_HOUR);
  arenaHourly(s);
  const bout = s.arena!.bout!;
  assert.ok(bout, 'the bout begins');
  assert.equal(fighter.away, ARENA_AWAY, 'in the ring');
  // (watchable on the fight screen)
  const sim = new Sim(s);
  sim.command({ type: 'watch', expedition: bout.id });
  sim.step();
  assert.equal(s.watching, bout.id);
  assert.ok(snapshot(s).watch, 'the fight screen has it');
  for (let i = 0; i < 20000 && bout.ended === undefined; i++) {
    s.tick++;
    arenaTick(s);
  }
  assert.ok(bout.ended !== undefined, 'it ended');
  assert.ok(bout.e.result, 'a result for the victory window');
  if (s.people.includes(fighter)) assert.equal(fighter.away, null, 'home again');
  const a = arenaOf(s);
  assert.equal(a.ladder.length, 2);
  assert.equal(a.ladder.reduce((n, e) => n + e.wins, 0), 1);
  assert.equal(a.past.length, 1);
  assert.ok(a.renown > 0);
  // (the gate paid the treasury: at least its base, whatever the bet did)
  assert.ok((s.coins ?? 0) > 200 - 40);
});

test('a ranch beast fights on alternate days, and a season ends with a crown', () => {
  const s = town('arena-beasts');
  put(s, 'beast_ranch', (s.people[0].x / 32 - 10) | 0);
  const b = addBeast(s, 'wolf', 'tamed', new Rng(2))!;
  b.sick = undefined;
  s.tick = at(2, CARD_HOUR);
  const card = postCard(s)!;
  assert.equal(card.kind, 'beasts');
  assert.equal(card.town.id, b.id);
  fightItOut(s);
  assert.equal(b.wins + b.losses, 1, 'its record kept');
  const top = crown(s);
  assert.ok(top);
  assert.equal(arenaOf(s).champions.length, 1);
});

test('a whole season runs itself, the final crowns a champion; a knights tournament counts on the ladder', () => {
  const s = town('arena-season', 10);
  for (let d = 1; d <= SEASON_DAYS; d++) {
    s.tick = at(d, CARD_HOUR);
    arenaHourly(s);
    if (s.arena?.card) fightItOut(s);
  }
  const a = arenaOf(s);
  assert.ok(a.past.length >= 3, `bouts were fought (${a.past.length})`);
  assert.equal(a.champions.length, 1, 'the final crowned someone');
  const jousts = s.people.slice(1, 3).map((p, i) => ({ p, won: i === 0 }));
  const before = a.ladder.length;
  noteJousts(s, jousts);
  assert.ok(arenaOf(s).ladder.length >= before);
  assert.ok(arenaOf(s).ladder.some((e) => e.key === `p${jousts[0].p.id}` && e.wins >= 1));
});

test('the same town fights the same bouts (deterministic), and nothing happens with the autopilot off', () => {
  const run = () => {
    const s = town('arena-same');
    s.tick = at(2, CARD_HOUR);
    arenaHourly(s);
    fightItOut(s);
    return JSON.stringify(s.arena!.past);
  };
  assert.equal(run(), run());
  const off = town('arena-off');
  off.autopilot = false;
  off.tick = at(2, CARD_HOUR);
  arenaHourly(off);
  assert.equal(off.arena, undefined);
});
