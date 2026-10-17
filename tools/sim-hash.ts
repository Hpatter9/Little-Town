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

// (STRIP=a,b leaves those top-level fields out of the hash: a branch that only records more compares with main so)
const strip = (process.env.STRIP ?? '').split(',').filter(Boolean);
const hash = (s: Parameters<typeof serialize>[0]) => {
  const t = s as unknown as Record<string, unknown>;
  const kept = strip.map((k) => [k, t[k]] as const);
  for (const k of strip) delete t[k];
  const h = createHash('sha1').update(serialize(s, 0)).digest('hex').slice(0, 12);
  for (const [k, v] of kept) if (v !== undefined) t[k] = v;
  return h;
};
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
// (the first four were founded before the land had hills and mountains, so they keep a level land; hash-e has relief)
for (const [seed, origin, relief] of [['hash-a', 'settlers', false], ['hash-b', 'knights', false], ['hash-c', 'vampire', false], ['hash-d', 'dwarves', false], ['hash-e', 'settlers', true]] as const) {
  if (only && only !== seed) continue;
  const s = newGame(seed, { origin, relief });
  const sim = new Sim(s);
  const t = performance.now();
  for (let i = 0; i < days * TICKS_PER_DAY; i++) sim.step();
  console.log(`${seed} ${origin} ${hash(s)} people ${s.people.length} ${((performance.now() - t) / 1000).toFixed(1)} s`);
}
