// The ground's cost on a big town (docs/notes/ground-blend.md): opens the phone build (out/web: `npm run web` first)
// in the pre-installed Chromium with test/fixtures/late-town.json.gz as its save, pans the camera across the town for
// a spell at two zooms with the CDP CPU profiler running, and prints the JS time spent in the ground's functions and
// in all named functions, and the frames' times. Run by hand. (This container has no GPU: the frame times are software
// rasterising, so compare a before and an after build, never read them as a phone's.)
//
//   node tools/ground-perf.mjs               out/web
//   node tools/ground-perf.mjs --web <dir>   another build (an older one, for before and after)
//   --size 393x852                           the phone upright (by default)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const arg = (flag, or) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : or;
};
const web = arg('--web', 'out/web');
const [vw, vh] = arg('--size', '393x852').split('x').map(Number);
const save = gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8');
if (!existsSync(`${web}/index.html`)) throw new Error('build the phone version first: npm run web');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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
/** The ground's own functions, old and new, by name in the profile. */
const GROUND = /^(bakeChunk|syncChunks|surfAt|chunkSig|tileOf|ready|fillOut|paintGround|paintCells|putImageData|createImageData)$/;
const results = [];
for (const zoom of ['0.5', '0.25']) {
  await page.addInitScript(([save, zoom]) => {
    localStorage.clear();
    localStorage.setItem('littletown.save', save);
    localStorage.setItem('littletown.zoom4', zoom);
    localStorage.setItem('littletown.zoom4.side', zoom);
  }, [save, zoom]);
  await page.goto(`http://localhost:${port}/`);
  let strip = null;
  for (let i = 0; i < 120 && !strip; i++) {
    strip = page.frames().find((f) => f.url().includes('strip.html')) ?? null;
    if (!strip) await page.waitForTimeout(500);
  }
  await strip.waitForFunction(() => !!window.__iso && window.__iso.width > 0 && !!window.__camera, null, { timeout: 120000 });
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
  await page.waitForTimeout(8000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  // (the camera swept round the town in a slow circle for 15 s, the frames' times kept)
  const frames = await strip.evaluate(async () => {
    const cam = window.__camera;
    cam.touchedAt = performance.now() + 1e9;
    const times = [];
    const t0 = performance.now();
    let last = t0;
    await new Promise((done) => {
      const step = (now) => {
        times.push(now - last);
        last = now;
        const a = ((now - t0) / 15000) * Math.PI * 2;
        cam.centreOn({ x: (96 + Math.cos(a) * 40) * 32, y: (96 + Math.sin(a) * 40) * 32 }, window.innerWidth, window.innerHeight);
        if (now - t0 < 15000) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return times;
  });
  const { profile } = await cdp.send('Profiler.stop');
  const dt = profile.timeDeltas;
  const self = new Map();
  const idx = new Map(profile.nodes.map((n, i) => [n.id, i]));
  profile.samples.forEach((id, i) => {
    const n = profile.nodes[idx.get(id)];
    const name = n.callFrame.functionName || '(anon)';
    self.set(name, (self.get(name) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  let named = 0;
  let ground = 0;
  const top = [];
  for (const [name, ms] of self) {
    if (name === '(program)' || name === '(idle)' || name === '(garbage collector)') continue;
    named += ms;
    if (GROUND.test(name)) {
      ground += ms;
      top.push([name, Math.round(ms)]);
    }
  }
  frames.sort((a, b) => a - b);
  const q = (p) => Math.round(frames[Math.floor(frames.length * p)] ?? 0);
  results.push({ zoom, frames: frames.length, median: q(0.5), p95: q(0.95), worst: Math.round(frames[frames.length - 1] ?? 0), named: Math.round(named), ground: Math.round(ground), parts: top.sort((a, b) => b[1] - a[1]) });
  await cdp.detach();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
