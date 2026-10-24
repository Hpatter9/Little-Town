import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanNewGameOptions } from '../src/shared/data/founding';
import { FOUNDERS } from '../src/shared/data/founders';
import { ORIGINS, PLAYABLE_ORIGINS } from '../src/shared/data/origins';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

// The peoples to found a town as (the owner's call: the settlers only, docs/notes/settlers-only.md; before that five,
// docs/notes/five-origins.md); the rest stay in the game.

const base = { biome: 'forest', difficulty: 'normal' };
const hidden = ORIGINS.filter((o) => !PLAYABLE_ORIGINS.includes(o));

test('a new town offers only the settlers', () => {
  assert.deepEqual([...PLAYABLE_ORIGINS], ['settlers']);
  for (const o of PLAYABLE_ORIGINS) assert.equal(cleanNewGameOptions({ ...base, origin: o })?.origin, o, `${o} can be founded`);
  assert.equal(hidden.length, 12);
  for (const o of hidden) assert.equal(cleanNewGameOptions({ ...base, origin: o }), null, `${o} is not offered`);
  assert.equal(cleanNewGameOptions(base)?.origin, 'settlers', 'left out: the settlers, as ever');
});

test("a ready-made founder comes only with their own people, and a hidden people's founders are not offered", () => {
  for (const o of PLAYABLE_ORIGINS) for (const f of FOUNDERS[o]) assert.ok(cleanNewGameOptions({ ...base, origin: o, founder: { pick: f.id } }), `${f.id} founds a ${o} town`);
  for (const o of hidden) for (const f of FOUNDERS[o]) assert.equal(cleanNewGameOptions({ ...base, origin: 'settlers', founder: { pick: f.id } }), null, `${f.id} (${o}) is not offered`);
});

for (const origin of hidden) {
  test(`an older ${origin} town still loads and steps`, () => {
    const s0 = newGame(`old-${origin}`, { origin });
    const sim0 = new Sim(s0);
    for (let i = 0; i < TICKS_PER_HOUR; i++) sim0.step();
    const back = parseSave(serialize(s0, 0));
    assert.ok(back.ok, 'the save loads');
    if (!back.ok) return;
    const s = back.save.state;
    assert.equal(s.origin, origin, 'still its own people');
    const sim = new Sim(s);
    const from = s.tick;
    for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
    assert.equal(s.tick, from + TICKS_PER_HOUR, 'the clock moves');
    assert.equal(s.origin, origin);
  });
}
