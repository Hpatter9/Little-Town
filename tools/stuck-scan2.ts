// Steps a town for days and reports any foe-like figure in the snapshot that stays put for a game day, by the list it is in.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { Rng } from '../src/shared/rng';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { startRaid } from '../src/shared/sim/raids';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

const days = Number(process.argv[2] ?? 20);
const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
if (!r.ok) throw new Error('no fixture');
const s = r.save.state;
const sim = new Sim(s);
const FOE = /rat|kunoichi|ninja|monk|shinobi/i;
const KINDS = ['shinobi', 'rats', 'shinobi_night', 'prowl_thieves', 'rats'];
const seen = new Map<string, { x: number; y: number; since: number }>();
const out = new Set<string>();
function walk(o: unknown, path: string, depth: number, found: Map<string, { x: number; y: number }>): void {
  if (!o || typeof o !== 'object' || depth > 6) return;
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[]`, depth + 1, found)); return; }
  const rec = o as Record<string, unknown>;
  if (typeof rec.kind === 'string' && FOE.test(rec.kind) && typeof rec.x === 'number' && typeof rec.y === 'number') found.set(`${path}#${rec.id}:${rec.kind}`, { x: rec.x, y: rec.y });
  for (const k of Object.keys(rec)) walk(rec[k], `${path}.${k}`, depth + 1, found);
}
for (let t = 0; t < days * TICKS_PER_DAY; t++) {
  sim.step();
  if (t % (TICKS_PER_DAY / 2) === 0 && !s.raid) startRaid(s, RAID_KIND_BY_ID[KINDS[(t / (TICKS_PER_DAY / 2)) % KINDS.length]], 40, new Rng(s.tick), KINDS[0] === 'x' ? undefined : undefined);
  if (t % TICKS_PER_HOUR) continue;
  const found = new Map<string, { x: number; y: number }>();
  walk(snapshot(s), 'snap', 0, found);
  for (const [k, p] of found) {
    const was = seen.get(k);
    if (!was || was.x !== p.x || was.y !== p.y) seen.set(k, { ...p, since: s.tick });
    else if (s.tick - was.since > TICKS_PER_DAY && !out.has(k)) { out.add(k); console.log('STUCK', k, p, 'for h', (s.tick - was.since) / TICKS_PER_HOUR, 'raid', s.raid?.phase, s.raid?.kind); }
  }
  for (const k of [...seen.keys()]) if (!found.has(k)) seen.delete(k);
}
console.log('done', days, 'days; raids so far', s.raidsSurvived ?? '?');
