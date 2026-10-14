// Probe (kept by hand): counts who stands on mountain rock in a dwarves town. Run: node tools/probe-mountain.mjs [days]
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { CELL, groundAt } from '../src/shared/sim/land';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 6);
const s = newGame('probe', { origin: 'dwarves' as never });
const sim = new Sim(s);
const hits: Record<string, number> = {};
const first: Record<string, string> = {};
for (let t = 0; t < days * TICKS_PER_DAY; t++) {
  sim.step();
  if (t % 5) continue;
  const seen = new Set<unknown>();
  const scan = (o: any, path: string, depth: number) => {
    if (!o || typeof o !== 'object' || depth > 4 || seen.has(o) || path.startsWith('land') || path.startsWith('buildings')) return;
    seen.add(o);
    if (typeof o.x === 'number' && typeof o.y === 'number' && o.x > 400 && o.y > 400 && groundAt(s.land, Math.floor(o.x / CELL), Math.floor(o.y / CELL)) === 'mountain') {
      const k = path.replace(/\.\d+/g, '[]');
      hits[k] = (hits[k] ?? 0) + 1;
      first[k] ??= `tick ${s.tick} ${JSON.stringify({ x: o.x, y: o.y, task: o.task?.type, kind: o.kind ?? o.type })}`;
    }
    for (const [k, v] of Object.entries(o)) scan(v, path + '.' + k, depth + 1);
  };
  scan(s, 'S', 0);
}
console.log('people', s.people.length, 'buildings', s.buildings.length, 'rooms', s.buildings.filter((b) => b.room).length);
console.log(hits, first);
for (const b of s.buildings) console.log(b.id, b.def, b.status, b.room ? 'room' : '', b.progress.toFixed(2), b.tile, b.row, JSON.stringify(b.delivered));
console.log(s.people.map((p) => `${p.name} ${p.task?.type} ${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`));
