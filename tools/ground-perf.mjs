// The ground's cost on a big town (docs/notes/ground-blend.md): opens the phone build (out/web: `npm run web` first)
// in the pre-installed Chromium with test/fixtures/late-town.json.gz as its save (paused), drags the camera round the
// town a fixed step a frame at two zooms with the CDP CPU profiler running, and prints the JS time spent in the
// ground's functions and in all named functions, the frames' times, and the view's work in the worst frame (timed in
// the page: `setCamera`, the ground and the land's trees; the idle-time baking apart; and, rougher, from the profile:
// a run of the ticker's samples). Run by hand. (This container has no GPU: the frame times are software rasterising, so compare a before and
// an after build, never read them as a phone's.)
//
//   node tools/ground-perf.mjs               out/web
//   node tools/ground-perf.mjs --web <dir>   another build (an older one, for before and after)
//   --size 393x852                           the phone upright (by default)
//   --throttle 4                             the CPU slowed this many times (CDP), standing in for a phone
//   --frames 60 --step 24                    how many frames the camera is dragged at each zoom, and how far a frame
//                                            (world px: 24 is a steady drag on the phone, about 1,400 px a second)
//   --dpr 1                                  the page's pixel ratio (1 by default: software rasterising is slow)
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
const throttle = Number(arg('--throttle', '1'));
const steps = Number(arg('--frames', '60'));
const step = Number(arg('--step', '24'));
// (the town paused: under a throttled CPU the sim's snapshots would bury the page's frames, and the ground's cost is
// the camera's, not the sim's)
const saved = JSON.parse(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
saved.state.paused = true;
const save = JSON.stringify(saved);
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
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(arg('--dpr', '1')) });
if (process.env.GP_DEBUG) page.on('console', (m) => console.error('page:', m.text().slice(0, 120)));
/** The ground's own functions, old and new, by name in the profile. */
const GROUND = /^(bakeChunk|startBake|bakeRows|bakeFor|bakeNow|showChunk|syncChunks|surfAt|chunkSig|tileOf|ready|fillOut|paintGround|paintCells|putImageData|createImageData)$/;
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
  // (the camera put where the drag starts and left to settle, so the first frame measured isn't a jump across the map;
  // and each frame's view work timed in the page: `setCamera` (the ground, and the land's trees laid), and the
  // ground's baking in idle time apart, where the build has it)
  await strip.evaluate(() => {
    const cam = window.__camera;
    cam.touchedAt = performance.now() + 1e9;
    cam.centreOn({ x: 96 * 32 + 40 * 32, y: 96 * 32 }, window.innerWidth, window.innerHeight);
    const iso = window.__iso;
    const proto = Object.getPrototypeOf(iso);
    const m = (window.__groundCost = { frame: 0, idle: 0, inCam: false });
    iso.setCamera = function (...a) {
      const t = performance.now();
      m.inCam = true;
      try {
        return proto.setCamera.apply(this, a);
      } finally {
        m.inCam = false;
        m.frame += performance.now() - t;
      }
    };
    if (proto.bakeFor)
      iso.bakeFor = function (ms) {
        if (m.inCam) return proto.bakeFor.call(this, ms);
        const t = performance.now();
        try {
          return proto.bakeFor.call(this, ms);
        } finally {
          m.idle += performance.now() - t;
        }
      };
  });
  await page.waitForTimeout(8000);
  const cdp = await page.context().newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  // (the camera dragged round the town in a circle a fixed step a frame, as a finger pans it, the frames' times kept)
  const frames = await strip.evaluate(async ([steps, step]) => {
    const cam = window.__camera;
    cam.touchedAt = performance.now() + 1e9;
    const times = [];
    const views = [];
    const m = window.__groundCost;
    m.idle = 0;
    let last = performance.now();
    const r = 40 * 32;
    await new Promise((done) => {
      let k = 0;
      const tick = (now) => {
        times.push(now - last);
        views.push(m.frame);
        m.frame = 0;
        last = now;
        const a = (k * step) / r;
        cam.centreOn({ x: 96 * 32 + Math.cos(a) * r, y: 96 * 32 + Math.sin(a) * r }, window.innerWidth, window.innerHeight);
        if (++k < steps) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { times: times.slice(1), views: views.slice(2), idle: m.idle };
  }, [steps, step]);
  const views = frames.views.sort((a, b) => a - b);
  const worstView = views[views.length - 1] ?? 0;
  const p95View = views[Math.floor(views.length * 0.95)] ?? 0;
  const idleBake = frames.idle;
  frames.times.sort((a, b) => a - b);
  const { profile } = await cdp.send('Profiler.stop');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const dt = profile.timeDeltas;
  const self = new Map();
  const idx = new Map(profile.nodes.map((n, i) => [n.id, i]));
  profile.samples.forEach((id, i) => {
    const n = profile.nodes[idx.get(id)];
    const name = n.callFrame.functionName || '(anon)';
    self.set(name, (self.get(name) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  // (each sample in a frame or not: under the ticker's `_tick`; a frame ends at an idle sample or work outside it)
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const inTick = new Map();
  const ticks = (id) => {
    if (inTick.has(id)) return inTick.get(id);
    const n = byId.get(id);
    const v = n.callFrame.functionName === '_tick' || (parent.has(id) && ticks(parent.get(id)));
    inTick.set(id, v);
    return v;
  };
  const frameGround = [];
  let cur = null;
  let idleGround = 0;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const name = n.callFrame.functionName;
    const ms = (dt[i] ?? 0) / 1000;
    if (ticks(id)) {
      if (!cur) frameGround.push((cur = { ground: 0 }));
      if (GROUND.test(name)) cur.ground += ms;
    } else {
      if (name !== '(garbage collector)' && name !== '(program)') cur = null;
      if (GROUND.test(name)) idleGround += ms;
    }
  });
  const worstFrame = Math.max(0, ...frameGround.map((f) => f.ground));
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
  const q = (p) => Math.round(frames.times[Math.floor(frames.times.length * p)] ?? 0);
  results.push({ zoom, throttle, frames: frames.times.length, worstView: Math.round(worstView * 10) / 10, p95View: Math.round(p95View * 10) / 10, idleBake: Math.round(idleBake), worstFrameGroundProfile: Math.round(worstFrame * 10) / 10, idleGroundProfile: Math.round(idleGround), median: q(0.5), p95: q(0.95), worst: Math.round(frames.times[frames.times.length - 1] ?? 0), named: Math.round(named), ground: Math.round(ground), parts: top.sort((a, b) => b[1] - a[1]) });
  await cdp.detach();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
