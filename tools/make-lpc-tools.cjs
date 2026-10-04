// One-off (run by hand; needs Playwright's Chromium): makes the tool layers the LPC pack lacks (a pickaxe, a sickle
// and a hoe) out of its axe layer, frame by frame: the axe head is taken off the haft and the tool's own head drawn
// at the haft's end. Writes them into src/renderer/art/lpc/lpcData.json as w_pick_*, w_sickle_*, w_hoe_*.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/renderer/art/lpc/lpcData.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  await pg.setContent('<canvas id=c></canvas>');
  for (const sex of ['m', 'f']) {
    const src = data.layers[`w_axe_${sex}`];
    const has = data.has[`w_axe_${sex}`];
    const made = await pg.evaluate(async ({ src, has }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const W = img.width, H = img.height, F = 64;
      const out = {};
      for (const tool of ['pick', 'sickle', 'hoe']) {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const id = g.getImageData(0, 0, W, H);
        const px = id.data;
        const at = (x, y) => (y * W + x) * 4;
        const isHaft = (x, y) => { const i = at(x, y); return px[i + 3] > 0 && px[i] > px[i + 1] && px[i + 1] > px[i + 2] && px[i] - px[i + 2] > 30; };
        const isHead = (x, y) => { const i = at(x, y); return px[i + 3] > 0 && Math.abs(px[i] - px[i + 1]) < 24 && Math.abs(px[i + 1] - px[i + 2]) < 24 && px[i] > 90; };
        const set = (x, y, r, gg, bb) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = at(x, y); px[i] = r; px[i + 1] = gg; px[i + 2] = bb; px[i + 3] = 255; };
        const clear = (x, y) => { const i = at(x, y); px[i + 3] = 0; };
        for (let row = 0; row < has.length; row++) {
          if (!has[row]) continue;
          const frames = Math.floor(W / F);
          for (let f = 0; f < frames; f++) {
            const ox = f * F, oy = row * F;
            const haft = [], head = [];
            for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
              if (isHaft(ox + x, oy + y)) haft.push([x, y]);
              else if (isHead(ox + x, oy + y)) head.push([x, y]);
            }
            if (!haft.length) continue;
            // the haft's axis (its two ends: the hand's and the head's)
            let hx = 0, hy = 0;
            for (const [x, y] of head) { hx += x; hy += y; }
            if (head.length) { hx /= head.length; hy /= head.length; }
            let far = haft[0], near = haft[0];
            const dh = ([x, y]) => head.length ? Math.hypot(x - hx, y - hy) : -Math.hypot(x - 31, y - 40);
            for (const p of haft) { if (dh(p) < dh(far)) far = p; if (dh(p) > dh(near)) near = p; }
            const len = Math.max(1, Math.hypot(far[0] - near[0], far[1] - near[1]));
            const ax = (far[0] - near[0]) / len, ay = (far[1] - near[1]) / len; // along the haft, toward the head
            const nx = -ay, ny = ax; // across it
            for (const [x, y] of head) clear(ox + x, oy + y);
            const iron = [92, 96, 108], light = [160, 166, 178], steel = [196, 204, 214], dark = [60, 62, 72];
            const dot = (x, y, col) => set(ox + Math.round(x), oy + Math.round(y), ...col);
            const line = (x0, y0, x1, y1, col) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let i = 0; i <= n; i++) dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col); };
            const [ex, ey] = [far[0] + ax * 0.5, far[1] + ay * 0.5];
            if (tool === 'pick') {
              // a bar across the haft's end, both ends drawn to points
              line(ex - nx * 5, ey - ny * 5, ex + nx * 5, ey + ny * 5, iron);
              line(ex - nx * 4 + ax, ey - ny * 4 + ay, ex + nx * 4 + ax, ey + ny * 4 + ay, light);
              line(ex - nx * 3 - ax, ey - ny * 3 - ay, ex + nx * 3 - ax, ey + ny * 3 - ay, dark);
              dot(ex - nx * 6 + ax * 1.5, ey - ny * 6 + ay * 1.5, iron);
              dot(ex + nx * 6 + ax * 1.5, ey + ny * 6 + ay * 1.5, iron);
            } else if (tool === 'hoe') {
              // a blade on one side, turned back toward the hand
              line(ex, ey, ex + nx * 4 - ax * 2, ey + ny * 4 - ay * 2, iron);
              line(ex + ax, ey + ay, ex + nx * 4 - ax, ey + ny * 4 - ay, light);
              line(ex + nx * 4 - ax * 2, ey + ny * 4 - ay * 2, ex + nx * 5 - ax * 5, ey + ny * 5 - ay * 5, iron);
              line(ex + nx * 5 - ax * 2, ey + ny * 5 - ay * 2, ex + nx * 6 - ax * 5, ey + ny * 6 - ay * 5, dark);
            } else {
              // a short handle and a curved blade hooking back
              for (const [x, y] of haft) if (Math.hypot(x - near[0], y - near[1]) > 9) clear(ox + x, oy + y);
              const sx = near[0] + ax * 9, sy = near[1] + ay * 9;
              const pts = [];
              for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 0.9; pts.push([sx + ax * (2 + Math.sin(a) * 7) + nx * (1 - Math.cos(a)) * 5, sy + ay * (2 + Math.sin(a) * 7) + ny * (1 - Math.cos(a)) * 5]); }
              for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], steel);
              for (let i = 0; i < pts.length - 2; i++) line(pts[i][0] - nx, pts[i][1] - ny, pts[i + 1][0] - nx, pts[i + 1][1] - ny, iron);
            }
          }
        }
        g.putImageData(id, 0, 0);
        out[tool] = c.toDataURL('image/png');
      }
      return out;
    }, { src, has });
    for (const tool of Object.keys(made)) {
      data.layers[`w_${tool}_${sex}`] = made[tool];
      data.has[`w_${tool}_${sex}`] = has;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  // a contact sheet of the slash row for a look
  await pg.setContent(`<body style="margin:0;background:#3a5a3a">${['axe', 'pick', 'sickle', 'hoe'].map((t) => `<div><img src="${data.layers[`w_${t}_m`]}" style="image-rendering:pixelated;zoom:3;margin-top:-${3 * 64 * 3}px;clip-path:inset(${64 * 3}px 0 ${64 * 2}px 0)"></div>`).join('')}`);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(__dirname, '../out/lpc-tools.png'), fullPage: true });
  await b.close();
  console.log('wrote', file);
})();
