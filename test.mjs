// Bundles test/*.test.ts and runs them with Node's built-in test runner, as many processes at once as there are
// cores, the slowest first. A file whose tests took long last time is split: each slow test runs in a process of its
// own (`--test-name-pattern`), and the rest of the file in one more (`--test-skip-pattern`), so a file of three long
// simulations doesn't hold up the end of the run. The times are kept in out/test-times.json (seeded from
// test/times.json, which `npm test -- --save-times` writes; a new or renamed test simply runs with the rest of its file).
//
//   npm test                     every file
//   npm test -- castle ringWall  only the files whose names contain one of these (or test/castle.test.ts)
//   TEST_JOBS=2 npm test         at most two processes at once
import * as esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import { readdirSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const started = Date.now();
const args = process.argv.slice(2);
const saveSeed = args.includes('--save-times');
const wanted = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/^test\//, '').replace(/\.test\.ts$/, '').replace(/\.ts$/, ''));
const all = readdirSync('test').filter((f) => f.endsWith('.test.ts'));
const names = wanted.length ? all.filter((f) => wanted.some((w) => f.includes(w))) : all;
if (!names.length) {
  console.error(`No test file matches ${wanted.join(', ')}`);
  process.exit(1);
}

const outdir = wanted.length ? 'out/test-some' : 'out/test';
rmSync(outdir, { recursive: true, force: true });
await esbuild.build({
  entryPoints: names.map((f) => `test/${f}`),
  outdir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2023',
  logLevel: 'warning',
  // (the renderer's pictures, where a test reaches them: only their names matter)
  loader: { '.png': 'empty' },
});

// The last run's times: for each file, its whole time and each top-level test's.
const TIMES = 'out/test-times.json';
const SEED = 'test/times.json';
/** @type {Record<string, { ms: number, tests: Record<string, number> }>} */
let times = {};
for (const f of [TIMES, SEED]) {
  if (!existsSync(f)) continue;
  try { times = JSON.parse(readFileSync(f, 'utf8')); break; } catch { /* try the next */ }
}

/** A test this slow runs in a process of its own. */
const SPLIT_MS = 2500;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The jobs: a file, or a test of a file, or the rest of a file.
const jobs = [];
for (const name of names) {
  const t = times[name];
  const slow = t ? Object.entries(t.tests).filter(([, ms]) => ms >= SPLIT_MS) : [];
  if (slow.length && Object.keys(t.tests).length > 1) {
    for (const [test, ms] of slow) jobs.push({ name, est: ms, flags: [`--test-name-pattern=^${escape(test)}$`], part: test });
    const rest = t.ms - slow.reduce((a, [, ms]) => a + ms, 0);
    jobs.push({ name, est: rest, flags: slow.map(([test]) => `--test-skip-pattern=^${escape(test)}$`), part: 'the rest', rest: true });
  } else jobs.push({ name, est: t ? t.ms : 1e9, flags: [] });
}
// slowest first; anything never timed goes first, since it may be slow
jobs.sort((a, b) => b.est - a.est);

const totals = { tests: 0, suites: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
const failed = [];
const fresh = {};

/** Top-level tests in a TAP report, with their times. */
function testsIn(out) {
  const found = {};
  const re = /^(?:not )?ok \d+ - (.*)\n {2}---\n {2}duration_ms: ([\d.]+)\n {2}type: '(\w+)'/gm;
  for (const m of out.matchAll(re)) {
    if (m[3] !== 'test') continue;
    const name = m[1].replace(/ # (SKIP|TODO).*$/, '').replace(/\\#/g, '#').replace(/\\\\/g, '\\');
    found[name] = Math.round(Number(m[2]));
  }
  return found;
}

function run(job) {
  return new Promise((done) => {
    const t0 = Date.now();
    const file = `${outdir}/${job.name.replace(/\.ts$/, '.cjs')}`;
    const child = spawn(process.execPath, ['--test-reporter=tap', ...job.flags, file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => {
      const ms = Date.now() - t0;
      const f = (fresh[job.name] ??= { ms: 0, tests: {} });
      f.ms += ms;
      Object.assign(f.tests, testsIn(out));
      const counts = {};
      for (const k of Object.keys(totals)) {
        const m = out.match(new RegExp(`^# ${k} (\\d+)$`, 'm'));
        counts[k] = m ? Number(m[1]) : 0;
        totals[k] += counts[k];
      }
      // (the rest of a split file may be nothing; a test picked out by name that ran nothing was renamed, and runs
      // with the rest)
      const label = job.part ? `${job.name} (${job.part})` : job.name;
      const bad = code !== 0 || counts.fail > 0 || counts.cancelled > 0 || (counts.tests === 0 && !job.part);
      if (bad) {
        failed.push(label);
        if (counts.fail === 0 && counts.cancelled === 0) totals.fail += 1; // (it died before reporting)
        process.stdout.write(`\n# ---- ${label} FAILED (exit ${code}) ----\n${out}\n`);
      } else {
        process.stdout.write(`ok ${label} · ${counts.pass} passed · ${(ms / 1000).toFixed(1)} s\n`);
      }
      done();
    });
  });
}

const width = Math.max(1, Number(process.env.TEST_JOBS) || availableParallelism());
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => {
  while (queue.length) await run(queue.shift());
}));

// Keep this run's times (only when everything passed, so a broken test's short time doesn't stick).
if (!failed.length) {
  const kept = { ...times };
  for (const [name, f] of Object.entries(fresh)) kept[name] = f;
  for (const name of Object.keys(kept)) if (!all.includes(name)) delete kept[name];
  mkdirSync('out', { recursive: true });
  writeFileSync(TIMES, JSON.stringify(kept, null, 1));
  if (saveSeed) writeFileSync(SEED, JSON.stringify(kept, null, 1) + '\n');
}
const slowest = Object.entries(fresh).sort((a, b) => b[1].ms - a[1].ms).slice(0, 5);
console.log(`\n# slowest files: ${slowest.map(([n, f]) => `${n} ${(f.ms / 1000).toFixed(1)}s`).join(', ')}`);
if (failed.length) console.log(`# failed: ${failed.join(', ')}`);
console.log(`# files ${names.length}`);
for (const [k, v] of Object.entries(totals)) console.log(`# ${k} ${v}`);
console.log(`# duration_ms ${Date.now() - started}`);
process.exit(failed.length ? 1 : 0);
