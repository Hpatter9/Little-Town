import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REFUGEE_OPTIONS } from '../src/shared/data/bands';
import { Rng } from '../src/shared/rng';
import { answerRefugees, bandsTick, membersOf, spawnBand, strike } from '../src/shared/sim/bands';
import { totalStock } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import type { GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, clearAround, plainGame, put, row } from './helpers';

const lucky = (seed: number) => Object.assign(new Rng(seed), { chance: () => true }) as Rng;
const run = (s: GameState, rng: Rng, ticks: number, until?: () => boolean) => {
  for (let i = 0; i < ticks && !(until && until()); i++) {
    s.tick++;
    bandsTick(s, rng);
  }
};

test('travellers come in one side, rest at the tavern, and go out the far side', () => {
  const s = plainGame('bands-pass');
  clearAround(s, 24);
  put(s, 'fireside_inn', camp(s).x + 3, row(s));
  const rng = new Rng(3);
  const b = spawnBand(s, rng, 'travellers', -1);
  assert.ok(membersOf(s, b).length >= 2);
  assert.ok(membersOf(s, b).every((t) => t.x < camp(s).x * 32), 'they start out west');
  run(s, rng, 6 * TICKS_PER_HOUR, () => b.phase === 'staying');
  assert.equal(b.phase, 'staying', 'they reach the tavern');
  run(s, rng, 6 * TICKS_PER_HOUR, () => b.phase === 'leaving');
  assert.equal(b.phase, 'leaving');
  assert.ok(membersOf(s, b).every((t) => t.toX > camp(s).x * 32), 'out the far side');
  run(s, rng, 12 * TICKS_PER_HOUR, () => !s.bands?.length);
  assert.equal(s.bands?.length ?? 0, 0, 'gone');
  assert.equal((s.travellers ?? []).length, 0);
  // the snapshot names them a band
  const c = spawnBand(s, rng, 'caravan', 1);
  const v = snapshot(s);
  assert.ok(v.travellers.some((t) => t.band === 'caravan'));
  assert.equal(v.wagons.length, 1);
  void c;
});

test('refugees at the gate: a question; taken in they join, fed they rest and eat, turned away they go', () => {
  for (const [i, opt] of REFUGEE_OPTIONS.entries()) {
    const s = plainGame(`bands-ref-${i}`);
    clearAround(s, 24);
    s.buildings[0].store = { berries: 40 };
    const rng = new Rng(5);
    const people = s.people.length;
    const b = spawnBand(s, rng, 'refugees', 1);
    const n = membersOf(s, b).length;
    run(s, rng, 8 * TICKS_PER_HOUR, () => b.phase === 'staying');
    const q = s.prompts.find((p) => p.kind === 'refugees');
    assert.ok(q, 'a question is put');
    const rep = s.reputation;
    const food = totalStock(s).berries ?? 0;
    answerRefugees(s, opt, rng);
    assert.ok(!s.prompts.some((p) => p.kind === 'refugees'));
    if (i === 0) {
      assert.equal(s.people.length, people + n, 'they join');
      assert.ok(s.reputation > rep);
    } else if (i === 1) {
      assert.ok((totalStock(s).berries ?? 0) < food, 'fed from the stores');
      assert.equal(b.phase, 'staying', 'they rest a while');
      assert.ok(s.reputation > rep);
    } else {
      assert.equal(b.phase, 'leaving');
      assert.ok(s.reputation < rep);
    }
  }
});

test('bandits in disguise strike from inside the town at night; a guard on watch may see through them first', () => {
  const s = plainGame('bands-bandits');
  clearAround(s, 24);
  const rng = new Rng(7);
  const b = spawnBand(s, rng, 'bandits', -1);
  assert.ok(b.strikeAt! > s.tick);
  run(s, rng, 10 * TICKS_PER_HOUR, () => b.phase === 'staying');
  assert.equal(b.phase, 'staying');
  s.tick = b.strikeAt!;
  bandsTick(s, rng);
  assert.ok(s.raid, 'they strike');
  assert.equal(s.raid!.kind, 'band_bandits');
  assert.equal(s.raid!.phase, 'active', 'from inside, no warning');
  assert.ok(!s.bands?.length && !(s.travellers ?? []).some((t) => t.band !== undefined));
  // a guard sees through them in the open
  const g = plainGame('bands-guard');
  const b2 = spawnBand(g, rng, 'bandits', 1);
  strike(g, b2, rng, g.people[0]);
  assert.ok(g.journal.some((j) => /saw through the "travellers"/.test(j.text)));
});

test("a caravan's merchants come with it when it arrives at the market (the town running itself)", () => {
  const sim = new Sim(plainGame('bands-caravan'));
  const s = sim.state;
  s.autopilot = true;
  s.caravan = { x: 0, leavesTick: s.tick + 10 * TICKS_PER_HOUR, arrived: s.tick, offers: [] };
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  bandsTick(s, lucky(1));
  const b = s.bands?.find((x) => x.kind === 'caravan');
  assert.ok(b, 'the merchants come');
  assert.ok(b!.wagon, 'with their wagon');
  assert.equal(b!.until, s.caravan!.leavesTick);
});
