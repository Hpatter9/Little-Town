// Saves with the Underdark open, for looking at it in the browser: the late fixture with a deep mine dug through, and
// a dwarves town some days in. Run: node tools/under-saves.mjs <outDir> [dwarfDays] [fixtureDays]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, depthOf, footprints } from '../src/shared/sim/buildings';
import { spiralSpot } from '../src/shared/sim/land';
import { campCell } from '../src/shared/sim/state';
import { depthMap, underDug } from '../src/shared/sim/underdark';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';

const out = process.argv[2] ?? 'out/under-saves';
mkdirSync(out, { recursive: true });
const run = (s: GameState, days: number) => {
  const sim = new Sim(s);
  const calm = () => {
    // (no raid on the screen when the save is opened)
    s.raid = null;
    s.nextRaidTick = s.tick + 2 * TICKS_PER_DAY;
    s.prompts = [];
    s.nextEventTick = s.tick + 2 * TICKS_PER_DAY;
  };
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    sim.step();
    if (s.gameOver) s.gameOver = null;
  }
  calm();
};
// a dwarves town
const d = newGame(process.env.SEED ?? 'look-dwarves', { origin: 'dwarves' });
run(d, Number(process.argv[3] ?? 12));
writeFileSync(`${out}/dwarves.json`, serialize(d, Date.now()));
console.log('dwarves', d.people.length, 'found', d.underdark?.found.length, 'through', d.underdark?.through);
if (process.env.ONLY === 'dwarves') process.exit(0);
// the fixture with a deep mine
const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
if (!r.ok) throw new Error('fixture');
const s = r.save.state;
const def = BUILDING_BY_ID.mine;
const spot = spiralSpot(s.land, def.width, depthOf(def), footprints(s), campCell(s));
if (!spot || !canPlace(s, def, spot.x, spot.y).ok) throw new Error('no room');
const b = { id: s.nextId++, def: 'mine', tile: spot.x, row: spot.y, status: 'done' as const, delivered: {}, progress: 1, store: {} };
s.buildings.push(b);
run(s, 0.05);
for (let i = 0; i < 300 && s.underdark && s.underdark.through === undefined; i++) underDug(s, s.people[1], b);
run(s, Number(process.argv[4] ?? 3));
writeFileSync(`${out}/fixture.json`, serialize(s, Date.now()));
console.log('fixture', s.people.length, 'found', s.underdark?.found.length, 'through', s.underdark?.through);
// the same at night (11 at night)
const night = parseSave(serialize(s, Date.now()));
if (!night.ok) throw new Error('night');
const n = night.save.state;
const sn = new Sim(n);
while (calendar(n.tick).hour !== 23) sn.step();
n.raid = null;
n.prompts = [];
writeFileSync(`${out}/fixture-night.json`, serialize(n, Date.now()));
// and with all three depths open, mostly scouted, the first two dwellers slain (for looking at the depths)
const u = s.underdark!;
u.depth = 3;
u.deeps = [1, 2, 3].map((k) => {
  const m = depthMap(s.seed, k);
  let seen = '';
  // (all but the far side, left dark to show its outline)
  for (let i = 0; i < m.cells.length; i++) seen += Math.abs((i % 48) - (m.arrive % 48)) < 30 ? '1' : '0';
  return { seen, found: m.sites.map((x) => x.id), opened: s.tick, ...(k < 3 ? { slain: s.tick } : {}) };
});
writeFileSync(`${out}/fixture-deep.json`, serialize(s, Date.now()));
console.log('night hour', calendar(n.tick).hour, TICKS_PER_HOUR);
