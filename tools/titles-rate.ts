// How often titles land in a long town: plays the late-town fixture for some days and counts the titles won.
// Run: node tools/titles-rate.mjs [days]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
if (!r.ok) throw new Error('the fixture would not load');
const s = r.save.state;
const days = Number(process.argv[2] ?? 10);
const before = new Map(s.people.map((p) => [p.id, new Set(p.titles ?? [])]));
const had = s.people.reduce((n, p) => n + (p.titles?.length ?? 0), 0);
const sim = new Sim(s);
for (let i = 0; i < days * TICKS_PER_DAY; i++) sim.step();
const won: Record<string, number> = {};
let total = 0;
for (const p of s.people) for (const t of p.titles ?? []) if (!before.get(p.id)?.has(t)) { won[t] = (won[t] ?? 0) + 1; total++; }
console.log(`${s.people.length} people, titles at the start ${had}, ${days} days played: ${total} new titles (${(total / days).toFixed(2)} a day), ${Object.keys(won).length} kinds`);
console.log(JSON.stringify(won));
