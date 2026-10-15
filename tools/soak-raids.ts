// Raid counts and deaths over a soak (the odds weighed: sim/raidOdds.ts). Run: node tools/soak-raids.mjs [days] [origin...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { newGame } from '../src/shared/sim/state';
import { oddsOf } from '../src/shared/sim/raidOdds';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 40);
const origins = process.argv.slice(3).length ? process.argv.slice(3) : ['settlers', 'knights', 'lich'];
for (const origin of origins) {
  for (const seed of ['soak-a', 'soak-b']) {
    // ('fixture': the mature town the perf tests use, with its raids left on)
    let s = newGame(`${seed}-${origin}`, { origin: (origin === 'fixture' ? 'settlers' : origin) as never });
    if (origin === 'fixture') {
      if (seed !== 'soak-a') continue;
      const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
      if (!r.ok) throw new Error('no fixture');
      s = r.save.state;
      s.raid = null;
    }
    const sim = new Sim(s);
    let raids = 0;
    let attacks = 0;
    let deaths = 0;
    let ids = new Set(s.people.map((p) => p.id));
    let wasOn: object | null = null;
    let wasActive = false;
    for (let i = 0; i < days * TICKS_PER_DAY; i++) {
      sim.step();
      if (process.env.ODDS && s.raid && s.raid.phase === 'warning' && s.tick + 1 >= s.raid.arrivesTick && !(s.raid as { logged?: boolean }).logged) {
        (s.raid as { logged?: boolean }).logged = true;
        console.log(`  day ${(s.tick / TICKS_PER_DAY).toFixed(1)} ${s.raid.kind} x${s.raid.raiders.length} odds ${oddsOf(s, s.raid).toFixed(2)} people ${s.people.length}`);
      }
      if (s.raid && s.raid !== wasOn) raids++;
      wasOn = s.raid;
      const active = !!s.raid && s.raid.phase === 'active';
      if (active && !wasActive) attacks++;
      wasActive = active;
      if (s.raid?.phase === 'active' || i % 600 === 0) {
        const now = new Set(s.people.map((p) => p.id));
        if (s.raid?.phase === 'active') for (const id of ids) if (!now.has(id)) deaths++;
        ids = now;
      }
    }
    const o = (s as { raidOdds?: { turned?: number; spared?: number; hunted?: number } }).raidOdds;
    console.log(`${origin.padEnd(9)} ${seed}  raids ${raids}  fought ${attacks}  turned back ${o?.turned ?? 0}  spared ${o?.spared ?? 0}  hunted ${o?.hunted ?? 0}  raid deaths ${deaths}  people ${s.people.length}`);
  }
}
