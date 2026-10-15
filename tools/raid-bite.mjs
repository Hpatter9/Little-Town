// Bundles and runs tools/raid-bite.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/raid-bite.ts'], outfile: 'out/raid-bite.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/raid-bite.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
