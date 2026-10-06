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

test('the tactics board is cut from the land round the gate: heights from the ground, buildings blocked', () => {
  const s = town('tac-board');
  const b = makeBoard(s, -1);
  assert.equal(b.tiles.length, BOARD_W * BOARD_H);
  for (const t of b.tiles) {
    assert.ok(t.lx >= 0 && t.ly >= 0 && t.lx < s.land.w && t.ly < s.land.h);
    if (t.g === 'water') assert.equal(t.h, 0);
  }
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
