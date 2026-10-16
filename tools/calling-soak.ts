// The peoples' own base callings over a run (docs/notes/origin-classes.md): for towns of some peoples, the people,
// the deaths, how many hold one of their people's own callings (`oc_` roads) at the end, and the raids won, driven off
// or pillaged; and the hash of a plain town (autopilot off) that the callings must leave as it was.
// Run: node tools/calling-soak.mjs [days] [seeds] [origin,origin...]
import { createHash } from 'node:crypto';
import { serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const args = process.argv.slice(2);
const DAYS = Number(args[0] ?? 40);
const SEEDS = Number(args[1] ?? 3);
const origins = (args[2] ?? 'lich,knights,orcs').split(',');

for (const o of origins) {
  for (let k = 0; k < SEEDS; k++) {
    const s: GameState = newGame(`calling-${o}-${k}`, { origin: o as 'settlers' });
    const sim = new Sim(s);
    const fell0 = (s.fallen ?? []).length;
    const raids = { victory: 0, driven: 0, pillaged: 0 };
    let last = s.raidRecap;
    for (let t = 0; t < DAYS * TICKS_PER_DAY; t++) {
      sim.step();
      if (s.gameOver?.won) s.gameOver = null;
      if (s.raidRecap && s.raidRecap !== last) raids[s.raidRecap.outcome]++;
      last = s.raidRecap;
      if (s.gameOver) break;
    }
    const grown = s.people.filter((p) => p.cls);
    const own = grown.filter((p) => p.road?.startsWith('oc_')).length;
    const deaths = (s.fallen ?? []).length - fell0;
    console.log(`${o.padEnd(9)} seed ${k}: people ${String(s.people.length).padStart(3)} deaths ${String(deaths).padStart(3)} own callings ${own}/${grown.length} raids won ${raids.victory} driven ${raids.driven} pillaged ${raids.pillaged}${s.gameOver ? ' (fell)' : ''}`);
  }
}
// a plain town (autopilot off), five days: its hash must not move
for (const o of ['settlers', 'lich', 'orcs'] as const) {
  const s = newGame(`plain-${o}`, { origin: o });
  s.autopilot = false;
  const sim = new Sim(s);
  for (let t = 0; t < 5 * TICKS_PER_DAY; t++) sim.step();
  console.log(`plain ${o}: ${createHash('sha1').update(serialize(s, 0)).digest('hex').slice(0, 12)}`);
}
