import { newGame } from '../src/shared/sim/state';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
const seed = process.argv[2] ?? 'hold-grows';
const sim = new Sim(newGame(seed, { origin: 'dwarves' }));
const s = sim.state;
let raids = 0;
for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) { const had = !!s.raid; sim.step(); if (!had && s.raid) raids++; }
console.log(seed, 'people', s.people.length, 'raids', raids, 'rooms', s.buildings.filter((b) => b.room).length, 'fallen', (s.fallen ?? []).length);
