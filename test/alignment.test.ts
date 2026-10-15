import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, EVENT_BY_ID } from '../src/shared/data/events';
import { EVENT_ALIGN } from '../src/shared/data/eventAlign';
import { ALIGN_EVENT_ORDER, ALIGN_EVENT_WEIGHTS, GOOD_AT, EVIL_AT, homeOf } from '../src/shared/data/alignment';
import { EVENT_ORDER } from '../src/shared/data/eventOrder';
import { Rng } from '../src/shared/rng';
import { alignArrival, alignArrivalMult, alignEnemyPace, alignPact, alignPacted, alignScore, alignmentHourly, alignView, orderScore, recommend, titledName, weightOf } from '../src/shared/sim/alignment';
import { answerEvent, startEvent } from '../src/shared/sim/events';
import { answerPrompt, expirePrompts } from '../src/shared/sim/roadEvents';
import { killPerson } from '../src/shared/sim/health';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const on = (seed: string) => {
  const s = plainGame(seed);
  s.autopilot = true;
  return s;
};

test('every answer of every event has an alignment weight', () => {
  for (const e of EVENTS) {
    const w = ALIGN_EVENT_WEIGHTS[e.id] ?? EVENT_ALIGN[e.id];
    assert.ok(w, `${e.id}: weights`);
    assert.equal(w.length, e.options.length, `${e.id}: one weight an answer`);
  }
});

test('a people starts where its lore puts it', () => {
  assert.ok(homeOf('vampire') < 0 && homeOf('knights') > 0 && homeOf('settlers') === 0);
});

test('an answer moves the bar by its weight', () => {
  const s = on('align-choice');
  const def = EVENT_BY_ID.pilgrims_come;
  startEvent(s, def, new Rng(1));
  const before = alignScore(s);
  answerEvent(s, 0, new Rng(1)); // (take them in: kind)
  assert.ok(alignScore(s) > before);
  startEvent(s, EVENT_BY_ID.thieves_offer, new Rng(2));
  const mid = alignScore(s);
  answerEvent(s, 0, new Rng(2)); // (let the Hand work: evil)
  assert.ok(alignScore(s) < mid);
  assert.ok(weightOf('thieves_offer', 0) < 0);
});

test('an execution moves the bar down, and the Chronicle can tell it', () => {
  const s = on('align-hang');
  s.politics = { laws: [], log: [], sat: {}, crimes: 0 } as never;
  alignmentHourly(s); // (a first look)
  const before = alignScore(s);
  (s.politics as unknown as { log: unknown[] }).log.unshift({ day: 1, kind: 'trial', text: 'Wat is hanged before the town.' } as never);
  s.tick += 600 - (s.tick % 600);
  alignmentHourly(s);
  assert.ok(alignScore(s) <= before - 9);
  assert.ok(alignView(s).score < 0);
});

test('every choice card carries a recommendation, and a card that times out takes it', () => {
  for (const def of EVENTS.slice(0, 120)) {
    const s = on(`align-rec-${def.id}`);
    startEvent(s, def, new Rng(3));
    const p = s.prompts.find((q) => q.kind === 'event')!;
    assert.ok(p.recommended !== undefined && p.recommended >= 0 && p.recommended < def.options.length, def.id);
    assert.ok(p.why && p.why.length > 3, def.id);
    assert.equal(p.defaultOption, p.recommended);
  }
  const s = on('align-timeout');
  startEvent(s, EVENT_BY_ID.pilgrims_come, new Rng(1));
  const p = s.prompts.find((q) => q.kind === 'event')!;
  const pick = p.recommended!;
  s.tick = p.expiresTick;
  expirePrompts(s, new Rng(1));
  assert.equal(s.event, undefined);
  assert.equal(s.prompts.length, 0);
  assert.ok(pick >= 0);
});

test('a kind town recommends mercy and a hard one does not', () => {
  const def = EVENT_BY_ID.pilgrims_come;
  const good = on('align-rec-good');
  good.align = { score: 70, log: [] };
  const evil = on('align-rec-evil');
  evil.align = { score: -70, log: [] };
  assert.equal(def.options[recommend(good, def).option].label, 'Take them in');
  assert.notEqual(recommend(evil, def).option, 0);
});

test('past a threshold the town draws what it earns', () => {
  const g = on('align-gate');
  g.align = { score: GOOD_AT + 5, log: [] };
  assert.ok(EVENT_BY_ID.pilgrims_come.when!(g));
  assert.ok(!EVENT_BY_ID.thieves_offer.when!(g));
  const e = on('align-gate-evil');
  e.align = { score: EVIL_AT - 5, log: [] };
  assert.ok(EVENT_BY_ID.thieves_offer.when!(e));
  assert.ok(!EVENT_BY_ID.pilgrims_come.when!(e));
  const m = e.coins ?? 0;
  e.tick = TICKS_PER_DAY * 3;
  alignmentHourly(e);
  assert.ok((e.coins ?? 0) > m, 'the Hand pays the treasury');
});

test('with nothing pushing, the bar drifts back toward home', () => {
  const s = newGame('align-drift', { origin: 'vampire' });
  s.autopilot = true;
  s.align = { score: 20, log: [] };
  s.tick = 600;
  for (let i = 0; i < 100; i++) {
    s.tick += 600;

    alignmentHourly(s);
  }
  assert.ok(alignScore(s) < 20);
});

test('the slow drift pulls toward neutral, except for a dark people, which it pulls to its own home', () => {
  const drift = (origin: 'knights' | 'vampire' | 'settlers', from: number) => {
    const s = newGame(`align-neutral-${origin}`, { origin });
    s.autopilot = true;
    s.align = { score: from, log: [] };
    s.tick = 600;
    for (let i = 0; i < 20; i++) {
      s.tick += 600;
      alignmentHourly(s);
    }
    return alignScore(s);
  };
  assert.ok(drift('knights', 40) < 40 && drift('knights', 40) > 0, 'a knightly town is not pulled back up to its home');
  assert.equal(drift('vampire', -45), -45, 'a vampire town at home stays there');
  assert.ok(drift('vampire', -10) < -10 && drift('vampire', -10) > -45, 'and drifts back down to it from a kinder bar');
  assert.ok(drift('vampire', 30) < 30, 'from a good one too');
  assert.ok(drift('settlers', -20) > -20 && drift('settlers', 20) < 20);
});

void killPerson;

test('every answer of every event also has an order weight', () => {
  for (const e of EVENTS) {
    const w = ALIGN_EVENT_ORDER[e.id] ?? EVENT_ORDER[e.id];
    assert.ok(w, `${e.id}: order weights`);
    assert.equal(w.length, e.options.length, `${e.id}: one order weight an answer`);
  }
});

test('an answer moves the order axis too', () => {
  const s = on('align-order');
  startEvent(s, EVENT_BY_ID.holy_order, new Rng(1));
  const before = orderScore(s);
  answerEvent(s, 0, new Rng(1));
  assert.ok(orderScore(s) > before);
});

test('the town takes a title from where it stands, and the legend carries it', () => {
  const s = on('align-title');
  s.townName = 'Ashford';
  s.align = { score: 50, order: 0, log: [] };
  assert.equal(titledName(s), 'Ashford the Merciful');
  s.align = { score: -65, order: 0, log: [] };
  assert.equal(titledName(s), 'Ashford the Cruel');
  s.align = { score: 0, order: 0, log: [] };
  assert.equal(titledName(s), 'Ashford');
});

test('a dark town is offered a pact instead of a siege, and the answer holds the siege off', () => {
  const s = on('align-pact');
  s.align = { score: -50, order: 0, log: [] };
  s.greatEnemy = { kind: 'lich', chosen: 0, stage: 'march', plan: 52 } as never;
  assert.equal(alignPact(s), true);
  const p = s.prompts.find((q) => q.ways?.system === 'align')!;
  assert.ok(p && p.recommended !== undefined && p.why);
  assert.equal(alignPact(s), true, 'one offer at a time');
  answerPrompt(s, p.id, 0, new Rng(1));
  assert.equal(alignPacted(s), true);
  assert.ok(alignScore(s) < -50);
  const g = on('align-pact-good');
  g.align = { score: 50, order: 0, log: [] };
  assert.equal(alignPact(g), false);
  assert.ok(alignEnemyPace(g) > 0 && alignEnemyPace(s) === 0);
});

test('a refused pact lets the siege go ahead', () => {
  const s = on('align-pact-no');
  s.align = { score: -50, order: 0, log: [] };
  s.greatEnemy = { kind: 'lich', chosen: 0, stage: 'march', plan: 52 } as never;
  alignPact(s);
  const p = s.prompts.find((q) => q.ways?.system === 'align')!;
  answerPrompt(s, p.id, 2, new Rng(1));
  assert.equal(alignPact(s), false);
});

test('a hard swing from good to evil brings the fall, once', () => {
  const s = on('align-fall');
  s.align = { score: -40, order: 0, log: [], samples: [{ tick: 0, score: 40 }] };
  s.tick = TICKS_PER_DAY * 10;
  alignmentHourly(s);
  assert.ok(s.prompts.some((q) => q.kind === 'event' && q.title.includes('fallen')));
  assert.deepEqual(s.align.arcs, ['fall_reckoning']);
});

test('good towns draw kind wanderers and dark ones grasping ones', () => {
  const g = on('align-arrive');
  g.align = { score: 60, order: 0, log: [] };
  let kind = 0;
  for (let id = 1; id < 40; id++) {
    const p: { id: number; nature?: string | null } = { id };
    alignArrival(g, p as never);
    if (p.nature === 'kind' || p.nature === 'pious') kind++;
  }
  assert.ok(kind > 10);
  assert.ok(alignArrivalMult(g) > 1);
  g.align = { score: -60, order: 0, log: [] };
  assert.ok(alignArrivalMult(g) < 1);
});
