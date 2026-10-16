// Cuts the cutscenes' props and held things (src/shared/data/sceneProps.ts) out of the packs in ../chronos-assets (a
// dev tool, run by hand: `node tools/compose-scene-props.cjs`; it needs Playwright's Chromium). Each sprite is cut to
// what's drawn (or to the cell given) and scaled so it stands `h` stage px tall when drawn at half size (the files are
// kept at twice the stage's pixel, for the close-ups), into src/renderer/art/scene/<name>.png. Pixel art grown is kept
// sharp; the Medieval Field Work set's big cartoon art is shrunk smooth. Credited in CREDITS.md.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ROOT = process.env.ASSETS_ROOT || path.join(__dirname, '../../chronos-assets');
const OUT = path.join(__dirname, '../src/renderer/art/scene');
const FINE = 2;

const pack = (frag) => {
  const d = fs.readdirSync(path.join(ROOT, 'assets')).find((x) => x.includes(frag));
  if (!d) throw new Error('no pack ' + frag);
  return path.join(ROOT, 'assets', d);
};
const FIELD = (n) => path.join(pack('medieval-field-work'), 'PNG/Environment', `Cartoon_Medieval_Field_Work_Level_Set_Environment - ${n}.png`);
const CAMP = (d, n) => path.join(pack('fields-tileset-pixel-art'), '2 Objects', d, `${n}.png`);
const DAWN = (f) => path.join(ROOT, 'DawnLike', f);
const GOATS = path.join(ROOT, 'whtdragons_MVanimals_ALL_4-1-2025/animals/goats.png');
/** A DawnLike cell (16 px), by column and row. */
const cell = (c, r) => [c * 16, r * 16, 16, 16];

// name: [source, { h: stage px tall (else `k`, the scale), cell: a crop, frames: crops laid side by side }]
const LIST = {
  // the camp (the Fields tileset's camp pieces)
  firepit: [CAMP('8 Camp', 5), { k: 2 }],
  firepit_cold: [CAMP('8 Camp', 6), { k: 2 }],
  tent: [CAMP('8 Camp', 2), { h: 34 }],
  tent_side: [CAMP('8 Camp', 1), { h: 26 }],
  crate: [CAMP('7 Decor', 'Box1'), { k: 2 }],
  stump: [CAMP('7 Decor', 'Tree2'), { h: 12 }],
  log: [CAMP('7 Decor', 'Log3'), { h: 7 }],
  lamp: [CAMP('7 Decor', 'Lamp1'), { h: 30 }],
  signpost: [CAMP('3 Pointer', 4), { h: 28 }],
  scorch: [CAMP('7 Decor', 'Dirt6'), { k: 2 }],
  // the farm (the Medieval Field Work set)
  barrel: [FIELD('Wooden Barrel'), { h: 15 }],
  cart: [FIELD('Cart 01'), { h: 22 }],
  wagon: [FIELD('Cart 02'), { h: 28 }],
  sign: [FIELD('Sign 01'), { h: 22 }],
  table: [FIELD('Table 01'), { h: 12 }],
  rock: [FIELD('Rock 01'), { h: 11 }],
  hay: [FIELD('Hay 01'), { h: 20 }],
  bucket: [FIELD('Bucket'), { h: 9 }],
  // DawnLike's cells
  grave: [DAWN('Objects/Decor0.png'), { cell: cell(0, 17), h: 18 }],
  skull: [DAWN('Objects/Decor0.png'), { cell: cell(0, 12), h: 10 }],
  cauldron: [DAWN('Objects/Decor0.png'), { cell: cell(1, 3), h: 14 }],
  bread: [DAWN('Items/Food.png'), { cell: cell(1, 4), k: 1 }],
  pie: [DAWN('Items/Food.png'), { cell: cell(4, 5), k: 1 }],
  apple: [DAWN('Items/Food.png'), { cell: cell(0, 2), k: 1 }],
  tankard: [DAWN('Items/Food.png'), { cell: cell(4, 4), k: 1 }],
  sword: [DAWN('Items/MedWep.png'), { cell: cell(0, 0), k: 1 }],
  torch: [DAWN('Items/Light.png'), { cell: cell(0, 0), k: 1 }],
  list: [DAWN('Items/Scroll.png'), { cell: cell(3, 5), k: 1 }],
  map: [DAWN('Items/Scroll.png'), { cell: cell(0, 0), k: 1 }],
  pamphlet: [DAWN('Items/Scroll.png'), { cell: cell(2, 0), k: 1 }],
  ladle: [DAWN('Items/Tool.png'), { cell: cell(7, 1), k: 1 }],
  cheese: [DAWN('Items/Food.png'), { cell: cell(0, 5), k: 1 }],
  lantern: [DAWN('Items/Light.png'), { cell: cell(3, 0), k: 1 }],
  axe: [DAWN('Items/MedWep.png'), { cell: cell(0, 1), k: 1 }],
  // Duchess: whtdragon's white goat, walking left (its sheet's second row) then right (the third)
  goat: [GOATS, { frames: [0, 1, 2].map((c) => [c * 48, 48, 48, 48]).concat([0, 1, 2].map((c) => [c * 48, 96, 48, 48])), k: 1 }],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  for (const [name, [file, o]] of Object.entries(LIST)) {
    const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    const url = await page.evaluate(
      async ({ src, o, FINE }) => {
        const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
        const t = document.createElement('canvas');
        t.width = im.width; t.height = im.height;
        const g = t.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        /** What's drawn inside a crop. */
        const bbox = ([cx, cy, cw, ch]) => {
          const d = g.getImageData(cx, cy, cw, ch).data;
          let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          return [cx + x0, cy + y0, x1 - x0 + 1, y1 - y0 + 1];
        };
        // (frames keep their cells whole, so they line up; a single sprite is cut to what's drawn)
        const crops = o.frames ?? [bbox(o.cell ?? [0, 0, im.width, im.height])];
        const k = o.k ?? (o.h * FINE) / crops[0][3];
        const fw = Math.max(1, Math.round(crops[0][2] * k));
        const fh = Math.max(1, Math.round(crops[0][3] * k));
        const c = document.createElement('canvas');
        c.width = fw * crops.length; c.height = fh;
        const out = c.getContext('2d');
        out.imageSmoothingEnabled = k < 1;
        out.imageSmoothingQuality = 'high';
        crops.forEach(([sx, sy, sw, sh], i) => out.drawImage(im, sx, sy, sw, sh, i * fw, 0, fw, fh));
        return c.toDataURL('image/png');
      },
      { src, o, FINE },
    );
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(name);
  }
  await browser.close();
})();
