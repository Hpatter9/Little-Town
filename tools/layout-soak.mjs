// Bundles and runs tools/layout-soak.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/layout-soak.ts'], outfile: 'out/layout-soak.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/layout-soak.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
