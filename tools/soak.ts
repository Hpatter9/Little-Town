// Balance soak: runs towns of each origin (or the late fixture) for some days and prints people and deaths.
// Run: node tools/soak.mjs [days] [seedCount] [origin,origin...]   (fixture: node tools/soak.mjs fixture [days] [seeds])
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ORIGINS } from '../src/shared/data/origins';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { launchAirship } from '../src/shared/sim/skies';
import { newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const args = process.argv.slice(2);
const fixture = args[0] === 'fixture';
if (fixture) args.shift();
const DAYS = Number(args[0] ?? 20);
const SEEDS = Number(args[1] ?? 3);
const origins = args[2] ? args[2].split(',') : [...ORIGINS];

const causes: Record<string, number> = {};
function run(s: GameState, days: number) {
  const sim = new Sim(s);
  const start = s.people.length, fell0 = (s.fallen ?? []).length;
  let low = start, end = days;
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < TICKS_PER_DAY; i++) { try { sim.step(); } catch (e) { console.log(`CRASH day ${d} tick ${s.tick}: ${(e as Error).message} dests ${JSON.stringify(s.expeditions.map((x) => x.dest))}`); throw e; } if (s.gameOver?.won) s.gameOver = null; } // (a won game carries on: the soak measures the town)
    low = Math.min(low, s.people.length);
    if (process.env.TIMELINE && d % 5 === 4) console.log(`  day ${d + 1}: people ${s.people.length} deaths ${(s.fallen ?? []).length - fell0} era ${s.era} buildings ${s.buildings.length}`);
    if (s.gameOver) { end = d + 1; break; }
  }
  for (const f of (s.fallen ?? []).slice(fell0)) causes[f.cause.replace(/ of .*$| at .*$|^by .*$/, '').slice(0, 40)] = (causes[f.cause.replace(/ of .*$| at .*$|^by .*$/, '').slice(0, 40)] ?? 0) + 1;
  return { start, people: s.people.length, deaths: (s.fallen ?? []).length - fell0, dead: (!!s.gameOver && !s.gameOver.won) || s.people.length === 0, over: s.gameOver?.text ?? '', low, end };
}
const rows: string[] = [];
process.on('exit', () => { if (process.env.CAUSES) console.log('causes', JSON.stringify(causes)); });
const names = fixture ? ['fixture'] : origins;
for (const o of names) {
  let pop = 0, deaths = 0, dead = 0, low = 0;
  for (let k = 0; k < SEEDS; k++) {
    let s: GameState;
    if (fixture) {
      const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
      if (!r.ok) throw new Error('fixture');
      s = r.save.state;
      s.seed = `${s.seed}:${k + Number(process.env.SEEDOFF ?? 0)}`;
      if (process.env.SKY) {
        // forced into the Industrial age; SKY=ship also builds an airship (the skies chat's experiment)
        s.era = 'industrial';
        s.research.done.push('steam_power', 'cartography', 'steelmaking', 'aeronautics', 'rigid_airships');
        if (process.env.SKY === 'ship') { s.buildings.push({ id: s.nextId++, def: 'airship_mast', tile: s.land.camp.x + 4, row: s.land.camp.y + 3, status: 'done', delivered: {}, progress: 1, store: {} } as never); launchAirship(s, 'zeppelin'); }
      }
    } else s = newGame(`soak${k}`, { origin: o as never });
    if (process.env.DIRECTION) s.direction = process.env.DIRECTION as never; // (DIRECTION=trade: the town's direction, set from the start)
    const r = run(s, DAYS);
    if (r.over) console.log(`  ${o} seed ${k} ended day ${r.end}: ${r.over}`);
    if (process.env.SKY) console.log(`  sky: pirates seen/last ${JSON.stringify(s.skies?.lastPirates ?? null)} fleet ${(s.airships ?? []).length} raidsDue ${s.nextRaidTick - s.tick}`);
    if (process.env.EMPIRE) console.log(`  ${o} seed ${k}: coins ${s.coins ?? 0} posts ${s.empire?.posts.length ?? 0} founded ${s.empire?.founded ?? 0} lost ${s.empire?.lostPosts ?? 0} caravans ${s.empire?.sent ?? 0} lost ${s.empire?.lostCaravans ?? 0} tributes ${s.empire?.tributes ?? 0}/${s.empire?.tributePaid ?? 0} made ${s.empire?.made ?? 0} deals ${s.empire?.standing ?? 0} house ${s.market?.standing ?? 0} era ${s.era}`);
    if (process.env.EMPIRE === '2') console.log((s.empire?.log ?? []).slice().reverse().map((l) => `    ${l}`).join('\n'));
    if (process.env.EMPIRE) console.log(`  ${o} seed ${k}: people ${r.people} deaths ${r.deaths}`);
    pop += r.people; deaths += r.deaths; dead += r.dead ? 1 : 0; low += r.low;
  }
  rows.push(`${o.padEnd(11)} people ${(pop / SEEDS).toFixed(1).padStart(5)}  low ${(low / SEEDS).toFixed(1).padStart(5)}  deaths ${(deaths / SEEDS).toFixed(1).padStart(5)}  wiped ${dead}/${SEEDS}`);
  console.log(rows[rows.length - 1]);
}
