// Bundles and runs tools/under-saves.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/under-saves.ts'], outfile: 'out/under-saves.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/under-saves.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
