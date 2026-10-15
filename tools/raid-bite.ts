// How hard raids bite: per raid, who came, how it ended (tactics outcome), and the townsfolk lost while it was on.
// Run: node tools/raid-bite.mjs [days] [seeds] [origin|fixture ...]   (BITE_LOG=1 lists each raid)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { newGame, poolSize, type GameState, type Raid } from '../src/shared/sim/state';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 40);
const seeds = Number(process.argv[3] ?? 3);
const origins = process.argv.slice(4).length ? process.argv.slice(4) : ['settlers', 'knights', 'orcs', 'fixture'];
for (const origin of origins) {
  const tot = { raids: 0, fought: 0, deaths: 0, downed: 0, won: 0, fled: 0, lost: 0, none: 0, through: 0, stolen: 0, fires: 0, clock: 0 };
  let people = 0;
  for (let k = 0; k < seeds; k++) {
    let s: GameState;
    if (origin === 'fixture') {
      const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
      if (!r.ok) throw new Error('no fixture');
      s = r.save.state;
      s.seed = `${s.seed}:${k}`;
    } else s = newGame(`bite${k}`, { origin: origin as never });
    const sim = new Sim(s);
    let cur: Raid | null = null;
    let fell0 = 0, down0 = 0, last: Raid | null = null, startTick = 0, fires0 = 0;
    const fires = () => s.buildings.filter((b) => b.fire !== undefined).length;
    for (let i = 0; i < days * TICKS_PER_DAY; i++) {
      sim.step();
      if (s.raid !== cur) {
        if (cur) close(cur);
        cur = s.raid;
        if (cur) { fell0 = (s.fallen ?? []).length; down0 = 0; startTick = s.tick; fires0 = fires(); }
      }
      if (s.raid) last = s.raid;
      if (cur && s.raid?.phase === 'active') down0 = Math.max(down0, s.people.filter((p) => p.downed).length);
    }
    function close(r: Raid) {
      tot.raids++;
      const t = r.tactics;
      const deaths = (s.fallen ?? []).length - fell0;
      const fought = r.phase === 'active' || !!t;
      if (!fought) return; // (turned back, spared...)
      tot.fought++;
      tot.deaths += deaths;
      tot.downed += down0;
      const o = t?.outcome ?? 'none';
      tot[o === 'won' ? 'won' : o === 'fled' ? 'fled' : o === 'lost' ? 'lost' : 'none']++;
      tot.through += t?.through ?? 0;
      const rec = s.raidRecap;
      const st = rec && rec.tick >= startTick ? poolSize(rec.stolen) : 0;
      tot.stolen += st;
      tot.fires += Math.max(0, fires() - fires0);
      if (s.tick >= r.leavesTick) tot.clock++;
      if (process.env.BITE_LOG) console.log(`  ${origin} s${k} day ${(startTick / TICKS_PER_DAY).toFixed(1)} ${r.kind} x${r.raiders.length} ${o} through ${t?.through ?? 0} killed ${t?.killed ?? 0} deaths ${deaths} downed ${down0} stolen ${st} hrs ${((s.tick - startTick) / 600).toFixed(1)}`);
    }
    people += s.people.length;
  }
  const f = Math.max(1, tot.fought);
  console.log(`${origin.padEnd(9)} raids ${tot.raids} fought ${tot.fought} (won ${tot.won} fled ${tot.fled} lost ${tot.lost} other ${tot.none}) deaths ${tot.deaths} (${(tot.deaths / f).toFixed(2)}/raid) downed ${tot.downed} through ${tot.through} stolen ${tot.stolen} fires ${tot.fires} ended-by-clock ${tot.clock} people ${(people / seeds).toFixed(1)}`);
}
