// Bundles and runs tools/ldtk-maps.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/ldtk-maps.ts'], outfile: 'out/ldtk-maps.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/ldtk-maps.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
