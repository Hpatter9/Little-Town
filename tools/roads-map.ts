// A town run for some days, for judging its streets (docs/notes/town-roads.md): at each day asked, a picture of the
// land round it, a cell a few pixels (streets laid dark, planned light, buildings by kind, fields, water, rock, woods)
// and the street audit (test/roadAudit.ts); with --save, the game saved there too, for screenshots.
// The town orders its own buildings (`townBuilds`, standing in for the player's orders).
// Run: node tools/roads-map.mjs <origin> <seed> <day,day,...> [--out=dir] [--save] [--biome=id]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { campCell, newGame, type GameState } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY } from '../src/shared/sim/time';
import { doorCell, footprint } from '../src/shared/sim/buildings';
import { pathGround, refusalOn } from '../src/shared/sim/pathPlans';
import { doorOnStreet, doorReached, network, roadToDoor, route, wantsStreet } from '../src/shared/sim/townRoads';
import { groundAt, isPlannedRoad, isRoad } from '../src/shared/sim/land';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';
import { auditRoads } from '../test/roadAudit';

const args = process.argv.slice(2);
const [origin = 'settlers', seed = 'roads-a', daysArg = '10,20,40'] = args.filter((a) => !a.startsWith('--'));
const out = args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'out/roads';
const biome = args.find((a) => a.startsWith('--biome='))?.slice(8);
const save = args.includes('--save');
const days = daysArg.split(',').map(Number);
const s: GameState = newGame(seed, { origin: origin as 'settlers', ...(biome ? { biome } : {}) } as never);
s.townBuilds = true;
const sim = new Sim(s);
mkdirSync(out, { recursive: true });

const R = Number(args.find((a) => a.startsWith("--r="))?.slice(4) ?? 30), PX = 10;
type RGB = [number, number, number];
const colourOf = (st: GameState, x: number, y: number, at: Map<number, RGB>): RGB => {
  const b = at.get(y * 100000 + x);
  if (b) return b;
  if (isRoad(st.land, x, y)) return [92, 64, 40];
  if (isPlannedRoad(st.land, x, y)) return [214, 178, 110];
  const g = groundAt(st.land, x, y);
  if (g === 'water' || g === 'shallows' || g === 'deep') return [60, 110, 190];
  if (g === 'mountain') return [110, 110, 115];
  if (g === 'forest') return [40, 95, 50];
  if (g === 'rock') return [150, 150, 140];
  if (g === 'hall') return [70, 60, 60];
  if (g === 'sand') return [220, 205, 150];
  if (g === 'fertile') return [120, 160, 80];
  return [150, 190, 110];
};
function kindColour(id: string, done: boolean): RGB {
  const d = BUILDING_BY_ID[id];
  let c: RGB = [200, 80, 60];
  if (!d) c = [255, 0, 255];
  else if (d.seat) c = [240, 200, 40];
  else if (CROPS[id]) c = [200, 170, 60];
  else if (HERDS[id]) c = [190, 140, 100];
  else if (d.hp && d.width <= 2 && !d.housing) c = [60, 60, 60];
  else if (d.housing) c = [190, 60, 60];
  else if (d.storage) c = [120, 70, 150];
  return done ? c : (c.map((v) => Math.round(v * 0.5 + 127)) as RGB);
}
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b: Buffer) => {
    let c = -1;
    for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function picture(st: GameState, file: string) {
  const c = st.layout ? { x: st.layout.col, y: st.layout.row } : campCell(st);
  const at = new Map<number, RGB>();
  for (const b of st.buildings) {
    const f = footprint(b);
    const col = kindColour(b.def, b.status === 'done');
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      // (a darker rim, so neighbours read apart)
      const rim = x === f.x || y === f.y || x === f.x + f.w - 1 || y === f.y + f.h - 1;
      at.set(y * 100000 + x, rim && f.w > 1 ? (col.map((v) => Math.round(v * 0.75)) as RGB) : col);
    }
  }
  const n = 2 * R + 1, W = n * PX;
  const rgb = new Uint8Array(W * W * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const col = colourOf(st, c.x - R + i, c.y - R + j, at);
      for (let py = 0; py < PX; py++)
        for (let px = 0; px < PX; px++) {
          const o = ((j * PX + py) * W + i * PX + px) * 3;
          const grid = px === 0 || py === 0 ? 0.92 : 1;
          rgb[o] = col[0] * grid;
          rgb[o + 1] = col[1] * grid;
          rgb[o + 2] = col[2] * grid;
        }
    }
  writeFileSync(file, png(W, W, rgb));
}
let day = 0;
for (const d of days) {
  for (; day < d; day++) for (let i = 0; i < TICKS_PER_DAY; i++) sim.step();
  const a = auditRoads(s);
  const name = `${out}/${origin}-${seed}-d${d}`;
  picture(s, `${name}.png`);
  if (save) {
    // (taken at the next midday, no question or raid on the screen, as tools/layout-soak.ts does)
    const r = parseSave(serialize(s, Date.now()));
    if (!r.ok) throw new Error('the save would not load');
    const f = r.save.state;
    f.nextEventTick = f.nextRaidTick = Number.MAX_SAFE_INTEGER;
    const fork = new Sim(f);
    for (let i = 0; i < TICKS_PER_DAY && calendar(f.tick).hour !== 12; i++) fork.step();
    f.prompts = [];
    f.raid = null;
    writeFileSync(`${name}.txt`, serialize(fork.state, Date.now()));
  }
  console.log(`${origin} ${seed} day ${d}: buildings ${s.buildings.filter((b) => b.status === 'done').length} people ${s.people.length} streets ${a.cells} doorless ${a.doorless.length} cut off ${a.cutOff.length} gates off ${a.gatesOff} doubled ${a.doubled} parallel ${a.parallel} on fields ${a.onFields}${[...a.doorless, ...a.cutOff.map((c) => 'cut ' + c), ...a.where].slice(0, 8).join(' ')}`);
}
if (args.includes('--ascii')) {
  const c = s.layout ? { x: s.layout.col, y: s.layout.row } : campCell(s);
  const at = new Map<number, string>();
  for (const b of s.buildings) {
    const f = footprint(b);
    const d = BUILDING_BY_ID[b.def];
    const l = d?.seat ? '@' : CROPS[b.def] ? 'F' : HERDS[b.def] ? 'P' : d?.housing ? 'H' : b.def === 'campfire' ? '*' : d?.hp && d.width <= 2 ? 'W' : 'B';
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) at.set(y * 100000 + x, b.status === 'done' ? l : l.toLowerCase());
  }
  for (let y = c.y - R; y <= c.y + R; y++) {
    let line = `${String(y).padStart(4)} `;
    for (let x = c.x - R; x <= c.x + R; x++) {
      const g = groundAt(s.land, x, y);
      line += at.get(y * 100000 + x) ?? (isRoad(s.land, x, y) ? '#' : isPlannedRoad(s.land, x, y) ? '+' : g === 'water' || g === 'shallows' ? '~' : g === 'mountain' ? '^' : g === 'forest' ? ',' : g === 'rock' ? 'o' : '.');
    }
    console.log(line);
  }
  console.log('layout', JSON.stringify(s.layout), 'x from', c.x - R);
}
if (args.includes('--why')) {
  const g = pathGround(s);
  for (const b of s.buildings) {
    if (b.status !== 'done' || !wantsStreet(s, b)) continue;
    if (doorOnStreet(s, b)) {
      if (doorReached(s, b, network(s))) continue;
      const before = s.land.plannedRoads;
      const ok = roadToDoor(s, b, false, g);
      console.log('cut off', b.def, b.tile, b.row, 'door', doorCell(b), 'roadToDoor', ok, 'planned changed', before !== s.land.plannedRoads);
      continue;
    }
    const d = doorCell(b);
    console.log(b.def, b.tile, b.row, 'door', d, refusalOn(g, d.x, d.y), 'route', JSON.stringify(route(s, [d], network(s), g)));
  }
}
