// Cuts the pieces the ring wall's grates and the bridges are laid from (a dev tool, run by hand: `node
// tools/compose-walls.cjs`; it needs Playwright's Chromium and ../chronos-assets). No pack has a bridge that turns or a
// grate with its own corners in the game's sizes, so these are the packs' own pieces, cut out for the game to lay
// together by each cell's neighbours (src/renderer/art/autotile.ts):
// - src/renderer/art/packs/dl_grates.png: DawnLike's fence set (`Objects/Fence.png`), a 16px cell per piece in the
//   order of GRATE_COL in map/packBuildings.ts (the corner turning south and east, the run along a row, the corner
//   turning south and west, the T open south, the run down a column, the T open east, the crossing, the T open west,
//   the T open north, the corner turning north and east, the corner turning north and west), a row each for its
//   wooden, iron and pale runs.
// - src/renderer/art/roads/bridge_parts.png: Craftpix's Bridges pack (`PNG_n_Tiled/Bridges.png`), its wooden bridge
//   both ways and its ends: the bridge running north and south (32x32), the one running east and west (32x36), the
//   north-south bridge's north end and south end (32x12, 32x13), the east-west bridge's west and east ends (10x36
//   each). Their places on the sheet are BRIDGE_PARTS in art/bridgeTiles.ts.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const FENCE = path.join(ASSETS, 'DawnLike/Objects/Fence.png');
const BRIDGES = path.join(ASSETS, 'assets/craftpix-net-668008-free-bridges-top-down-pixel-art-asset-pack/PNG_n_Tiled/Bridges.png');
const GRATES_OUT = path.join(__dirname, '../src/renderer/art/packs/dl_grates.png');
const BRIDGE_OUT = path.join(__dirname, '../src/renderer/art/roads/bridge_parts.png');
// each piece's cell in a material's 3x3 block (column, row), the block's rows starting at 3 (wood), 6 (iron), 9 (pale)
const GRATE_CELLS = [[0, 0], [1, 0], [2, 0], [4, 0], [0, 1], [3, 1], [4, 1], [5, 1], [4, 2], [0, 2], [2, 2]];
const GRATE_ROWS = [3, 6, 9];
// [source x, y, w, h, sheet x, y]
const BRIDGE_CUTS = [
  [224, 362, 32, 32, 0, 0],
  [300, 356, 32, 36, 32, 0],
  [224, 324, 32, 12, 64, 0],
  [224, 448, 32, 13, 64, 12],
  [270, 356, 10, 36, 96, 0],
  [386, 356, 10, 36, 106, 0],
];

(async () => {
  const url = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const [grates, bridges] = await p.evaluate(
    async ([fence, bridgeSheet, cells, rows, cuts]) => {
      const load = async (src) => {
        const im = new Image();
        im.src = src;
        await im.decode();
        return im;
      };
      const f = await load(fence);
      const br = await load(bridgeSheet);
      const c = document.createElement('canvas');
      c.width = cells.length * 16;
      c.height = rows.length * 16;
      const g = c.getContext('2d');
      rows.forEach((r, j) => cells.forEach(([x, y], i) => g.drawImage(f, x * 16, (r + y) * 16, 16, 16, i * 16, j * 16, 16, 16)));
      const d = document.createElement('canvas');
      d.width = 116;
      d.height = 36;
      const h = d.getContext('2d');
      for (const [sx, sy, w, hh, x, y] of cuts) h.drawImage(br, sx, sy, w, hh, x, y, w, hh);
      return [c.toDataURL('image/png'), d.toDataURL('image/png')];
    },
    [url(FENCE), url(BRIDGES), GRATE_CELLS, GRATE_ROWS, BRIDGE_CUTS],
  );
  fs.writeFileSync(GRATES_OUT, Buffer.from(grates.split(',')[1], 'base64'));
  fs.writeFileSync(BRIDGE_OUT, Buffer.from(bridges.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote', GRATES_OUT, BRIDGE_OUT);
})();
