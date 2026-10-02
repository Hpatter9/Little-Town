// Builds the spell sheets from the Craftpix effect packs in ../chronos-assets (a dev tool, run by hand:
// `node tools/compose-effects.cjs`; it needs Playwright's Chromium). The Pixel Magic Sprite Effects pack's strips
// (72px frames in a row) are copied as they are; the Magic Slash pack's 800x600 frames are cropped to the slash
// (one square around all its frames) and shrunk to 96px, 5 frames to a row. All go to src/renderer/art/effects/.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets/assets');
const OUT = path.join(__dirname, '../src/renderer/art/effects');
const MAGIC = path.join(ASSETS, 'craftpix-net-440623-free-pixel-magic-sprite-effects-pack/1 Magic');
const SLASH = path.join(ASSETS, 'craftpix-net-837255-free-magic-slash-effects-asset-pack');
const SIZE = 96;
const ACROSS = 5;

// [our name, the pack's strip]
const STRIPS = [
  ['mg_ground_fire', '1'], ['mg_ground_fire2', '1_2'], ['mg_sigil', '2'], ['mg_beam', '3'], ['mg_strike', '3_2'],
  ['mg_bolt', '4'], ['mg_bolt2', '4_1'], ['mg_pop', '4_2'], ['mg_sparks', '5'], ['mg_flame', '6'], ['mg_flare', '6_2'],
  ['mg_spikes', '7'], ['mg_creep', '8'], ['mg_puff', '9'], ['mg_shards', '10'],
];
// [our name, the pack's folder]
const SLASHES = [
  ['slash_wind', 'Double Wind Slashes'], ['slash_fire', 'Fire Slash'], ['slash_lightning', 'Lightning Slash'],
  ['slash_poison', 'Poisonous Slashes'], ['slash_gold', 'Ultimate Slash'], ['slash_water', 'Water Slash'],
];

(async () => {
  for (const [id, f] of STRIPS) fs.copyFileSync(path.join(MAGIC, f + '.png'), path.join(OUT, id + '.png'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const counts = {};
  for (const [id, dir] of SLASHES) {
    const d = path.join(SLASH, dir, 'PNG');
    const files = fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort((a, b) => +a.match(/(\d+)\.png$/)[1] - +b.match(/(\d+)\.png$/)[1]);
    const srcs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(d, f)).toString('base64'));
    const url = await page.evaluate(
      async ({ srcs, SIZE, ACROSS }) => {
        const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
        const ims = [];
        for (const s of srcs) ims.push(await load(s));
        const W = ims[0].width, H = ims[0].height;
        // the box round every frame's drawn pixels
        const t = document.createElement('canvas');
        t.width = W; t.height = H;
        const tg = t.getContext('2d', { willReadFrequently: true });
        let x0 = W, y0 = H, x1 = 0, y1 = 0;
        for (const im of ims) {
          tg.clearRect(0, 0, W, H);
          tg.drawImage(im, 0, 0);
          const d = tg.getImageData(0, 0, W, H).data;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 16) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        const side = Math.max(x1 - x0, y1 - y0) + 8;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const c = document.createElement('canvas');
        c.width = SIZE * ACROSS;
        c.height = SIZE * Math.ceil(ims.length / ACROSS);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        ims.forEach((im, i) => g.drawImage(im, cx - side / 2, cy - side / 2, side, side, (i % ACROSS) * SIZE, Math.floor(i / ACROSS) * SIZE, SIZE, SIZE));
        return c.toDataURL('image/png');
      },
      { srcs, SIZE, ACROSS },
    );
    fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    counts[id] = files.length;
    console.log(id, files.length, 'frames');
  }
  console.log(JSON.stringify(counts));
  await browser.close();
})();
