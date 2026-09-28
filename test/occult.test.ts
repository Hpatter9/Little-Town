import assert from 'node:assert/strict';
import { test } from 'node:test';
import { killPerson } from '../src/shared/sim/health';
import { occultRevealed, offerBloodRite, revealOccult } from '../src/shared/sim/occult';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { Rng } from '../src/shared/rng';
import { canQueue } from '../src/shared/sim/research';
import type { Building } from '../src/shared/sim/state';
import { plainGame } from './helpers';

test('the Occult stays hidden until something reveals it', () => {
  const s = plainGame('occult');
  assert.equal(occultRevealed(s), false);
  assert.match(canQueue(s.research, 'forbidden_lore', s.era).reason ?? '', /Undiscovered/);
  revealOccult(s, 'A vision.');
  assert.ok(occultRevealed(s));
  assert.equal(canQueue(s.research, 'forbidden_lore', s.era).ok, true);
  assert.ok(s.notices.some((n) => n.text.includes('the Occult')));
});

test('a vampire founder rises once a night; a lich returns while the phylactery stands', () => {
  const s = plainGame('undead');
  const main = s.people[0];
  offerBloodRite(s);
  const rite = s.prompts.at(-1)!;
  answerPrompt(s, rite.id, 0, new Rng(1));
  assert.equal(main.monster, 'vampire');
  killPerson(s, main, 'at dawn');
  assert.equal(s.gameOver, null, 'rose again');
  killPerson(s, main, 'again the same day');
  assert.ok(s.gameOver, 'but only once a night');

  const s2 = plainGame('lich');
  const lich = s2.people[0];
  const phyl: Building = { id: s2.nextId++, def: 'phylactery', tile: 95, status: 'done', delivered: {}, progress: 1, store: {} };
  s2.buildings.push(phyl);
  for (let i = 0; i < 3; i++) killPerson(s2, lich, 'over and over');
  assert.equal(s2.gameOver, null, 'always returns');
  s2.buildings = s2.buildings.filter((b) => b !== phyl); // burned
  killPerson(s2, lich, 'finally');
  assert.ok(s2.gameOver);
});

test('a Spirit Totem, then a Resurrection Shrine, bring the founder back; after that, death is final', () => {
  const s = plainGame('revive');
  const main = s.people[0];
  s.items.spirit_totem = 1;
  const shrine: Building = { id: s.nextId++, def: 'resurrection_shrine', tile: 90, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(shrine);

  killPerson(s, main, 'in a fall');
  assert.equal(s.gameOver, null);
  assert.ok(s.people.includes(main) && main.hp > 0);
  assert.equal(s.items.spirit_totem ?? 0, 0, 'totem used');

  killPerson(s, main, 'in another fall');
  assert.equal(s.gameOver, null);
  assert.equal(shrine.spent, true, 'shrine used');

  killPerson(s, main, 'for good');
  assert.ok(s.gameOver, 'no third chance');
});
