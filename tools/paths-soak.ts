// Footpaths and streets over a run: how many cells are worn, planned and paved, day by day. Used to tune the
// speed paths build up (docs/notes/faster-paths.md). Run: node tools/paths-soak.mjs <origin|fixture> <seed> <days>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { WEAR_FULL, WEAR_SHOW, wearAt } from '../src/shared/sim/land';

const [what = 'settlers', seed = 'soak-a', daysArg = '40', every = '1'] = process.argv.slice(2);
const days = Number(daysArg);
let s;
if (what === 'fixture') {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  s = r.save.state;
  s.raid = null;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
} else s = newGame(seed, { origin: what as 'settlers' });
const sim = new Sim(s);
const count = (str: string | undefined, f: (c: string) => boolean) => (str ? [...str].filter(f).length : 0);
const rows: string[] = [];
const sample = (d: number) => {
  const m = s.land;
  const worn = m.wear ? Array.from({ length: m.w * m.h }, (_, i) => wearAt(m, i)) : [];
  rows.push(
    `day ${String(d).padStart(3)} people ${String(s.people.length).padStart(3)} dead ${String(s.fallen?.length ?? 0).padStart(3)} buildings ${String(s.buildings.length).padStart(3)} ` +
      `paved ${String(count(m.roads, (c) => c === '#')).padStart(4)} planned ${String(count(m.plannedRoads, (c) => c === '#')).padStart(4)} ` +
      `showing ${String(worn.filter((w) => w >= WEAR_SHOW).length).padStart(4)} clear ${String(worn.filter((w) => w >= WEAR_FULL).length).padStart(4)}`,
  );
};
sample(0);
for (let d = 1; d <= days; d++) {
  for (let i = 0; i < TICKS_PER_DAY; i++) sim.step();
  if (d % Number(every) === 0 || d === days) sample(d);
}
console.log(`${what} ${seed}`);
console.log(rows.join('\n'));
