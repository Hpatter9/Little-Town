// The sim's cost on a big late-game town (test/fixtures/late-town.json.gz: knights, day 33, 37 people, 281
// buildings), for the phone's performance work: a tick's step, its snapshot, the delta sent from the phone's sim
// worker to the page and copying it, against copying the whole snapshot, and catching up two days away.
// Run: node tools/perf-sim.mjs [ticks]

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { SnapDiffer } from '../src/shared/snapDelta';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

// (SAVE=<file.json>: another save instead, e.g. tools/under-saves.mjs's; UNDER=1: with the Underdark's view open)
const load = () => {
  const r = parseSave(process.env.SAVE ? readFileSync(process.env.SAVE, 'utf8') : gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('the fixture would not load');
  return r.save.state;
};
const N = Number(process.argv[2] ?? 3000);
const s = load();
if (process.env.UNDER) s.watchingUnder = true;
const sim = new Sim(s);
const differ = new SnapDiffer();
let step = 0, snap = 0, diff = 0, clone = 0, bytes = 0, full = 0, fulls = 0, hitches = 0;
for (let i = 0; i < N; i++) {
  let t = performance.now();
  sim.step();
  const a = performance.now() - t;
  t = performance.now();
  const sn = snapshot(s);
  const b = performance.now() - t;
  t = performance.now();
  const d = differ.diff(sn);
  diff += performance.now() - t;
  t = performance.now();
  structuredClone(d);
  clone += performance.now() - t;
  if (i) bytes += JSON.stringify(d).length;
  if (i % 100 === 50) {
    t = performance.now();
    structuredClone(sn);
    full += performance.now() - t;
    fulls++;
  }
  step += a;
  snap += b;
  if (i > 20 && a + b > 50) hitches++;
}
const f = (x: number) => (x / N).toFixed(2);
console.log(`${s.people.length} people, ${s.buildings.length} buildings, ${N} ticks`);
console.log(`step ${f(step)} ms · snapshot ${f(snap)} ms · ticks over 50 ms ${hitches}`);
console.log(`delta ${f(diff)} ms to make, ${f(clone)} ms to copy, ${(bytes / N / 1024).toFixed(1)} KB · whole snapshot ${(full / fulls).toFixed(2)} ms to copy`);
// (the raid at the fixture's gate and any choice event would stop the play: left out, so the two days are all played)
const long = load();
long.raid = null;
long.nextRaidTick = Number.MAX_SAFE_INTEGER;
long.nextEventTick = Number.MAX_SAFE_INTEGER;
const longSim = new Sim(long);
const LONG_TICKS = 28_800;
const t0 = performance.now();
for (let i = 0; i < LONG_TICKS; i++) longSim.step();
console.log(`running ${LONG_TICKS / TICKS_PER_DAY} game days flat out: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
