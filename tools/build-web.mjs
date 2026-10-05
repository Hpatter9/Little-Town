// Builds the phone (web) version into out/web: a self-contained folder to put on any static web host
// (GitHub Pages, Netlify, ...). Run after build.mjs, which makes the strip and panel pages it reuses.
import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { trayIconPng } from '../src/main/trayIcon.ts';

const OUT = 'out/web';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// the desktop strip and panel pages, as they are (the strip page becomes strip.html)
copyFileSync('out/renderer/index.html', `${OUT}/strip.html`);
for (const f of ['panel.html', 'renderer.js', 'panel.js', 'world-map.jpg', 'lpcFaces.json']) copyFileSync(`out/renderer/${f}`, `${OUT}/${f}`);
cpSync('out/renderer/music', `${OUT}/music`, { recursive: true });
cpSync('out/renderer/packs', `${OUT}/packs`, { recursive: true });
cpSync('out/renderer/backdrops', `${OUT}/backdrops`, { recursive: true });
cpSync('out/renderer/props', `${OUT}/props`, { recursive: true });
cpSync('out/renderer/scenery', `${OUT}/scenery`, { recursive: true });
cpSync('out/renderer/fonts', `${OUT}/fonts`, { recursive: true });

// the version shown in the ☰ menu: the package's number, the commit it was built from and the day (so the owner can
// tell an updated game from an old one in the phone's cache)
const pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // (no git: the number and day alone)
}
const built = new Date().toISOString().slice(0, 10);

// the phone page that holds them
await esbuild.build({
  define: { __GAME_VERSION__: JSON.stringify(pkgVersion), __GAME_COMMIT__: JSON.stringify(commit), __GAME_BUILT__: JSON.stringify(built) },
  entryPoints: ['src/renderer/mobile/mobile.ts'],
  outfile: `${OUT}/mobile.js`,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2023',
  loader: { '.png': 'dataurl' },
  logLevel: 'warning',
});
copyFileSync('src/renderer/mobile/index.html', `${OUT}/index.html`);
writeFileSync(`${OUT}/icon-192.png`, trayIconPng(12));
writeFileSync(`${OUT}/icon-512.png`, trayIconPng(32));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync(
  `${OUT}/manifest.webmanifest`,
  JSON.stringify(
    {
      name: 'Chronos Settlement',
      short_name: 'Chronos', // (the home-screen label: Android cuts longer names short)
      description: pkg.description,
      start_url: './',
      scope: './',
      display: 'standalone', // (fullscreen let Android's navigation bar cover the town)
      orientation: 'any',
      background_color: '#211811',
      theme_color: '#211811',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    null,
    2,
  ),
);

// the offline cache lists every file, and is renamed on every build so phones pick up the new one
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    // (the fights' backdrops are many and big: each is cached when a fight first shows it, see sw.js)
    else if (!path.relative(OUT, p).startsWith('backdrops')) files.push(path.relative(OUT, p).replaceAll('\\', '/'));
  }
};
walk(OUT);
const sw = readFileSync('src/renderer/mobile/sw.js', 'utf8')
  .replace('__VERSION__', `littletown-${pkg.version}-${Date.now().toString(36)}`)
  .replace('__FILES__', JSON.stringify(['./', ...files]));
writeFileSync(`${OUT}/sw.js`, sw);
// (GitHub Pages would otherwise skip files and folders starting with _)
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`built ${OUT}/ (${files.length} files)`);
