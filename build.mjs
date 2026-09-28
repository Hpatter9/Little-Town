// Bundles main, preload and renderers into out/. Type checking is separate (npm run typecheck).
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const common = { bundle: true, sourcemap: true, logLevel: 'warning', target: 'es2023' };
// koffi loads a native binary at runtime, so it stays in node_modules instead of the bundle.
const node = { ...common, platform: 'node', format: 'cjs', external: ['electron', 'koffi'] };
// Small sprite sheets are inlined as data URLs, like the LPC layers.
const browser = { ...common, platform: 'browser', format: 'iife', loader: { '.png': 'dataurl' } };

mkdirSync('out/renderer', { recursive: true });

await Promise.all([
  esbuild.build({ ...node, entryPoints: ['src/main/main.ts'], outfile: 'out/main.js' }),
  esbuild.build({ ...node, entryPoints: ['src/main/preload.ts'], outfile: 'out/preload.js' }),
  esbuild.build({ ...browser, entryPoints: ['src/renderer/main.ts'], outfile: 'out/renderer/renderer.js' }),
  esbuild.build({ ...browser, entryPoints: ['src/renderer/panel/panel.ts'], outfile: 'out/renderer/panel.js' }),
]);
copyFileSync('src/renderer/index.html', 'out/renderer/index.html');
copyFileSync('src/renderer/panel/panel.html', 'out/renderer/panel.html');
// the world map on the Expedition Board
copyFileSync('assets/World map.jpg', 'out/renderer/world-map.jpg');
// music is streamed from files, not inlined
mkdirSync('out/renderer/music', { recursive: true });
for (const f of ['town.ogg', 'battle.ogg']) copyFileSync(`src/renderer/music/${f}`, `out/renderer/music/${f}`);
console.log('built out/');
