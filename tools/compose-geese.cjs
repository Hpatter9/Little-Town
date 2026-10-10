// Builds the migrating geese's atlas (src/renderer/art/geese.png) (a dev tool, run by hand: `node tools/compose-geese.cjs`;
// it needs Playwright's Chromium). whtdragon's RPG Maker MV *flyingducks* sheet holds eight birds in flight, each three
// wing-beat frames across and four facings down (down, left, right, up); the dark-headed grey one stands for the grey
// goose and the white one for the snow goose. The atlas is their three frames across, a row a facing, the grey's four
// rows then the white's (48px cells, as the sheet has them): map/mapGeese.ts cuts it the same way.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const SHEET = path.join(ASSETS, 'whtdragons_MVanimals_ALL_4-1-2025/animals/flyingducks.png');
const OUT = path.join(__dirname, '../src/renderer/art/geese.png');
// the birds on the sheet (its 3x4-cell blocks, counted across the top row): the grey goose, then the snow goose
const BIRDS = [2, 1];
const CELL = 48;
(async () => {
  const src = 'data:image/png;base64,' + fs.readFileSync(SHEET).toString('base64');
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const atlas = await p.evaluate(
    async ([src, birds, cell]) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = 3 * cell;
      c.height = birds.length * 4 * cell;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      birds.forEach((bird, i) => {
        for (let row = 0; row < 4; row++) for (let f = 0; f < 3; f++) g.drawImage(im, (bird * 3 + f) * cell, row * cell, cell, cell, f * cell, (i * 4 + row) * cell, cell, cell);
      });
      return c.toDataURL('image/png');
    },
    [src, BIRDS, CELL],
  );
  fs.writeFileSync(OUT, Buffer.from(atlas.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote', OUT);
})();
