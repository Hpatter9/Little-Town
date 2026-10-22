// Bundles and runs tools/floor-preview.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/floor-preview.ts'], outfile: 'out/floor-preview.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/floor-preview.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
