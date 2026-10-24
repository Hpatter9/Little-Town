// Bundles and runs tools/roads-map.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/roads-map.ts'], outfile: `out/roads-map-${process.pid}.cjs`, bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, [`out/roads-map-${process.pid}.cjs`, ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
