// Copies the Himeko Sutori sprite share's layers the townsfolk are dressed in from ../chronos-assets into
// src/renderer/art/himeko/ (a dev tool, run by hand: `node tools/import-himeko.cjs`; needs Playwright's Chromium for
// the measuring). Each file is renamed to its key (the base name, lower case, letters and digits only: "Hair Long Black
// Front" is hairlongblackfront), and himeko.json lists the keys and where each body's feet stand in its cells. Every
// sheet is the pack's grid of 128px cells, 8 poses by 4 facings (front, left, right, back); 2048 sheets are it doubled.
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const { palettise } = require('./pngPalette.cjs');
const OUT = path.join(__dirname, '../src/renderer/art/himeko');
const keyOf = (f) => path.basename(f, '.png').toLowerCase().replace(/[^a-z0-9]/g, '');

const top = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.png'));
const inDir = (d) => fs.readdirSync(path.join(ASSETS, d)).filter((f) => f.endsWith('.png')).map((f) => path.join(d, f));
const gendered = (f) => /_(male|female)(_top)?\.png$/i.test(f) && !/_(blue|black|old|wide|reliable|empowered|siege|StormGold)_|offhand/i.test(f);
// the outfits, weapons and hand items the dressing uses (by name), in both their male and female cut
const LOOSE = /^(Template|Adventurer|Alch_|Alchemy_01_Flask_|Barbarian|Book|Bow|Cape|Cleric|Dagger|Druid|Greataxe|Greathammer|Greatsword|Gun_0[1-6]_(Crossbow|Blunderbuss|Arquebus|Zapper|ShoulderCannon|Vest|Coat|Gear|Cuirass|Armor|Royal)_|Hammer|Illusion|Leather|Mage|Orb|Paladin|Peasant|Pistol|Plate|Ranger|Scythe|Sickle|Staff|Student|Sword|Talisman|Totem|Wand|Warlock|Axe)/;
const files = [
  ...top.filter((f) => LOOSE.test(f) && (gendered(f) || /^Template_/.test(f) || /^Staff_(Crescent|Gnarled|GnarledVenerable|Mysterious)_/.test(f))),
  'Undead/Skeleton.png', 'Mechanical.png', 'Orc.png',
  ...['Hair Female/Long', 'Hair Female/Pigtails', 'Hair Female/Pixie', 'Hair Female/Short', 'Bangs/Big', 'Bangs/Layers', 'Facial Hair', 'Helm', 'Shield'].flatMap(inDir),
  ...inDir('Facial Features').filter((f) => /Eyepatch|Scar|Freckles/.test(f)),
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  // (only the sheets' top half is drawn on, four rows of 128: each is cut to that, 1024 by 512, the 2048 ones scaled down)
  const keys = [];
  for (const f of files) {
    const k = keyOf(f);
    const png = await page.evaluate(async (src) => {
      const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const s = im.width / 1024;
      g.drawImage(im, 0, 0, 1024 * s, 512 * s, 0, 0, 1024, 512);
      return c.toDataURL('image/png');
    }, 'data:image/png;base64,' + fs.readFileSync(path.join(ASSETS, f)).toString('base64'));
    fs.writeFileSync(path.join(OUT, k + '.png'), palettise(Buffer.from(png.split(',')[1], 'base64')));
    keys.push(k);
  }
  // where the feet stand in a cell (the lowest opaque row of the standing pose, each facing), from the man's template
  const feet = await page.evaluate(async (src) => {
    const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const out = [];
    for (let row = 0; row < 4; row++) {
      const d = g.getImageData(0, row * 128, 128, 128).data;
      let foot = 0, top = 128;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (d[(y * 128 + x) * 4 + 3] > 30) { foot = Math.max(foot, y); top = Math.min(top, y); }
      out.push([top, foot]);
    }
    return out;
  }, 'data:image/png;base64,' + fs.readFileSync(path.join(ASSETS, 'Template_Male.png')).toString('base64'));
  await browser.close();
  fs.writeFileSync(path.join(OUT, '../himeko.json'), JSON.stringify({ feet, keys: keys.sort() }) + '\n');
  console.log(keys.length, 'layers;', 'feet', JSON.stringify(feet));
})();
