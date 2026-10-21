import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { ORIGINS } from '../src/shared/data/origins';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

// every people's self-running town researches something and puts up at least one home
for (const origin of ORIGINS) {
  test(`${origin}: the self-running town researches and builds a home`, () => {
    const sim = new Sim(newGame(`planner-${origin}`, { origin }));
    const s = sim.state;
    s.autopilot = true;
    const start = s.research.done.length;
    for (let t = 0; t < 8 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
    const homes = s.buildings.filter((b) => BUILDING_BY_ID[b.def]?.housing && b.status === 'done' && b.def !== 'campfire');
    const dbg = `${origin}: research ${start}->${s.research.done.length}, homes ${homes.length}, blueprints ${s.buildings.filter((b) => b.status === 'blueprint').map((b) => b.def)}, people ${s.people.length}`;
    assert.ok(s.research.done.length > start, `no research: ${dbg}`);
    assert.ok(homes.length >= 1, `no home: ${dbg}`);
  });
}
