import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGINS, ORIGIN_DEFS } from '../src/shared/data/origins';
import { Rng } from '../src/shared/rng';
import { castHeld, castPowers, holdPower, POWERS } from '../src/shared/sim/powers';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

// an origin with a power that needs nothing paid for it, for the test
const pick = ORIGINS.flatMap((o) => ORIGIN_DEFS[o].powers.filter((id) => !POWERS[id]?.costs).map((id) => [o, id] as const))[0];

test('a power held back is never cast by the town; the player casts it when it is ready', () => {
  assert.ok(pick, 'some origin has a free power');
  const [origin, id] = pick;
  const s = newGame('held', { origin });
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  holdPower(s, id);
  assert.equal(snapshot(s).powers.find((p) => p.id === id)!.held, true);
  const realWhen = POWERS[id].when;
  POWERS[id].when = () => true; // (the moment is always right, for the town)
  try {
    s.tick = TICKS_PER_HOUR * 5;
    castPowers(s, new Rng(1));
    assert.ok(!((s.powers?.[id] ?? 0) > s.tick), 'the town left it alone');
    assert.ok(castHeld(s, new Rng(1)), 'the player casts it');
    assert.ok((s.powers?.[id] ?? 0) > s.tick, 'and it recharges');
    assert.equal(castHeld(s, new Rng(1)), false, 'not again until it has');
    holdPower(s, null);
    assert.equal(s.heldPower, undefined);
  } finally {
    POWERS[id].when = realWhen;
  }
});

test("only the town's own powers can be held", () => {
  const s = newGame('held-other', { origin: 'settlers' });
  holdPower(s, 'no_such_power');
  assert.equal(s.heldPower, undefined);
});
