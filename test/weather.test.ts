import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPELL_HOURS, spellWeather, weatherAt, type Weather } from '../src/shared/sim/weather';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

const SPELL = SPELL_HOURS * TICKS_PER_HOUR;

test('the weather is the same for the same town and time, and holds for a spell of hours', () => {
  assert.deepEqual(weatherAt('town-a', 50 * SPELL + 10, null), weatherAt('town-a', 50 * SPELL + 10, null));
  assert.equal(weatherAt('town-a', 50 * SPELL, null).kind, weatherAt('town-a', 51 * SPELL - 1, null).kind, 'one spell, one weather');
  assert.equal(weatherAt('town-a', 50 * SPELL, null).before, weatherAt('town-a', 49 * SPELL, null).kind);
});

test('the season sets the odds: snow only in winter, storms mostly in summer; every season has some variety', () => {
  const seen = (season: Parameters<typeof spellWeather>[2]) => {
    const n = new Map<Weather, number>();
    for (let i = 0; i < 400; i++) {
      const w = spellWeather('odds', i, season);
      n.set(w, (n.get(w) ?? 0) + 1);
    }
    return n;
  };
  const winter = seen('winter');
  const summer = seen('summer');
  assert.ok((winter.get('snow') ?? 0) > 100);
  assert.equal(summer.get('snow') ?? 0, 0);
  assert.ok((summer.get('storm') ?? 0) > 20 && (summer.get('clear') ?? 0) > 150);
  for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) assert.ok(seen(s).size >= 3, s);
});

test('disasters bring their own weather', () => {
  assert.equal(weatherAt('x', 5 * SPELL, 'deep_freeze').kind, 'snow');
  assert.equal(weatherAt('x', 5 * SPELL, 'drought').kind, 'clear');
  assert.equal(weatherAt('x', 5 * SPELL, 'ash_winter').kind, 'fog');
});
