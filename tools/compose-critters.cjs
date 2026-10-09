// Builds the small creatures' atlas (src/renderer/art/critters.png) and the scarecrow (src/renderer/art/scarecrow.png)
// (a dev tool, run by hand: `node tools/compose-critters.cjs`; it needs Playwright's Chromium). The atlas is a column
// per kind in the order of CRITTER in src/renderer/map/mapCritters.ts, its two 16px frames down: DawnLike's bee,
// dragonfly, moth, bat and two rats (the `0` sheet, then the `1`), the Fields pack's crate as a box hive, and a straw
// skep pixelled here (no pack has one). The scarecrow is put together from the Himeko layers the game already carries
// (src/renderer/art/himeko/): the man's body turned to sacking, the first peasant's robe and the gunslinger's wide
// hat, cut off at the hem and stood on a pole, a crossbar poking out of the sleeves, stitched eyes.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const CHARS = path.join(ASSETS, 'DawnLike/Characters');
const BOX = path.join(ASSETS, 'assets/craftpix-net-665131-free-fields-tileset-pixel-art-for-tower-defense/2 Objects/7 Decor/Box1.png');
const HK = path.join(__dirname, '../src/renderer/art/himeko');
const OUT = path.join(__dirname, '../src/renderer/art/critters.png');
const SCARE = path.join(__dirname, '../src/renderer/art/scarecrow.png');
// [sheet, column, row]: bee, dragonfly, moth, bat, brown rat, grey-brown rat
const CELLS = [
  ['Pest', 0, 8],
  ['Pest', 1, 1],
  ['Pest', 3, 1],
  ['Avian', 0, 1],
  ['Rodent', 2, 2],
  ['Rodent', 0, 1],
];
// a straw skep, coiled bands on a board, its door dark (. clear, a-d straw light to dark, k the door, w the board)
const SKEP = [
  '................',
  '................',
  '......bbbb......',
  '.....abaabb.....',
  '....cccccccc....',
  '...abaabaabab...',
  '...dcccccccccd..',
  '..abaabaabaabb..',
  '..dccccccccccd..',
  '..abaabaabaabb..',
  '..dcccckkcccdd..',
  '..abaabkkaabbb..',
  '..dddddkkdddd...',
  '.wwwwwwwwwwwwww.',
  '..w..........w..',
  '................',
];
const SKEP_COLOURS = { a: [226, 190, 112], b: [196, 156, 82], c: [160, 120, 60], d: [112, 80, 40], k: [40, 26, 16], w: [110, 72, 40] };
(async () => {
  const data = {};
  const url = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  for (const s of new Set(CELLS.map((c) => c[0]))) for (const k of [0, 1]) data[s + k] = url(path.join(CHARS, `${s}${k}.png`));
  data.box = url(BOX);
  for (const k of ['templatemale', 'peasant01male', 'helmgunslingermale']) data[k] = url(path.join(HK, `${k}.png`));
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const [atlas, scare] = await p.evaluate(
    async ([cells, data, skep, colours]) => {
      const ims = {};
      for (const [k, src] of Object.entries(data)) {
        const im = new Image();
        im.src = src;
        await im.decode();
        ims[k] = im;
      }
      const c = document.createElement('canvas');
      c.width = (cells.length + 2) * 16;
      c.height = 32;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      cells.forEach(([s, x, y], i) => [0, 1].forEach((f) => g.drawImage(ims[s + f], x * 16, y * 16, 16, 16, i * 16, f * 16, 16, 16)));
      // the box hive (the crate, 17px wide, squeezed into its cell), the skep pixelled
      const hive = cells.length;
      for (const f of [0, 1]) g.drawImage(ims.box, 0, 0, 17, 16, hive * 16, f * 16, 16, 16);
      for (const f of [0, 1])
        skep.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch === '.') return;
            const [r, gg, bb] = colours[ch];
            g.fillStyle = `rgb(${r},${gg},${bb})`;
            g.fillRect((hive + 1) * 16 + x, f * 16 + y, 1, 1);
          }),
        );
      // the scarecrow: the front-facing stand cell of each layer, the body first, turned to sacking
      const s = document.createElement('canvas');
      s.width = s.height = 128;
      const sg = s.getContext('2d');
      sg.drawImage(ims.templatemale, 0, 0, 128, 128, 0, 0, 128, 128);
      const px = sg.getImageData(0, 0, 128, 128);
      for (let i = 0; i < px.data.length; i += 4) {
        if (!px.data[i + 3]) continue;
        const l = (px.data[i] * 0.3 + px.data[i + 1] * 0.59 + px.data[i + 2] * 0.11) / 255;
        px.data[i] = 70 + 150 * l;
        px.data[i + 1] = 60 + 125 * l;
        px.data[i + 2] = 40 + 85 * l;
      }
      sg.putImageData(px, 0, 0);
      sg.drawImage(ims.peasant01male, 0, 0, 128, 128, 0, 0, 128, 128);
      sg.drawImage(ims.helmgunslingermale, 0, 0, 128, 128, 0, 0, 128, 128);
      sg.clearRect(0, 119, 128, 9);
      sg.fillStyle = '#5c4026';
      sg.fillRect(62, 112, 3, 15);
      sg.fillStyle = '#3c2818';
      sg.fillRect(65, 112, 1, 15);
      sg.fillStyle = '#785430';
      sg.fillRect(42, 92, 8, 1);
      sg.fillRect(78, 92, 8, 1);
      sg.fillStyle = '#4e341e';
      sg.fillRect(42, 93, 8, 1);
      sg.fillRect(78, 93, 8, 1);
      // (stitched eyes and a mouth over the sacking face)
      sg.fillStyle = '#2a1c10';
      for (const [x, y] of [[60, 66], [61, 67], [61, 66], [60, 67], [66, 66], [67, 67], [67, 66], [66, 67], [61, 71], [63, 72], [65, 71], [62, 72], [64, 72]]) sg.fillRect(x, y, 1, 1);
      // cut to what's drawn
      const all = sg.getImageData(0, 0, 128, 128).data;
      let x0 = 128, y0 = 128, x1 = 0, y1 = 0;
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++)
          if (all[(y * 128 + x) * 4 + 3]) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      const o = document.createElement('canvas');
      o.width = x1 - x0 + 1;
      o.height = y1 - y0 + 1;
      o.getContext('2d').drawImage(s, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      return [c.toDataURL('image/png'), o.toDataURL('image/png')];
    },
    [CELLS, data, SKEP, SKEP_COLOURS],
  );
  fs.writeFileSync(OUT, Buffer.from(atlas.split(',')[1], 'base64'));
  fs.writeFileSync(SCARE, Buffer.from(scare.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote', OUT, SCARE);
})();
