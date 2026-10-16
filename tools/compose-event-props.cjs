// Builds the event cards' props and sets (src/renderer/art/eventprops/, copied beside the page by the builds; the table
// that names them is src/renderer/panel/eventProps.ts) from ../chronos-assets (a dev tool, run by hand: `node
// tools/compose-event-props.cjs`; it needs Playwright's Chromium). Each prop is cut to what's drawn and shrunk (or, for
// DawnLike's 16px cells, blown up by whole pixels) to its height in the scene's 320x180 art pixels, so the player draws
// it one to one. A prop with frames (the fire) is a strip, its frames side by side. The sets (the hall, the cottage)
// are whole 320x180 pictures laid from the Medieval Field Work pack's wall, window and column pieces.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const OUT = path.join(__dirname, '../src/renderer/art/eventprops');
const FW = path.join(ASSETS, 'assets/craftpix-net-867123-free-medieval-field-work-2d-tileset-for-platformer/PNG');
const fw = (dir, name) => path.join(FW, dir, `Cartoon_Medieval_Field_Work_Level_Set_${dir} - ${name}.png`);
const env = (name) => fw('Environment', name);
const bld = (name) => fw('Building', name);
const DECOR = path.join(ASSETS, 'DawnLike/Objects/Decor0.png');
const FOOD = path.join(ASSETS, 'DawnLike/Items/Food.png');
const LIGHT = path.join(ASSETS, 'DawnLike/Items/Light.png');
const BEASTS = path.join(ASSETS, 'DawnLike/Characters/Quadraped0.png');
const FLAME = path.join(__dirname, '../src/renderer/art/effects/flame.png');

// [id, source, height in art px] for the Field Work pack's pictures (smoothly shrunk); [id, sheet, [col, row] (a run of
// cells: [col, row, cols]), whole-pixel scale] for DawnLike's cells.
const FWP = [
  ['banner_red', env('Banner 03'), 34], ['banner_green', env('Banner 02'), 34], ['banner_brown', env('Banner 01'), 36],
  ['cask', env('Wooden Barrel'), 30], ['tub', env('Barrel'), 22], ['bucket', env('Bucket'), 12],
  ['handcart', env('Cart 01'), 26], ['wagon', env('Cart 02'), 50], ['bench', env('Chair'), 14],
  ['fence', env('Fence 02'), 28], ['hay_bale', env('Hay 01'), 22], ['haystack', env('Hay 02'), 40],
  ['crops', env('Plants 06'), 24], ['turnips', env('Plants 03'), 20], ['beans', env('Plants 02'), 34], ['grapes', env('Plants 05'), 14],
  ['plow', env('Plow'), 26], ['board', env('Quest Board'), 60], ['sign', env('Sign 03'), 28],
  ['table', env('Table 01'), 26], ['table_small', env('Table 02 '), 24], ['crate', env('Wooden Crate'), 24],
  ['tree', env('Tree 02'), 140], ['rock', env('Rock 01'), 22], ['stall', env('Canopy'), 70], ['mill', env('Handmill'), 34],
  ['door', bld('Door 01'), 72], ['well', bld('Chimney 03'), 46], ['window', bld('Window 01'), 34], ['tools', bld('Decor Tools 01'), 26],
];
const DLP = [
  ['bed', DECOR, [0, 9], 3], ['sickbed', DECOR, [0, 20], 3], ['cot', DECOR, [1, 21], 2], ['coffin', DECOR, [6, 10], 3],
  ['candles', DECOR, [3, 8], 2], ['candle', DECOR, [2, 8], 2], ['tombstone', DECOR, [0, 17], 2], ['cross', DECOR, [0, 11], 3],
  ['round_table', DECOR, [1, 7], 2], ['long_table', DECOR, [0, 10, 2], 2], ['chair', DECOR, [0, 7], 2],
  ['throne', DECOR, [6, 7], 3], ['shelf', DECOR, [3, 4], 3],
  ['bowl', FOOD, [4, 5], 2], ['bread', FOOD, [1, 4], 2], ['apple', FOOD, [0, 2], 2], ['lantern', LIGHT, [3, 0], 2],
  ['cow', BEASTS, [0, 1], 2], ['goat', BEASTS, [0, 2], 2], ['sheep', BEASTS, [1, 3], 2], ['horse', BEASTS, [2, 5], 2], ['boar', BEASTS, [4, 0], 2],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const save = (name, url) => fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  await page.evaluate(() => {
    window.load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    /** The box of what's drawn in a picture (or a part of it). */
    window.bounds = (im, sx = 0, sy = 0, sw = im.width, sh = im.height) => {
      const t = document.createElement('canvas');
      t.width = sw; t.height = sh;
      const g = t.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
      const d = g.getImageData(0, 0, sw, sh).data;
      let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return [sx + x0, sy + y0, x1 - x0 + 1, y1 - y0 + 1];
    };
  });
  const sizes = {};
  for (const [id, file, h] of FWP) {
    const r = await page.evaluate(async ({ src, h }) => {
      const im = await load(src);
      const [x, y, w, hh] = bounds(im);
      const c = document.createElement('canvas');
      c.height = h; c.width = Math.max(1, Math.round((w * h) / hh));
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, x, y, w, hh, 0, 0, c.width, c.height);
      return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
    }, { src: data(file), h });
    save(id, r.url);
    sizes[id] = [r.w, r.h];
  }
  for (const [id, file, [col, row, cols = 1], k] of DLP) {
    const r = await page.evaluate(async ({ src, col, row, cols, k }) => {
      const im = await load(src);
      const [x, y, w, h] = bounds(im, col * 16, row * 16, cols * 16, 16);
      const c = document.createElement('canvas');
      c.width = w * k; c.height = h * k;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(im, x, y, w, h, 0, 0, c.width, c.height);
      return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
    }, { src: data(file), col, row, cols, k });
    save(id, r.url);
    sizes[id] = [r.w, r.h];
  }
  // the fire: the effects' flame (8 frames of 32px, already in the game) as a strip of 26px frames
  {
    const r = await page.evaluate(async ({ src }) => {
      const im = await load(src);
      const F = 26;
      const c = document.createElement('canvas');
      c.width = F * 8; c.height = F;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < 8; i++) g.drawImage(im, i * 32, 0, 32, 32, i * F, 0, F, F);
      return { url: c.toDataURL('image/png'), w: F, h: F };
    }, { src: data(FLAME) });
    save('fire', r.url);
    sizes.fire = [r.w, r.h];
  }
  // a burning house's front: the plaster wall under the roof's two slopes, a door and a window
  {
    const parts = { wall: data(bld('Wall B 02')), roofL: data(bld('Roof A 04')), door: data(bld('Door 02')), win: data(bld('Window 02')) };
    const r = await page.evaluate(async (parts) => {
      const p = {};
      for (const [k, v] of Object.entries(parts)) p[k] = await load(v);
      const c = document.createElement('canvas');
      c.width = 120; c.height = 120;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.wall, 0, 20, 320, 300, 6, 52, 108, 68);
      // (the roof's slope, and its mirror for the other side)
      g.drawImage(p.roofL, 0, 0, 352, 160, -4, 6, 128, 56);
      g.drawImage(p.door, 0, 18, 128, 238, 64, 76, 26, 44);
      g.drawImage(p.win, 13, 12, 102, 104, 20, 72, 24, 24);
      return { url: c.toDataURL('image/png'), w: 120, h: 120 };
    }, parts);
    save('house', r.url);
    sizes.house = [r.w, r.h];
  }
  // the gate: a wide door between two stone columns, a beam over them
  {
    const parts = { door: data(bld('Wide Door 03')), col: data(bld('Wall A 01')), colR: data(bld('Wall A 03')), beam: data(bld('Roof A 02')) };
    const r = await page.evaluate(async (parts) => {
      const p = {};
      for (const [k, v] of Object.entries(parts)) p[k] = await load(v);
      const c = document.createElement('canvas');
      c.width = 110; c.height = 100;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(p.door, 22, 6, 212, 250, 18, 30, 74, 70);
      g.drawImage(p.beam, 0, 0, 320, 90, 0, 14, 110, 20);
      g.drawImage(p.col, 63, 20, 65, 300, 0, 26, 20, 74);
      g.drawImage(p.colR, 0, 20, 65, 300, 90, 26, 20, 74);
      return { url: c.toDataURL('image/png'), w: 110, h: 100 };
    }, parts);
    save('gate', r.url);
    sizes.gate = [r.w, r.h];
  }
  // the sets: the hall (plaster walls between brick columns, tall stone windows, banners, an earthen floor) and the
  // cottage (a plastered room with a wainscot, a wooden window, a door)
  const SET = { wallA: data(bld('Wall A 02')), wallB: data(bld('Wall B 02')), floor: data(bld('Wall C 02')), brick: data(bld('Roof A 01')), stoneWin: data(bld('Stone Window 02')), win: data(bld('Window 01')), door: data(bld('Door 01')), beam: data(bld('Roof A 02')), red: data(env('Banner 03')), green: data(env('Banner 02')) };
  for (const set of ['hall', 'cottage']) {
    const url = await page.evaluate(async ({ parts, set }) => {
      const p = {};
      for (const [k, v] of Object.entries(parts)) p[k] = await load(v);
      const W = 320, H = 180, FLOOR = 128;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const wall = set === 'hall' ? p.wallA : p.wallB;
      for (let x = 0; x < W; x += 106) g.drawImage(wall, 0, 20, 320, 300, x, 0, 108, FLOOR + 4);
      if (set === 'hall') {
        // (a beam under the roof, brick columns, two tall windows, a banner between each)
        for (let x = -6; x < W; x += 104) g.drawImage(p.brick, 36, 0, 92, 160, x, 0, 24, FLOOR);
        for (const x of [52, 236]) g.drawImage(p.stoneWin, 23, 11, 114, 149, x, 22, 36, 48);
        g.drawImage(p.red, 2, 0, 124, 117, 128, 8, 30, 28);
        g.drawImage(p.green, 16, 0, 96, 115, 168, 8, 24, 29);
        g.drawImage(p.beam, 0, 0, 320, 70, 0, -6, W, 16);
      } else {
        g.drawImage(p.win, 13, 7, 102, 114, 60, 34, 38, 42);
        g.drawImage(p.win, 13, 7, 102, 114, 222, 34, 38, 42);
        g.drawImage(p.door, 0, 18, 128, 238, 140, 52, 40, 76);
        g.drawImage(p.beam, 0, 0, 320, 70, 0, -6, W, 16);
      }
      // the floor, darkening toward the back wall
      for (let x = 0; x < W; x += 106) g.drawImage(p.floor, 0, 40, 320, 200, x, FLOOR, 108, H - FLOOR);
      const sh = g.createLinearGradient(0, FLOOR, 0, FLOOR + 14);
      sh.addColorStop(0, 'rgba(30,18,8,0.55)');
      sh.addColorStop(1, 'rgba(30,18,8,0)');
      g.fillStyle = sh;
      g.fillRect(0, FLOOR, W, 14);
      return c.toDataURL('image/png');
    }, { parts: SET, set });
    save(`set_${set}`, url);
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes) + '\n');
  console.log(Object.keys(sizes).length, 'props, 2 sets');
  await browser.close();
})();
