import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { GRAIL_HONOUR, GRAIL_HOURS, GRAIL_STAGES, KNIGHT_LEVEL, LIEGE_HOURS, LIEGE_SENT, POVERTY_MOST, VOWS } from '../src/shared/data/chivalry';
import { Rng } from '../src/shared/rng';
import { checkVows, dub, grail, liegeCall, orderHourly, orderOf, tourney } from '../src/shared/sim/chivalry';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function order(seed: string, n = 5): GameState {
  const s = plainGame(seed);
  s.origin = 'knights';
  s.autopilot = true;
  s.era = 'medieval';
  s.tick = at(5, 9);
  const rng = new Rng(6);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'hunter', { x: c.x, y: c.y }, s.people.map((q) => q.name)));
  return s;
}

test('a vow kept raises the Order\'s honour and makes them worthy of knighthood; one broken shames it', () => {
  const s = order('kn-vows');
  const o = orderOf(s)!;
  const [a, b] = s.people.slice(1);
  o.vows[a.id] = { vow: 'temperance', since: s.tick - VOWS.temperance.days * TICKS_PER_DAY, felled: 0 };
  o.vows[b.id] = { vow: 'poverty', since: s.tick, felled: 0 };
  b.coins = POVERTY_MOST + 20;
  s.buildings[0].owner = b.id; // (owning property breaks the vow of poverty)
  const h = o.honour;
  checkVows(s, o);
  assert.equal(o.kept, 1);
  assert.equal(o.broken, 1);
  assert.ok(a.keptVow);
  assert.ok(o.honour !== h);
  a.skills.melee.level = KNIGHT_LEVEL;
  assert.ok(dub(s, o, a), 'knighted');
  assert.ok(a.titles?.includes('Knight of the Order'));
  assert.equal(dub(s, o, a), false, 'once');
});

test('a tournament: the best fighters joust, the winners take the purse', () => {
  const s = order('kn-tourney');
  const o = orderOf(s)!;
  for (const p of s.people) p.skills.melee.level = 30;
  const r = tourney(s, o);
  assert.equal(r.length, 3);
  assert.ok(r.some((x) => x.won), 'strong fighters win');
  assert.ok(s.prompts.some((p) => p.title === 'The Tournament'));
});

test('the liege calls: fighters ride out and come home with pay; refused, the Order pays for it', () => {
  const s = order('kn-liege');
  const o = orderOf(s)!;
  const q = liegeCall(s, o);
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(s.people.filter((p) => p.away !== null).length, LIEGE_SENT);
  s.tick += LIEGE_HOURS * TICKS_PER_HOUR;
  orderHourly(s);
  assert.equal(o.liege, undefined);
  assert.ok(s.people.every((p) => p.away === null));
  const h = o.honour;
  s.coins = 100;
  const q2 = liegeCall(s, o);
  answerPrompt(s, q2.id, 1, new Rng(2));
  assert.ok(o.honour < h && (s.coins ?? 0) < 100);
});

test('the Grail: at high honour the best rides out; three stages found win the game', () => {
  const s = order('kn-grail');
  const o = orderOf(s)!;
  o.honour = GRAIL_HONOUR;
  for (const p of s.people) p.skills.melee.level = 60; // (the best odds)
  let tries = 0;
  while (o.grail.stage < GRAIL_STAGES.length && tries++ < 40 && !s.gameOver) {
    o.grail.wait = 0;
    o.honour = Math.max(o.honour, GRAIL_HONOUR);
    if (o.grail.rider === undefined && !grail(s, o)) break;
    s.tick += GRAIL_HOURS * TICKS_PER_HOUR;
    orderHourly(s);
    for (const p of s.people) p.hp = 999;
  }
  assert.equal(o.grail.stage, GRAIL_STAGES.length, `stages found after ${tries} rides: ${o.log.join(" | ")} ${s.people.map((p) => [p.away, p.downed, p.hp].join("/")).join(",")}`);
  assert.ok(s.gameOver?.won);
  assert.ok(snapshot(s).heritage?.order);
});
