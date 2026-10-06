// Bundles test/*.test.ts and runs them with Node's built-in test runner.
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';

const entries = readdirSync('test').filter((f) => f.endsWith('.test.ts')).map((f) => `test/${f}`);
rmSync('out/test', { recursive: true, force: true });
await esbuild.build({
  entryPoints: entries,
  outdir: 'out/test',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2023',
  logLevel: 'warning',
  // (the renderer's pictures, where a test reaches them: only their names matter)
  loader: { '.png': 'empty' },
});
const files = entries.map((e) => e.replace(/^test\//, 'out/test/').replace(/\.ts$/, '.cjs'));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
