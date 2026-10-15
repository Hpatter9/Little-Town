// Bundles and runs tools/probe-hold.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/probe-hold.ts'], outfile: 'out/probe-hold.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/probe-hold.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
