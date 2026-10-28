// Bundles and runs tools/grid-audit.ts (see there): the grid audit's table, docs/notes/grid-audit/measurements.md.
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/grid-audit.ts'], outfile: 'out/grid-audit.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/grid-audit.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
