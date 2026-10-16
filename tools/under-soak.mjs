// Bundles and runs tools/under-soak.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/under-soak.ts'], outfile: 'out/under-soak.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/under-soak.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
