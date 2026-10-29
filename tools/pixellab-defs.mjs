// Bundles and runs tools/pixellab-defs.ts (see there): the buildings waiting for PixelLab art, out/pixellab-defs.json.
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
await esbuild.build({ entryPoints: ['tools/pixellab-defs.ts'], outfile: 'out/pixellab-defs.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
process.exit(spawnSync(process.execPath, ['out/pixellab-defs.cjs', ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
