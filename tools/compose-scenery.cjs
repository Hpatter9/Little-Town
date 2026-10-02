// Builds the town's scenery atlas from Craftpix's side-on tree, bush, rock and cloud packs in ../chronos-assets (a dev tool,
// run by hand: `node tools/compose-scenery.cjs`; it needs Playwright's Chromium). Each object is cut to what's drawn and
// kept pixel for pixel: the town draws it at half size, one source pixel to a fine-grid pixel (art/pixelArt.ts FINE),
// so it sits on the same grid as the painted art. Packed into src/renderer/art/scenery/scenery.png (copied beside the
// page by the builds) with its frames, by set, in art/scenery.json, read by art/scenery.ts.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets/assets');
const OUT = path.join(__dirname, '../src/renderer/art/scenery');
const ATLAS_W = 2048;

const dirOf = (frag) => {
  const d = fs.readdirSync(ASSETS).find((x) => x.includes(frag));
  if (!d) throw new Error('no pack ' + frag);
  return path.join(ASSETS, d);
};
const TREES = path.join(dirOf('free-tree-pixel-art'), 'PNG');
const BUSH = path.join(dirOf('free-bush-assets'), 'PNG');
const ROCK = path.join(dirOf('free-rocks-pixel-art'), 'PNG');
const CLOUD = path.join(dirOf('free-clouds-pixel-art'), 'PNG/Clouds_white');
const files = (dir, re) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png') && re.test(f))
    .sort()
    .map((f) => path.join(dir, f));
const bushes = (re) => fs.readdirSync(BUSH).filter((d) => re.test(d)).flatMap((d) => files(path.join(BUSH, d), /./));

// Each set: its files, and the trimmed source heights kept (the packs run from saplings and stumps up to big trees).
const SETS = {
  leafy: [[...files(TREES, /^middle_lane_tree\d+\./), ...files(TREES, /^birch_\d+\./)], 150, 290],
  conifer: [files(TREES, /^fir_tree_\d+\./), 150, 290],
  snowTree: [[...files(TREES, /^winter_tree_\d+\./), ...files(TREES, /^winter_conifer_tree_\d+\./)], 150, 290],
  dryTree: [files(TREES, /^jungle_tree_\d+\./), 150, 290],
  bush: [bushes(/^Bushes([1235-9]|10)$/), 30, 62],
  bareBush: [bushes(/^Bushes4$/), 30, 70],
  rock: [[...files(path.join(ROCK, 'middle_lane_rocks1'), /./), ...files(path.join(ROCK, 'middle_lane_rocks2'), /./), ...files(path.join(ROCK, 'cave_rocks'), /./)], 22, 70],
  snowRock: [files(path.join(ROCK, 'snowy_rocks1'), /./), 20, 70],
  // (the puffy and streaky clouds; the swirls and scatters are left out)
  cloud: [[...files(path.join(CLOUD, 'Shape2'), /_[2-4]\./), ...files(path.join(CLOUD, 'Shape3'), /_[2-4]\./), ...files(path.join(CLOUD, 'Shape4'), /_[3-4]\./), ...files(path.join(CLOUD, 'Shape6'), /_[2-3]\./)], 10, 64],
  dryRock: [[...files(path.join(ROCK, 'desert_rocks'), /./), ...files(path.join(ROCK, 'canyon_rocks'), /./)], 20, 70],
};

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage();
  const input = Object.fromEntries(Object.entries(SETS).map(([k, [list, lo, hi]]) => [k, { lo, hi, urls: list.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')) }]));
  const { atlas, frames, counts } = await page.evaluate(
    async ([input, W]) => {
      const load = async (u) => {
        const im = new Image();
        im.src = u;
        await im.decode();
        return im;
      };
      // trim each to what's drawn
      const cut = (im) => {
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (d[(y * c.width + x) * 4 + 3] > 8) {
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
        return x1 < 0 ? null : { c, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      };
      const items = [];
      const counts = {};
      for (const [set, { lo, hi, urls }] of Object.entries(input)) {
        counts[set] = 0;
        for (const u of urls) {
          const t = cut(await load(u));
          if (!t || t.h < lo || t.h > hi) continue;
          items.push({ set, ...t });
          counts[set]++;
        }
      }
      // shelf packing, tallest first
      items.sort((a, b) => b.h - a.h);
      let x = 0, y = 0, row = 0;
      for (const it of items) {
        if (x + it.w + 1 > W) { x = 0; y += row + 1; row = 0; }
        it.ax = x; it.ay = y;
        x += it.w + 1;
        row = Math.max(row, it.h);
      }
      const out = document.createElement('canvas');
      out.width = W;
      out.height = y + row;
      const g = out.getContext('2d');
      const frames = {};
      for (const it of items) {
        g.drawImage(it.c, it.x, it.y, it.w, it.h, it.ax, it.ay, it.w, it.h);
        (frames[it.set] ??= []).push([it.ax, it.ay, it.w, it.h]);
      }
      return { atlas: out.toDataURL('image/png'), frames, counts };
    },
    [input, ATLAS_W],
  );
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'scenery.png'), Buffer.from(atlas.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, '../src/renderer/art/scenery.json'), JSON.stringify(frames));
  console.log(counts);
  await browser.close();
})();
