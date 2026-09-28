import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUILD_THRESHOLD } from '../src/shared/data/monsters';
import { becomeMonster, updateMonsters } from '../src/shared/sim/monsters';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { startGuildRaid } from '../src/shared/sim/raids';
import { makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function recruit(s: GameState, type: string): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, type, (camp(s) + 1) * 32, s.people.map((q) => q.name));
  p.traits = [];
  s.people.push(p);
  return p;
}
/** Run the monster clock to a given game hour (ticks counted from the start). */
function atHour(s: GameState, hours: number, rng: Rng): void {
  s.tick = hours * TICKS_PER_HOUR;
  updateMonsters(s, rng, (t) => startGuildRaid(s, t, rng));
}

test('a werewolf mauls someone on the full-moon night; a vampire feeds every couple of days', () => {
  const s = plainGame('moon');
  const rng = new Rng(1);
  const wolf = recruit(s, 'werewolf');
  becomeMonster(s, wolf, 'werewolf');
  assert.equal(wolf.hp, maxHp(wolf));
  assert.ok(maxHp(wolf) > 60, 'hardier');
  const main = s.people[0];
  const before = main.hp;
  // day 6 is the first full moon (days count from 1); 23:00 is 16 hours after the 07:00 start
  atHour(s, 5 * 24 + 16, rng);
  assert.ok(main.hp < before, 'mauled');

  const s2 = plainGame('bite');
  const vamp = recruit(s2, 'vampire');
  becomeMonster(s2, vamp, 'vampire');
  const victim = s2.people[0];
  const hp = victim.hp;
  atHour(s2, 19, rng); // 02:00 on day 2: not hungry yet
  assert.equal(victim.hp, hp);
  atHour(s2, 2 * 24 + 19, rng); // 02:00 on day 3
  assert.ok(victim.hp < hp, 'fed');
});

test('the Guild grows hostile while a monster lives in town, then comes; hiding or handing over ends it', () => {
  const s = plainGame('guild');
  const rng = new Rng(3);
  const vamp = recruit(s, 'vampire');
  becomeMonster(s, vamp, 'vampire');
  vamp.order = 'give_up';
  for (let d = 0; d < 6 && !s.raid; d++) atHour(s, d * 24 + 5, rng); // noon each day
  assert.ok((s.guild ?? 0) >= GUILD_THRESHOLD);
  assert.equal(s.raid?.kind, 'hunters');
  const prompt = s.prompts.find((p) => p.id === s.raid!.prompt)!;
  assert.equal(prompt.options[prompt.defaultOption], `Give up ${vamp.name}`, 'the standing order is the default');
  answerPrompt(s, prompt.id, prompt.defaultOption, rng);
  assert.equal(s.raid, null, 'they leave');
  assert.ok(!s.people.includes(vamp), 'handed over');
  assert.ok((s.guild ?? 0) < GUILD_THRESHOLD);
  assert.ok(s.tick < 7 * TICKS_PER_DAY);
});
