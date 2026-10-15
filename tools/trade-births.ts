// Does the trade empire's staff away on the roads block births or hauling? On the late fixture under the Trade direction,
// counts each hour the couples split by the road (one partner away on the trade roads, the other at home), the adults
// away, and the births. Run: node tools/trade-births.mjs [days] [seeds]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { EMPIRE_AWAY } from '../src/shared/data/tradeEmpire';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 40);
const seeds = Number(process.argv[3] ?? 2);
for (let k = 0; k < seeds; k++) {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  const s = r.save.state;
  s.seed = `${s.seed}:${k}`;
  s.direction = 'trade';
  const sim = new Sim(s);
  const kids0 = new Set(s.people.filter((p) => p.bornTick != null).map((p) => p.id));
  let split = 0, married = 0, awayHours = 0, hours = 0, lastHour = -1;
  const born = new Set<number>();
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    sim.step();
    for (const p of s.people) if (p.bornTick != null && !kids0.has(p.id)) born.add(p.id);
    if (s.tick % TICKS_PER_HOUR || s.tick === lastHour) continue; // (a step that waits on a question leaves the tick where it was)
    lastHour = s.tick;
    hours++;
    awayHours += s.people.filter((p) => p.away === EMPIRE_AWAY).length;
    for (const a of s.people) {
      const b = a.partner == null ? undefined : s.people.find((q) => q.id === a.partner);
      if (!b || a.id > b.id || !a.married) continue;
      married++;
      if ((a.away === EMPIRE_AWAY) !== (b.away === EMPIRE_AWAY)) split++;
    }
  }
  console.log(`seed ${k}: people ${s.people.length} born ${born.size} married-couple-hours ${married} split by the road ${split} (${((100 * split) / Math.max(1, married)).toFixed(1)}%) staff away on average ${(awayHours / hours).toFixed(1)}`);
}
