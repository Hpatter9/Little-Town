import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { DRAGON_DEST, DRAGON_FIRST_DAY, FLEE_AT, OMEN_FLIGHTS, PASS_TICKS, dragonFor, dragonHome, dragonTick, summonDragon, tributeOf, volley } from '../src/shared/sim/dragon';
import { destinationOf, destinationUnlocked } from '../src/shared/sim/expeditions';
import { boardDestinations } from '../src/shared/sim/parties';
import { totalStock } from '../src/shared/sim/buildings';
import { makePerson, campXY, type Expedition, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true; // (the dragon comes only to a town running itself; the tests drive dragonTick alone)
  s.tick = DRAGON_FIRST_DAY * TICKS_PER_DAY;
  for (let i = 1; i < 7; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  put(s, 'stockpile', 4, row(s));
  return s;
}
/** Run the dragon hour by hour until `done` (at most `hours`). */
function hours(s: GameState, n: number, done: () => boolean = () => false): void {
  for (let i = 0; i < n * TICKS_PER_HOUR && !done(); i++) {
    s.tick++;
    dragonTick(s);
  }
}

test('a dragon by the land; it circles, then lands and demands tribute', () => {
  assert.equal(dragonFor('tundra'), 'rimewyrm');
  assert.equal(dragonFor('desert'), 'ashen_wyrm');
  assert.equal(dragonFor('forest'), 'dragon');
  const s = town('dragon-1');
  s.coins = 500;
  const d = summonDragon(s);
  s.tick -= s.tick % TICKS_PER_HOUR;
  hours(s, 40, () => s.prompts.some((p) => p.kind === 'dragon'));
  assert.equal(d.flights, OMEN_FLIGHTS, 'it circled first');
  const ask = s.prompts.find((p) => p.kind === 'dragon')!;
  assert.ok(ask, 'it demands');
  assert.equal(d.tribute, tributeOf(s, { ...d, paid: 0 }));
  assert.equal(ask.defaultOption, 0, 'a treasury that can pay pays, left alone');
  assert.ok(destinationUnlocked(s, destinationOf(s, DRAGON_DEST)!), 'its lair is on the board');
  assert.ok(boardDestinations(s).some((x) => x.id === DRAGON_DEST));
  const before = s.coins;
  answerPrompt(s, ask.id, 0, new Rng(1));
  assert.equal(d.phase, 'paid');
  assert.equal(s.coins, before - d.tribute);
  assert.ok(tributeOf(s, d) > 0);
});

test('refused, it comes down on the roofs; the engines and bows drive it off', () => {
  const s = town('dragon-2');
  s.coins = 0;
  const d = summonDragon(s);
  s.tick -= s.tick % TICKS_PER_HOUR;
  hours(s, 40, () => s.prompts.some((p) => p.kind === 'dragon'));
  const ask = s.prompts.find((p) => p.kind === 'dragon')!;
  assert.equal(ask.options[ask.defaultOption], 'Refuse: let it come', 'nothing to pay with: refused');
  answerPrompt(s, ask.id, ask.defaultOption, new Rng(1));
  assert.equal(d.phase, 'wrath');
  assert.equal(volley(s).dmg, 0, 'nothing in town can reach it yet');
  for (let i = 0; i < 4; i++) put(s, 'ballista', 2 + i * 3, row(s) + 3);
  assert.ok(volley(s).dmg > 0, 'the ballistae can');
  const hp = d.hp;
  hours(s, 12, () => d.passes > 0 && !d.flight);
  assert.ok(d.passes >= 1, 'it made a pass');
  assert.ok(d.hp < hp, 'and was struck');
  // (it asks again every few passes: the town still can't pay)
  for (let k = 0; k < 10 && (d.phase as string) !== 'driven'; k++) {
    hours(s, 24, () => d.phase === 'driven' || s.prompts.some((p) => p.kind === 'dragon'));
    const again = s.prompts.find((p) => p.kind === 'dragon');
    if (again) answerPrompt(s, again.id, again.defaultOption, new Rng(2));
  }
  assert.equal(d.phase, 'driven', 'struck enough, it flies off for good');
  assert.ok(d.hp <= d.maxHp * FLEE_AT);
  void PASS_TICKS;
});

test('slain in its lair: the hoard comes home and the party are Dragonslayers', () => {
  const s = town('dragon-3');
  const d = summonDragon(s);
  d.phase = 'wrath';
  const party = s.people.slice(1, 4);
  const e = { dest: DRAGON_DEST, cleared: true, recalled: false, members: party.map((p) => p.id) } as unknown as Expedition;
  const gold = totalStock(s).gold ?? 0;
  dragonHome(s, e, party);
  assert.equal(d.phase, 'slain');
  assert.ok((totalStock(s).gold ?? 0) > gold, 'its gold is the town\'s');
  assert.ok(party.every((p) => p.titles?.includes('Dragonslayer')));
  assert.equal(destinationOf(s, DRAGON_DEST), undefined, 'its lair is gone from the board');
});

test('no dragon comes to a small or young town', () => {
  const s = town('dragon-4');
  s.people.length = 3;
  hours(s, 24 * 10);
  assert.equal(s.dragon, undefined);
});
