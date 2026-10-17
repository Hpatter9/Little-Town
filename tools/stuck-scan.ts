// Forces shinobi and rat raids, one after another, and checks that nothing foe-like is left on the town map after each.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Rng } from '../src/shared/rng';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { parseSave } from '../src/shared/sim/save';
import { campXY, newGame, type GameState } from '../src/shared/sim/state';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { CELL } from '../src/shared/sim/land';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

for (const origin of process.argv.slice(2).length ? process.argv.slice(2) : ['settlers', 'fixture']) {
  let s: GameState;
  if (origin === 'fixture') {
    const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
    if (!r.ok) throw new Error('no fixture');
    s = r.save.state;
  } else s = newGame('stuck1', { origin: origin as never });
  const sim = new Sim(s);
  for (let n = 0; n < 6; n++) {
    for (const id of ['shinobi', 'rats']) {
      let guard = 0;
      while (s.raid && guard++ < 400 * TICKS_PER_HOUR) sim.step();
      const t0 = s.tick;
      startRaid(s, RAID_KIND_BY_ID[id], 60, new Rng(s.tick + n));
      let ticks = 0;
      while (s.raid && ticks++ < 60 * TICKS_PER_HOUR) sim.step();
      const hrs = ((s.tick - t0) / TICKS_PER_HOUR).toFixed(1);
      for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) sim.step();
      console.log(origin, n, id, 'took h', hrs, s.raid ? 'RAID STILL ON' : 'over', 'roamers', (s.roamers ?? []).length, 'ended', !!s.tacticsEnded, 'prisoners', s.prisoners.length, 'people', s.people.length);
    }
  }
  const c = campXY(s);
  for (const r of s.roamers ?? []) console.log(' roamer', r.id, r.kind, JSON.stringify(r.group), 'dist cells', (Math.hypot(r.x - c.x, r.y - c.y) / CELL).toFixed(0), 'untilIn h', ((r.until - s.tick) / TICKS_PER_HOUR).toFixed(1), 'fighting', r.fighting, 'chasing', r.chasing, 'flying', r.flying);
}
