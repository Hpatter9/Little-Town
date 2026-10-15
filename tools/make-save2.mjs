// Bundles and runs tools/make-save2.ts (see there).
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/make-save2.ts'], outfile: 'out/makesave.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/makesave.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
