// Bundles and runs tools/probe-hills.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/probe-hills.ts'], outfile: 'out/relief-map.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/relief-map.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
