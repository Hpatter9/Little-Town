import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { GameLoop } from '../src/shared/gameLoop';
import { startRaid } from '../src/shared/sim/raids';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { Sim } from '../src/shared/sim/sim';
import { makePerson } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

/** A town with fighters, its raid's battle on the screen. */
function fighting(seed: string) {
  const s = plainGame(seed);
  s.battles = true;
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 5 && !fightOnScreen(s); i++) sim.step();
  return { s, sim };
}

test("while a raid's battle is on screen, nothing pops up over it: the questions' clocks stand still", () => {
  const { s, sim } = fighting('hold-fight');
  assert.ok(fightOnScreen(s), 'the battle is on');
  assert.ok(snapshot(s).fightOn);
  s.prompts.push({ id: 99, kind: 'event', title: 'A question', text: '', options: ['Yes', 'No'], defaultOption: 0, expiresTick: s.tick + 5 } as (typeof s.prompts)[number]);
  for (let i = 0; i < 50 && s.raid; i++) sim.step();
  if (fightOnScreen(s)) assert.ok(s.prompts.some((p) => p.id === 99), 'still waiting for the player');
});

test('a hidden page holds the game still, and it carries on from the same tick when it is back', async () => {
  const { s } = fighting('hold-hidden');
  s.battles = false;
  const loop = new GameLoop(s, () => {});
  const pump = () => (loop as unknown as { pump(): void }).pump();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const tick = s.tick;
  loop.hidden = true;
  await wait(300);
  pump();
  assert.equal(s.tick, tick, 'no time passes while hidden');
  loop.hidden = false;
  pump(); // (the clock was held, so the time hidden is not owed)
  await wait(250);
  pump();
  assert.ok(s.tick - tick < 10, `carried on with no catch-up (${s.tick - tick} ticks)`);
});
