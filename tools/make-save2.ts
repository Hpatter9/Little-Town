// Writes a settlers town, run for some days, as a phone save (for previews). Run: node tools/make-save2.mjs out.txt [days]
import { writeFileSync } from 'node:fs';
import { serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
const sim = new Sim(newGame('shot', { origin: 'settlers' as never }));
for (let t = 0; t < Number(process.argv[3] ?? 6) * TICKS_PER_DAY; t++) sim.step();
writeFileSync(process.argv[2], serialize(sim.state, Date.now()));
