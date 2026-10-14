// Bundles and runs tools/perf-sim.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/perf-sim.ts'], outfile: 'out/perf-sim.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/perf-sim.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
