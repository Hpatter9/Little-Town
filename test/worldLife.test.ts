// The living world: the powers fall out, march on each other and bleed; trade comes down the road and bandits may
// rob it; the world map is told what's moving.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worldHourly, worldView, WORLD_HOUR, MARCH_HOURS } from '../src/shared/sim/worldLife';
import { realm } from '../src/shared/sim/factions';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const hours = (s: ReturnType<typeof plainGame>, n: number) => {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    worldHourly(s);
  }
};
const toWorldHour = (s: ReturnType<typeof plainGame>) => {
  while (calendar(s.tick + TICKS_PER_HOUR).hour !== WORLD_HOUR) s.tick += TICKS_PER_HOUR;
};

test('two powers at feud march on each other, and the loser bleeds', () => {
  const s = plainGame('world-feud');
  s.autopilot = true;
  const fs = realm(s);
  for (const f of fs) f.known = true;
  s.feuds = [{ a: fs[0].id, b: fs[1].id, since: 0 }];
  const before = fs[0].troops + fs[1].troops;
  toWorldHour(s);
  hours(s, 1);
  const marching = worldView(s).marches.filter((m) => m.kind === 'feud');
  assert.ok(marching.length >= 1 || !s.feuds.length, 'a host marches');
  hours(s, MARCH_HOURS + 1);
  if (marching.length) assert.ok(fs[0].troops + fs[1].troops < before, 'the strike cost troops');
  assert.ok(s.notices.some((n) => /Realm news/.test(n.text)));
});

test('a power that trades sends its caravan down the road, and a war host is seen marching on the town', () => {
  const s = plainGame('world-trade');
  s.autopilot = true;
  const fs = realm(s);
  for (const f of fs) f.known = true;
  fs[0].stance = 'trade';
  fs[1].stance = 'war';
  fs[1].host = { at: s.tick + 10 * TICKS_PER_HOUR, size: 20 };
  toWorldHour(s);
  hours(s, 1);
  const v = worldView(s);
  assert.ok(v.marches.some((m) => m.kind === 'trade'), 'a caravan on the road');
  const host = v.marches.find((m) => m.kind === 'host');
  assert.ok(host && host.t > 0.5 && host.t < 1, 'the host is most of the way');
});
