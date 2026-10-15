// How the ring wall goes up: for each town, the day the ring is first under way and the day it stands, how long the
// gap is between its first and last piece turning from blueprint to built (0 when the whole wall goes up together),
// how many builders work at once and how far apart along the line, and people and deaths at the end.
// Run: node tools/wall-probe.mjs [days] [seeds] [origin,origin...]
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { isRingPiece } from '../src/shared/sim/ringWall';

const DAYS = Number(process.argv[2] ?? 40);
const SEEDS = Number(process.argv[3] ?? 3);
const origins = (process.argv[4] ?? 'settlers,knights').split(',');
for (const origin of origins) {
  for (let k = 0; k < SEEDS; k++) {
    const s = newGame(`wall-${k}`, { origin });
    const sim = new Sim(s);
    let raids = 0, wasRaid: unknown = null, fell = -1;
    let started = -1, stood = -1, firstDone = -1, lastDone = -1, maxBuilders = 0, spreadSum = 0, spreadN = 0, gen = 0;
    const doneAt = new Map<number, number>();
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
      sim.step();
      if (s.raid && s.raid !== wasRaid) raids++;
      wasRaid = s.raid;
      if (s.gameOver && fell < 0) fell = s.tick / TICKS_PER_DAY;
      if (!s.ring) continue;
      if (started < 0) started = s.tick / TICKS_PER_DAY;
      if (s.ring.gen !== gen) { gen = s.ring.gen; doneAt.clear(); }
      if (gen === 1 && !s.ring.done) {
        for (const b of s.buildings) if (b.ring === gen && b.status === 'done' && isRingPiece(b.def) && !doneAt.has(b.id)) doneAt.set(b.id, s.tick);
        const bs = s.people.filter((p) => p.task?.type === 'build' && s.buildings.find((b) => b.id === (p.task as { building: number }).building)?.ring === gen);
        maxBuilders = Math.max(maxBuilders, bs.length);
        if (bs.length > 1 && s.tick % 50 === 0) {
          const pts = bs.map((p) => ({ x: p.x, y: p.y }));
          let sum = 0, n = 0;
          for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { sum += Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); n++; }
          spreadSum += sum / n; spreadN++;
        }
      }
      if (gen === 1 && s.ring.done && stood < 0) {
        stood = s.tick / TICKS_PER_DAY;
        const ts = [...doneAt.values()];
        firstDone = Math.min(...ts) / TICKS_PER_DAY; lastDone = Math.max(...ts) / TICKS_PER_DAY;
      }
      if (s.gameOver) break;
    }
    const f = (n: number) => (n < 0 ? '-' : n.toFixed(2));
    console.log(`${origin} #${k}: ring laid day ${f(started)}, stands day ${f(stood)}, pieces built over ${f(lastDone - firstDone)} days (first ${f(firstDone)} last ${f(lastDone)}), max builders ${maxBuilders}, builders' mean spread ${spreadN ? (spreadSum / spreadN / 32).toFixed(1) : '-'} cells, raids ${raids}, people ${s.people.length}, deaths ${(s.fallen ?? []).length}${fell >= 0 ? `, fell day ${fell.toFixed(1)}` : ''}`);
  }
}
