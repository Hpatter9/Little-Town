// Prints a dwarves hold after some days as a map (. open, # rock, = dug, h hallway, r room). Run: node tools/hold-map.mjs [days]
import { footprint } from '../src/shared/sim/buildings';
import { groundAt } from '../src/shared/sim/land';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
const sim = new Sim(newGame('hold-map', { origin: 'dwarves' as never }));
const s = sim.state;
for (let t = 0; t < Number(process.argv[2] ?? 20) * TICKS_PER_DAY; t++) sim.step();
const mark = new Map<string, string>();
for (const b of s.buildings) if (b.room) { const f = footprint(b); for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) mark.set(`${x},${y}`, b.def === 'hold_hallway' ? (b.status === 'done' ? 'h' : 'p') : b.status === 'done' ? 'r' : 'q'); }
for (let y = 60; y < 100; y++) console.log(String(y).padStart(3), Array.from({ length: 70 }, (_, k) => { const x = 62 + k; const g = groundAt(s.land, x, y); const m = mark.get(`${x},${y}`); return g === 'mountain' ? (m ? m.toUpperCase() : '#') : m && g === 'hall' ? m : g === 'hall' ? '=' : '.'; }).join(''));
console.log('people', s.people.length, 'rooms', s.buildings.filter((b) => b.room && b.def !== 'hold_hallway').length, 'hallways', s.buildings.filter((b) => b.def === 'hold_hallway').map((b) => `${b.status}@${b.tile},${b.row}${b.turned ? 'T' : ''}`).join(' '));
import { hallSpot } from '../src/shared/sim/planner';
console.log('hallSpot', JSON.stringify(hallSpot(s)), 'slots', s.buildings.filter((b) => b.status === 'blueprint').map((b) => b.def).join(','), 'stock', JSON.stringify(s.buildings.flatMap((b) => Object.entries(b.store)).slice(0, 5)));
