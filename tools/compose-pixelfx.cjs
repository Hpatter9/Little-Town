// Builds the fight effects atlas from the 5000 Pixel Effects pack in ../chronos-assets/pixel-effects (a dev tool, run
// by hand: `node tools/compose-pixelfx.cjs`; it needs Playwright's Chromium). Every element's every family (fire-bolt,
// ice-nova, light-sparkle... 15 elements by 30 families) and the neutral white and gold ones, the normal variant's six
// 32px frames, packed STRIPS_ACROSS strips to a row into src/renderer/art/effects/pixelfx.png, with pixelfx.json
// saying which row each strip is on (loaded by art/effects.ts; picked by data/actFx.ts).
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const PACK = process.env.PIXELFX || path.join(__dirname, '../../chronos-assets/pixel-effects/sprites');
const OUT = path.join(__dirname, '../src/renderer/art/effects');
const SIZE = 32;
const FRAMES = 6;
const STRIPS_ACROSS = 8;

(async () => {
  // the normal variant of each effect: a folder with no variant suffix
  const ids = fs.readdirSync(PACK).filter((d) => !/-(f|s|b|d|fb|fd|sb|sd|x)$/.test(d) && fs.existsSync(path.join(PACK, d, '32'))).sort();
  const strips = [];
  for (const id of ids) {
    const dir = path.join(PACK, id, '32');
    const files = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort();
    if (!files.length) continue;
    strips.push({ id, frames: files.slice(0, FRAMES).map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64')) });
  }
  const rows = Math.ceil(strips.length / STRIPS_ACROSS);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const url = await page.evaluate(
    async ({ strips, SIZE, FRAMES, STRIPS_ACROSS, rows }) => {
      const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
      const c = document.createElement('canvas');
      c.width = SIZE * FRAMES * STRIPS_ACROSS;
      c.height = SIZE * rows;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      for (let n = 0; n < strips.length; n++) {
        const row = Math.floor(n / STRIPS_ACROSS);
        const col = n % STRIPS_ACROSS;
        for (let f = 0; f < strips[n].frames.length; f++) {
          const im = await load(strips[n].frames[f]);
          g.drawImage(im, col * SIZE * FRAMES + f * SIZE, row * SIZE, SIZE, SIZE);
        }
      }
      return c.toDataURL('image/png');
    },
    { strips, SIZE, FRAMES, STRIPS_ACROSS, rows },
  );
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'pixelfx.png'), Buffer.from(url.split(',')[1], 'base64'));
  const index = {};
  strips.forEach((s, n) => (index[s.id] = [n % STRIPS_ACROSS, Math.floor(n / STRIPS_ACROSS), s.frames.length]));
  fs.writeFileSync(path.join(OUT, 'pixelfx.json'), JSON.stringify({ size: SIZE, frames: FRAMES, across: STRIPS_ACROSS, strips: index }));
  console.log(`${strips.length} strips, ${rows} rows -> pixelfx.png`);
})();
