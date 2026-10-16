// A town run for some days, for judging its layout (docs/notes/town-layout.md): its numbers (people, deaths,
// buildings standing, paved cells, the day the ring wall stood) and its map as text, a letter for each kind of place.
// Run: node tools/layout-soak.mjs <origin|fixture> <seed> <days> [--map] [--save=out/dir]  (saves at day 10 and the end)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { campCell, newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { footprint } from '../src/shared/sim/buildings';
import { groundAt, isPlannedRoad, isRoad } from '../src/shared/sim/land';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';

const args = process.argv.slice(2);
const [what = 'settlers', seed = 'soak-a', daysArg = '40'] = args.filter((a) => !a.startsWith('--'));
const map = args.includes('--map');
const saveDir = args.find((a) => a.startsWith('--save='))?.slice(7);
const days = Number(daysArg);
let s: GameState;
if (what === 'fixture') {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('no fixture');
  s = r.save.state;
} else s = newGame(seed, { origin: what as 'settlers' });
const sim = new Sim(s);
const startTick = s.tick;
let ringDay: number | null = null;
const count = (str: string | undefined) => (str ? [...str].filter((c) => c === '#').length : 0);
// (a letter for each kind of place: capital when built, small while a blueprint)
const letter = (id: string): string => {
  const d = BUILDING_BY_ID[id];
  if (!d) return '?';
  if (d.seat) return '@';
  if (id === 'campfire') return '*';
  if (CROPS[id]) return 'F';
  if (HERDS[id]) return 'P';
  if (d.hp && d.width <= 2 && !d.housing) return 'W';
  if (d.defense) return 'D';
  if (d.housing) return 'H';
  if (d.storage) return 'K';
  if (d.floor) return 'V';
  return 'B';
};
function draw(st: GameState, r = 34): string {
  const c = campCell(st);
  const at = new Map<number, string>();
  for (const b of st.buildings) {
    const f = footprint(b);
    const l = letter(b.def);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) at.set(y * 100000 + x, b.status === 'done' ? l : l.toLowerCase());
  }
  const rows: string[] = [];
  for (let y = c.y - r; y <= c.y + r; y++) {
    let line = '';
    for (let x = c.x - r; x <= c.x + r; x++) {
      const b = at.get(y * 100000 + x);
      if (b) line += b;
      else if (isRoad(st.land, x, y)) line += '#';
      else if (isPlannedRoad(st.land, x, y)) line += '+';
      else {
        const g = groundAt(st.land, x, y);
        line += g === 'water' || g === 'shallows' ? '~' : g === 'mountain' ? '^' : g === 'forest' ? ',' : g === 'rock' ? 'o' : g === 'hall' ? '=' : '.';
      }
    }
    rows.push(line);
  }
  return rows.join('\n');
}
const every = Number(args.find((a) => a.startsWith('--every='))?.slice(8) ?? 0);
const kinds = () => {
  const n = { homes: 0, fields: 0, far: 0 };
  const c = campCell(s);
  for (const b of s.buildings) {
    if (BUILDING_BY_ID[b.def]?.housing) n.homes++;
    if (CROPS[b.def]) {
      n.fields++;
      n.far += Math.max(Math.abs(b.tile - c.x), Math.abs(b.row - c.y));
    }
  }
  return `homes ${n.homes} fields ${n.fields} (mean ${n.fields ? Math.round(n.far / n.fields) : 0} out) beds ${s.buildings.reduce((k, b) => k + (b.status === 'done' ? (BUILDING_BY_ID[b.def]?.housing ?? 0) : 0), 0)}`;
};
const report = (d: number) =>
  `day ${String(d).padStart(3)} people ${String(s.people.length).padStart(3)} dead ${String(s.fallen?.length ?? 0).padStart(3)} buildings ${String(s.buildings.filter((b) => b.status === 'done' && b.ring === undefined).length).padStart(3)} paved ${String(count(s.land.roads)).padStart(4)} planned ${String(count(s.land.plannedRoads)).padStart(4)} ring ${ringDay ?? '-'}${s.ring ? ` (${s.ring.rect.w}x${s.ring.rect.h})` : ''}`;
for (let d = 1; d <= days; d++) {
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    sim.step();
    if (ringDay === null && s.ring?.done) ringDay = Math.round(((s.tick - startTick) / TICKS_PER_DAY) * 10) / 10;
  }
  if (every && d % every === 0) console.log(report(d), kinds());
  if (saveDir && d === 10 && days > 10) shoot(d);
}
// (the saves for pictures are taken at midday: half a day on)
function shoot(d: number) {
  const r = parseSave(serialize(s, Date.now()));
  if (!r.ok) throw new Error('the save would not load');
  const fork = new Sim(r.save.state);
  for (let i = 0; i < TICKS_PER_DAY / 2; i++) fork.step();
  mkdirSync(saveDir!, { recursive: true });
  writeFileSync(`${saveDir}/${what}-${seed}-d${d}.txt`, serialize(fork.state, Date.now()));
}
if (saveDir) shoot(days);
console.log(`${what} ${seed} ${report(days)}`);
if (args.includes('--dead')) for (const f of s.fallen ?? []) console.log(`  died day ${f.day}: ${f.name} ${f.cause}`);
if (map) console.log(draw(s));
if (map && s.layout) console.log('layout', JSON.stringify(s.layout), 'camp', JSON.stringify(campCell(s)));
