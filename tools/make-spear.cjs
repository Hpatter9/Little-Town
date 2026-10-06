// Makes a spear for the townsfolk's Himeko dress from the pack's naginata (a dev tool, run by hand:
// `node tools/make-spear.cjs`; needs Playwright's Chromium). The pack has no spear: in every cell of the naginata's
// layer (src/renderer/art/himeko/greataxe04naginata{male,female}.png, 8 poses by 4 facings of 128px) the curved blade
// is taken off the shaft and a straight leaf-shaped spearhead is drawn along the shaft's line in its place, with a
// socket where the blade's guard was. Written as spear01{male,female}.png beside it and added to himeko.json's keys.
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const { palettise } = require('./pngPalette.cjs');
const DIR = path.join(__dirname, '../src/renderer/art/himeko');
const MANIFEST = path.join(__dirname, '../src/renderer/art/himeko.json');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const sex of ['male', 'female']) {
    const src = fs.readFileSync(path.join(DIR, `greataxe04naginata${sex}.png`)).toString('base64');
    const png = await page.evaluate(async (data) => {
      const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = data; });
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const img = g.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const at = (x, y) => (y * c.width + x) * 4;
      // (the blade and guard are grey, the shaft brown)
      const grey = (i) => d[i + 3] > 0 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 28;
      const brown = (i) => d[i + 3] > 0 && d[i] - d[i + 2] > 30;
      const set = (x, y, rgb) => {
        if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
        const i = at(x, y);
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      };
      const EDGE = [58, 62, 72], STEEL = [196, 202, 210], RIDGE = [150, 156, 166], SOCKET = [92, 96, 104];
      for (let cy = 0; cy < c.height; cy += 128)
        for (let cx = 0; cx < c.width; cx += 128) {
          const blade = [], shaft = [];
          for (let y = cy; y < cy + 128; y++)
            for (let x = cx; x < cx + 128; x++) {
              const i = at(x, y);
              if (grey(i)) blade.push([x, y]);
              else if (brown(i)) shaft.push([x, y]);
            }
          // (only the biggest run of grey is the blade: the butt-cap at the shaft's other end is grey too)
          {
            const key = (p) => p[0] * 4096 + p[1];
            const left = new Map(blade.map((p) => [key(p), p]));
            let biggest = [];
            while (left.size) {
              const [k0, p0] = left.entries().next().value;
              left.delete(k0);
              const run = [p0];
              for (let j = 0; j < run.length; j++)
                for (let oy = -1; oy <= 1; oy++)
                  for (let ox = -1; ox <= 1; ox++) {
                    const k = key([run[j][0] + ox, run[j][1] + oy]);
                    const q = left.get(k);
                    if (q) {
                      left.delete(k);
                      run.push(q);
                    }
                  }
              if (run.length > biggest.length) biggest = run;
            }
            blade.length = 0;
            blade.push(...biggest);
          }
          if (blade.length < 4) continue; // (an empty pose, or only the shaft showing)
          const mean = (ps) => ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length], [0, 0]);
          const B = mean(blade);
          // the shaft's line: from its middle toward the blade (a pose with no shaft showing keeps the blade's long axis)
          let dir;
          if (shaft.length >= 3) {
            const S = mean(shaft);
            dir = [B[0] - S[0], B[1] - S[1]];
          } else {
            let far = blade[0], best = -1;
            for (const p of blade) for (const q of blade) { const k = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (k > best) { best = k; far = [q[0] - p[0], q[1] - p[1]]; } }
            dir = far;
          }
          const n = Math.hypot(dir[0], dir[1]) || 1;
          dir = [dir[0] / n, dir[1] / n];
          const side = [-dir[1], dir[0]];
          // the blade's base (nearest the hands) and how far it reached
          let lo = Infinity, hi = -Infinity;
          for (const [x, y] of blade) { const t = (x - B[0]) * dir[0] + (y - B[1]) * dir[1]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
          const base = [B[0] + dir[0] * lo, B[1] + dir[1] * lo];
          // (its line on the shaft: the base taken back onto the shaft's own line through the shaft pixels, if any)
          for (const [x, y] of blade) d[at(x, y) + 3] = 0;
          const len = Math.max(7, Math.min(16, (hi - lo) * 0.85));
          const W = Math.max(1.6, Math.min(2.6, len / 6));
          const x0 = Math.floor(base[0] - len - 4), x1 = Math.ceil(base[0] + len + 4);
          const y0 = Math.floor(base[1] - len - 4), y1 = Math.ceil(base[1] + len + 4);
          for (let y = Math.max(cy, y0); y <= Math.min(cy + 127, y1); y++)
            for (let x = Math.max(cx, x0); x <= Math.min(cx + 127, x1); x++) {
              const vx = x + 0.5 - base[0], vy = y + 0.5 - base[1];
              const t = vx * dir[0] + vy * dir[1];
              const s = Math.abs(vx * side[0] + vy * side[1]);
              if (t >= -2.5 && t < 0.5 && s <= 1.2) { set(x, y, SOCKET); continue; } // (the socket on the shaft)
              if (t < 0.5 || t > len) continue;
              const k = t / len;
              const w = k < 0.38 ? 0.9 + (W - 0.9) * (k / 0.38) : W * (1 - (k - 0.38) / 0.62) + 0.15;
              if (s > w) continue;
              set(x, y, s > w - 0.9 ? EDGE : s < 0.5 && k < 0.85 ? RIDGE : STEEL);
            }
        }
      g.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    }, 'data:image/png;base64,' + src);
    const key = `spear01${sex}`;
    fs.writeFileSync(path.join(DIR, `${key}.png`), palettise(Buffer.from(png.split(',')[1], 'base64')));
    if (!manifest.keys.includes(key)) manifest.keys.push(key);
    console.log('wrote', key);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  await browser.close();
})();
