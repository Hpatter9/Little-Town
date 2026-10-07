import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { BACK_MULT, BOARD_H, BOARD_W, blowMult, makeBoard, SIDE_MULT, tacticsView, type TacUnit } from '../src/shared/sim/tactics';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { plainGame } from './helpers';

function town(seed: string, n = 5): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.battleStyle = 'tactics';
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    p.skills.melee.level = 8;
    if (i % 2) p.skills.ranged.level = 12;
    s.people.push(p);
  }
  return s;
}

test('the tactics board is cut from the land round the gate: no buildings, the town\'s wall across it with a gate, the field varied', () => {
  const s = town('tac-board');
  const b = makeBoard(s, -1);
  assert.equal(b.tiles.length, BOARD_W * BOARD_H);
  for (const t of b.tiles) {
    assert.ok(t.lx >= 0 && t.ly >= 0 && t.lx < s.land.w && t.ly < s.land.h);
    if (t.g === 'water') assert.equal(t.h, 0);
    assert.notEqual(t.block, 'building', 'no buildings on the board');
  }
  // (one column of wall, palisade by default, and a gate in it)
  const walled = b.tiles.filter((t) => t.wall);
  assert.ok(walled.length >= BOARD_H - 3, `${walled.length} wall tiles`);
  assert.ok(walled.every((t) => t.wall!.startsWith('palisade')));
  assert.equal(walled.filter((t) => t.gate).length, 2, 'a gate two tiles wide');
  // (the lie of the land differs from one battle to the next)
  const other = makeBoard(s, -1, false, 12345);
  assert.notEqual(b.tiles.map((t) => `${t.h}${t.block ?? ''}${t.bush ? 'b' : ''}`).join(), other.tiles.map((t) => `${t.h}${t.block ?? ''}${t.bush ? 'b' : ''}`).join());
});

test('a blow from behind bites hardest, from beside harder, and from above more', () => {
  const tiles = Array.from({ length: 9 }, () => ({ h: 1, g: 'grass' as const, lx: 0, ly: 0 }));
  const t = { tiles, w: 3 };
  const target: TacUnit = { key: 'r1', foe: true, u: 1, v: 1, facing: 0, ct: 0 };
  assert.equal(blowMult(t, { u: 2, v: 1 }, target), 1, 'in front');
  assert.equal(blowMult(t, { u: 0, v: 1 }, target), BACK_MULT, 'behind');
  assert.equal(blowMult(t, { u: 1, v: 0 }, target), SIDE_MULT, 'beside');
  tiles[0 * 3 + 1] = { ...tiles[1], h: 3 };
  assert.ok(blowMult(t, { u: 1, v: 0 }, target) > SIDE_MULT, 'from above');
});

test('a raid on the tactics board plays out turn by turn to an end, with blows struck both ways', () => {
  const s = town('tac-raid', 6);
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 40, new Rng(3));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(9);
  updateRaid(s, rng);
  assert.ok(r.tactics, 'the board is laid');
  const v = tacticsView(s)!;
  assert.ok(v.units.some((u) => !u.foe) && v.units.some((u) => u.foe), 'both sides on it');
  assert.equal(v.order.length, 8, 'the turns to come');
  const hp0 = s.people.reduce((a, p) => a + p.hp, 0);
  let turns = 0;
  for (let i = 0; i < 20000 && r.tactics!.phase !== 'done'; i++) {
    s.tick++;
    updateRaid(s, rng);
    turns = r.tactics!.turns;
    if (!s.raid) break;
  }
  assert.ok(r.tactics!.phase === 'done' || !s.raid, 'it ends');
  assert.ok(turns > 10, `${turns} turns`);
  const dealt = r.tactics!.killed + r.raiders.filter((q) => q.hp < q.maxHp).length;
  assert.ok(dealt > 0, 'the town struck home');
  assert.ok(s.people.reduce((a, p) => a + p.hp, 0) < hp0 || s.people.some((p) => p.downed), 'the raiders struck home');
});

import { DOWN_COUNT, tacticsOrder, type Tactics } from '../src/shared/sim/tactics';
import { knockDown } from '../src/shared/sim/health';

/** A town with a raid on the board, stepped until the board is laid. */
function boardNow(seed: string, n = 5, manual = false) {
  const s = town(seed, n);
  if (manual) {
    s.autopilot = true; // (the board waits on the player only in a town that runs itself)
    s.tacticsAuto = false;
  }
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(5));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(11);
  updateRaid(s, rng);
  return { s, r, t: r.tactics as Tactics, rng };
}
const run = (s: GameState, rng: Rng, ticks: number, until?: () => boolean) => {
  for (let i = 0; i < ticks && s.raid && !until?.(); i++) {
    s.tick++;
    updateRaid(s, rng);
  }
};

test('struck down on the field, a townsperson has a count of three of their turns, then is lost; a friend can tend them', () => {
  const { s, t, rng } = boardNow('tac-count', 4);
  const unit = t.units.find((u) => u.key[0] === 'p' && u.key !== `p${s.mainId}`)!;
  const p = s.people.find((q) => `p${q.id}` === unit.key)!;
  knockDown(s, p);
  run(s, rng, 1);
  assert.equal(unit.count, DOWN_COUNT, 'lies with a count');
  // (nobody tends them: keep everyone else busy away, and let the clock run)
  for (const u of t.units) if (u !== unit && !u.foe) u.ct = -1e9;
  run(s, rng, 6000, () => !s.people.includes(p) || !s.raid?.tactics || s.raid.tactics.phase === 'done');
  assert.ok(!s.people.includes(p) || !p.downed, 'lost at the end of the count, or the battle ended first');
  // tended: up again
  const b = boardNow('tac-tend', 4);
  const down = b.t.units.find((u) => u.key[0] === 'p' && u.key !== `p${b.s.mainId}`)!;
  const q = b.s.people.find((x) => `p${x.id}` === down.key)!;
  knockDown(b.s, q);
  run(b.s, b.rng, 1);
  const friend = b.t.units.find((u) => u.key[0] === 'p' && u !== down)!;
  friend.u = down.u;
  friend.v = down.v - 1 >= 0 ? down.v - 1 : down.v + 1;
  b.t.act = { key: friend.key, path: [[friend.u, friend.v]], step: 0, target: down.key, kind: 'tend', stage: 'act', next: b.s.tick };
  run(b.s, b.rng, 2);
  assert.equal(q.downed, null, 'back on their feet');
  assert.equal(down.count, undefined);
});

test('the player gives the orders on their fighters\' turns: a move within reach, a blow in reach, a wait', () => {
  const { s, t, rng } = boardNow('tac-orders', 4, true);
  run(s, rng, 3000, () => !!t.await);
  assert.ok(t.await, 'a turn waits on the player');
  const me = t.units.find((u) => u.key === t.await!.key)!;
  assert.equal(tacticsOrder(s, { op: 'move', u: 0, v: 0 }), false, 'too far');
  const free = [[me.u - 1, me.v], [me.u, me.v - 1], [me.u, me.v + 1]].find(([u, v]) => !t.units.some((x) => x.u === u && x.v === v) && t.tiles[v * t.w + u] && !t.tiles[v * t.w + u].block && t.tiles[v * t.w + u].g !== 'water');
  if (free) {
    assert.ok(tacticsOrder(s, { op: 'move', u: free[0], v: free[1] }), 'a step');
    run(s, rng, 30, () => t.await?.moved === true);
    assert.equal(t.await?.moved, true);
    assert.deepEqual([me.u, me.v], free);
  }
  assert.ok(tacticsOrder(s, { op: 'wait', facing: 3 }));
  assert.equal(t.await, undefined, 'the turn is over');
  assert.equal(me.facing, 3);
  // left alone, the town takes the turn
  run(s, rng, 3000, () => !!t.await);
  const first = t.await as { key: string; until: number } | undefined;
  run(s, rng, 41 * 10);
  const now = (t as Tactics).await;
  assert.ok(!first || !now || now !== first, 'the town took it when no order came');
});

test('a raid led by a chief breaks when the chief falls', () => {
  const { s, r, t, rng } = boardNow('tac-lead', 5);
  if (!t.leader) return; // (bandits bring a chief once the budget allows; nothing to test otherwise)
  const lead = r.raiders.find((q) => `r${q.id}` === t.leader)!;
  run(s, rng, 300, () => t.units.some((u) => u.key === t.leader));
  lead.hp = 0;
  lead.down = true;
  run(s, rng, 2);
  assert.equal(t.broken, true);
});

test('the board stays up a moment after the raid is over, with the outcome across it', () => {
  const s = town('tac-linger', 6);
  const r = startRaid(s, RAID_KIND_BY_ID.wolves, 10, new Rng(4));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(2);
  updateRaid(s, rng);
  assert.ok(r.tactics);
  for (let i = 0; i < 30000 && s.raid; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.equal(s.raid, null, 'the raid ended');
  const v = tacticsView(s);
  assert.ok(v, 'the board is still shown');
  assert.equal(v!.phase, 'done');
  assert.ok(v!.banner, 'with a word across it');
  s.tick += 10 * 10;
  assert.equal(tacticsView(s), null, 'and then it goes');
});

import { hit as hitFx } from '../src/shared/data/effects';

test('a spell aimed at a tile falls on everyone in its area: a 3x3 hits all three raiders standing in it', () => {
  const { s, r, t, rng } = boardNow('tac-area', 4, true);
  run(s, rng, 3000, () => !!t.await);
  assert.ok(t.await, 'a turn waits on the player');
  const me = t.units.find((u) => u.key === t.await!.key)!;
  me.kit = { ...(me.kit ?? kitOfNone()), actions: [{ id: 'test_wave', name: 'Test Wave', spell: true, level: 1, cooldown: 0, ready: 0, effects: [hitFx(1, 'fire', 'foes')], use: 'attack', cost: 0, pool: 'mp' }] };
  // (three raiders round a tile three away, the rest well off)
  const at: [number, number] = [Math.max(0, me.u - 3), me.v];
  const foes = t.units.filter((u) => u.foe);
  const spots: [number, number][] = [[at[0], at[1]], [at[0], Math.max(0, at[1] - 1)], [at[0], Math.min(t.h - 1, at[1] + 1)]];
  foes.forEach((f, i) => ([f.u, f.v] = i < 3 ? spots[i] : [0, (i * 2) % t.h]));
  for (const [u, v] of spots) delete t.tiles[v * t.w + u].block;
  const hp = foes.slice(0, 3).map((f) => r.raiders.find((q) => `r${q.id}` === f.key)!.hp);
  assert.ok(tacticsOrder(s, { op: 'skill', skill: 'test_wave', at }), 'aimed within its reach');
  run(s, rng, 60, () => !!t.await?.acted);
  foes.slice(0, 3).forEach((f, i) => assert.ok(r.raiders.find((q) => `r${q.id}` === f.key)!.hp < hp[i], `${f.key} was struck`));
  assert.ok(t.fx.some((x) => x.kind === 'area' && x.to.length === 9), 'its 3x3 lit on the board');
  assert.equal(tacticsOrder(s, { op: 'skill', skill: 'test_wave', at: [me.u, me.v] }), false, 'once acted, no second cast');
});

function kitOfNone() {
  return { actions: [], passive: { damage: 0, power: 0, healing: 0, crit: 0, critDamage: 0, counter: 0, lifesteal: 0, thorns: 0, guard: 0, resist: 0, regen: 0, lastStand: 0, firstStrike: false } };
}
