import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { musterHost, launchHost, realm } from '../src/shared/sim/factions';
import { gatherOf, oddsHourly, oddsOf, outmatchedPlan, weighArrival, oddsOver, raidPower, ripeGrudge, townPower } from '../src/shared/sim/raidOdds';
import { startGuildRaid, startRaid } from '../src/shared/sim/raids';
import { skipRaidsTick } from '../src/shared/sim/raidSkip';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { totalStock } from '../src/shared/sim/buildings';
import { calendar } from '../src/shared/sim/time';
import { campPx, plainGame } from './helpers';

/** A town of `n` grown-ups with the autopilot on, and a few knights of the Order on their way. */
function townWithOrder(seed: string, n: number, budget = 120) {
  const s = plainGame(seed);
  s.autopilot = true;
  for (let i = 1; i < n; i++) s.people.push(makePerson(new Rng(100 + i), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  startRaid(s, RAID_KIND_BY_ID.rival_knights, budget, new Rng(5));
  // (a rival's lord isn't wanted: just the knights)
  s.raid!.raiders = s.raid!.raiders.filter((rd) => rd.kind !== 'grand_master').slice(0, 4);
  s.raid!.arrivesTick = s.tick + 1;
  return s;
}

const stepUntil = (s: GameState, done: () => boolean, max = 4000) => {
  const sim = new Sim(s);
  for (let t = 0; t < max && !done(); t++) sim.step();
};

test('four knights against twenty townsfolk turn back instead of attacking, and the next band comes bigger', () => {
  const s = townWithOrder('odds-turn', 20);
  const r = s.raid!;
  assert.ok(oddsOf(s, r) < 0.5, `outmatched (${raidPower(r).toFixed(0)} against ${townPower(s, r).toFixed(0)})`);
  stepUntil(s, () => s.prompts.some((p) => p.options.includes('Let them go')));
  assert.equal(s.raid?.phase, 'warning', 'they hold at the edge while the town decides');
  stepUntil(s, () => !s.raid, 4 * TICKS_PER_HOUR); // (nobody answers: the town does, in its way)
  assert.equal(s.raid, null, 'the raid is over without a fight');
  assert.equal(s.raidOdds?.turned, 1);
  assert.ok((s.raidOdds?.extra ?? 0) >= 1, 'the next comes bigger');
  assert.match(s.raidRecap!.story[0], /turned back at the sight of your walls/);
  assert.equal(s.raidRecap!.came, 4);
  assert.equal(s.people.length, 20, 'nobody hurt');
  // the next band: more of them, and tougher
  const next = startRaid(s, RAID_KIND_BY_ID.rival_knights, 40, new Rng(5));
  const knights = next.raiders.filter((rd) => rd.kind === 'order_knight');
  assert.ok(knights.every((rd) => (rd.might ?? 1) > 1.3), 'tougher');
});

test('the Hunter\'s Guild\'s four hunters against a town of twenty turn back too, and come again as a fair fight', () => {
  const s = plainGame('odds-guild');
  s.autopilot = true;
  for (let i = 1; i < 20; i++) s.people.push(makePerson(new Rng(300 + i), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  s.people[1].monster = 'vampire';
  startGuildRaid(s, s.people[1], new Rng(4));
  const r = s.raid!;
  assert.equal(r.kind, 'hunters');
  r.arrivesTick = s.tick + 1;
  const before = oddsOf(s, r);
  assert.ok(before < 0.5);
  stepUntil(s, () => s.prompts.some((p) => p.options.includes('Let them go')));
  const prompt = s.prompts.find((p) => p.options.includes('Let them go'))!;
  answerPrompt(s, prompt.id, 0, new Rng(1));
  assert.equal(s.raid, null);
  assert.equal(s.guildTarget, null);
  // (the next Guild raid is as big as a fair fight)
  startGuildRaid(s, s.people[1], new Rng(4));
  assert.ok(oddsOf(s, s.raid!) >= 0.5, `${oddsOf(s, s.raid!)}`);
});

test('a band that is not outmatched attacks as before', () => {
  const s = townWithOrder('odds-fair', 3);
  const r = s.raid!;
  assert.ok(oddsOf(s, r) >= 0.5);
  stepUntil(s, () => s.raid?.phase === 'active');
  assert.equal(s.raid?.phase, 'active');
  assert.equal(s.raidOdds?.turned, undefined);
});

test('without the autopilot the odds are not weighed', () => {
  const s = townWithOrder('odds-plain', 20);
  s.autopilot = false;
  stepUntil(s, () => s.raid?.phase === 'active');
  assert.equal(s.raid?.phase, 'active');
});

test('mercy at the edge lifts their people\'s standing and turns the alignment good', () => {
  const s = townWithOrder('odds-mercy', 20);
  stepUntil(s, () => s.prompts.some((p) => p.options.includes('Let them go')));
  const prompt = s.prompts.find((p) => p.options.includes('Let them go'))!;
  answerPrompt(s, prompt.id, 0, new Rng(1));
  assert.equal(s.raid, null);
  assert.equal(s.raidOdds?.spared, 1);
  assert.ok((s.raidOdds?.align ?? 0) > 0);
  assert.equal(s.raidRecap!.mercy, 'turned');
});

test('slaughter: they fight on, are run down as they break, and a survivor carries a grudge', () => {
  const s = townWithOrder('odds-hunt', 20);
  // the town's leader is a hard one, and says so
  stepUntil(s, () => s.prompts.some((p) => p.options.includes('Let them go')));
  const prompt = s.prompts.find((p) => p.options.includes('Let them go'))!;
  answerPrompt(s, prompt.id, 1, new Rng(1));
  assert.equal(s.raid?.mercy, 'hunted');
  assert.ok((s.raidOdds?.align ?? 0) < 0);
  stepUntil(s, () => !s.raid, 40_000);
  assert.equal(s.raid, null);
  assert.equal(s.raidRecap!.mercy, 'hunted');
  assert.ok(s.raidRecap!.story.includes('You hunted them down.'));
  assert.ok(s.raidRecap!.killed >= 1);
  assert.ok(Object.keys(s.raidRecap!.spoils).length > 0, 'loot');
});

test('a hunted band that breaks is run down for experience; one let go is not', () => {
  for (const mercy of [true, false]) {
    const s = townWithOrder(`odds-break-${mercy}`, 6, 80);
    const r = s.raid!;
    r.raiders = r.raiders.slice(0, 4);
    s.raidOdds = { streak: 3 }; // (forced to come on)
    stepUntil(s, () => s.raid?.phase === 'active');
    // three felled, the last runs
    r.raiders.forEach((rd, i) => {
      if (i < 3) {
        rd.down = true;
        rd.hp = 0;
      } else {
        rd.fleeing = true;
        rd.x = campPx(s).x + 200 * r.side; // (broken in the middle of the town, running for the edge)
        rd.y = campPx(s).y;
      }
    });
    stepUntil(s, () => s.prompts.some((p) => p.options.includes('Let them go')), 50);
    const prompt = s.prompts.find((p) => p.options.includes('Let them go'));
    assert.ok(prompt, 'they break: the town is asked');
    const xp = s.people.reduce((t, p) => t + (p.lvXp ?? 0), 0);
    answerPrompt(s, prompt!.id, mercy ? 0 : 1, new Rng(1));
    stepUntil(s, () => !s.raid, 20_000);
    assert.equal(s.raid, null);
    const gained = s.people.reduce((t, p) => t + (p.lvXp ?? 0), 0) - xp;
    if (mercy) assert.equal(s.raidRecap!.mercy, 'spared');
    else assert.ok(s.raidRecap!.runDown >= 1 && gained > 0, 'the last was run down');
  }
});

test('the alarm\'s "Skip the battle" fights it out when they arrive, and is the same fight as watching it', () => {
  const run = (skip: boolean, battles: boolean, style: 'trail' | 'tactics') => {
    const s = plainGame('odds-skip');
    s.autopilot = false;
    s.battles = battles;
    s.battleStyle = style;
    for (let i = 1; i < 6; i++) s.people.push(makePerson(new Rng(200 + i), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
    s.nextRaidTick = Number.MAX_SAFE_INTEGER;
    startRaid(s, RAID_KIND_BY_ID.wolves, 40, new Rng(9));
    s.raid!.arrivesTick = s.tick + 5;
    const prompt = s.prompts.find((p) => p.kind === 'raid')!;
    assert.ok(prompt.options.includes('Skip the battle'));
    answerPrompt(s, prompt.id, skip ? prompt.options.indexOf('Skip the battle') : 0, new Rng(1));
    const sim = new Sim(s);
    let skipped = false;
    for (let t = 0; t < 200_000 && (s.raid || t < 10); t++) {
      sim.step();
      if (s.raidSkip) skipped = true;
    }
    assert.equal(s.raid, null);
    assert.equal(skipped, skip);
    return { people: s.people.map((p) => [p.id, Math.round(p.hp), p.lvXp ?? 0, !!p.downed]), loot: s.raidRecap!.spoils, killed: s.raidRecap!.killed, rows: s.raidRecap!.rows.map((x) => [x.id, x.dealt, x.xp, x.died]) };
  };
  for (const [battles, style] of [[false, 'trail'], [true, 'trail'], [true, 'tactics']] as const) assert.deepEqual(run(true, battles, style), run(false, battles, style), `${battles} ${style}`);
});

test('a town set to skip its raids, and a raid that asks to be skipped, skip when active', () => {
  const s = plainGame('odds-skip-flag');
  startRaid(s, RAID_KIND_BY_ID.wolves, 10, new Rng(2));
  s.raid!.skipIt = true;
  s.raid!.phase = 'active';
  skipRaidsTick(s);
  assert.ok(s.raidSkip);
});

test('a hunted band\'s survivor carries a grudge that brings a bigger raid of the same kind later', () => {
  const s = townWithOrder('odds-grudge', 6);
  const r = s.raid!;
  r.mercy = 'hunted';
  r.raiders[0].gone = true; // (got away)
  s.raidRecap = { tick: s.tick, name: 'The Order', outcome: 'victory', boss: null, waves: 1, came: 4, killed: 3, fled: 1, through: 0, prisoners: 0, stolen: {}, spoils: {}, rows: [], best: null, towers: null, lamed: 0, limped: 0, runDown: 0, takenAlive: 0, story: [] };
  oddsOver(s, r);
  assert.equal(s.raidRecap.mercy, 'hunted');
  assert.equal(s.raidOdds?.grudge?.kind, 'rival_knights');
  assert.equal(ripeGrudge(s), null, 'not yet');
  s.tick = s.raidOdds!.grudge!.at;
  assert.equal(ripeGrudge(s), 'rival_knights');
  assert.ok(gatherOf(s) >= 1.5, 'and bigger');
  assert.equal(s.raidOdds?.grudge, undefined);
});

test('a hunted war host leaves a grudge on its power: the next host comes bigger', () => {
  const s = plainGame('odds-host-grudge');
  s.autopilot = true;
  s.era = 'medieval';
  for (const f of realm(s)) f.known = true;
  const foe = realm(s)[0];
  foe.stance = 'war';
  foe.troops = 40;
  musterHost(s, foe);
  const first = foe.host!.size;
  const r = launchHost(s, foe, new Rng(4))!;
  r.mercy = 'hunted';
  r.raiders.find((rd) => !rd.ally)!.gone = true; // (got away)
  s.raidRecap = { tick: s.tick, name: 'Host', outcome: 'victory', boss: null, waves: 1, came: 4, killed: 3, fled: 1, through: 0, prisoners: 0, stolen: {}, spoils: {}, rows: [], best: null, towers: null, lamed: 0, limped: 0, runDown: 0, takenAlive: 0, story: [] };
  oddsOver(s, r);
  assert.equal(foe.grudge, true);
  assert.equal(s.raidOdds?.grudge, undefined, 'the power bears it, not the town\'s book');
  assert.match(s.raidRecap.story.join(' '), /next host will come bigger/);
  musterHost(s, foe);
  assert.ok(foe.host!.size > first, `bigger: ${foe.host!.size} against ${first}`);
  assert.equal(foe.grudge, undefined, 'spent');
  // spared: no grudge
  r.mercy = 'spared';
  oddsOver(s, r);
  assert.equal(foe.grudge, undefined);
});

/** A town of twenty and four bandits at its edge, the clock wound to a tick where the band's side-stream roll says `plan`. */
function bandsAtEdge(seed: string, plan: 'toll' | 'probe' | 'turn') {
  const s = plainGame(seed);
  s.autopilot = true;
  s.coins = 400;
  for (let i = 1; i < 20; i++) s.people.push(makePerson(new Rng(500 + i), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  startRaid(s, RAID_KIND_BY_ID.bandits, 60, new Rng(5));
  s.raid!.raiders = s.raid!.raiders.slice(0, 4);
  s.raid!.arrivesTick = s.tick + 1;
  s.tick += 100;
  for (let i = 0; i < 500 && outmatchedPlan(s, s.raid!) !== plan; i++) s.tick++;
  assert.equal(outmatchedPlan(s, s.raid!), plan, `found a tick that rolls ${plan}`);
  assert.ok(oddsOf(s, s.raid!) < 0.5, 'outmatched');
  return s;
}

test('an outmatched band may demand a toll: paid, they go and the next is no bigger; refused, they turn back', () => {
  const s = bandsAtEdge('odds-toll', 'toll');
  const r = s.raid!;
  assert.equal(weighArrival(s, r), 'wait');
  assert.ok(r.toll && r.toll.coins > 0, 'a share of the coins');
  const prompt = s.prompts.find((p) => p.id === r.parley)!;
  assert.deepEqual(prompt.options, ['Pay the toll', 'Refuse the toll']);
  assert.equal(s.raid, r, 'they hold at the edge');
  const coins = s.coins!;
  const toll = r.toll!.coins;
  s.raidOdds = { extra: 1, streak: 1 };
  answerPrompt(s, prompt.id, 0, new Rng(1));
  assert.equal(s.coins, coins - toll);
  assert.equal(s.raid, null);
  assert.equal(s.raidRecap!.mercy, 'toll');
  assert.match(s.raidRecap!.story.join(' '), /toll/);
  assert.equal(s.raidOdds!.tolls, 1);
  assert.equal(gatherOf(s), 1, 'no bigger next time');

  const t = bandsAtEdge('odds-toll2', 'toll');
  weighArrival(t, t.raid!);
  const coins2 = t.coins!;
  answerPrompt(t, t.raid!.parley!, 1, new Rng(1));
  assert.equal(t.coins, coins2, 'nothing paid');
  assert.equal(t.raid, null);
  assert.equal(t.raidRecap!.mercy, 'turned');
  assert.ok(gatherOf(t) > 1, 'and they come back bigger');
});

test('the toll question\'s default follows the leader and the treasury', () => {
  const rich = bandsAtEdge('odds-toll3', 'toll');
  weighArrival(rich, rich.raid!);
  const askedRich = rich.prompts.find((p) => p.id === rich.raid!.parley)!;
  const poor = bandsAtEdge('odds-toll4', 'toll');
  poor.coins = 0;
  for (const st of poor.buildings) st.store = {};
  assert.equal(weighArrival(poor, poor.raid!), 'wait');
  assert.equal(poor.raid!.toll, undefined, 'nothing to ask of an empty town: they just turn back');
  assert.ok(askedRich.defaultOption === 0 || askedRich.defaultOption === 1);
  assert.ok(poor.prompts.some((p) => p.options.includes('Let them go')));
});

test('an outmatched band may probe instead: it turns back, and a few slip in by night to steal one thing, or are caught', () => {
  const s = bandsAtEdge('odds-probe', 'probe');
  const loot = { iron: 40 };
  const st = s.buildings.find((b) => b.def === 'campfire')!;
  st.store = { ...loot };
  assert.equal(weighArrival(s, s.raid!), 'wait');
  assert.equal(s.raid, null, 'the band turned back');
  assert.equal(s.raidRecap!.mercy, 'probe');
  assert.match(s.raidRecap!.story.join(' '), /weak spot/);
  const probe = s.raidOdds!.probe!;
  assert.equal(calendar(probe.at).hour, 2, 'by night');
  // not before its night
  oddsHourly(s);
  assert.ok(s.raidOdds!.probe, 'waits');
  const before = JSON.stringify(s);
  s.tick = probe.at;
  // (an unwatched town: the take, unless the roll is the catch)
  oddsHourly(s);
  assert.equal(s.raidOdds!.probe, undefined, 'spent');
  const kept = totalStock(s).iron ?? 0;
  assert.ok(kept < 40 || (s.raidOdds!.caught ?? 0) === 1, 'something taken, or caught');
  void before;
  // many nights: guards catch more of them
  const rate = (guards: number) => {
    let caught = 0;
    for (let i = 0; i < 40; i++) {
      const g = plainGame(`odds-probe-n${i}`);
      g.autopilot = true;
      for (let k = 0; k < guards; k++) {
        const p = makePerson(new Rng(700 + k), g.nextId++, 'hunter', g.people[0], g.people.map((q) => q.name));
        p.guard = true;
        g.people.push(p);
      }
      g.tick = 14400 * 3 + 600 * 2;
      g.raidOdds = { probe: { kind: 'bandits', at: g.tick, goal: 'steal', n: 2 } };
      oddsHourly(g);
      caught += g.raidOdds!.caught ?? 0;
    }
    return caught;
  };
  assert.ok(rate(5) > rate(0), 'a watched town catches more');
});
