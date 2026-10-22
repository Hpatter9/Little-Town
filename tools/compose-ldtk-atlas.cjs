// Makes the tileset the hand-made raid boards are drawn with in the LDtk editor (a dev tool, run by hand: `node
// tools/compose-ldtk-atlas.cjs`; it needs Playwright's Chromium). LDtk lays square tiles on a grid, and the game's raid
// board is drawn from the isometric kits' diamond tiles (src/renderer/art/iso/kits), so each ground here is the middle
// of a kit tile's diamond cut square, and each prop the kit's own piece fitted into its cell. The game never loads this
// picture: it is only for the editor (maps/raid-boards.ldtk points at it by a relative path).
// - maps/raid-boards-tiles.png: 32px cells, 8 to a row, in the order of ATLAS below (the .ldtk's tile rectangles
//   follow it: change one, change the other, tools/ldtk-boards.ts `ATLAS_CELL`).

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const KITS = path.join(__dirname, '../src/renderer/art/iso/kits');
const OUT = path.join(__dirname, '../maps/raid-boards-tiles.png');
const CELL = 32;
const COLS = 8;
// each cell: a kit tile cut square ('tile'), a kit piece fitted in ('piece'), or a marker drawn here ('mark'); a tint
// multiplied over it
const ATLAS = [
  // row 0 and 1: the grounds, in the order of the Terrain layer's values (1..14)
  { tile: 'settlers/grass_tile' },
  { tile: 'settlers/dirt_tile' },
  { tile: 'settlers/field_tile' },
  { tile: 'druids/forest_floor_tile' },
  { tile: 'merfolk/sand_tile' },
  { tile: 'dwarves/flagstone_tile' },
  { tile: 'moonpack/snow_tile' },
  { tile: 'moonpack/snow_tile', tint: '#a8d4f4' },
  { tile: 'orcs/mud_tile' },
  { tile: 'merfolk/shallow_water_tile' },
  { tile: 'merfolk/shallow_water_tile', tint: '#3c64b4' },
  { tile: 'dwarves/rocky_tile', tint: '#8c8c8c' },
  { tile: 'settlers/cobble_tile' },
  { tile: 'settlers/dirt_tile', tint: '#c08850', planks: true },
  null,
  null,
  // row 2 and 3: the cover and the props, then the markers
  { piece: 'settlers/oak_tree' },
  { piece: 'settlers/bush' },
  { piece: 'moonpack/woodpile' },
  { piece: 'settlers/fence' },
  { piece: 'settlers/hay_bales' },
  { piece: 'settlers/rocks' },
  { piece: 'settlers/stone_wall_run' },
  { piece: 'settlers/cart' },
  { piece: 'settlers/barrels' },
  { piece: 'settlers/crates' },
  { piece: 'settlers/woodpile' },
  { piece: 'settlers/well' },
  { mark: 'front' },
  { mark: 'back' },
  { mark: 'entry' },
  null,
];

(async () => {
  const url = (id) => 'data:image/png;base64,' + fs.readFileSync(path.join(KITS, `${id}.png`)).toString('base64');
  const cells = ATLAS.map((c) => (c && (c.tile || c.piece) ? { ...c, src: url(c.tile || c.piece) } : c));
  const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const p = await b.newPage();
  const png = await p.evaluate(
    async ([cells, CELL, COLS]) => {
      const c = document.createElement('canvas');
      c.width = CELL * COLS;
      c.height = CELL * Math.ceil(cells.length / COLS);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell) continue;
        const x = (i % COLS) * CELL;
        const y = Math.floor(i / COLS) * CELL;
        if (cell.src) {
          const im = new Image();
          im.src = cell.src;
          await im.decode();
          const w = im.naturalWidth;
          const h = im.naturalHeight;
          if (cell.tile) {
            // (the diamond's middle: a square a third of the tile across, about a quarter of the way down)
            const side = Math.floor(w / 3);
            g.drawImage(im, Math.floor(w / 2 - side / 2), Math.floor(w / 4 - side / 2), side, side, x, y, CELL, CELL);
          } else {
            const k = Math.min(CELL / w, CELL / h);
            g.drawImage(im, 0, 0, w, h, x + (CELL - w * k) / 2, y + CELL - h * k, w * k, h * k);
          }
          if (cell.tint) {
            g.save();
            g.beginPath();
            g.rect(x, y, CELL, CELL);
            g.clip();
            g.globalCompositeOperation = 'multiply';
            g.fillStyle = cell.tint;
            g.fillRect(x, y, CELL, CELL);
            g.globalCompositeOperation = 'destination-in';
            g.drawImage(c, x, y, CELL, CELL, x, y, CELL, CELL);
            g.restore();
          }
          if (cell.planks) {
            g.fillStyle = 'rgba(60,34,16,0.55)';
            for (let k = 3; k < CELL; k += 8) g.fillRect(x, y + k, CELL, 1);
            for (let k = 0; k < 4; k++) g.fillRect(x + ((k * 13) % CELL), y + k * 8 + 3, 1, 8);
          }
        } else if (cell.mark) {
          // (the markers: the town's front line a blue shield, its back line a pale one, a raiders' way in a red arrow)
          g.lineWidth = 2;
          if (cell.mark === 'entry') {
            g.fillStyle = '#c83c32';
            g.beginPath();
            g.moveTo(x + 4, y + 10);
            g.lineTo(x + 18, y + 10);
            g.lineTo(x + 18, y + 4);
            g.lineTo(x + 29, y + 16);
            g.lineTo(x + 18, y + 28);
            g.lineTo(x + 18, y + 22);
            g.lineTo(x + 4, y + 22);
            g.closePath();
            g.fill();
            g.strokeStyle = '#3a0c08';
            g.stroke();
          } else {
            g.fillStyle = cell.mark === 'front' ? '#2f6fd0' : '#9cc4f0';
            g.beginPath();
            g.moveTo(x + 6, y + 5);
            g.lineTo(x + 26, y + 5);
            g.lineTo(x + 26, y + 16);
            g.quadraticCurveTo(x + 26, y + 25, x + 16, y + 29);
            g.quadraticCurveTo(x + 6, y + 25, x + 6, y + 16);
            g.closePath();
            g.fill();
            g.strokeStyle = '#0c1c3a';
            g.stroke();
            g.fillStyle = '#ffffff';
            g.font = 'bold 13px sans-serif';
            g.textAlign = 'center';
            g.fillText(cell.mark === 'front' ? 'F' : 'B', x + 16, y + 21);
          }
        }
      }
      return c.toDataURL('image/png');
    },
    [cells, CELL, COLS],
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  await b.close();
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
})();
