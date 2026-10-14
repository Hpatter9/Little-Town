// Bundles and runs tools/sim-hash.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/sim-hash.ts'], outfile: 'out/sim-hash.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/sim-hash.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
