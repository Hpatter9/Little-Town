import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { GameLoop } from '../src/shared/gameLoop';
import { holdOf } from '../src/shared/sim/popups';
import { startRaid } from '../src/shared/sim/raids';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { skipRaid } from '../src/shared/sim/raidSkip';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

/** A town with fighters, its raid's battle on the board. */
function fighting(seed: string) {
  const s = plainGame(seed);
  s.battles = true;
  s.battleStyle = 'tactics'; // (the tactics board, the game's own default)
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 5 && !fightOnScreen(s); i++) sim.step();
  assert.ok(s.raid?.tactics, 'the board is up');
  return { s, sim };
}

/** A question for the player, of the kind that holds the town. */
const ask = (s: GameState, id = 99) =>
  s.prompts.push({ id, kind: 'event', title: 'A question', text: '', options: ['Yes', 'No'], defaultOption: 0, expiresTick: s.tick + 6000 } as (typeof s.prompts)[number]);

test('a raid skipped with a question waiting is still fought out to its end (Skip once left it standing still)', () => {
  const { s } = fighting('flow-skip');
  ask(s);
  assert.ok(skipRaid(s));
  assert.equal(holdOf(s), 'fight', 'the skipped battle plays alone; the question waits for it');
  // (the game loop as the phone runs it: a raid being skipped runs flat out, a slice a pump)
  const loop = new GameLoop(s, () => {});
  const pump = () => (loop as unknown as { pump(): void }).pump();
  for (let i = 0; i < 2000 && s.raid; i++) pump();
  assert.equal(s.raid, null, 'the raid ended');
  assert.ok(s.raidRecap, 'and its recap is there');
  assert.ok(s.prompts.some((p) => p.id === 99), 'the question is still there to answer');
});

test("the victory board goes after its moment though a question is up, so the question and the recap show", () => {
  const { s, sim } = fighting('flow-linger');
  for (let i = 0; i < 200_000 && s.raid; i++) sim.step(holdOf(s));
  assert.equal(s.raid, null, 'the raid ended');
  assert.ok(s.tacticsEnded, 'the board stays a moment for the last word');
  // (a question raised as the raid ended: a debrief, say)
  ask(s);
  assert.equal(holdOf(s), 'fight', 'the board on screen keeps its clock running');
  assert.ok(snapshot(s).tactics, 'the board is shown');
  for (let i = 0; i < 200 && holdOf(s) === 'fight'; i++) sim.step(holdOf(s));
  assert.ok(!snapshot(s).tactics, 'the board has gone');
  assert.equal(holdOf(s), 'popup', 'now the question holds the town, and shows');
});
