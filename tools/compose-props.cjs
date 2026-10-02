// Builds the raid battle map's scenery atlases from Craftpix's top-down object packs in ../chronos-assets (a dev tool,
// run by hand: `node tools/compose-props.cjs`; it needs Playwright's Chromium). Each object is cut to what's drawn,
// shrunk to the map's scale (16 art px a cell; drawn at twice that, for the fine grid) and packed into one atlas per
// set (src/renderer/art/props/<set>.png, copied beside the page by the builds) with its frames in art/props.json, read by
// art/props.ts. The battle view scatters a set over the wild ground by the town's land.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets/assets');
const OUT = path.join(__dirname, '../src/renderer/art/props');
const FINE = 2;
const ATLAS_W = 1024;

const dirOf = (frag) => {
  const d = fs.readdirSync(ASSETS).find((x) => x.includes(frag));
  if (!d) throw new Error('no pack ' + frag);
  return path.join(ASSETS, d);
};
/** Files in a folder whose names match, each with its scale (art px per source px). */
function pick(dir, re, k, skip) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png') && re.test(f) && !(skip && skip.test(f)))
    .sort()
    .map((f) => [path.join(dir, f), k]);
}
const TREES = path.join(dirOf('free-tree-pixel-art'), 'PNG');
const BUSH = path.join(dirOf('free-bush-assets'), 'PNG');
const ROCK = path.join(dirOf('free-rocks-pixel-art'), 'PNG');
const ROCKY = path.join(dirOf('rocky-area-objects'), 'PNG/Objects_separately');
const FOREST = path.join(dirOf('forest-objects-top-down'), 'PNG/Assets_no_shadow');
const CAVE = path.join(dirOf('top-down-pixel-art-cave-objects'), 'PNG/Objects_separately');
const SEA = path.join(dirOf('top-down-seabed-objects'), 'PNG/Objects_separately');
const FIELDS = path.join(dirOf('fields-tileset-pixel-art-for-tower'), '2 Objects');
const bushes = fs.readdirSync(BUSH).flatMap((d) => pick(path.join(BUSH, d), /./, 0.17));
const fields = (d, re = /./) => pick(path.join(FIELDS, d), re, 0.5);

// (the small saplings at the start of each tree row are left out)
const SETS = {
  // fields and woods
  wild: [
    ...pick(TREES, /^middle_lane_tree([4-9]|1\d)\./, 0.17),
    ...pick(TREES, /^birch_([5-9]|1\d)\./, 0.17),
    ...pick(TREES, /^fir_tree_([5-9]|1\d)\./, 0.17),
    ...bushes,
    ...pick(path.join(ROCK, 'middle_lane_rocks1'), /./, 0.15),
    ...pick(path.join(ROCK, 'middle_lane_rocks2'), /./, 0.15),
    ...pick(FOREST, /mushroom|Chanterelles|Curved_tree|Willow/, 0.2),
    ...pick(ROCKY, /^(Oval_leaf_tree|Oval_rock\d_ground|Orange_mushrooms\d_ground|Rock_statue_(deer|fox)_ground)/, 0.2),
    ...fields('4 Stone'), ...fields('5 Grass'), ...fields('6 Flower'), ...fields('9 Bush'), ...fields('7 Decor', /^(Log|Tree|Dirt)/),
  ],
  // snow (the tundra, and winter anywhere)
  winter: [
    ...pick(TREES, /^winter_tree_([3-9]|1\d)\./, 0.17),
    ...pick(TREES, /^winter_conifer_tree_([4-9]|1\d)\./, 0.17),
    ...pick(path.join(ROCK, 'snowy_rocks1'), /./, 0.15),
    ...pick(path.join(ROCK, 'ice_rock'), /./, 0.15),
  ],
  // sand and stone
  desert: [
    ...pick(path.join(ROCK, 'desert_rocks'), /./, 0.15),
    ...pick(path.join(ROCK, 'canyon_rocks'), /./, 0.15),
    ...pick(ROCKY, /_ground_shadow\.png$/, 0.2, /Liana|Cave_entrance|Oval_rock|Orange/),
    ...pick(ROCKY, /^Fern_tree/, 0.2),
  ],
  // the coast: palms and ferns among the usual
  coast: [...pick(TREES, /^jungle_tree_([4-9]|1\d)\./, 0.17), ...pick(ROCKY, /^Fern_tree|^Oval_leaf_tree/, 0.2), ...bushes.slice(0, 12)],
  // the dwarves' rock
  cave: [
    ...pick(path.join(ROCK, 'cave_rocks'), /./, 0.15),
    ...pick(path.join(ROCK, 'stalagmites'), /./, 0.15),
    ...pick(path.join(CAVE, '32'), /light_shadow|vertical/, 0.22),
    ...pick(path.join(CAVE, '64'), /light_shadow|vertical/, 0.22),
    ...pick(path.join(CAVE, '128'), /light_shadow|cocoon|Dark_totem_dark_shadow2/, 0.22),
  ],
  // under the merfolk's water
  sea: pick(SEA, /shadow1\.png$/, 0.2, /Ship|Mermaid_house|Dragon_bones|Monster_fish/),
  // the fae's and druids' groves
  grove: [
    ...pick(FOREST, /Luminous|balls_tree|Swirling|White_tree|Tree_idol|Ent_|gazebo|Mega_tree/, 0.2),
    ...pick(FOREST, /mushroom|Chanterelles/, 0.2),
  ],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const manifest = {};
  for (const [set, list] of Object.entries(SETS)) {
    if (!list.length) throw new Error(set + ': empty');
    const items = list.map(([f, k]) => ({ src: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'), k: k * FINE }));
    const res = await page.evaluate(
      async ({ items, W }) => {
        const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
        const cut = [];
        for (const it of items) {
          const im = await load(it.src);
          const t = document.createElement('canvas');
          t.width = im.width; t.height = im.height;
          const g = t.getContext('2d', { willReadFrequently: true });
          g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, im.width, im.height).data;
          let x0 = im.width, y0 = im.height, x1 = -1, y1 = -1;
          for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          if (x1 < 0) continue;
          const w = Math.max(1, Math.round((x1 - x0 + 1) * it.k)), h = Math.max(1, Math.round((y1 - y0 + 1) * it.k));
          cut.push({ im, sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1, w, h });
        }
        // shelves, tallest first
        const order = cut.map((c, i) => i).sort((a, b) => cut[b].h - cut[a].h);
        let x = 0, y = 0, row = 0;
        const at = [];
        for (const i of order) {
          const c = cut[i];
          if (x + c.w > W) { x = 0; y += row + 1; row = 0; }
          at[i] = [x, y, c.w, c.h];
          x += c.w + 1;
          row = Math.max(row, c.h);
        }
        const c = document.createElement('canvas');
        c.width = W; c.height = y + row;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        cut.forEach((q, i) => g.drawImage(q.im, q.sx, q.sy, q.sw, q.sh, at[i][0], at[i][1], at[i][2], at[i][3]));
        return { url: c.toDataURL('image/png'), frames: at };
      },
      { items, W: ATLAS_W },
    );
    fs.writeFileSync(path.join(OUT, set + '.png'), Buffer.from(res.url.split(',')[1], 'base64'));
    manifest[set] = res.frames;
    console.log(set, res.frames.length, 'objects');
  }
  fs.writeFileSync(path.join(OUT, '../props.json'), JSON.stringify(manifest) + '\n');
  await browser.close();
})();
