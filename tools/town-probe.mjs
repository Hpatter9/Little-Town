// Bundles and runs tools/town-probe.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/town-probe.ts'], outfile: 'out/town-probe.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/town-probe.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
