// Writes a dwarves town, run for some days, as a phone save (for previews). Run: node tools/make-save.mjs out.txt [days]
// (SEED=, ORIGIN=settlers, BIOME=highlands: another town; RELIEF=0 a level land)
import { writeFileSync } from 'node:fs';
import { serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
const env = process.env;
const sim = new Sim(newGame(env.SEED ?? 'shot', { origin: (env.ORIGIN ?? 'dwarves') as never, relief: env.RELIEF !== '0', ...(env.BIOME ? { biome: env.BIOME as never } : {}) }));
for (let t = 0; t < Number(process.argv[3] ?? 6) * TICKS_PER_DAY; t++) sim.step();
writeFileSync(process.argv[2], serialize(sim.state, Date.now()));
