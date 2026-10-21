// Builds the phone (web) version into out/web: a self-contained folder to put on any static web host
// (GitHub Pages, Netlify, ...). Run after build.mjs, which makes the strip and panel pages it reuses.
import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
cpSync('out/renderer/himeko', `${OUT}/himeko`, { recursive: true });
cpSync('out/renderer/iso', `${OUT}/iso`, { recursive: true });
cpSync('out/renderer/props', `${OUT}/props`, { recursive: true });
cpSync('out/renderer/scenery', `${OUT}/scenery`, { recursive: true });
cpSync('out/renderer/eventprops', `${OUT}/eventprops`, { recursive: true });
cpSync('out/renderer/scene', `${OUT}/scene`, { recursive: true });
cpSync('out/renderer/fx', `${OUT}/fx`, { recursive: true });
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
// the loading screen, its own small script first in the page's body (mobile/loading.ts), and the pack pieces its logo
// and scene are drawn from, beside it (loading/logo.ts `PIECE_FILES`)
await esbuild.build({ define: { __GAME_VERSION__: JSON.stringify(pkgVersion), __GAME_COMMIT__: JSON.stringify(commit), __GAME_BUILT__: JSON.stringify(built) }, entryPoints: ['src/renderer/mobile/loading.ts'], outfile: `${OUT}/loading.js`, bundle: true, platform: 'browser', format: 'iife', target: 'es2023', logLevel: 'warning' });
mkdirSync(`${OUT}/loading`, { recursive: true });
for (const f of [
  'art/village/house1.png',
  'art/village/house2.png',
  'art/village/house4.png',
  'art/village/palisade04.png',
  'art/village/tent2.png',
  'art/seats/flag.png',
  'art/fields/soil01.png',
  'art/scene/goat.png',
  'art/scene/tent.png',
  'art/scene/firepit.png',
  'art/scene/log.png',
  'art/effects/flame.png',
  'ui/art/gui0.png',
  'ui/art/wood.png',
  'ui/art/stone.png',
])
  copyFileSync(`src/renderer/${f}`, `${OUT}/loading/${path.basename(f)}`);
// the page's first script, which starts the worker before the page's own script has loaded (mobile/boot.ts)
await esbuild.build({ entryPoints: ['src/renderer/mobile/boot.ts'], outfile: `${OUT}/boot.js`, bundle: true, platform: 'browser', format: 'iife', target: 'es2023', logLevel: 'warning' });
// the game itself, in a worker of its own (mobileBridge.ts starts it), so the sim never holds up drawing or a tap
await esbuild.build({
  entryPoints: ['src/renderer/mobile/simWorker.ts'],
  outfile: `${OUT}/simWorker.js`,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2023',
  loader: { '.png': 'dataurl' },
  logLevel: 'warning',
});
copyFileSync('src/renderer/mobile/index.html', `${OUT}/index.html`);
// (the home-screen icon: the logo's square mark, made by tools/compose-logo.cjs; the painted one until it has been)
for (const [size, scale] of [
  [192, 12],
  [512, 32],
]) {
  const mark = `src/renderer/mobile/art/icon-${size}.png`;
  if (existsSync(mark)) copyFileSync(mark, `${OUT}/icon-${size}.png`);
  else writeFileSync(`${OUT}/icon-${size}.png`, trayIconPng(scale));
}
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

// the offline caches (sw.js): the shell (pages, scripts, manifest: renamed every build) and the art (kept between
// builds, one entry per file and short content hash, so an update fetches only the pictures that changed)
const SHELL = /\.(html|js|webmanifest|json)$|^icon-|^\.nojekyll$/;
// (the fights' backdrops, the townsfolk's layers and the isometric kits are many and big: the service worker fetches
// them in the background after install, not before the first play)
const LATER = /^(backdrops|himeko|iso)\//;
const shell = [];
const art = {};
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = path.relative(OUT, p).replaceAll('\\', '/');
      if (rel === 'sw.js' || rel === 'art-manifest.json') continue;
      if (SHELL.test(rel)) shell.push(rel);
      else {
        const bytes = readFileSync(p);
        art[rel] = [createHash('md5').update(bytes).digest('hex').slice(0, 10), bytes.length, LATER.test(rel) ? 1 : 0];
      }
    }
  }
};
walk(OUT);
const version = `${pkg.version}-${Date.now().toString(36)}`;
writeFileSync(`${OUT}/art-manifest.json`, JSON.stringify({ version, art }));
const sw = readFileSync('src/renderer/mobile/sw.js', 'utf8')
  .replace('__VERSION__', `littletown-shell-${version}`)
  .replace('__FILES__', JSON.stringify(['./', ...shell, 'art-manifest.json']));
writeFileSync(`${OUT}/sw.js`, sw);
// (GitHub Pages would otherwise skip files and folders starting with _)
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`built ${OUT}/ (${shell.length} shell files, ${Object.keys(art).length} art files)`);
