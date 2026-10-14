// End-state hashes for checking that a speed-up changes nothing: the fixture caught up two days, and a few new towns
// run with the autopilot for some days. Run: node tools/sim-hash.mjs [days]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { startCatchUp } from '../src/shared/sim/offline';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const hash = (s: Parameters<typeof serialize>[0]) => createHash('sha1').update(serialize(s, 0)).digest('hex').slice(0, 12);
const days = Number(process.argv[2] ?? 6);
const only = process.argv[3];
if (!only || only === 'fixture') {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  const s = r.save.state;
  s.raid = null;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  const t = performance.now();
  const job = startCatchUp(new Sim(s), 7 * 24 * 3_600_000);
  while (!job.run(500));
  console.log(`fixture ${hash(s)} ${((performance.now() - t) / 1000).toFixed(1)} s`);
}
for (const [seed, origin] of [['hash-a', 'settlers'], ['hash-b', 'knights'], ['hash-c', 'vampire'], ['hash-d', 'dwarves']] as const) {
  if (only && only !== seed) continue;
  const s = newGame(seed, { origin });
  const sim = new Sim(s);
  const t = performance.now();
  for (let i = 0; i < days * TICKS_PER_DAY; i++) sim.step();
  console.log(`${seed} ${origin} ${hash(s)} people ${s.people.length} ${((performance.now() - t) / 1000).toFixed(1)} s`);
}
