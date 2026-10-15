// The Great Enemy + Calamity arc on a STRONG town: the late fixture with its folk levelled and armed (or, with ORIGIN=x, a
// fresh town of that people), the Enemy forced into its omens and its plan run faster (PLAN_BOOST extra plan a day), then run
// on and every stage logged in order: the Enemy's stages, the Calamity's, the hosts, the siege, who lived.
// Run: node tools/arc.mjs [days] [seeds]   (ARC_WEAK=1: the fixture as it is; ARC_KIND=<enemy kind>)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { forceEnemy } from '../src/shared/sim/greatEnemy';
import type { GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 80);
const seeds = Number(process.argv[3] ?? 1);
const boost = Number(process.env.PLAN_BOOST ?? 0.8);
for (let k = 0; k < seeds; k++) {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  const s: GameState = r.save.state;
  s.seed = `${s.seed}:arc${k}`;
  s.autopilot = true;
  if (!process.env.ARC_WEAK) {
    for (const p of s.people) {
      for (const sk of ['melee', 'ranged'] as const) p.skills[sk].level = Math.max(p.skills[sk].level, 40);
      p.gear.weapon = 'iron_sword';
      p.gear.body = 'chainmail';
      p.priorities.defend = 1;
    }
  }
  const e = forceEnemy(s, 'omens', process.env.ARC_KIND as never);
  const sim = new Sim(s);
  const day = () => Math.floor(s.tick / TICKS_PER_DAY);
  const say = (m: string) => console.log(`  [seed ${k} day ${day()}] ${m}`);
  console.log(`seed ${k}: ${s.people.length} people, enemy ${e.kind}, era ${s.era}`);
  let saved = false, stage = '', cal = -1, raid = '', sieged = 0, lost = 0;
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    if (i % TICKS_PER_DAY === 0 && s.greatEnemy && s.greatEnemy.siegeAt === undefined && s.greatEnemy.stage !== 'peace') s.greatEnemy.plan += boost;
    sim.step();
    const g = s.greatEnemy;
    if (process.env.ARC_SAVE && g?.stage === 'march' && !saved && !s.raid) {
      saved = true; writeFileSync(process.env.ARC_SAVE, gzipSync(serialize(s, 0))); say(`saved the town to ${process.env.ARC_SAVE}`); }
    if (g && g.stage !== stage) { stage = g.stage; say(`enemy stage ${stage} (plan ${g.plan.toFixed(1)}, lost ${g.lost}, siegeAt ${g.siegeAt === undefined ? '-' : ((g.siegeAt - s.tick) / 600).toFixed(1) + 'h'}) people ${s.people.length}`); }
    if (s.calamity && s.calamity.stage !== cal) { cal = s.calamity.stage; say(`calamity stage ${cal} dread ${s.calamity.dread} scar ${s.calamity.scar}`); }
    const rd = s.raid ? `${s.raid.kind}${s.raid.enemy ? ':' + s.raid.enemy : ''}` : '';
    if (rd !== raid && (rd.includes(':') || raid.includes(':'))) say(rd ? `raid starts ${rd} x${s.raid!.raiders.length}` : `raid over (${raid}) people ${s.people.length} enemy lost ${g?.lost} stage ${g?.stage}`);
    raid = rd;
    // (the siege hour by hour: who is left of its host, its Enemy's health, the town's standing and fallen)
    if (s.raid?.enemy === 'siege' && s.tick % 300 === 0) {
      const q = s.raid, boss = q.raiders.find((x) => !x.ally && !x.down && !x.gone && x.maxHp === Math.max(...q.raiders.map((y) => y.maxHp)));
      const left = q.raiders.filter((x) => !x.ally && !x.down && !x.gone).length;
      say(`siege ${q.phase} ${((s.tick - q.arrivesTick) / 600).toFixed(1)}h: host ${left}/${q.raiders.filter((x) => !x.ally).length} boss ${boss ? `${boss.kind} ${boss.hp}/${boss.maxHp}` : 'down'} clock ${((q.leavesTick - s.tick) / 600).toFixed(1)}h tactics ${q.tactics ? `${q.tactics.phase}/${q.tactics.outcome ?? '-'} turns ${q.tactics.turns} through ${q.tactics.through} pressed ${q.tactics.pressed ?? 0}` : '-'} folk ${s.people.length} downed ${s.people.filter((p) => p.downed).length}`);
    }
    if (g && g.lost !== lost) { lost = g.lost; sieged++; }
    if (s.gameOver?.won) s.gameOver = null; // (a won game carries on)
    if (s.gameOver) { say(`GAME OVER: ${s.gameOver.text}`); break; }
    if (g && g.stage === 'peace' && !s.raid) { say(`the Enemy is dead; people ${s.people.length}`); break; }
  }
  console.log(`  end: day ${day()} people ${s.people.length} enemy ${s.greatEnemy?.stage} sieges lost ${lost} calamity ${s.calamity?.stage}`);
}
