// Builds the map's wildlife atlas (src/renderer/art/wildlife.png) from DawnLike's character sheets in ../chronos-assets
// (a dev tool, run by hand: `node tools/compose-wildlife.cjs`; it needs Playwright's Chromium). A column per kind, in
// the order of KINDS in src/renderer/map/mapWildlife.ts, its two 16px frames down (the `0` sheet, then the `1`).
// DawnLike's creatures face left.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const CHARS = path.join(process.env.ASSETS || path.join(__dirname, '../../chronos-assets'), 'DawnLike/Characters');
const OUT = path.join(__dirname, '../src/renderer/art/wildlife.png');
// [sheet, column, row]: deer, stag, boar, fox, wolf, squirrel, bear, camel, snow fox
const CELLS = [
  ['Quadraped', 0, 8],
  ['Quadraped', 1, 8],
  ['Quadraped', 3, 2],
  ['Dog', 0, 2],
  ['Dog', 0, 1],
  ['Rodent', 0, 0],
  ['Quadraped', 0, 5],
  ['Quadraped', 5, 1],
  ['Dog', 0, 3],
];
(async () => {
  const data = {};
  for (const s of new Set(CELLS.map((c) => c[0]))) for (const k of [0, 1]) data[s + k] = 'data:image/png;base64,' + fs.readFileSync(path.join(CHARS, `${s}${k}.png`)).toString('base64');
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const png = await p.evaluate(
    async ([cells, data]) => {
      const ims = {};
      for (const [k, src] of Object.entries(data)) {
        const im = new Image();
        im.src = src;
        await im.decode();
        ims[k] = im;
      }
      const c = document.createElement('canvas');
      c.width = cells.length * 16;
      c.height = 32;
      const g = c.getContext('2d');
      cells.forEach(([s, x, y], i) => [0, 1].forEach((f) => g.drawImage(ims[s + f], x * 16, y * 16, 16, 16, i * 16, f * 16, 16, 16)));
      return c.toDataURL('image/png');
    },
    [CELLS, data],
  );
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote', OUT);
})();
