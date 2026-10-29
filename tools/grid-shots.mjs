// The grid audit's screenshots (docs/notes/grid-audit.md): builds the gallery town (tools/grid-town.ts), opens the
// phone build (out/web: `npm run web` first) in the pre-installed Chromium with the town as its save and the grid
// overlay on (`littletown.grid`), and shoots each part of the gallery into docs/notes/grid-audit/. Run by hand.
//
//   node tools/grid-shots.mjs            the gallery's shots, with the overlay
//   node tools/grid-shots.mjs --plain    the same without it
//   --scene town     the town as a player might build it (tools/grid-town.ts), not the gallery (or `polish`)
//   --night          its clock at ten at night (the shots named `-night`)
//   --only <names>   only these shots (comma between)
//   --size 393x852   the phone upright (852x393, on its side, by default)
//   --web <dir>      another build of the phone page (an older one, for before and after)
//   --out <dir>      where the shots go (docs/notes/grid-audit by default)
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const plain = process.argv.includes('--plain');
/** The value after a flag, or a default. */
const arg = (flag, or) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : or;
};
const scene = arg('--scene', 'gallery');
const night = process.argv.includes('--night');
const only = arg('--only', '').split(',').filter(Boolean);
const [vw, vh] = arg('--size', '852x393').split('x').map(Number);
const web = arg('--web', 'out/web');
await esbuild.build({ entryPoints: ['tools/grid-town.ts'], outfile: 'out/grid-town.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2023', logLevel: 'warning', loader: { '.png': 'empty' } });
if (spawnSync(process.execPath, ['out/grid-town.cjs', scene, ...(night ? ['night'] : [])], { stdio: 'inherit' }).status) process.exit(1);
const town = JSON.parse(readFileSync('out/grid-town.json', 'utf8'));
if (!existsSync(`${web}/index.html`)) throw new Error('build the phone version first: npm run web');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
  let p = join(web, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
}).listen(0);
const port = server.address().port;

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
await page.addInitScript(([save, grid]) => {
  if (sessionStorage.getItem('gridSeeded')) return;
  sessionStorage.setItem('gridSeeded', '1');
  localStorage.clear();
  localStorage.setItem('littletown.save', save);
  localStorage.setItem('littletown.zoom4.side', '1');
  localStorage.setItem('littletown.zoom4', '1');
  if (grid) localStorage.setItem('littletown.grid', '1'); // (the overlay: iso/isoView.ts)
}, [town.save, !plain]);
await page.goto(`http://localhost:${port}/`);
/** The strip's page (the map's own frame, where `__iso` lives), found again each time the page opens. */
let strip = null;
/** Past the main menu: its Continue, in whichever frame holds it. */
async function pastMenu() {
  for (let i = 0; i < 60; i++) {
    let clicked = false;
    for (const fr of page.frames()) {
      clicked = await fr.evaluate(() => {
        const b = document.querySelector('.mm-item.continue');
        b?.click();
        return !!b;
      }).catch(() => false);
      if (clicked) break;
    }
    if (clicked) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(6000);
}
const out = arg('--out', 'docs/notes/grid-audit');
mkdirSync(out, { recursive: true });
/** Put the camera over a cell, zoomed in, and shoot. */
async function shoot(name, cx, cy) {
  await strip.evaluate(([cx, cy]) => {
    const cam = window.__camera;
    cam.touchedAt = performance.now() + 1e9; // (the camera left where it's put: it follows no one)
    if (window.__fog) window.__fog.sprite.renderable = false; // (no fog of war over the gallery's far end)
    cam.centreOn({ x: (cx + 0.5) * 32, y: (cy + 0.5) * 32 }, window.innerWidth, window.innerHeight); // (world px: the camera puts them on the diamonds)
  }, [cx, cy]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}${plain ? '-plain' : ''}${night ? '-night' : ''}${vw < vh ? '-upright' : ''}.jpg`, type: 'jpeg', quality: 78 });
  console.log(`shot ${name}`);
}
const shots = town.shots;
for (const [zoom, all] of Object.entries(shots)) {
  const list = all.filter(([n]) => !only.length || only.includes(n));
  if (!list.length) continue;
  await page.evaluate((z) => {
    localStorage.setItem('littletown.zoom4.side', z);
    localStorage.setItem('littletown.zoom4', z);
  }, zoom);
  await page.reload();
  strip = null;
  for (let i = 0; i < 120 && !strip; i++) {
    strip = page.frames().find((f) => f.url().includes('strip.html')) ?? null;
    if (!strip) await page.waitForTimeout(500);
  }
  await strip.waitForFunction(() => !!window.__iso && window.__iso.width > 0 && !!window.__camera, null, { timeout: 60000 });
  await pastMenu();
  for (const [n, x, y] of list) await shoot(n, x, y);
}
await browser.close();
server.close();
