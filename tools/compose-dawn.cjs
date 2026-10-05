// Builds the menagerie's creature sheet from DawnLike's character sheets in ../chronos-assets (a dev tool, run by hand:
// `node tools/compose-dawn.cjs`; it needs Playwright's Chromium). Each creature of src/shared/data/menagerie.ts (its
// row's sheet and cell, in order) becomes a pair of 16px frames on src/renderer/art/creatures/dawn.png (its frame
// from the `0` sheet, then the `1`), `DAWN_ACROSS` pairs to a row. DawnLike's creatures face left; the game mirrors
// them to face right (creatures.ts `pairs`).

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
const OUT = path.join(__dirname, '../src/renderer/art/creatures/dawn.png');
const SRC = fs.readFileSync(path.join(__dirname, '../src/shared/data/menagerie.ts'), 'utf8');
const ACROSS = +/DAWN_ACROSS = (\d+)/.exec(SRC)[1];
const ROWS = [...SRC.matchAll(/^ {2}\['[a-z_]+', (?:'[^']*'|"[^"]*"), '(\w+)', (\d+), (\d+),/gm)].map((m) => [m[1], +m[2], +m[3]]);

(async () => {
  const sheets = [...new Set(ROWS.map((r) => r[0]))];
  const data = {};
  for (const s of sheets) for (const k of [0, 1]) data[`${s}${k}`] = 'data:image/png;base64,' + fs.readFileSync(path.join(CHARS, `${s}${k}.png`)).toString('base64');
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const png = await p.evaluate(
    async ([rows, data, across]) => {
      const ims = {};
      for (const [k, src] of Object.entries(data)) {
        const im = new Image();
        im.src = src;
        await im.decode();
        ims[k] = im;
      }
      const F = 16;
      const c = document.createElement('canvas');
      c.width = across * 2 * F;
      c.height = Math.ceil(rows.length / across) * F;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      rows.forEach(([sheet, x, y], i) => {
        const bx = (i % across) * 2 * F;
        const by = Math.floor(i / across) * F;
        [0, 1].forEach((k) => g.drawImage(ims[`${sheet}${k}`], x * F, y * F, F, F, bx + k * F, by, F, F));
      });
      return c.toDataURL('image/png');
    },
    [ROWS, data, ACROSS],
  );
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`${ROWS.length} creatures -> ${path.relative(process.cwd(), OUT)}`);
  await b.close();
})();
