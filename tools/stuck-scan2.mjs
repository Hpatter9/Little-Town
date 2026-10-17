import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/stuck-scan2.ts'], outfile: 'out/stuck-scan2.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/stuck-scan2.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
