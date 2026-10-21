// Bundles and runs tools/titles-rate.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/titles-rate.ts'], outfile: 'out/titles-rate.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/titles-rate.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
