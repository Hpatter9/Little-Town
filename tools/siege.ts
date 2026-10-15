// The Great Enemy's last siege on a saved town (tools/arc.ts with ARC_SAVE=<file> writes one as the Enemy marches): the
// siege forced on it, then logged every half hour: its host left, its Enemy's health, the raid's clock, the board, the town.
// Run: node tools/siege.mjs <save.gz> [days]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { forceEnemy } from '../src/shared/sim/greatEnemy';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const r = parseSave(gunzipSync(readFileSync(process.argv[2])).toString('utf8'));
if (!r.ok) throw new Error('no save');
const s = r.save.state;
s.autopilot = true;
forceEnemy(s, 'siege');
const sim = new Sim(s);
const start = s.tick;
console.log(`${s.people.length} people, enemy ${s.greatEnemy?.kind}, sieges lost ${s.greatEnemy?.lost}`);
for (let i = 0; i < Number(process.argv[3] ?? 3) * TICKS_PER_DAY; i++) {
  sim.step();
  const q = s.raid;
  if (q?.enemy === 'siege' && s.tick % 300 === 0) {
    const foes = q.raiders.filter((x) => !x.ally);
    const boss = foes.slice().sort((a, b) => b.maxHp - a.maxHp)[0];
    const tt = q.tactics;
    console.log(`  +${((s.tick - start) / 600).toFixed(1)}h ${q.phase}: host ${foes.filter((x) => !x.down && !x.gone).length}/${foes.length} (down ${foes.filter((x) => x.down).length}, gone ${foes.filter((x) => x.gone).length}) boss ${boss.kind} ${boss.hp}/${boss.maxHp}${boss.down ? ' DOWN' : boss.gone ? ' GONE' : ''} clock ${((q.leavesTick - s.tick) / 600).toFixed(1)}h board ${tt ? `${tt.phase}/${tt.outcome ?? '-'} turns ${tt.turns} on-field ${tt.units.filter((u) => u.foe).length}+${tt.waiting.length} waiting, through ${tt.through}, pressed ${tt.pressed ?? 0}` : '-'} folk ${s.people.length} downed ${s.people.filter((p) => p.downed).length}`);
  }
  if (!s.raid && s.greatEnemy && s.greatEnemy.siegeAt === undefined && s.tick - start > 1200) { console.log(`over at +${((s.tick - start) / 600).toFixed(1)}h: ${s.greatEnemy.stage}, lost ${s.greatEnemy.lost}, people ${s.people.length}, ${s.gameOver?.text ?? ''}`); break; }
}
