// The Underdark's soak: towns run with the autopilot for some days, and what the caves gave and took is counted from
// the news (and the Underdark's own tally, where a town keeps one). Run: node tools/under-soak.mjs [days] [seeds] [origin,origin...]
import { SITE_YIELD } from '../src/shared/data/underdark';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { reached } from '../src/shared/sim/underdark';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, depthOf, footprints } from '../src/shared/sim/buildings';
import { spiralSpot } from '../src/shared/sim/land';
import { campCell } from '../src/shared/sim/state';

/** MINE=<day>: a town with no way down by then is given a mine (the knights and settlers seldom build one in 40 days). */
const MINE_DAY = process.env.MINE ? Number(process.env.MINE) : -1;
const WAYS = ['deep_shaft', 'mine', 'coal_mine', 'deep_mine', 'hold_hallway'];
function giveMine(s: GameState): void {
  if (s.buildings.some((b) => WAYS.includes(b.def))) return;
  const def = BUILDING_BY_ID.mine;
  const spot = spiralSpot(s.land, def.width, depthOf(def), footprints(s), campCell(s));
  if (!spot || !canPlace(s, def, spot.x, spot.y).ok) return;
  s.buildings.push({ id: s.nextId++, def: 'mine', tile: spot.x, row: spot.y, status: 'done', delivered: {}, progress: 1, store: {} } as never);
}
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

const args = process.argv.slice(2);
const DAYS = Number(args[0] ?? 40);
const SEEDS = Number(args[1] ?? 3);
const origins = (args[2] ?? 'dwarves,knights,settlers').split(',');
const CAVE_DEATH = /cave-in|dark below|underground river|in the Underdark|below the town|deep roads|sunless|magma deep|dragged/i;
const pats: Record<string, RegExp> = {
  trades: /comes up the shaft with|traders? from .* (?:come|came) up/i,
  raidsUp: /come up out of the shaft|pour out of the shaft|up out of the Underdark/i,
  caveIns: /roof comes down|rock comes down/i,
  taken: /taken by something|dragged off/i,
  floods: /floods the shaft|river breaks into/i,
  finds: /^Scouts below (?:find|come on)/,
};
for (const o of origins) {
  const tot: Record<string, number> = {};
  for (let k = 0; k < SEEDS; k++) {
    let s: GameState;
    if (o === 'fixture') {
      // (the late fixture, its seed varied; MINE counts from the start of the run)
      const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
      if (!r.ok) throw new Error('fixture');
      s = r.save.state;
      s.seed = `${s.seed}:${k}`;
    } else s = newGame(`usoak${k}`, { origin: o as never });
    const t0 = s.tick;
    const sim = new Sim(s);
    const fell0 = (s.fallen ?? []).length;
    const c: Record<string, number> = { trades: 0, raidsUp: 0, caveIns: 0, taken: 0, floods: 0, finds: 0, goodsEst: 0 };
    let last = s.nextId;
    let through = -1;
    for (let t = 0; t < DAYS * TICKS_PER_DAY; t++) {
      const since = s.tick - t0;
      sim.step();
      if (s.gameOver?.won) s.gameOver = null;
      if (MINE_DAY >= 0 && since === MINE_DAY * TICKS_PER_DAY) giveMine(s);
      if (s.tick % TICKS_PER_HOUR !== 1) continue;
      for (const n of s.notices) if (n.id >= last) for (const [key, re] of Object.entries(pats)) if (re.test(n.text)) c[key]++;
      last = s.nextId;
      const u = s.underdark;
      if (u?.through !== undefined && through < 0) through = Math.floor(u.through / TICKS_PER_DAY) + 1;
      if (u && calendar(s.tick).hour === 6 && !u.tally) {
        const r = reached(u);
        for (const x of u.sites) if (u.found.includes(x.id) && r[x.at]) for (const n of Object.values(SITE_YIELD[x.kind] ?? {})) c.goodsEst += n ?? 0;
      }
      if (s.gameOver) break;
    }
    const fallen = (s.fallen ?? []).slice(fell0);
    const cave = fallen.filter((f) => CAVE_DEATH.test(f.cause)).length;
    const u = s.underdark;
    const row = { people: s.people.length, deaths: fallen.length, caveDeaths: cave, through, found: u?.found.length ?? 0, dug: u?.dug ?? 0, ...c, ...Object.fromEntries(Object.entries(u?.tally ?? {}).map(([k, n]) => [`u.${k}`, n])), village: u?.village !== undefined ? 1 : 0, depth: u?.depth ?? 0, ways: s.buildings.filter((b) => ['deep_shaft', 'mine', 'coal_mine', 'deep_mine', 'hold_hallway'].includes(b.def)).length, slain: (u?.deeps ?? []).filter((d) => d?.slain !== undefined).length } as Record<string, number>;
    console.log(`  ${o} seed ${k}: ${Object.entries(row).map(([a, b]) => `${a} ${Math.round(b)}`).join('  ')}${s.gameOver ? `  (ended: ${s.gameOver.text.slice(0, 60)})` : ''}`);
    for (const [a, b] of Object.entries(row)) tot[a] = (tot[a] ?? 0) + b;
  }
  console.log(`${o.padEnd(9)} avg: ${Object.entries(tot).map(([a, b]) => `${a} ${(b / SEEDS).toFixed(1)}`).join('  ')}`);
}
