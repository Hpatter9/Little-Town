// Draws each hand-made dungeon floor (sim/delveFloors.ts) whole, top-down, as the game draws it (renderer/delve/
// floorArt.ts), with the rooms numbered and the party's way through them dotted (a dev tool, run by hand: `node
// tools/floor-preview.mjs [out dir] [scale]`; it needs Playwright's Chromium). Writes <out dir>/floor-<id>.png
// (default docs/notes/hand-made-maps).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DELVE_FLOORS } from '../src/shared/data/delveFloors';
import { floorPath, floorRooms } from '../src/shared/sim/delveFloors';
import { groundTiles, propTiles, tileIndex, TILE_COLS } from '../src/renderer/delve/floorArt';

const OUT = resolve(process.argv[2] ?? 'docs/notes/hand-made-maps');
const SCALE = Number(process.argv[3] ?? 2);
// (Playwright from wherever it's installed, never bundled)
const req = eval('require') as NodeJS.Require;
const pw = (() => {
  try {
    return req('playwright');
  } catch {
    return req(join(req('node:child_process').execSync('npm root -g').toString().trim(), 'playwright'));
  }
})();

(async () => {
  mkdirSync(OUT, { recursive: true });
  const sheet = 'data:image/png;base64,' + readFileSync('src/renderer/art/floors/tiles.png').toString('base64');
  const jobs = DELVE_FLOORS.map((m) => {
    const rooms = floorRooms(m);
    const found = new Set<number>();
    for (let v = 0; v < m.h; v++) for (let u = 0; u < m.w; u++) if (m.grids.Ground[v][u] === 'S') found.add(v * m.w + u);
    const tiles = [...groundTiles(m, found), ...propTiles(m)].map((t) => [tileIndex(t.name), t.u, t.v]);
    const path: [number, number][] = [];
    for (let i = 1; i < rooms.length; i++) path.push(...(floorPath(m, rooms[i - 1], rooms[i]) ?? []));
    return { id: m.id, w: m.w, h: m.h, tiles, rooms: rooms.map((r) => [r.u, r.v, r.step]), path };
  });
  const browser = await pw.chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage();
  const out: string[] = await page.evaluate(
    async ([jobs, sheet, cols, k]: [typeof jobs, string, number, number]) => {
      const im = new Image();
      im.src = sheet;
      await im.decode();
      return jobs.map((j) => {
        const c = document.createElement('canvas');
        c.width = j.w * 16 * k;
        c.height = j.h * 16 * k;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#0c0a10';
        g.fillRect(0, 0, c.width, c.height);
        for (const [i, u, v] of j.tiles) if (i >= 0) g.drawImage(im, (i % cols) * 16, Math.floor(i / cols) * 16, 16, 16, u * 16 * k, v * 16 * k, 16 * k, 16 * k);
        g.fillStyle = 'rgba(255,230,120,0.55)';
        for (const [u, v] of j.path) g.fillRect((u * 16 + 7) * k, (v * 16 + 7) * k, 2 * k, 2 * k);
        g.font = `bold ${9 * k}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const [u, v, n] of j.rooms) {
          g.fillStyle = 'rgba(0,0,0,0.65)';
          g.beginPath();
          g.arc((u * 16 + 8) * k, (v * 16 + 8) * k, 6 * k, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#ffe070';
          g.fillText(String(n), (u * 16 + 8) * k, (v * 16 + 8.5) * k);
        }
        return c.toDataURL('image/png');
      });
    },
    [jobs, sheet, TILE_COLS, SCALE],
  );
  jobs.forEach((j, i) => {
    const file = join(OUT, `floor-${j.id.toLowerCase().replace(/_/g, '-')}.png`);
    writeFileSync(file, Buffer.from(out[i].split(',')[1], 'base64'));
    console.log(file);
  });
  await browser.close();
})();
