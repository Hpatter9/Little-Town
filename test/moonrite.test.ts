import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerRite, offerMoonRite, tryRevive } from '../src/shared/sim/occult';
import { fullMoon } from '../src/shared/sim/monsters';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('the Moon Rite is hidden Occult research; answering the moon makes the founder a werewolf (refusing is the default)', () => {
  const t = TOPIC_BY_ID.moon_rite;
  assert.ok(t.hidden && t.branch === 'occult');
  const s = plainGame('moon');
  offerMoonRite(s);
  const q = s.prompts.at(-1)!;
  assert.equal(q.options[q.defaultOption], 'Refuse');
  answerRite(s, 'Refuse');
  assert.equal(s.people[0].monster ?? null, null);
  answerRite(s, q.options[0]);
  assert.equal(s.people[0].monster, 'werewolf');
});

test("a werewolf founder's wolves run with the town, all but the alpha", () => {
  const s = plainGame('pack');
  s.people[0].monster = 'werewolf';
  let wave = startRaid(s, RAID_KIND_BY_ID.wolves, 60, new Rng(3));
  let tries = 0;
  while (!wave.raiders.some((r) => r.kind === 'wolf_alpha') && tries++ < 20) wave = startRaid(s, RAID_KIND_BY_ID.wolves, 60, new Rng(tries + 3));
  const wolves = wave.raiders.filter((r) => r.kind === 'wolf');
  assert.ok(wolves.some((r) => r.ally), 'some of the pack joined');
  assert.ok(wave.raiders.filter((r) => r.kind === 'wolf_alpha').every((r) => !r.ally), 'the alpha never does');
  assert.ok(s.notices.some((n) => n.text.includes("catch the founder's scent")));
});

test("under a full moon a werewolf founder won't stay dead (once a night)", () => {
  const s = plainGame('moon-revive');
  const p = s.people[0];
  p.monster = 'werewolf';
  let d = 0;
  while (!fullMoon(s) && d++ < 60) s.tick += TICKS_PER_DAY;
  assert.ok(fullMoon(s));
  assert.equal(tryRevive(s, p), true);
  assert.equal(tryRevive(s, p), false, 'only once a night');
  while (fullMoon(s)) s.tick += TICKS_PER_DAY;
  assert.equal(tryRevive(s, p), false, 'and not when the moon is waning');
});
