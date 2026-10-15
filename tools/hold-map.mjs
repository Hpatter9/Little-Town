// Bundles and runs tools/hold-map.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/hold-map.ts'], outfile: 'out/holdmap.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/holdmap.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
