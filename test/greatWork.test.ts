import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { STAGES, TRANSMUTATIONS, WORK_HOUR } from '../src/shared/data/greatWork';
import { storages, totalStock } from '../src/shared/sim/buildings';
import { advance, experiment, workHourly, workOf } from '../src/shared/sim/greatWork';
import type { GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function crucible(seed: string): GameState {
  const s = plainGame(seed);
  s.origin = 'alchemists';
  s.autopilot = true;
  s.tick = at(5, WORK_HOUR);
  return s;
}

test('the morning experiment transmutes base matter, and success brings the Great Work on', () => {
  let worked = 0;
  let tried = 0;
  for (let i = 0; i < 12; i++) {
    const s = crucible(`gw-${i}`);
    s.people[0].skills.research.level = 20;
    storages(s)[0].store.clay = 40;
    const w = workOf(s)!;
    const r = experiment(s, w);
    assert.ok(r, 'an experiment run');
    tried++;
    if (r.ok) {
      worked++;
      assert.ok(w.progress > 0);
      assert.ok((totalStock(s).copper ?? 0) > 0 || r.kind === 'potion');
    }
  }
  assert.ok(worked > 4 && worked < tried, `${worked} of ${tried} worked`);
  for (const t of TRANSMUTATIONS) assert.ok(t.fromN > 0 && t.toN > 0);
});

test('a stage is reached with its mark, its age and its offering; the Stone wins the game', () => {
  const s = crucible('gw-stage');
  const w = workOf(s)!;
  w.progress = STAGES[0].at;
  assert.equal(advance(s, w), false, 'no offering yet');
  storages(s)[0].store.herbs = 10;
  storages(s)[0].store.bone = 10;
  assert.equal(advance(s, w), true);
  assert.equal(w.stage, 1);
  assert.ok(s.prompts.some((p) => p.title === STAGES[0].name));
  // the rest, at once
  s.era = 'industrial';
  w.progress = 999;
  storages(s)[0].store = { gold: 50, gems: 50, silver: 50, sulphur: 50, herbs: 50 };
  while (advance(s, w));
  assert.equal(w.stage, STAGES.length);
  assert.ok(s.gameOver?.won, 'the Philosopher\'s Stone');
});

test('after Albedo homunculi are grown and the town works faster', () => {
  const s = crucible('gw-hom');
  const w = workOf(s)!;
  w.stage = 2;
  w.lastHomunculus = -1e9;
  workHourly(s);
  assert.equal(w.homunculi.length, 1);
  assert.ok((s.marks ?? []).some((m) => m.lever === 'work' && m.value > 1));
  assert.ok(snapshot(s).heritage?.work?.homunculi.length);
});
