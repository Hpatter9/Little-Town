// What towns on hilly land make of it (sim/relief.ts): for some seeds, after some days, the quarries, the buildings cut
// into the rock, the tunnel cells and how far from the camp they lie. Run: node tools/probe-hills.mjs [days] [seeds] [biome] [origin]
import { newGame } from '../src/shared/sim/state';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { footprint } from '../src/shared/sim/buildings';

const days = Number(process.argv[2] ?? 12);
const seeds = Number(process.argv[3] ?? 4);
const biome = (process.argv[4] ?? 'highlands') as never;
const origin = (process.argv[5] ?? 'settlers') as never;
for (let k = 0; k < seeds; k++) {
  const s = newGame(`hills${k}`, { biome, origin, relief: process.env.RELIEF !== '0' });
  const sim = new Sim(s);
  for (let i = 0; i < days * TICKS_PER_DAY; i++) sim.step();
  const c = s.land.camp;
  const far = (b: (typeof s.buildings)[number]) => Math.round(Math.hypot(footprint(b).x - c.x, footprint(b).y - c.y));
  const tunnel: number[] = [];
  for (let i = 0; i < s.land.cells.length; i++) if ((s.land.cells[i] === 'H' || s.land.cells[i] === 'M') && (s.land.roads[i] === '#' || s.land.plannedRoads?.[i] === '#')) tunnel.push(i);
  console.log(`hills${k} ${biome} ${origin}: people ${s.people.length} buildings ${s.buildings.length} open ${s.land.open.toFixed(1)} quarries ${s.buildings.filter((b) => b.def === 'quarry').map(far).join(',') || '-'} cut ${s.buildings.filter((b) => b.cut).map((b) => `${b.def}@${far(b)}`).join(',') || '-'} tunnel ${tunnel.length} (${tunnel.filter((i) => s.land.cells[i] === 'H').length} cut)`);
}
