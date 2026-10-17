// Draws the logo's square mark (src/renderer/loading/logo.ts `drawMark`: the emblem on its wood plaque) as the phone's
// home-screen icons, src/renderer/mobile/art/icon-192.png and icon-512.png, which tools/build-web.mjs copies in place of
// the painted one. A dev tool, run by hand after `npm run web` (it draws with the built loading.js in Playwright's
// Chromium): `node tools/compose-logo.cjs`.

const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const WEB = path.join(__dirname, '../out/web');
const OUT = path.join(__dirname, '../src/renderer/mobile/art');

(async () => {
  // (the built page's files, and a bare page that runs only the loading screen's script)
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/mark.html') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><body><script src="loading.js"></script></body>');
    fs.readFile(path.join(WEB, p), (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200).end(data)));
  });
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/mark.html`);
  fs.mkdirSync(OUT, { recursive: true });
  for (const size of [192, 512]) {
    const data = await page.evaluate((n) => window.__loading.mark(n).then((c) => c.toDataURL('image/png')), size);
    fs.writeFileSync(path.join(OUT, `icon-${size}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`icon-${size}.png`);
  }
  await browser.close();
  server.close();
})();
