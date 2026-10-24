// Writes a dwarves town, run for some days, as a phone save (for previews). Run: node tools/make-save.mjs out.txt [days]
// (SEED=, ORIGIN=settlers, BIOME=highlands: another town; RELIEF=0 a level land; VALLEY=River_Valley a starting valley
// drawn by hand, sim/startValleys.ts; SCENARIO=band; EXPLORE=24 the land that far round the camp seen;
// HOME_DEF=longhouse a home built at the start with everyone's bed in it; VENUES=1 a Fireside Inn and a Trading Post
// built at the start, to see their own windows); BUILD=statue,harbour,... those built, finished, after the run (to see
// their pictures: put up after, so the town can't pull them down); UNLOCK=1 every building in the build menu;
// KIDS=4 that many children added after the run, each beside a grown-up, to see children beside grown-ups; FOLK=20 that
// many more grown townsfolk added after the run, each a fresh look (skin, hair) gathered round the first, to see a crowd;
// CREATURE=wolf the town given its God creature after the run (to see it fight in a raid)
import { writeFileSync } from 'node:fs';
import { serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { campCell, newGame } from '../src/shared/sim/state';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { spiralSpot } from '../src/shared/sim/land';
import { depthOf, footprints } from '../src/shared/sim/buildings';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { randomLook } from '../src/shared/data/people';
import { hashSeed, Rng } from '../src/shared/rng';
import { adoptCreature } from '../src/shared/sim/creature';
const env = process.env;
const sim = new Sim(newGame(env.SEED ?? 'shot', { origin: (env.ORIGIN ?? 'dwarves') as never, relief: env.RELIEF !== '0', ...(env.BIOME ? { biome: env.BIOME as never } : {}), ...(env.VALLEY ? { valley: env.VALLEY } : {}), ...(env.SCENARIO ? { scenario: env.SCENARIO } : {}) }));
// (HOME=longhouse: one built at the start, everyone's bed in it, to see them inside it)
if (env.HOME_DEF) {
  const st = sim.state;
  const d = BUILDING_BY_ID[env.HOME_DEF];
  const r = spiralSpot(st.land, d.width, depthOf(d), footprints(st), campCell(st));
  if (r) {
    const id = st.nextId++;
    st.buildings.push({ id, def: d.id, tile: r.x, row: r.y, status: 'done', delivered: {}, progress: 1, store: {} });
    for (const p of st.people) p.bed = id;
  }
}
if (env.VENUES) {
  const st = sim.state;
  // (the studies they need, or the town pulls them down)
  for (const r of ['barter', 'hospitality']) if (!st.research.done.includes(r)) st.research.done.push(r);
  for (const id of ['fireside_inn', 'trading_post']) {
    const d = BUILDING_BY_ID[id];
    const r = spiralSpot(st.land, d.width, depthOf(d), footprints(st), campCell(st));
    if (r) st.buildings.push({ id: st.nextId++, def: d.id, tile: r.x, row: r.y, status: 'done', delivered: {}, progress: 1, store: {} });
  }
}
for (let t = 0; t < Number(process.argv[3] ?? 6) * TICKS_PER_DAY; t++) sim.step();
if (env.UNLOCK) sim.state.cheats.unlockAll = true;
if (env.BUILD) {
  const st = sim.state;
  for (const id of env.BUILD.split(',')) {
    const d = BUILDING_BY_ID[id];
    const r = d && spiralSpot(st.land, d.width, depthOf(d), footprints(st), campCell(st), { maxR: 40, wild: true });
    if (!r) console.log(`no room for ${id}`);
    else st.buildings.push({ id: st.nextId++, def: d.id, tile: r.x, row: r.y, status: 'done', delivered: {}, progress: 1, store: {} });
  }
}
if (env.FOLK) {
  const st = sim.state;
  const rng = new Rng(hashSeed(`${st.seed}:make-save-folk`));
  const a = st.people.find((p) => p.bornTick == null) ?? st.people[0];
  for (let i = 0; i < Number(env.FOLK); i++) {
    const p = { ...structuredClone(a), id: st.nextId++, name: `Villager ${i + 1}`, partner: null, task: null, gear: {}, carrying: {}, look: randomLook(rng) };
    p.x = a.x + 14 * ((i % 6) - 2.5);
    p.y = a.y + 14 * (Math.floor(i / 6) - 1.5);
    st.people.push(p);
  }
}
if (env.KIDS) {
  const st = sim.state;
  const grown = st.people.filter((p) => p.bornTick == null);
  for (let i = 0; i < Number(env.KIDS); i++) {
    const a = grown[i % grown.length];
    const kid = { ...structuredClone(a), id: st.nextId++, name: `${a.name.split(' ')[0]}'s child ${i + 1}`, type: 'child', bornTick: st.tick, parents: [a.id], partner: null, task: null, gear: {}, carrying: {} };
    kid.look = { ...kid.look, gender: i % 2 ? 'f' : 'm', beard: false };
    kid.x = a.x + 14 * (i % 2 ? 1 : -1);
    st.people.push(kid);
  }
}
if (env.CREATURE) {
  // (the autopilot off while it comes: no naming question waits on the save's first minute)
  const on = sim.state.autopilot;
  sim.state.autopilot = false;
  adoptCreature(sim.state, env.CREATURE as never);
  sim.state.autopilot = on;
}
// (EXPLORE=24: the land that far round the camp already seen, for previews of the land about the town)
if (env.EXPLORE && sim.state.explored) {
  const st = sim.state;
  const { w, h, camp } = st.land;
  const seen = st.explored![camp.y * w + camp.x];
  const r = Number(env.EXPLORE);
  const cells = st.explored!.split('');
  for (let y = Math.max(0, camp.y - r); y <= Math.min(h - 1, camp.y + r); y++) for (let x = Math.max(0, camp.x - r); x <= Math.min(w - 1, camp.x + r); x++) if (Math.hypot(x - camp.x, y - camp.y) <= r) cells[y * w + x] = seen;
  st.explored = cells.join('');
}
writeFileSync(process.argv[2], serialize(sim.state, Date.now()));
