// Draws each hand-made raid board as the LDtk editor shows it, top-down (a dev tool, run by hand: `node
// tools/ldtk-preview.cjs [out dir]`; it needs Playwright's Chromium). For a look at the boards without LDtk: the ground
// from the Terrain layer's tiles, the heights as shading and a number, the Things layer's entities, the line the game
// lays the town's wall down (dashed) and its gate. Writes <out dir>/ldtk-<board>.png (default docs/notes/raid-boards).

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const MAPS = path.join(__dirname, '../maps');
const OUT = path.resolve(process.argv[2] ?? path.join(__dirname, '../docs/notes/raid-boards'));
const CELL = 20;

(async () => {
  const project = JSON.parse(fs.readFileSync(path.join(MAPS, 'raid-boards.ldtk'), 'utf8'));
  const ts = project.defs.tilesets[0];
  const atlas = 'data:image/png;base64,' + fs.readFileSync(path.join(MAPS, ts.relPath)).toString('base64');
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const pngs = await p.evaluate(
    async ([project, atlas, CELL]) => {
      const im = new Image();
      im.src = atlas;
      await im.decode();
      const layerDef = (id) => project.defs.layers.find((l) => l.identifier === id);
      const terrainTile = new Map(layerDef('Terrain').intGridValues.map((x) => [x.value, x.tile]));
      const heightOf = new Map(layerDef('Height').intGridValues.map((x) => [x.value, Number(x.identifier.slice(1))]));
      const out = {};
      for (const lv of project.levels) {
        const L = (id) => lv.layerInstances.find((l) => l.__identifier === id);
        const terrain = L('Terrain');
        const w = terrain.__cWid;
        const h = terrain.__cHei;
        const head = 22;
        const c = document.createElement('canvas');
        c.width = w * CELL;
        c.height = h * CELL + head;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#1c2030';
        g.fillRect(0, 0, c.width, c.height);
        const name = lv.fieldInstances.find((f) => f.__identifier === 'name')?.__value ?? lv.identifier;
        g.fillStyle = '#f0e6c8';
        g.font = 'bold 13px sans-serif';
        g.fillText(name, 6, 15);
        g.font = '10px sans-serif';
        g.fillStyle = '#a8a090';
        g.textAlign = 'right';
        g.fillText('raiders ← → town', c.width - 6, 15);
        g.textAlign = 'left';
        g.translate(0, head);
        const hcsv = L('Height').intGridCsv;
        for (let v = 0; v < h; v++)
          for (let u = 0; u < w; u++) {
            const t = terrainTile.get(terrain.intGridCsv[v * w + u]);
            if (t) g.drawImage(im, t.x, t.y, t.w, t.h, u * CELL, v * CELL, CELL, CELL);
            const hv = heightOf.get(hcsv[v * w + u]);
            if (hv !== undefined) {
              g.fillStyle = `rgba(255,255,255,${Math.min(0.4, 0.08 * hv)})`;
              g.fillRect(u * CELL, v * CELL, CELL, CELL);
            }
          }
        // (a step of three or more between tiles is a cliff: a dark edge)
        const tileH = (u, v) => {
          const hv = heightOf.get(hcsv[v * w + u]);
          if (hv !== undefined) return hv;
          const id = layerDef('Terrain').intGridValues.find((x) => x.value === terrain.intGridCsv[v * w + u])?.identifier;
          return id === 'cliff' ? 6 : ['water', 'shallows', 'ice', 'mud'].includes(id) ? 0 : 1;
        };
        g.strokeStyle = 'rgba(10,8,6,0.85)';
        g.lineWidth = 2;
        for (let v = 0; v < h; v++)
          for (let u = 0; u < w; u++) {
            if (u + 1 < w && Math.abs(tileH(u, v) - tileH(u + 1, v)) >= 3) {
              g.beginPath();
              g.moveTo((u + 1) * CELL, v * CELL);
              g.lineTo((u + 1) * CELL, (v + 1) * CELL);
              g.stroke();
            }
            if (v + 1 < h && Math.abs(tileH(u, v) - tileH(u, v + 1)) >= 3) {
              g.beginPath();
              g.moveTo(u * CELL, (v + 1) * CELL);
              g.lineTo((u + 1) * CELL, (v + 1) * CELL);
              g.stroke();
            }
          }
        // (the dressing under the things, a little smaller: nothing the fight sees)
        for (const e of L('Decor')?.entityInstances ?? []) {
          const [u, v] = e.__grid;
          const t = e.__tile;
          if (t) g.drawImage(im, t.x, t.y, t.w, t.h, u * CELL + CELL / 6, v * CELL + CELL / 6, (CELL * 2) / 3, (CELL * 2) / 3);
        }
        for (const e of L('Things').entityInstances) {
          const [u, v] = e.__grid;
          const t = e.__tile;
          if (t) g.drawImage(im, t.x, t.y, t.w, t.h, u * CELL, v * CELL, CELL, CELL);
          if (e.__identifier === 'Raiders') {
            g.fillStyle = '#fff';
            g.font = 'bold 9px sans-serif';
            g.fillText(String(e.fieldInstances[0].__value), u * CELL + 2, v * CELL + 9);
          }
        }
        // the wall's line and its gate
        const along = w - 4;
        const mid = Math.floor(h / 2);
        g.setLineDash([4, 3]);
        g.strokeStyle = '#ffd860';
        g.lineWidth = 2;
        g.strokeRect(along * CELL + 1, 1, CELL - 2, h * CELL - 2);
        g.setLineDash([]);
        g.strokeStyle = '#ffffff';
        g.strokeRect(along * CELL + 2, (mid - 1) * CELL + 2, CELL - 4, 2 * CELL - 4);
        out[lv.identifier] = c.toDataURL('image/png');
      }
      return out;
    },
    [project, atlas, CELL],
  );
  fs.mkdirSync(OUT, { recursive: true });
  for (const [id, png] of Object.entries(pngs)) {
    const f = path.join(OUT, `ldtk-${id.toLowerCase().replace(/_/g, '-')}.png`);
    fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`wrote ${path.relative(process.cwd(), f)}`);
  }
  await b.close();
})();
